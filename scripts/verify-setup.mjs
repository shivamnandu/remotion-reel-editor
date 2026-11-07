// Verify the video pipeline setup. Usage: npm run verify
// Prints one line per check and exits non-zero if any required check fails.

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
let failed = 0;

const check = (label, ok, detail = '', required = true) => {
  const mark = ok ? 'OK  ' : required ? 'FAIL' : 'WARN';
  if (!ok && required) failed++;
  console.log(`${mark} ${label}${detail ? ` - ${detail}` : ''}`);
};

const run = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: isWin && !cmd.endsWith('.exe') });
  } catch {
    return null;
  }
};

// Tools
const nodeMajor = Number(process.versions.node.split('.')[0]);
check('Node.js >= 20', nodeMajor >= 20, `v${process.versions.node}`);
const ff = run('ffmpeg', ['-version']);
check('ffmpeg', !!ff, ff?.split('\n')[0]);
const git = run('git', ['--version']);
check('git', !!git, git?.trim());
const chromePaths = isWin
  ? ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', path.join(process.env.LOCALAPPDATA ?? '', 'Google\\Chrome\\Application\\chrome.exe')]
  : ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'];
const chrome = chromePaths.find((p) => fs.existsSync(p));
check('Google Chrome', !!chrome, chrome);

// Folder structure
const dirs = ['public/recordings', 'public/screen-recordings', 'public/images', 'public/sound pack', 'public/music pack', 'hyperframes', 'brand', 'out', 'scripts', 'bin'];
const missing = dirs.filter((d) => !fs.statSync(path.join(root, d), { throwIfNoEntry: false })?.isDirectory());
check('Folder structure', missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : 'STRUCTURE_OK');

// whisper.cpp
const whisperBin = path.join(root, 'bin', 'whisper.cpp', 'build', 'bin', isWin ? 'whisper-cli.exe' : 'whisper-cli');
// whisper-cli prints usage to stderr and may exit non-zero for --help; a missing DLL
// (e.g. VC++ runtime) makes it die before printing anything.
const help = fs.existsSync(whisperBin) ? spawnSync(whisperBin, ['--help'], { encoding: 'utf8' }) : null;
check('whisper-cli runs', /usage/i.test(`${help?.stdout ?? ''}${help?.stderr ?? ''}`), whisperBin);
const model = path.join(root, 'bin', 'whisper.cpp', 'models', 'ggml-base.en.bin');
const modelSize = fs.statSync(model, { throwIfNoEntry: false })?.size ?? 0;
check('ggml-base.en.bin model', modelSize > 100 * 1024 * 1024, `${(modelSize / 1048576).toFixed(1)} MB`);
const small = path.join(root, 'bin', 'whisper.cpp', 'models', 'ggml-small.bin');
const smallSize = fs.statSync(small, { throwIfNoEntry: false })?.size ?? 0;
check('ggml-small.bin model (caption re-timing)', smallSize > 400 * 1024 * 1024, `${(smallSize / 1048576).toFixed(1)} MB`, false);

// Python env for the skill's helper scripts
const py = path.join(root, '.venv', isWin ? 'Scripts/python.exe' : 'bin/python');
const pyOk = fs.existsSync(py) && /PY_OK/.test(run(py, ['-c', 'import numpy, PIL; print("PY_OK")']) ?? '');
check('.venv python with numpy + pillow', pyOk, py, false);

// Remotion + HyperFrames
const hfPkg = path.join(root, 'node_modules', 'hyperframes', 'package.json');
check('hyperframes installed', fs.existsSync(hfPkg), fs.existsSync(hfPkg) ? `v${JSON.parse(fs.readFileSync(hfPkg, 'utf8')).version}` : '');
const rmPkg = path.join(root, 'node_modules', 'remotion', 'package.json');
check('remotion installed', fs.existsSync(rmPkg), fs.existsSync(rmPkg) ? `v${JSON.parse(fs.readFileSync(rmPkg, 'utf8')).version}` : '');

// Project files
for (const s of ['transcribe', 'ingest', 'auto-edit', 'find-words', 'check', 'render', 'find-audio', 'use-audio', 'generate-sfx', 'index-sounds', 'import-audio', 'registry']) {
  check(`scripts/${s}.mjs`, fs.existsSync(path.join(root, 'scripts', `${s}.mjs`)));
}
check('brand/BRAND.md + theme.ts', fs.existsSync(path.join(root, 'brand', 'BRAND.md')) && fs.existsSync(path.join(root, 'brand', 'theme.ts')), '', false);
check('CLAUDE.md (operating rules)', fs.existsSync(path.join(root, 'CLAUDE.md')));
check('graphics library', fs.existsSync(path.join(root, 'src', 'shared', 'graphics', 'index.ts')));
const cat = path.join(root, 'src', 'shared', 'effects', 'catalog.json');
check('effects library', fs.existsSync(cat), fs.existsSync(cat) ? `${JSON.parse(fs.readFileSync(cat, 'utf8')).length} catalog entries` : '');
const luts = path.join(root, 'assets', 'luts');
const nLuts = fs.existsSync(luts) ? fs.readdirSync(luts).filter((f) => f.endsWith('.cube')).length : 0;
check('colour LUTs', nLuts >= 12, `${nLuts} .cube (npm run luts)`, false);
for (const s of ['fx', 'make-luts', 'find-effect']) check(`scripts/${s}.mjs`, fs.existsSync(path.join(root, 'scripts', `${s}.mjs`)));

// Asset libraries (outside public/ so renders stay fast)
for (const kind of ['sound', 'music']) {
  const idx = path.join(root, 'assets', `${kind}-index.json`);
  const n = fs.existsSync(idx) ? JSON.parse(fs.readFileSync(idx, 'utf8')).count : 0;
  check(`${kind} index`, n > 0, `${n} files (npm run index-sounds)`, false);
}
const pubBytes = (function size(d) {
  let t = 0;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    t += e.isDirectory() ? size(p) : fs.statSync(p).size;
  }
  return t;
})(path.join(root, 'public'));
check('public/ excluding recordings stays small (copied into every render)', true, `${(pubBytes / 1048576).toFixed(0)} MB total incl. recordings`, false);

// Background removal (onnxruntime needs the VC++ runtime next to its binding on this PC)
const ort = path.join(os.homedir(), '.cache', 'hyperframes', 'optional');
check('HyperFrames background-removal runtime', fs.existsSync(ort), ort, false);

// Skill
const skill = path.join(os.homedir(), '.claude', 'skills', 'remotion-reel', 'SKILL.md');
check('remotion-reel skill (SKILL.md)', fs.existsSync(skill), skill, false);

console.log(failed ? `\n${failed} required check(s) failed` : '\nSETUP_OK');
process.exit(failed ? 1 : 0);
