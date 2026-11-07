// Import downloaded audio (folders, zips, loose files) into the sound or music pack.
//
// Usage:
//   node scripts/import-audio.mjs <sourceDir> <sound|music> [--source-name "Name"] [--author "x"] [--license CC0] [--url https://...]
//
// <sourceDir> is either:
//   - a harvest folder containing manifest.json ({ slug: { done, title, author, license, url, dir } }), or
//   - any folder of audio files / archives (credited with the --source-name/--author/--license/--url flags).
//
// What it does:
//   - extracts .zip/.7z/.tar archives (Windows tar.exe / bsdtar; refuses paths escaping the folder)
//   - converts every audio file (ogg/wav/flac/aif/m4a/mp3) to mp3, named by sound in kebab-case
//   - sound: <=15 s -> assets/sfx-library/library/<source>/, 15-240 s -> assets/sfx-library/ambience/<source>/
//   - music: >=20 s -> assets/music-library/library/<source>/, shorter -> assets/music-library/stingers/<source>/
//   - skips exact duplicates (content hash) and writes/updates CREDITS.md in the pack
// Then run: node scripts/index-sounds.mjs

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [srcArg, kind, ...rest] = process.argv.slice(2);
if (!srcArg || !['sound', 'music'].includes(kind)) {
  console.error('Usage: node scripts/import-audio.mjs <sourceDir> <sound|music> [--source-name N] [--author A] [--license L] [--url U]');
  process.exit(1);
}
const flag = (n) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : undefined; };
const src = path.resolve(srcArg);
// Libraries live OUTSIDE public/: Remotion copies all of public/ into every render bundle on
// Windows, so multi-GB libraries there would slow every render. Use scripts/use-audio.mjs to
// copy the files a video needs into public/sound pack or public/music pack.
const packDir = path.join(root, 'assets', kind === 'sound' ? 'sfx-library' : 'music-library');
const AUDIO = /\.(ogg|oga|wav|flac|aif|aiff|m4a|mp3|opus)$/i;
const ARCHIVE = /\.(zip|7z|tar|tgz|tar\.gz)$/i;
const tarExe = process.platform === 'win32' ? path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar';

const slugify = (s) =>
  s
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'untitled';

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '__MACOSX' || e.name.startsWith('._')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function extractAll(dir, depth = 0) {
  if (depth > 2) return;
  for (const f of walk(dir).filter((p) => ARCHIVE.test(p))) {
    const dest = path.join(path.dirname(f), `${path.basename(f)}__x`);
    if (fs.existsSync(dest)) continue;
    fs.mkdirSync(dest, { recursive: true });
    try {
      execFileSync(tarExe, ['-xf', f, '-C', dest], { stdio: 'ignore' });
      // defence in depth: drop anything that resolved outside dest
      for (const p of walk(dest)) if (!path.resolve(p).startsWith(path.resolve(dest))) fs.rmSync(p, { force: true });
    } catch {
      console.warn(`  could not extract ${path.basename(f)}`);
    }
    extractAll(dest, depth + 1);
  }
}

const duration = (f) => {
  try {
    return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nk=1:nw=1', f], { encoding: 'utf8' }).trim()) || 0;
  } catch {
    return 0;
  }
};

// Existing hashes, so re-runs and overlapping sources don't duplicate files.
const seen = new Set();
const hashFile = (f) => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
const hashesPath = path.join(packDir, '.import-hashes.json');
if (fs.existsSync(hashesPath)) JSON.parse(fs.readFileSync(hashesPath, 'utf8')).forEach((h) => seen.add(h));

const manifestPath = path.join(src, 'manifest.json');
const entries = fs.existsSync(manifestPath)
  ? Object.values(JSON.parse(fs.readFileSync(manifestPath, 'utf8'))).filter((e) => e.done && e.dir).map((e) => ({ ...e, path: path.join(src, e.dir) }))
  : [{ title: flag('source-name') ?? path.basename(src), author: flag('author') ?? 'unknown', license: flag('license') ?? 'unknown', url: flag('url') ?? '', path: src }];

const credits = [];
let imported = 0, dupes = 0, skipped = 0;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'import-audio-'));
try {
  for (const e of entries) {
    if (!fs.existsSync(e.path)) continue;
    extractAll(e.path);
    const files = walk(e.path).filter((p) => AUDIO.test(p));
    const source = slugify(e.title);
    let n = 0;
    for (const f of files) {
      const d = duration(f);
      if (!d) { skipped++; continue; }
      // Reject files that probe fine but do not decode (corrupt/mislabelled).
      try { execFileSync('ffmpeg', ['-v', 'error', '-xerror', '-i', f, '-t', '2', '-f', 'null', '-'], { stdio: 'ignore' }); } catch { skipped++; continue; }
      let sub;
      if (kind === 'sound') sub = d <= 15 ? 'library' : d <= 240 ? 'ambience' : null;
      else sub = d >= 20 ? 'library' : 'stingers';
      if (!sub) { skipped++; continue; }
      const h = hashFile(f);
      if (seen.has(h)) { dupes++; continue; }
      seen.add(h);
      const outDir = path.join(packDir, sub, source);
      fs.mkdirSync(outDir, { recursive: true });
      let name = slugify(path.basename(f));
      let out = path.join(outDir, `${name}.mp3`);
      for (let k = 2; fs.existsSync(out); k++) out = path.join(outDir, `${name}-${k}.mp3`);
      if (/\.mp3$/i.test(f)) fs.copyFileSync(f, out);
      else execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-vn', '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', kind === 'music' ? '256k' : '224k', out]);
      n++;
      imported++;
    }
    if (n) credits.push({ ...e, source, count: n });
    console.log(`${source}: ${n} files`);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
fs.writeFileSync(hashesPath, JSON.stringify([...seen]));

// Merge credits into CREDITS.md (one line per source, keyed by folder name)
const creditsPath = path.join(packDir, 'CREDITS.md');
const header = `# ${kind === 'sound' ? 'Sound' : 'Music'} pack credits\n\nEvery file here is either generated by scripts/generate-sfx.mjs (original, no licence restrictions) or imported from the sources below. CC0 = public domain dedication: free for commercial use, no attribution required (credit given anyway). Check a source's licence before using anything that is not CC0.\n\n| Folder | Source | Author | Licence | Files | Link |\n| --- | --- | --- | --- | --- | --- |\n`;
const existing = fs.existsSync(creditsPath)
  ? Object.fromEntries(fs.readFileSync(creditsPath, 'utf8').split('\n').filter((l) => l.startsWith('| `')).map((l) => [l.split('|')[1].trim(), l]))
  : {};
for (const c of credits) {
  const esc = (s) => String(s ?? '').replace(/\|/g, '/');
  existing[`\`${c.source}\``] = `| \`${c.source}\` | ${esc(c.title)} | ${esc(c.author)} | ${esc(c.license)} | ${c.count} | ${c.url} |`;
}
fs.writeFileSync(creditsPath, header + Object.keys(existing).sort().map((k) => existing[k]).join('\n') + '\n');
console.log(`IMPORT_DONE imported=${imported} duplicates=${dupes} skipped=${skipped} sources=${credits.length}`);
