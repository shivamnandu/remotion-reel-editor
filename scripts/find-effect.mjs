// Search every available effect: this project's library (src/shared/effects/catalog.json:
// transitions, overlays, motion, text, graphics, grades, footage FX) plus the HyperFrames
// registry (448 blocks/components: shader transitions, 3D, liquid glass, annotations...).
//
// Usage:
//   npm run fx-find -- "glitch"              both sources
//   npm run fx-find -- "transition" --local  only this project's library
//   npm run fx-find -- "liquid glass" --hf   only HyperFrames (render via references/hyperframes-hybrid.md)
//   npm run fx-find -- --list                every local effect, one line each

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/media.mjs';

const args = process.argv.slice(2);
const q = args.filter((a) => !a.startsWith('--')).join(' ').toLowerCase().split(/\s+/).filter(Boolean);
const has = (f) => args.includes(`--${f}`);
const local = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'shared', 'effects', 'catalog.json'), 'utf8'));

const hfPath = path.join(ROOT, 'assets', 'hyperframes-catalog.json');
if (!fs.existsSync(hfPath) && !has('local')) {
  try {
    const raw = execFileSync(process.execPath, [path.join(ROOT, 'node_modules', 'hyperframes', 'bin', 'hyperframes.mjs'), 'catalog', '--json'], { encoding: 'utf8', env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1' }, maxBuffer: 64 * 1024 * 1024 });
    const items = JSON.parse(raw).map((x) => ({ name: x.name, type: x.type, title: x.title, tags: x.tags, desc: String(x.description ?? '').slice(0, 220) }));
    fs.mkdirSync(path.dirname(hfPath), { recursive: true });
    fs.writeFileSync(hfPath, JSON.stringify(items));
  } catch {
    console.warn('(HyperFrames catalog unavailable; showing local effects only)');
  }
}
const hf = fs.existsSync(hfPath) ? JSON.parse(fs.readFileSync(hfPath, 'utf8')) : [];
const match = (text) => q.every((t) => text.includes(t));

if (has('list')) {
  for (const e of local) console.log(`[${e.kind}] ${e.name}: ${e.use}`);
  process.exit(0);
}
if (!q.length) {
  console.error('Usage: npm run fx-find -- "<words>" [--local|--hf] | --list');
  process.exit(1);
}
if (!has('hf')) {
  const hits = local.filter((e) => match(`${e.name} ${e.kind} ${e.desc} ${e.use}`.toLowerCase()));
  console.log(`Project library (${hits.length}):`);
  for (const e of hits) console.log(`  [${e.kind}] ${e.name}: ${e.use}  // ${e.desc}${e.import === 'effects' ? '  (import from src/shared/effects)' : e.import === 'graphics' ? '  (import from src/shared/graphics)' : ''}`);
}
if (!has('local')) {
  const hits = hf.filter((e) => match(`${e.name} ${e.title} ${(e.tags ?? []).join(' ')} ${e.desc}`.toLowerCase())).slice(0, 15);
  console.log(`HyperFrames registry (${hits.length} shown; render as an asset, then composite):`);
  for (const e of hits) console.log(`  ${e.name} [${e.type}] ${(e.tags ?? []).slice(0, 5).join(',')}: ${e.desc.slice(0, 120)}`);
}
