// Generate 3D LUTs (.cube, 33^3) for the colour-grade presets. Original, licence-free.
// Usage: npm run luts            -> assets/luts/<name>.cube
// Apply to footage: npm run fx -- grade <take> --lut <name> [--mix 0.8]
// Names match <ColorGrade look="..."> presets in src/shared/effects/grade.tsx.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'assets', 'luts');
const N = 33;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const sCurve = (x, k) => { const c = x - 0.5; return clamp01(0.5 + c * (1 + k) - (k * 4 * c * c * c) / 1); };
const sat = ([r, g, b], s) => { const l = luma(r, g, b); return [l + (r - l) * s, l + (g - l) * s, l + (b - l) * s]; };
const liftGammaGain = ([r, g, b], lift, gamma, gain) => [r, g, b].map((v, i) => clamp01(Math.pow(clamp01(v * gain[i] + lift[i] * (1 - v)), 1 / gamma[i])));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
/** Split-tone: tint shadows and highlights by luminance. */
const splitTone = (c, shadow, highlight, amount = 0.15) => {
  const l = luma(...c);
  const sw = Math.pow(1 - l, 2), hw = Math.pow(l, 2);
  return c.map((v, i) => clamp01(v + (shadow[i] - 0.5) * sw * amount * 2 + (highlight[i] - 0.5) * hw * amount * 2));
};
const contrast = (c, k) => c.map((v) => sCurve(v, k));
const fade = (c, black = 0.06) => c.map((v) => black + v * (1 - black));
const mono = (c) => { const l = luma(...c); return [l, l, l]; };

// Selective saturation: keep warm hues (orange-yellow, food + yellow branding), mute the rest.
const rgb2hsv = ([r, g, b]) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx];
};
const keepWarm = (c, lo = 12, hi = 62, mute = 0.25) => {
  const [h] = rgb2hsv(c);
  const dist = h >= lo && h <= hi ? 0 : Math.min(Math.abs(h - lo), Math.abs(h - hi), 360 - Math.abs(h - lo), 360 - Math.abs(h - hi));
  const keep = Math.max(0, 1 - dist / 25); // soft 25-degree feather
  return sat(c, mute + (1 - mute) * keep);
};

const LOOKS = {
  // Reference-style food look: muted cool-grey world, warm food/brand yellow kept, deep blacks.
  'moody-warm': (c) =>
    splitTone(
      contrast(liftGammaGain(sat(keepWarm(c, 12, 62, 0.12), 0.82), [-0.02, -0.02, -0.015], [0.82, 0.83, 0.86], [0.96, 0.94, 0.9]), 0.5),
      [0.42, 0.48, 0.52], [0.6, 0.52, 0.4], 0.12,
    ),
  'teal-orange': (c) => sat(splitTone(contrast(c, 0.25), [0.2, 0.55, 0.62], [0.85, 0.55, 0.3], 0.18), 1.1),
  'warm-film': (c) => fade(sat(splitTone(contrast(c, 0.15), [0.45, 0.42, 0.4], [0.75, 0.6, 0.42], 0.12), 1.0), 0.03),
  'cool-blue': (c) => sat(splitTone(contrast(c, 0.15), [0.35, 0.45, 0.65], [0.5, 0.55, 0.65], 0.14), 0.92),
  'bleach-bypass': (c) => mix(contrast(c, 0.45), contrast(mono(c), 0.5), 0.55),
  'faded-matte': (c) => fade(sat(contrast(c, -0.1), 0.85), 0.08),
  'mono-contrast': (c) => contrast(mono(c), 0.45),
  'vintage-70s': (c) => fade(sat(splitTone(c, [0.45, 0.48, 0.38], [0.78, 0.62, 0.38], 0.2), 1.05), 0.05),
  'moody-green': (c) => liftGammaGain(sat(splitTone(contrast(c, 0.3), [0.38, 0.52, 0.45], [0.55, 0.58, 0.48], 0.14), 0.8), [0.01, 0.015, 0.01], [0.95, 0.95, 0.95], [0.97, 1, 0.97]),
  'golden-hour': (c) => sat(splitTone(contrast(c, 0.12), [0.55, 0.45, 0.4], [0.85, 0.65, 0.35], 0.2), 1.15),
  'clean-punch': (c) => sat(contrast(c, 0.22), 1.18),
  noir: (c) => liftGammaGain(contrast(mono(c), 0.7), [0, 0, 0], [0.9, 0.9, 0.9], [1, 1, 1]),
  pastel: (c) => fade(sat(contrast(c, -0.15), 0.85), 0.1),
};

fs.mkdirSync(OUT, { recursive: true });
for (const [name, fn] of Object.entries(LOOKS)) {
  const lines = [`TITLE "${name}"`, `LUT_3D_SIZE ${N}`, 'DOMAIN_MIN 0.0 0.0 0.0', 'DOMAIN_MAX 1.0 1.0 1.0'];
  // .cube order: red changes fastest, then green, then blue.
  for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) {
    const out = fn([r / (N - 1), g / (N - 1), b / (N - 1)]).map(clamp01);
    lines.push(out.map((v) => v.toFixed(6)).join(' '));
  }
  fs.writeFileSync(path.join(OUT, `${name}.cube`), lines.join('\n') + '\n');
}
console.log(`Wrote ${Object.keys(LOOKS).length} LUTs to ${path.relative(root, OUT)}: ${Object.keys(LOOKS).join(', ')}`);
