// Find the exact frame where a phrase is spoken ("when I say X" -> frame number).
//
// Usage:
//   npm run words -- <video-id|take> "gone viral"     search an auto-edit (output frames) or a take (source frames)
//   npm run words -- my-reel --list 0-300            print words with frames in a frame range
//
// Matching ignores case and punctuation; multi-word phrases must be consecutive.

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, FPS, msToFrame, frameToTc, resolveRecording, wordsPath, readJson, compId } from './lib/media.mjs';

const [target, phrase, range] = process.argv.slice(2);
if (!target || !phrase) {
  console.error('Usage: npm run words -- <video-id|take> "<phrase>"   |   npm run words -- <video-id|take> --list <from>-<to>');
  process.exit(1);
}
const editWords = path.join(ROOT, 'src', 'videos', compId(target), 'words.json');
let words, timeline;
if (fs.existsSync(editWords)) {
  words = readJson(editWords, []);
  timeline = `output timeline of composition "${compId(target)}"`;
} else {
  words = readJson(wordsPath(resolveRecording(target)), []);
  timeline = `source timeline of take "${target}"`;
}
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9']/g, '');

if (phrase === '--list') {
  const [a, b] = (range ?? `0-${Number.MAX_SAFE_INTEGER}`).split('-').map(Number);
  for (const w of words) {
    const f = msToFrame(w.startMs);
    if (f >= a && f <= b) console.log(`f${f} ${frameToTc(f)} ${w.text}`);
  }
  process.exit(0);
}

const q = phrase.split(/\s+/).map(norm).filter(Boolean);
const hits = [];
for (let i = 0; i + q.length <= words.length; i++) {
  if (q.every((t, k) => norm(words[i + k].text) === t)) {
    const first = words[i], last = words[i + q.length - 1];
    hits.push({ i, startFrame: msToFrame(first.startMs), endFrame: msToFrame(last.endMs), context: words.slice(Math.max(0, i - 4), i + q.length + 4).map((w) => w.text).join(' ') });
  }
}
console.log(`"${phrase}" in ${timeline} (${FPS} fps):`);
if (!hits.length) console.log('  no exact match. Try fewer words, or: npm run words -- <id> --list <from>-<to>');
for (const h of hits) console.log(`  word #${h.i}: f${h.startFrame}-f${h.endFrame} (${frameToTc(h.startFrame)})  ...${h.context}...`);
