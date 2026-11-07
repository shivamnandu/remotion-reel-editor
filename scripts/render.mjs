// Final render with the skill's settings, then verify the output.
//
// Usage:
//   npm run render -- <composition> [--frames A-B] [--crf 17] [--name file]
//   npm run render -- my-reel                 -> out/my-reel.mp4
//   npm run render -- my-reel --frames 300-420 -> out/my-reel_300-420.mp4 (one beat, to judge a note)
//
// After rendering it checks the frame count, duration and audio level, and scans for
// glitch frames (single-frame flashes) so problems are caught before anyone watches it.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, FPS, rel, probe, frameCount, remotion, concurrency } from './lib/media.mjs';

const argv = process.argv.slice(2);
const comp = argv[0];
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
if (!comp || comp.startsWith('--')) {
  console.error('Usage: npm run render -- <composition> [--frames A-B] [--crf 17] [--name file]');
  process.exit(1);
}
const frames = opt('frames');
const name = opt('name', frames ? `${comp}_${frames}` : comp);
const out = path.join(ROOT, 'out', `${name}.mp4`);
fs.mkdirSync(path.dirname(out), { recursive: true });
const t0 = Date.now();
remotion(['render', 'src/index.ts', comp, out, '--codec=h264', `--crf=${opt('crf', '17')}`, `--concurrency=${concurrency()}`, '--log=error', ...(frames ? [`--frames=${frames}`] : [])]);
const secs = ((Date.now() - t0) / 1000).toFixed(0);

const p = probe(out);
const n = frameCount(out);
const vol = spawnSync('ffmpeg', ['-v', 'info', '-i', out, '-vn', '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr ?? '';
const mean = vol.match(/mean_volume:\s*(-?[\d.]+) dB/)?.[1];
const max = vol.match(/max_volume:\s*(-?[\d.]+) dB/)?.[1];

// Glitch scan: frames that differ sharply from both neighbours (one-frame flash).
const sc = spawnSync('ffmpeg', ['-v', 'info', '-i', out, '-an', '-vf', 'scale=270:-2,select=gt(scene\\,0.4),metadata=print', '-f', 'null', '-'], { encoding: 'utf8' }).stderr ?? '';
const spikes = [...sc.matchAll(/pts_time:([\d.]+)/g)].map((m) => Math.round(Number(m[1]) * FPS));
const flashes = spikes.filter((f, i) => spikes.includes(f + 1) || spikes[i + 1] === f + 1);

// Expected frame count from the composition's edit.json when this is an auto-edit.
const editFile = path.join(ROOT, 'src', 'videos', comp, 'edit.json');
let expected = null;
if (fs.existsSync(editFile)) {
  const total = JSON.parse(fs.readFileSync(editFile, 'utf8')).durationInFrames;
  expected = frames ? Number(frames.split('-')[1]) - Number(frames.split('-')[0]) + 1 : total;
}
const countNote = expected === null ? '' : n === expected ? ' (matches composition)' : `  WARNING: expected ${expected}`;
console.log(`\nRendered ${rel(out)} in ${secs}s: ${p.width}x${p.height} ${p.fps}fps, ${n} frames${countNote} (${p.durationS.toFixed(2)}s), ${(fs.statSync(out).size / 1048576).toFixed(1)} MB`);
console.log(`Audio: mean ${mean ?? '?'} dB, peak ${max ?? '?'} dB${Number(max) >= -0.1 ? '  WARNING: clipping' : ''}`);
// Integrated loudness (EBU R128). Instagram/TikTok/YouTube play back around -14 LUFS.
const ebu = spawnSync('ffmpeg', ['-v', 'info', '-i', out, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr ?? '';
const lufs = Number(ebu.match(/I:\s*(-?[\d.]+) LUFS(?![\s\S]*I:\s*-?[\d.]+ LUFS)/)?.[1]);
const truePeak = Number(ebu.match(/Peak:\s*(-?[\d.]+) dBFS(?![\s\S]*Peak:)/)?.[1]);
console.log(`Loudness: ${lufs} LUFS integrated, true peak ${truePeak} dBFS (social target about -14 LUFS, peak <= -1)`);
if (argv.includes('--master')) {
  // Two-pass loudnorm on the final mix only; video stream is copied untouched.
  // TP=-2 + a final limiter: loudnorm's linear mode can overshoot by ~0.2 dB (measured -0.8 dBTP at TP=-1).
  const m = spawnSync('ffmpeg', ['-v', 'info', '-i', out, '-vn', '-af', 'loudnorm=I=-14:TP=-2:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' }).stderr ?? '';
  const j = JSON.parse(m.slice(m.lastIndexOf('{'), m.lastIndexOf('}') + 1));
  const mastered = out.replace(/\.mp4$/, '.master.mp4');
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', out, '-c:v', 'copy', '-af', `loudnorm=I=-14:TP=-2:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true,alimiter=limit=0.82:level=false`, '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', mastered], { stdio: 'inherit' });
  console.log(`Mastered copy (-14 LUFS, -1 dBTP): ${rel(mastered)}`);
}
console.log(flashes.length ? `Possible one-frame flashes at frames: ${[...new Set(flashes)].join(', ')} (inspect with npm run check)` : 'Glitch scan: no one-frame flashes found');
