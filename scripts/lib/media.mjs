// Shared helpers for the pipeline scripts: paths, ffmpeg/ffprobe wrappers, transcript I/O.
// All external tools are called with argument arrays (no shell), so paths with spaces are safe.

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PUBLIC = path.join(ROOT, 'public');
export const RECORDINGS = path.join(PUBLIC, 'recordings');
export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const isWin = process.platform === 'win32';

export const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
export const publicRel = (p) => path.relative(PUBLIC, p).split(path.sep).join('/');
export const msToFrame = (ms) => Math.round((ms / 1000) * FPS);
export const frameToTc = (f) => {
  const s = f / FPS;
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(2).padStart(5, '0')}`;
};

/**
 * Safe render concurrency for this machine: half the logical cores, capped by free RAM
 * (~1.2 GB per Chrome tab decoding video). 8 tabs on 12 GB crashed ("Target closed");
 * 2 and 4 rendered at the same speed, so more is not faster here.
 */
export function concurrency() {
  const freeGb = os.freemem() / 1024 ** 3;
  return Math.max(1, Math.min(Math.floor(os.cpus().length / 2), Math.floor(freeGb / 1.2)));
}

/** Run the Remotion CLI via node directly (no shell: works with spaces in the project path). */
export function remotion(args, opts = {}) {
  return execFileSync(process.execPath, [path.join(ROOT, 'node_modules', '@remotion', 'cli', 'remotion-cli.js'), ...args], { cwd: ROOT, stdio: 'inherit', ...opts });
}

export function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 256, ...opts });
}

/** Run and return combined stderr (ffmpeg writes analysis output there). */
export function runStderr(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 256 });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${(r.stderr || '').split('\n').slice(-3).join(' ')}`);
  return r.stderr || '';
}

export function probe(file) {
  const j = JSON.parse(run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]));
  const v = j.streams.find((s) => s.codec_type === 'video');
  const a = j.streams.find((s) => s.codec_type === 'audio');
  const rate = v?.avg_frame_rate?.split('/').map(Number);
  const rotation = Number(v?.tags?.rotate ?? v?.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? 0);
  let width = v?.width, height = v?.height;
  if (Math.abs(rotation) === 90 || Math.abs(rotation) === 270) [width, height] = [height, width];
  return {
    durationS: Number(j.format.duration),
    container: path.extname(file).toLowerCase(),
    vcodec: v?.codec_name,
    pixFmt: v?.pix_fmt,
    colorTransfer: v?.color_transfer,
    fps: rate && rate[1] ? rate[0] / rate[1] : 0,
    width,
    height,
    rotation,
    acodec: a?.codec_name,
    hasAudio: !!a,
  };
}

export function frameCount(file) {
  const out = run('ffprobe', ['-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', file]);
  return parseInt(out.trim(), 10); // output can carry a trailing comma ("657,")
}

export function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Resolve a recording by name ("take1"), file name, or path. */
export function resolveRecording(arg) {
  const candidates = [arg, path.join(RECORDINGS, arg), path.join(RECORDINGS, `${arg}.mp4`), path.join(PUBLIC, arg)];
  const hit = candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
  if (!hit) throw new Error(`Recording not found: ${arg} (looked in public/recordings/)`);
  return path.resolve(hit);
}

export const baseOf = (file) => path.basename(file, path.extname(file));
export const wordsPath = (mp4) => path.join(path.dirname(mp4), `${baseOf(mp4)}.words.json`);
export const analysisPath = (mp4) => path.join(path.dirname(mp4), `${baseOf(mp4)}.analysis.json`);

export function readJson(p, fallback) {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback;
}
export function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 1));
}

export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'video';
/** Remotion composition ids allow a-z, A-Z, 0-9, CJK and '-'. */
export const compId = (s) => slug(s).replace(/^(\d)/, 'v$1');
