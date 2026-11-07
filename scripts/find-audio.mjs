// Search the sound / music indexes without listing thousands of files.
//
// Usage:
//   npm run find -- sound "whoosh"                     top matches for a sound
//   npm run find -- sound "impact deep" --max 3        max duration (s)
//   npm run find -- music "upbeat corporate" --min 60  min duration (s)
//   npm run find -- music "calm piano" --free          only tracks needing no credit (CC0 / public domain / generated)
//   npm run find -- sound "pop" --limit 30 --json
//
// Output (one line per hit): path | duration | leadMs (silence before the hit) | meanDb | licence
// Then: npm run use -- "<path>"   copies it into public/ and prints the staticFile() path.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const kind = args[0];
const query = args[1] ?? '';
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const has = (n) => args.includes(`--${n}`);
if (!['sound', 'music'].includes(kind)) {
  console.error('Usage: npm run find -- <sound|music> "<words>" [--max s] [--min s] [--limit n] [--free] [--json]');
  process.exit(1);
}
const indexPath = path.join(root, 'assets', `${kind}-index.json`);
if (!fs.existsSync(indexPath)) {
  console.error(`No index yet. Run: npm run index-sounds`);
  process.exit(1);
}
const { files } = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const max = Number(opt('max', Infinity)), min = Number(opt('min', 0)), limit = Number(opt('limit', 12));

// Synonyms so plain-language asks find library naming.
const SYN = {
  whoosh: ['swoosh', 'swish', 'woosh', 'swipe', 'wind'], woosh: ['whoosh', 'swoosh', 'swish'], swoosh: ['whoosh', 'swish'],
  pop: ['bubble', 'plop', 'blip'], click: ['tap', 'button', 'switch', 'mouse'], impact: ['hit', 'punch', 'thud', 'boom', 'slam'],
  hit: ['impact', 'punch'], boom: ['explosion', 'impact', 'bass'], riser: ['rise', 'build', 'swell', 'uplifter'],
  ding: ['bell', 'chime', 'notification'], chime: ['bell', 'ding'], glitch: ['static', 'digital', 'error', 'noise'],
  coin: ['pickup', 'collect'], success: ['win', 'complete', 'level', 'powerup'], fail: ['lose', 'error', 'wrong'],
  typing: ['keyboard', 'type'], camera: ['shutter', 'photo'], upbeat: ['happy', 'bright', 'uplifting', 'bouncy', 'grooving', 'funky', 'playful'],
  calm: ['calming', 'relaxed', 'ambient', 'peaceful', 'mellow'], epic: ['cinematic', 'action', 'intense', 'heroic', 'orchestral'],
  sad: ['somber', 'melancholy', 'dark'], tense: ['suspense', 'suspenseful', 'mysterious', 'dark', 'eerie'],
  funny: ['comedy', 'quirky', 'playful', 'humorous'], chill: ['lofi', 'relaxed', 'calm', 'groovy'],
};
const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

function score(f) {
  const hay = f.tags.join(' ') + ' ' + f.path.toLowerCase() + ' ' + (f.mood ?? '').toLowerCase() + ' ' + (f.description ?? '').toLowerCase();
  let s = 0;
  const moods = (f.mood ?? '').toLowerCase().split(/[,\s]+/);
  for (const t of terms) {
    const syn = SYN[t] ?? [];
    if (moods[0] === t) s += 6; // primary mood is the strongest signal for music
    else if (moods.includes(t)) s += 4;
    else if (syn.includes(moods[0])) s += 3.5; // e.g. "upbeat" -> primary mood "bright"
    else if (moods.some((m) => syn.includes(m))) s += 2.5;
    else if (f.tags.includes(t)) s += 3;
    else if (hay.includes(t)) s += 2;
    else if ((SYN[t] ?? []).some((x) => hay.includes(x))) s += 1;
    else return 0; // every term must match something
  }
  if (f.inPublic) s += 1.5; // already in the project (generated or picked before)
  if (f.peakDb < -20) s -= 1; // very quiet files are rarely what you want
  return s;
}

const hits = files
  .filter((f) => f.durationS <= max && f.durationS >= min)
  .filter((f) => !has('free') || !f.creditRequired)
  .map((f) => ({ f, s: terms.length ? score(f) : 1 }))
  .filter((x) => x.s > 0)
  .sort((a, b) => b.s - a.s || a.f.durationS - b.f.durationS)
  .slice(0, limit)
  .map((x) => x.f);

if (has('json')) {
  console.log(JSON.stringify(hits, null, 1));
} else {
  if (!hits.length) console.log('No matches. Try fewer or different words.');
  for (const h of hits) {
    const extra = kind === 'music' ? ` | ${h.mood ?? ''}${h.bpm ? ` ${h.bpm}bpm` : ''}` : '';
    console.log(`${h.path} | ${h.durationS}s | lead ${h.leadMs}ms | ${h.meanDb}dB | ${h.license ?? '?'}${h.creditRequired ? ' (credit required)' : ''}${extra}`);
  }
  console.log(`(${hits.length} of ${files.length} ${kind} files)`);
}
