// Copy a library sound/track into public/ so a composition can use it.
//
// Usage: npm run use -- "<path from npm run find>" ["new name.mp3"]
// Prints: the staticFile() path, the cue lead in frames, and the credit line if one is required.
// Credits for every used track are appended to public/music pack/CREDITS-USED.md / public/sound pack/CREDITS-USED.md.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [srcArg, nameArg] = process.argv.slice(2);
if (!srcArg) {
  console.error('Usage: npm run use -- "<library path>" ["new name.mp3"]');
  process.exit(1);
}
const src = path.resolve(root, srcArg);
if (!fs.existsSync(src)) {
  console.error(`Not found: ${srcArg}`);
  process.exit(1);
}
const relSrc = path.relative(root, src).split(path.sep).join('/');
const isMusic = relSrc.includes('music');
const index = JSON.parse(fs.readFileSync(path.join(root, 'assets', `${isMusic ? 'music' : 'sound'}-index.json`), 'utf8'));
const entry = index.files.find((f) => f.path === relSrc) ?? {};

let destRel;
if (relSrc.startsWith('public/')) {
  destRel = relSrc; // already usable
} else {
  const pack = isMusic ? 'music pack' : 'sound pack';
  const name = nameArg ?? path.basename(src);
  const dest = path.join(root, 'public', pack, name);
  if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
  destRel = path.relative(root, dest).split(path.sep).join('/');
  if (entry.credit || entry.license) {
    const log = path.join(root, 'public', pack, 'CREDITS-USED.md');
    const line = `- ${name}: ${entry.credit ?? entry.license}${entry.creditRequired ? '  **(credit required in post description)**' : ''}\n`;
    const prev = fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : `# Credits for ${pack} files used in videos\n\n`;
    if (!prev.includes(line)) fs.writeFileSync(log, prev + line);
  }
}
const staticPath = destRel.replace(/^public\//, '');
console.log(`staticFile("${staticPath}")`);
if (entry.durationS !== undefined) console.log(`duration ${entry.durationS}s | lead ${entry.leadMs}ms = ${Math.round((entry.leadMs / 1000) * 30)} frames (start the cue that many frames early) | mean ${entry.meanDb}dB`);
if (entry.creditRequired) console.log(`CREDIT REQUIRED: ${entry.credit}`);
