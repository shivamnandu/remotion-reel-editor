// Build searchable indexes of every sound effect and music track on disk.
//
// Usage: npm run index-sounds        (re-analyses only new/changed files)
// Output: assets/sound-index.json and assets/music-index.json
//
// Indexed roots:
//   sound: assets/sfx-library/ (big CC0 library), public/sound pack/ (generated + your own picks)
//   music: assets/music-library/ (CC0, public domain, CC BY), public/music pack/ (your own picks)
//
// Per file: path (relative to project root), inPublic, durationS, peakDb, meanDb,
// leadMs (silence before the hit: first sample above 12% of peak, as in the remotion-reel
// skill's audio.md), tags (folder + file name words, plus metadata such as mood/bpm where known),
// licence + credit for music. Music also gets loudDb5s: a 5-second loudness map for choosing
// where to start a bed.
//
// Search it with: npm run find -- sound "whoosh" / npm run find -- music "upbeat"

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO = /\.(mp3|wav|ogg|flac|m4a|aac)$/i;
const SFX_SR = 24000; // high enough that clicks/snaps/cymbals measure correctly
const MUSIC_SR = 8000; // long files: keep fast

const ROOTS = {
  sound: [path.join(root, 'assets', 'sfx-library'), path.join(root, 'public', 'sound pack')],
  music: [path.join(root, 'assets', 'music-library'), path.join(root, 'public', 'music pack')],
};

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (AUDIO.test(e.name)) out.push(p);
  }
  return out;
}

const db = (x) => (x > 0 ? Math.round(20 * Math.log10(x) * 10) / 10 : -120);

function analyse(file, isMusic) {
  const SR = isMusic ? MUSIC_SR : SFX_SR;
  const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 's16le', '-'], {
    maxBuffer: 1024 * 1024 * 1024,
  });
  const n = pcm.length / 2;
  let peak = 0, sum = 0;
  for (let i = 0; i < n; i++) {
    const s = Math.abs(pcm.readInt16LE(i * 2)) / 32768;
    if (s > peak) peak = s;
    sum += s * s;
  }
  let lead = 0;
  for (let i = 0; i < n; i++) if (Math.abs(pcm.readInt16LE(i * 2)) / 32768 > peak * 0.12) { lead = i; break; }
  const e = { durationS: Math.round((n / SR) * 100) / 100, peakDb: db(peak), meanDb: db(Math.sqrt(sum / Math.max(1, n))), leadMs: Math.round((lead / SR) * 1000) };
  if (isMusic) {
    const win = SR * 5;
    e.loudDb5s = [];
    for (let w = 0; w < n; w += win) {
      let s2 = 0;
      const end = Math.min(n, w + win);
      for (let i = w; i < end; i++) { const s = pcm.readInt16LE(i * 2) / 32768; s2 += s * s; }
      e.loudDb5s.push(db(Math.sqrt(s2 / Math.max(1, end - w))));
    }
  }
  return e;
}

const words = (s) => s.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').split(/[\/\\_\-\s.(),&]+/).filter((t) => t.length > 1 && !/^\d+$/.test(t));

// Licence lookup from CREDITS.md tables (folder -> licence/author/url) and Kevin MacLeod credits.json files.
function creditsFor(rootDir) {
  const map = {};
  const credits = path.join(rootDir, 'CREDITS.md');
  if (fs.existsSync(credits)) {
    for (const line of fs.readFileSync(credits, 'utf8').split('\n')) {
      const m = line.match(/^\| `([^`]+)` \| (.*?) \| (.*?) \| (.*?) \| \d+ \| (.*?) \|$/);
      if (m) map[m[1]] = { source: m[2], author: m[3], license: m[4], url: m[5] };
    }
  }
  return map;
}
function kevinMeta(rootDir) {
  const meta = {};
  const stack = [rootDir];
  while (stack.length) {
    const d = stack.pop();
    if (!fs.existsSync(d)) continue;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.name === 'credits.json') {
        for (const [title, c] of Object.entries(JSON.parse(fs.readFileSync(p, 'utf8')))) meta[path.join(d, c.file)] = { title, ...c };
      }
    }
  }
  return meta;
}

for (const [kind, roots] of Object.entries(ROOTS)) {
  const isMusic = kind === 'music';
  const indexPath = path.join(root, 'assets', `${kind}-index.json`);
  const prev = fs.existsSync(indexPath) ? Object.fromEntries(JSON.parse(fs.readFileSync(indexPath, 'utf8')).files.map((f) => [f.path, f])) : {};
  const out = [];
  let fresh = 0, failed = 0;
  for (const r of roots) {
    const credit = creditsFor(r);
    const kevin = isMusic ? kevinMeta(r) : {};
    for (const f of walk(r)) {
      const relPath = path.relative(root, f).split(path.sep).join('/');
      const st = fs.statSync(f);
      const inPublic = relPath.startsWith('public/');
      const sub = path.relative(r, f).split(path.sep);
      const folder = sub.length > 2 ? sub[1] : sub[0];
      const k = kevin[f];
      const c = credit[folder];
      const meta = k
        ? { license: 'CC BY 4.0', creditRequired: true, credit: k.attribution, mood: k.feel, bpm: Number(k.bpm) || undefined, instruments: k.instruments, description: k.description }
        : c
          ? { license: c.license, creditRequired: !/^(CC0|Public Domain)/i.test(c.license), credit: `${c.source} by ${c.author} (${c.license}) ${c.url}`.trim() }
          : inPublic && relPath.includes('/generated/')
            ? { license: 'original (generated)', creditRequired: false }
            : {};
      const tags = [...new Set([...words(path.relative(r, f)), ...(k ? words(`${k.feel ?? ''} ${k.instruments ?? ''} ${k.title}`) : [])])];
      const old = prev[relPath];
      if (old && old.bytes === st.size) { out.push({ ...old, inPublic, tags, ...meta }); continue; }
      try {
        out.push({ path: relPath, inPublic, bytes: st.size, tags, ...meta, ...analyse(f, isMusic) });
        fresh++;
        if (fresh % 200 === 0) console.log(`  ${kind}: ${fresh} analysed...`);
      } catch {
        failed++;
      }
    }
  }
  out.sort((a, b) => a.path.localeCompare(b.path));
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, JSON.stringify({ generated: new Date().toISOString(), count: out.length, files: out }));
  console.log(`${kind}: ${out.length} files indexed (${fresh} analysed, ${failed} unreadable) -> ${path.relative(root, indexPath)}`);
}
