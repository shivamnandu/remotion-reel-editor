// Ingest raw takes in one command: normalise, transcribe, measure. No AI needed.
//
// Usage:
//   npm run ingest                    every new take in public/recordings/
//   npm run ingest -- take1 take2     specific takes (name, file name or path)
//   npm run ingest -- --force take1   redo analysis (never re-transcribes an unchanged file)
//   npm run ingest -- --fast ...      faster x264 preset for big 4K files (slightly larger output)
//
// Per take it:
//   1. Probes the file. If it is .mov / HEVC / not 30 fps / HDR / rotated, transcodes to H.264
//      yuv420p 30 fps mp4 (the remotion-reel skill's ingest rule; HDR is tone-mapped to SDR) and
//      moves the original to assets/originals/ (outside public/ so renders stay fast).
//   2. Confirms the frame count survived.
//   3. Transcribes to <name>.words.json if missing (whisper.cpp, word level).
//   4. Measures: scene cuts (threshold 0.05, as the skill says), silences, dead air, speaking rate.
//   5. Writes <name>.analysis.json next to the take, and analysis/<name>/contact.jpg (12 frames)
//      and analysis/<name>/grid.jpg (mid frame with the skill's measuring grid, reel coordinates).

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT, RECORDINGS, FPS, WIDTH, HEIGHT, probe, frameCount, run, runStderr, tmpDir, resolveRecording,
  baseOf, wordsPath, analysisPath, readJson, writeJson, rel, msToFrame,
} from './lib/media.mjs';

const args = process.argv.slice(2);
const force = args.includes('--force');
const fast = args.includes('--fast');
const names = args.filter((a) => !a.startsWith('--'));
const VIDEO = /\.(mp4|mov|m4v|mkv|webm|avi)$/i;

const ORIGINALS = path.join(ROOT, 'assets', 'originals');
const ANALYSIS_DIR = path.join(ROOT, 'analysis');

let inputs = names.length
  ? names.map(resolveRecording)
  : fs.readdirSync(RECORDINGS).filter((f) => VIDEO.test(f)).map((f) => path.join(RECORDINGS, f));
// A .mov whose .mp4 sibling already exists was ingested before.
inputs = inputs.filter((f) => !(path.extname(f).toLowerCase() !== '.mp4' && fs.existsSync(path.join(path.dirname(f), `${baseOf(f)}.mp4`))));
if (!inputs.length) {
  console.log('No takes found in public/recordings/. Drop your clips there first.');
  process.exit(0);
}

const HDR = new Set(['smpte2084', 'arib-std-b67']);

function needsTranscode(p, file) {
  const reasons = [];
  if (path.extname(file).toLowerCase() !== '.mp4') reasons.push(`container ${p.container}`);
  if (p.vcodec !== 'h264') reasons.push(`codec ${p.vcodec}`);
  if (Math.abs(p.fps - FPS) > 0.01) reasons.push(`${p.fps.toFixed(2)} fps`);
  if (p.pixFmt !== 'yuv420p') reasons.push(`pix_fmt ${p.pixFmt}`);
  if (HDR.has(p.colorTransfer)) reasons.push('HDR');
  if (p.rotation) reasons.push(`rotation ${p.rotation}`);
  if (p.hasAudio && p.acodec !== 'aac') reasons.push(`audio ${p.acodec}`);
  return reasons;
}

function transcode(file, p) {
  const out = path.join(path.dirname(file), `${baseOf(file)}.ingest-tmp.mp4`);
  const vf = [];
  if (HDR.has(p.colorTransfer)) {
    vf.push('zscale=t=linear:npl=100', 'format=gbrpf32le', 'zscale=p=bt709', 'tonemap=tonemap=hable:desat=0', 'zscale=t=bt709:m=bt709:r=tv');
  }
  vf.push('format=yuv420p');
  const argsFor = (filters) => [
    '-v', 'error', '-y', '-i', file, '-vf', filters.join(','),
    '-c:v', 'libx264', '-preset', fast ? 'veryfast' : 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out,
  ];
  try {
    execFileSync('ffmpeg', argsFor(vf), { stdio: 'inherit' });
  } catch (e) {
    if (!HDR.has(p.colorTransfer)) throw e;
    console.log('  zscale tone-mapping unavailable; retrying with a simple HDR->SDR conversion');
    execFileSync('ffmpeg', argsFor(['colorspace=all=bt709:iall=bt2020:fast=1', 'format=yuv420p']), { stdio: 'inherit' });
  }
  fs.mkdirSync(ORIGINALS, { recursive: true });
  const original = path.join(ORIGINALS, path.basename(file));
  fs.renameSync(file, fs.existsSync(original) ? `${original}.${Date.now()}` : original);
  const final = path.join(path.dirname(file), `${baseOf(file)}.mp4`);
  fs.renameSync(out, final);
  return final;
}

function sceneCuts(file) {
  const err = runStderr('ffmpeg', ['-v', 'info', '-i', file, '-an', '-vf', "scale=320:-2,select='gt(scene,0.05)',metadata=print", '-f', 'null', '-']);
  const cuts = [];
  let t = null;
  for (const line of err.split('\n')) {
    const pt = line.match(/pts_time:([\d.]+)/);
    if (pt) t = Number(pt[1]);
    const sc = line.match(/lavfi\.scene_score=([\d.]+)/);
    if (sc && t !== null) { cuts.push({ frame: Math.round(t * FPS), timeS: Math.round(t * 1000) / 1000, score: Number(Number(sc[1]).toFixed(3)) }); t = null; }
  }
  return cuts;
}

function meanVolume(file) {
  const err = runStderr('ffmpeg', ['-v', 'info', '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-']);
  return Number(err.match(/mean_volume:\s*(-?[\d.]+) dB/)?.[1] ?? -25);
}

function silences(file, noiseDb) {
  const err = runStderr('ffmpeg', ['-v', 'info', '-i', file, '-vn', '-af', `silencedetect=noise=${noiseDb}dB:d=0.1`, '-f', 'null', '-']);
  const out = [];
  let start = null;
  for (const line of err.split('\n')) {
    const s = line.match(/silence_start:\s*(-?[\d.]+)/);
    if (s) start = Math.max(0, Number(s[1]));
    const e = line.match(/silence_end:\s*([\d.]+)/);
    if (e && start !== null) { out.push({ startMs: Math.round(start * 1000), endMs: Math.round(Number(e[1]) * 1000) }); start = null; }
  }
  return out;
}

function images(file, name, totalFrames) {
  const dir = path.join(ANALYSIS_DIR, name);
  fs.mkdirSync(dir, { recursive: true });
  const picks = Array.from({ length: 12 }, (_, i) => Math.min(totalFrames - 1, Math.round(((i + 0.5) / 12) * totalFrames)));
  const sel = picks.map((n) => `eq(n\\,${n})`).join('+');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-vf', `select='${sel}',scale=180:320:force_original_aspect_ratio=decrease,pad=180:320:(ow-iw)/2:(oh-ih)/2,tile=6x2`, '-frames:v', '1', '-q:v', '4', path.join(dir, 'contact.jpg')]);
  const mid = Math.round(totalFrames / 2);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-vf', `select=eq(n\\,${mid}),scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},drawgrid=w=108:h=96:t=2:c=red@0.5,drawgrid=w=540:h=480:t=4:c=yellow@0.9`, '-frames:v', '1', '-q:v', '5', path.join(dir, 'grid.jpg')]);
  return { contactSheet: rel(path.join(dir, 'contact.jpg')), contactFrames: picks, grid: rel(path.join(dir, 'grid.jpg')), gridFrame: mid };
}

for (let file of inputs) {
  const name = baseOf(file);
  console.log(`\n== ${name}`);
  let p = probe(file);
  const reasons = needsTranscode(p, file);
  if (reasons.length) {
    console.log(`  transcoding (${reasons.join(', ')}) ...`);
    file = transcode(file, p);
    p = probe(file);
  }
  const frames = frameCount(file);
  const expected = Math.round(p.durationS * FPS);
  const framesOk = Math.abs(frames - expected) <= 2;
  console.log(`  ${p.width}x${p.height} ${p.fps.toFixed(2)}fps ${p.durationS.toFixed(2)}s, ${frames} frames ${framesOk ? 'OK' : `(expected ~${expected})`}`);

  const wp = wordsPath(file);
  if (!fs.existsSync(wp) && p.hasAudio) {
    console.log('  transcribing ...');
    try {
      execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'transcribe.mjs'), file, wp], { stdio: 'pipe' });
    } catch (e) {
      console.error(`  transcription failed:\n${String(e.stdout ?? '')}${String(e.stderr ?? '').split('\n').slice(-8).join('\n')}`);
      process.exitCode = 1;
      continue;
    }
  }
  const ap = analysisPath(file);
  const stat = fs.statSync(file);
  const prev = readJson(ap, null);
  if (prev && !force && prev.bytes === stat.size) { console.log(`  analysis up to date: ${rel(ap)}`); continue; }

  const words = readJson(wp, []).filter((w) => /[a-z0-9]/i.test(w.text)); // skill gotcha 4: drop punctuation-only words
  const mean = p.hasAudio ? meanVolume(file) : -90;
  const noise = Math.max(-55, Math.min(-25, Math.round(mean - 18)));
  const sil = p.hasAudio ? silences(file, noise) : [];
  const cuts = sceneCuts(file);
  const img = images(file, name, frames);
  const totalMs = Math.round(p.durationS * 1000);
  const silMs = sil.reduce((a, s) => a + (s.endMs - s.startMs), 0);
  const gaps = [];
  for (let i = 1; i < words.length; i++) {
    const g = words[i].startMs - words[i - 1].endMs;
    if (g >= 300) gaps.push({ afterWord: i - 1, startMs: words[i - 1].endMs, endMs: words[i].startMs, ms: g });
  }
  const analysis = {
    file: rel(file),
    staticFile: path.relative(path.join(ROOT, 'public'), file).split(path.sep).join('/'),
    bytes: stat.size,
    probe: p,
    frames,
    framesOk,
    audio: { meanDb: mean, silenceThresholdDb: noise },
    speech: {
      words: words.length,
      wordsPerMin: words.length && totalMs ? Math.round(words.length / (totalMs / 60000)) : 0,
      firstWordMs: words[0]?.startMs ?? null,
      lastWordMs: words.at(-1)?.endMs ?? null,
      silenceMs: silMs,
      deadAirPct: totalMs ? Math.round((silMs / totalMs) * 100) : 0,
    },
    cuts,
    silences: sil.map((s) => ({ ...s, fromFrame: msToFrame(s.startMs), toFrame: msToFrame(s.endMs) })),
    longGaps: gaps,
    images: img,
    notes: [
      'Framing numbers (eye line, chin, mic top, hair top) must be read off images.grid per take; never reuse from another take.',
      'Instagram 4:5 safe band is roughly y285-y1635 of 1920.',
    ],
  };
  writeJson(ap, analysis);
  console.log(`  ${words.length} words (${analysis.speech.wordsPerMin} wpm), ${cuts.length} cut candidates, ${sil.length} silences (${analysis.speech.deadAirPct}% dead air)`);
  console.log(`  -> ${rel(ap)}, ${img.contactSheet}, ${img.grid}`);
}
