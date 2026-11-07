// Deterministic rough cut: dead air removed, captions chunked, ready to render. No AI needed.
//
// Usage:
//   npm run auto-edit -- <video-id> <take> [<take> ...] [options]
//   npm run auto-edit -- my-reel take1 take2 --gap 0.1 --pad 0.06 --caption-y 1380
//
// Options:
//   --gap <s>         cut silences longer than this (default 0.1, the guide's rule)
//   --pad <s>         breathing room kept on each side of a cut (default 0.06)
//   --caption-y <px>  caption baseline (default 1380; measure per take from analysis grid.jpg)
//   --no-captions     leave captions out
//   --plain           plain white captions instead of the outlined TikTok style
//   --zoom <scale>    punch in on every other jump cut, e.g. 1.08 (best with 4K footage)
//   --music "<public path>" --music-db <dB under voice, default 17>
//
// Takes must be ingested first (npm run ingest). Writes src/videos/<id>/edit.json and
// regenerates src/videos/registry.ts so the composition <id> appears in Remotion Studio.

import fs from 'node:fs';
import path from 'node:path';
import { writeRegistry } from './lib/registry.mjs';
import { ROOT, FPS, WIDTH, HEIGHT, resolveRecording, wordsPath, analysisPath, readJson, writeJson, compId, msToFrame, frameToTc, runStderr } from './lib/media.mjs';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const has = (n) => argv.includes(`--${n}`);
const valueFlags = new Set(['--gap', '--pad', '--caption-y', '--zoom', '--music', '--music-db']);
const positional = argv.filter((a, i) => !a.startsWith('--') && !valueFlags.has(argv[i - 1]));
const [idArg, ...takeArgs] = positional;
if (!idArg || !takeArgs.length) {
  console.error('Usage: npm run auto-edit -- <video-id> <take> [<take> ...] [--gap 0.1] [--pad 0.06] [--caption-y 1380] [--zoom 1.08] [--music "<path>"]');
  process.exit(1);
}
const id = compId(idArg);
const gapMs = Number(opt('gap', 0.1)) * 1000;
const padMs = Number(opt('pad', 0.06)) * 1000;
const captionY = Number(opt('caption-y', 1380));

// Casual lowercase captions with a small keep-dictionary (skill captions.md).
const KEEP = { i: 'I', "i'm": "I'm", "i'll": "I'll", "i've": "I've", "i'd": "I'd", ai: 'AI', claude: 'Claude', ok: 'OK', youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', chatgpt: 'ChatGPT' };
// Proper nouns keep their capitals: whisper capitalises names mid-sentence, so a capitalised
// word that does not start a sentence is kept as-is. Sentence-initial words are lowercased
// unless they are in KEEP or fully uppercase (acronyms like "NASA").
const casual = (t, sentenceStart) => {
  const core = t.replace(/[,.?!:;"]+$/, '');
  const tail = t.slice(core.length);
  const kept = KEEP[core.toLowerCase()];
  if (kept) return kept + tail;
  if (core.length > 1 && core === core.toUpperCase() && /[A-Z]/.test(core)) return core + tail;
  if (!sentenceStart && /^[A-Z]/.test(core)) return core + tail;
  return core.toLowerCase() + tail;
};

const clips = [];
const outWords = [];
let outFrame = 0;
const report = [];

for (const takeArg of takeArgs) {
  const file = resolveRecording(takeArg);
  const analysis = readJson(analysisPath(file), null);
  if (!analysis) throw new Error(`${takeArg} is not ingested. Run: npm run ingest -- ${takeArg}`);
  const words = readJson(wordsPath(file), []).filter((w) => /[a-z0-9]/i.test(w.text));
  const totalMs = Math.round(analysis.probe.durationS * 1000);

  // Keep = everything except silences longer than the gap (minus padding), and trim
  // lead-in / tail outside the first and last word.
  const cuts = analysis.silences
    .map((s) => ({ startMs: s.startMs + padMs, endMs: s.endMs - padMs }))
    .filter((s) => s.endMs - s.startMs >= Math.max(gapMs - 2 * padMs, (2 / FPS) * 1000));
  const headEnd = words.length ? Math.max(0, words[0].startMs - padMs * 2) : 0;
  const tailStart = words.length ? Math.min(totalMs, words.at(-1).endMs + padMs * 3) : totalMs;
  const keep = [];
  let cursor = headEnd;
  for (const c of cuts) {
    if (c.endMs <= cursor) continue;
    if (c.startMs >= tailStart) break;
    if (c.startMs > cursor) keep.push([cursor, c.startMs]);
    cursor = Math.max(cursor, c.endMs);
  }
  if (cursor < tailStart) keep.push([cursor, tailStart]);

  const src = analysis.staticFile;
  let keptFrames = 0;
  for (const [a, b] of keep) {
    const fromFrame = msToFrame(a);
    const toFrame = Math.min(analysis.frames, msToFrame(b));
    if (toFrame - fromFrame < 3) continue;
    const clip = { src, fromFrame, toFrame, outFrom: outFrame };
    clips.push(clip);
    // Map the words inside this clip onto the output timeline.
    for (const w of words) {
      const wf = msToFrame(w.startMs);
      if (wf >= fromFrame && wf < toFrame) {
        const shiftMs = ((outFrame - fromFrame) / FPS) * 1000;
        outWords.push({ text: w.text, startMs: Math.round(w.startMs + shiftMs), endMs: Math.round(Math.min(w.endMs, (toFrame / FPS) * 1000) + shiftMs), take: path.basename(file), srcStartMs: w.startMs });
      }
    }
    outFrame += toFrame - fromFrame;
    keptFrames += toFrame - fromFrame;
  }
  report.push(`${path.basename(file)}: ${analysis.frames} -> ${keptFrames} frames (${Math.round((1 - keptFrames / analysis.frames) * 100)}% removed, ${keep.length} segments)`);
}

// Caption chunks (skill captions.md): 1-3 words, <= 17 chars, flush on sentence end,
// line runs first start -> min(last end, last start + 550ms) + 3 frames.
const chunks = [];
let cur = [];
const flush = () => {
  if (!cur.length) return;
  const last = cur.at(-1);
  chunks.push({
    from: msToFrame(cur[0].startMs),
    to: msToFrame(Math.min(last.endMs, last.startMs + 550)) + 3,
    text: cur.map((w) => casual(w.text, w.sentenceStart)).join(' ').replace(/[.,;:]+$/, ''),
  });
  cur = [];
};
outWords.forEach((w, i) => { w.sentenceStart = i === 0 || /[.?!]$/.test(outWords[i - 1].text); });
for (const w of outWords) {
  const candidate = [...cur, w].map((x) => x.text).join(' ');
  if (cur.length >= 3 || (cur.length > 0 && candidate.length > 17)) flush();
  cur.push(w);
  if (/[.?!]$/.test(w.text)) flush();
}
flush();

const edit = {
  id,
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
  durationInFrames: Math.max(1, outFrame),
  clips,
  ...(has('no-captions') ? {} : { captions: { y: captionY, outlined: !has('plain'), chunks } }),
  ...(opt('zoom') ? { zoomOnCuts: Number(opt('zoom')) } : {}),
};

const musicArg = opt('music');
if (musicArg) {
  // Bed level: N dB under the voice, measured (skill audio.md: 15-18 dB under).
  const musicFile = path.resolve(ROOT, 'public', musicArg.replace(/^public[\\/]/, ''));
  if (!fs.existsSync(musicFile)) throw new Error(`Music not found in public/: ${musicArg} (copy it in with npm run use)`);
  const meanDb = (f) => Number(runStderr('ffmpeg', ['-v', 'info', '-i', f, '-vn', '-af', 'volumedetect', '-f', 'null', '-']).match(/mean_volume:\s*(-?[\d.]+) dB/)?.[1] ?? -20);
  const voiceDb = readJson(analysisPath(resolveRecording(takeArgs[0])), {}).audio?.meanDb ?? -20;
  const target = voiceDb - Number(opt('music-db', 17));
  edit.music = {
    src: path.relative(path.join(ROOT, 'public'), musicFile).split(path.sep).join('/'),
    gain: Number(Math.min(1, Math.pow(10, (target - meanDb(musicFile)) / 20)).toFixed(3)),
    trimBefore: 0,
  };
}

const dir = path.join(ROOT, 'src', 'videos', id);
writeJson(path.join(dir, 'edit.json'), edit);
writeJson(path.join(dir, 'words.json'), outWords);

writeRegistry();

console.log(report.join('\n'));
console.log(`Composition "${id}": ${edit.durationInFrames} frames (${frameToTc(edit.durationInFrames)}), ${clips.length} clips, ${chunks.length} caption chunks${edit.music ? `, music gain ${edit.music.gain}` : ''}`);
console.log(`Files: src/videos/${id}/edit.json, src/videos/${id}/words.json (output-timeline words for "when I say X")`);
console.log(`Next: npm run check -- ${id} 0-${Math.min(edit.durationInFrames - 1, 299)}   then   npm run render -- ${id}`);
