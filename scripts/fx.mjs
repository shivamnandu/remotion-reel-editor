// Footage effects with ffmpeg: accurate, deterministic, no AI.
//
// Usage: npm run fx -- <op> <take> [options]
//   <take> = name in public/recordings, or any path. Output: public/fx/<name>.<op>.mp4
//   (or .mov with alpha for `key`), ready for staticFile("fx/...").
//
// Range: --from <s> --to <s> works on every op (process only that stretch).
//
// Ops:
//   grade    --lut <name> [--mix 0..1]      bake a 3D LUT from assets/luts (npm run luts)
//   slowmo   [--factor 2]                   optical-flow slow motion (minterpolate), audio dropped
//   speed    --factor <x>                   speed up / down with pitch-kept audio (atempo)
//   reverse                                 reversed video + audio (use a range: it buffers in RAM)
//   boomerang                               forward + reverse
//   stabilize [--shakiness 5] [--smooth 15] two-pass vid.stab
//   denoise  [--strength 4]                 temporal+spatial denoise (hqdn3d)
//   sharpen  [--amount 0.8]                 unsharp mask
//   key      [--color 0x00FF00] [--similarity 0.12] [--blend 0.08]  green/blue screen -> ProRes 4444 alpha .mov
//   voice                                   voice polish: high-pass, denoise, de-ess, EQ presence, compress, -14 LUFS (video copied)
//   deflicker                               remove light flicker (LED/shutter)
//   still    --at <s>                       freeze-frame PNG (public/fx/<name>.still-<s>.png)

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, FPS, PUBLIC, probe, resolveRecording, baseOf, rel, tmpDir } from './lib/media.mjs';

const argv = process.argv.slice(2);
const [op, takeArg] = argv;
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const OPS = ['grade', 'slowmo', 'speed', 'reverse', 'boomerang', 'stabilize', 'denoise', 'sharpen', 'key', 'voice', 'deflicker', 'still'];
if (!OPS.includes(op) || !takeArg) {
  console.error(`Usage: npm run fx -- <${OPS.join('|')}> <take> [options]   (see scripts/fx.mjs header)`);
  process.exit(1);
}
let src;
try { src = resolveRecording(takeArg); } catch { src = path.resolve(takeArg); }
if (!fs.existsSync(src)) { console.error(`Not found: ${takeArg}`); process.exit(1); }
const p = probe(src);
const outDir = path.join(PUBLIC, 'fx');
fs.mkdirSync(outDir, { recursive: true });
const from = opt('from'), to = opt('to');
const rangeTag = from || to ? `.${from ?? 0}-${to ?? 'end'}` : '';
const inArgs = [...(from ? ['-ss', from] : []), ...(to ? ['-to', to] : []), '-i', src];
const venc = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS)];
const aenc = ['-c:a', 'aac', '-b:a', '192k'];
const ff = (args, cwd = ROOT) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit', cwd });
const out = (ext = 'mp4', tag = op) => path.join(outDir, `${baseOf(src)}${rangeTag}.${tag}.${ext}`);
let result;

switch (op) {
  case 'grade': {
    const lut = opt('lut');
    const lutRel = `assets/luts/${lut}.cube`;
    if (!lut || !fs.existsSync(path.join(ROOT, lutRel))) throw new Error(`--lut required; available: ${fs.readdirSync(path.join(ROOT, 'assets', 'luts')).map((f) => f.replace('.cube', '')).join(', ')} (npm run luts)`);
    const m = Number(opt('mix', 1));
    // Relative LUT path + cwd=ROOT avoids Windows drive-letter escaping inside the filter graph.
    const vf = m >= 1 ? `lut3d=file=${lutRel}:interp=tetrahedral` : `split[a][b];[b]lut3d=file=${lutRel}:interp=tetrahedral[g];[a][g]blend=all_mode=normal:all_opacity=${m}`;
    result = out('mp4', `grade-${lut}`);
    ff([...inArgs, '-filter_complex', `[0:v]${vf},format=yuv420p[v]`, '-map', '[v]', '-map', '0:a?', ...venc, ...aenc, result]);
    break;
  }
  case 'slowmo': {
    const f = Number(opt('factor', 2));
    result = out('mp4', `slowmo${f}x`);
    ff([...inArgs, '-vf', `setpts=${f}*PTS,minterpolate=fps=${FPS}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`, '-an', ...venc, result]);
    break;
  }
  case 'speed': {
    const f = Number(opt('factor', 1.5));
    const at = [];
    let r = f;
    while (r > 2) { at.push('atempo=2'); r /= 2; }
    while (r < 0.5) { at.push('atempo=0.5'); r /= 0.5; }
    at.push(`atempo=${r}`);
    result = out('mp4', `speed${f}x`);
    ff([...inArgs, '-filter_complex', `[0:v]setpts=PTS/${f}[v];[0:a]${at.join(',')}[a]`, '-map', '[v]', '-map', '[a]', ...venc, ...aenc, result]);
    break;
  }
  case 'reverse':
    result = out();
    ff([...inArgs, '-vf', 'reverse', '-af', 'areverse', ...venc, ...aenc, result]);
    break;
  case 'boomerang':
    result = out();
    ff([...inArgs, '-filter_complex', '[0:v]split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0[v]', '-map', '[v]', '-an', ...venc, result]);
    break;
  case 'stabilize': {
    const t = tmpDir('stab-');
    const trf = 'transforms.trf'; // relative + cwd avoids drive-letter escaping
    ff([...inArgs, '-vf', `vidstabdetect=shakiness=${opt('shakiness', 5)}:accuracy=15:result=${trf}`, '-f', 'null', '-'], t);
    result = out();
    ff([...inArgs, '-vf', `vidstabtransform=input=${trf}:smoothing=${opt('smooth', 15)}:zoom=0:optzoom=1,unsharp=5:5:0.6:3:3:0.3`, ...venc, ...aenc, result], t);
    fs.rmSync(t, { recursive: true, force: true });
    break;
  }
  case 'denoise': {
    const s = Number(opt('strength', 4));
    result = out();
    ff([...inArgs, '-vf', `hqdn3d=${s}:${s * 0.75}:${s * 1.5}:${s * 1.1}`, ...venc, '-c:a', 'copy', result]);
    break;
  }
  case 'sharpen':
    result = out();
    ff([...inArgs, '-vf', `unsharp=5:5:${opt('amount', 0.8)}:5:5:0`, ...venc, '-c:a', 'copy', result]);
    break;
  case 'key': {
    result = out('mov');
    const c = opt('color', '0x00FF00');
    ff([...inArgs, '-vf', `chromakey=${c}:${opt('similarity', 0.12)}:${opt('blend', 0.08)},despill=type=${/00FF00/i.test(c) ? 'green' : 'blue'},format=yuva444p10le`, '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-an', result]);
    break;
  }
  case 'voice': {
    if (!p.hasAudio) throw new Error('No audio stream.');
    result = out();
    const chain = ['highpass=f=80', 'afftdn=nf=-25', 'deesser=i=0.4', 'equalizer=f=200:t=q:w=1:g=-2', 'equalizer=f=3500:t=q:w=1.2:g=3', 'acompressor=threshold=-20dB:ratio=3:attack=10:release=150:makeup=3', 'loudnorm=I=-14:TP=-1.5:LRA=9'].join(',');
    ff([...inArgs, '-af', chain, '-ar', '48000', '-c:v', 'copy', ...aenc, result]);
    break;
  }
  case 'deflicker':
    result = out();
    ff([...inArgs, '-vf', 'deflicker=mode=pm:size=10', ...venc, '-c:a', 'copy', result]);
    break;
  case 'still': {
    const at = opt('at', '0');
    result = path.join(outDir, `${baseOf(src)}.still-${at}.png`);
    ff(['-ss', at, '-i', src, '-frames:v', '1', result]);
    break;
  }
}
const r = probe(result);
console.log(`${op}: ${rel(result)}  ${r.width}x${r.height} ${r.fps ? r.fps.toFixed(2) + 'fps ' : ''}${r.durationS ? r.durationS.toFixed(2) + 's' : ''}`);
console.log(`Use: staticFile("${path.relative(PUBLIC, result).split(path.sep).join('/')}")`);
