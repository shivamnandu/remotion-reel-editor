// Visual check of a frame range in ONE render (the skill's rule: never a stack of stills),
// assembled into a single contact sheet image to look at.
//
// Usage:
//   npm run check -- <composition> <from>-<to> [--every N] [--scale 0.25]
//   npm run check -- my-reel 0-299 --every 30
//
// Output: analysis/check/<composition>-<from>-<to>.jpg (frames labelled in order, left->right, top->bottom)
// The frame numbers in the sheet are printed to the console.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, rel, remotion, concurrency } from './lib/media.mjs';

const argv = process.argv.slice(2);
const [comp, range] = argv;
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
if (!comp || !/^\d+-\d+$/.test(range ?? '')) {
  console.error('Usage: npm run check -- <composition> <from>-<to> [--every N] [--scale 0.25]');
  process.exit(1);
}
const [from, to] = range.split('-').map(Number);
const every = Math.max(1, Number(opt('every', Math.max(1, Math.round((to - from + 1) / 12)))));
const scale = opt('scale', '0.25');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'check-'));
try {
  // --every-nth-frame renders only the sampled frames (much faster for sparse checks).
  remotion(['render', 'src/index.ts', comp, tmp, '--sequence', `--frames=${from}-${to}`, `--every-nth-frame=${every}`, `--scale=${scale}`, `--concurrency=${concurrency()}`, '--log=error']);
  // Frame files are element-<n>.jpeg without padding past the range width (skill gotcha 13): sort numerically.
  const files = fs.readdirSync(tmp).filter((f) => /\d+\.(jpe?g|png)$/.test(f))
    .map((f) => ({ f, n: Number(f.match(/(\d+)\.(jpe?g|png)$/)[1]) }))
    .sort((a, b) => a.n - b.n)
    // With --every-nth-frame Remotion numbers output files 0..N-1; map back to real frames.
    .map((x, i, all) => ({ ...x, n: all.length === Math.floor((to - from) / every) + 1 && every > 1 ? from + i * every : x.n }));
  if (!files.length) throw new Error('No frames rendered.');
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, files.map((x) => `file '${path.join(tmp, x.f).replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
  const cols = Math.min(6, files.length);
  const rows = Math.ceil(files.length / cols);
  const outDir = path.join(ROOT, 'analysis', 'check');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${comp}-${from}-${to}.jpg`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `scale=270:-2,tile=${cols}x${rows}:padding=4:color=gray`, '-frames:v', '1', '-q:v', '4', out]);
  console.log(`Contact sheet: ${rel(out)}`);
  console.log(`Frames (in order): ${files.map((x) => x.n).join(', ')}`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
