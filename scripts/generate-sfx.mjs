// Procedural sound-effect generator: original, licence-free SFX made from code.
//
// Usage:
//   node scripts/generate-sfx.mjs                 # (re)generate the whole library
//   node scripts/generate-sfx.mjs whoosh riser    # only presets whose name starts with these
//   node scripts/generate-sfx.mjs --list          # list presets
//
// Output: public/sound pack/generated/<name>.mp3 (48 kHz stereo, peak -1 dBFS).
// Every sound's main hit sits within the first ~10 ms (risers/swells end on their peak),
// so cue leads are near zero unless noted in INDEX.json (run scripts/index-sounds.mjs).
//
// To add a sound: add a preset to PRESETS below (a function returning [L, R] Float32Arrays).

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'public', 'sound pack', 'generated');
const SR = 48000;

// ---------- deterministic randomness ----------
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
}

// ---------- building blocks ----------
const N = (sec) => Math.max(1, Math.round(sec * SR));
const buf = (sec) => new Float32Array(N(sec));
const lerp = (a, b, t) => a + (b - a) * t;
const expInterp = (a, b, t) => a * Math.pow(b / a, t);

function noise(sec, seed = 1) {
  const r = rng(seed);
  const b = buf(sec);
  for (let i = 0; i < b.length; i++) b[i] = r();
  return b;
}

/** Oscillator with frequency curve f(t01) and waveform. */
function osc(sec, freqFn, wave = 'sine', seed = 3) {
  const b = buf(sec);
  const r = rng(seed);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / b.length;
    ph += freqFn(t) / SR;
    const p = ph - Math.floor(ph);
    switch (wave) {
      case 'square': b[i] = p < 0.5 ? 1 : -1; break;
      case 'saw': b[i] = 2 * p - 1; break;
      case 'tri': b[i] = 1 - 4 * Math.abs(p - 0.5); break;
      case 'noisy': b[i] = Math.sin(2 * Math.PI * p) * 0.8 + r() * 0.2; break;
      default: b[i] = Math.sin(2 * Math.PI * p);
    }
  }
  return b;
}

/** Envelope from points [[t01, gain], ...] with optional curve exponent. */
function env(b, pts, curve = 1) {
  for (let i = 0; i < b.length; i++) {
    const t = i / (b.length - 1 || 1);
    let k = 0;
    while (k < pts.length - 2 && t > pts[k + 1][0]) k++;
    const [t0, g0] = pts[k];
    const [t1, g1] = pts[k + 1];
    const u = t1 === t0 ? 1 : Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    b[i] *= lerp(g0, g1, Math.pow(u, curve));
  }
  return b;
}

/** Exponential decay envelope (seconds to -60 dB). */
function decay(b, t60, attack = 0.002) {
  const a = N(attack);
  for (let i = 0; i < b.length; i++) {
    const g = i < a ? i / a : Math.pow(10, (-3 * (i - a)) / (t60 * SR));
    b[i] *= g;
  }
  return b;
}

/** State-variable filter with time-varying cutoff (Hz) and resonance q. mode: lp|hp|bp */
function svf(b, cutoffFn, q = 0.7, mode = 'lp') {
  let low = 0, band = 0;
  const out = new Float32Array(b.length);
  const damp = 1 / Math.max(0.5, q);
  for (let i = 0; i < b.length; i++) {
    const fc = Math.min(SR / 6, Math.max(20, cutoffFn(i / b.length)));
    const f = 2 * Math.sin((Math.PI * fc) / SR);
    low += f * band;
    const high = b[i] - low - damp * band;
    band += f * high;
    out[i] = mode === 'lp' ? low : mode === 'hp' ? high : band;
  }
  return out;
}

function mix(...parts) {
  const len = Math.max(...parts.map(([b, , off = 0]) => b.length + N(off)));
  const out = new Float32Array(len);
  for (const [b, g = 1, off = 0] of parts) {
    const o = N(off);
    for (let i = 0; i < b.length; i++) out[i + o] += b[i] * g;
  }
  return out;
}

function reverse(b) {
  return Float32Array.from(b).reverse();
}

function drive(b, amount = 2) {
  const k = Math.tanh(amount);
  return b.map((x) => Math.tanh(x * amount) / k);
}

function crush(b, bits = 6, hold = 4) {
  const q = Math.pow(2, bits - 1);
  const out = new Float32Array(b.length);
  let last = 0;
  for (let i = 0; i < b.length; i++) {
    if (i % hold === 0) last = Math.round(b[i] * q) / q;
    out[i] = last;
  }
  return out;
}

/** Small Schroeder-style room/plate. wet 0..1, size ~0.3..1 */
function reverb(b, wet = 0.25, size = 0.6, tail = 1.2) {
  const len = b.length + N(tail);
  const dry = new Float32Array(len);
  dry.set(b);
  const combs = [1557, 1617, 1491, 1422].map((d) => Math.round(d * size * (SR / 44100)));
  const out = new Float32Array(len);
  for (const d of combs) {
    const line = new Float32Array(d);
    let idx = 0, lp = 0;
    for (let i = 0; i < len; i++) {
      const y = line[idx];
      lp = y * 0.8 + lp * 0.2;
      line[idx] = dry[i] + lp * 0.84;
      idx = (idx + 1) % d;
      out[i] += y * 0.25;
    }
  }
  for (const d of [225, 556, 441, 341]) {
    const line = new Float32Array(d);
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const bufOut = line[idx];
      const y = -out[i] + bufOut;
      line[idx] = out[i] + bufOut * 0.5;
      out[i] = y;
      idx = (idx + 1) % d;
    }
  }
  for (let i = 0; i < len; i++) out[i] = dry[i] * (1 - wet) + out[i] * wet;
  return out;
}

/** Stereo: pan curve p(t01) in -1..1, plus optional Haas width in ms. */
function stereo(b, panFn = () => 0, widthMs = 0) {
  const L = new Float32Array(b.length), R = new Float32Array(b.length);
  const d = N(widthMs / 1000);
  for (let i = 0; i < b.length; i++) {
    const p = (panFn(i / b.length) + 1) / 2;
    L[i] = b[i] * Math.cos((p * Math.PI) / 2) * Math.SQRT2;
    R[i] = (i >= d ? b[i - d] : 0) * Math.sin((p * Math.PI) / 2) * Math.SQRT2;
  }
  return [L, R];
}

function trimTail(ch, thresh = 0.0005) {
  let end = ch[0].length;
  while (end > 1 && Math.abs(ch[0][end - 1]) < thresh && Math.abs(ch[1][end - 1]) < thresh) end--;
  const fade = Math.min(N(0.01), end);
  const out = ch.map((c) => c.slice(0, end));
  for (const c of out) for (let i = 0; i < fade; i++) c[end - 1 - i] *= i / fade;
  return out;
}

// ---------- presets ----------
const P = {};
const v = (name, fn) => (P[name] = fn);

// Whooshes / swipes (pan sweeps across)
for (const [i, [dur, lo, hi, q]] of [[0.45, 300, 4000, 1.2], [0.6, 200, 2500, 2], [0.35, 600, 7000, 1], [0.8, 150, 1800, 3], [0.5, 400, 5000, 4]].entries()) {
  v(`whoosh-${i + 1}`, () => {
    const n = env(noise(dur, 10 + i), [[0, 0], [0.55, 1], [1, 0]], 1.3);
    const f = svf(n, (t) => (t < 0.55 ? expInterp(lo, hi, t / 0.55) : expInterp(hi, lo * 1.5, (t - 0.55) / 0.45)), q, 'bp');
    return stereo(f, (t) => lerp(-0.8, 0.8, t), 0.4);
  });
}
for (const [i, [dur, hi]] of [[0.18, 6000], [0.22, 4000], [0.15, 9000], [0.28, 3000]].entries()) {
  v(`swipe-${i + 1}`, () => {
    const n = decay(noise(dur, 30 + i), dur * 0.9, 0.004);
    const f = svf(n, (t) => expInterp(hi, hi / 6, t), 1.5, 'bp');
    return stereo(f, (t) => lerp(i % 2 ? 0.7 : -0.7, i % 2 ? -0.7 : 0.7, t));
  });
}
v('whoosh-reverse-1', () => {
  const n = env(noise(1.2, 41), [[0, 0], [1, 1]], 3);
  return stereo(reverb(svf(n, (t) => expInterp(300, 6000, t), 1, 'bp'), 0.2, 0.5, 0.2), (t) => lerp(-0.3, 0.3, t), 0.5);
});

// Risers / downlifters / swells
for (const [i, [dur, f0, f1]] of [[2, 200, 1600], [3, 120, 1200], [1.2, 300, 2400], [4, 80, 900]].entries()) {
  v(`riser-${i + 1}`, () => {
    const tone = env(osc(dur, (t) => expInterp(f0, f1, t * t), 'saw', 50 + i), [[0, 0], [1, 1]], 2.2);
    const toneF = svf(tone, (t) => expInterp(400, 8000, t), 0.9, 'lp');
    const air = env(noise(dur, 60 + i), [[0, 0], [1, 1]], 2.5);
    const airF = svf(air, (t) => expInterp(800, 10000, t), 1.5, 'bp');
    return stereo(mix([toneF, 0.5], [airF, 0.7]), () => 0, 6);
  });
}
for (const [i, dur] of [1.2, 2].entries()) {
  v(`downlifter-${i + 1}`, () => {
    const n = env(noise(dur, 70 + i), [[0, 1], [1, 0]], 1.5);
    const f = svf(n, (t) => expInterp(9000, 150, t), 2, 'bp');
    const sub = env(osc(dur, (t) => expInterp(180, 40, t)), [[0, 1], [1, 0]], 1.2);
    return stereo(mix([f, 0.8], [sub, 0.6]), () => 0, 5);
  });
}
v('swell-reverse-cymbal', () => {
  const n = decay(noise(2.5, 80), 2.2, 0.001);
  const f = svf(n, () => 7000, 0.6, 'hp');
  return stereo(reverse(reverb(f, 0.35, 0.8, 0.3)), () => 0, 8);
});

// Impacts / booms / hits
for (const [i, [f0, f1, t60, punch]] of [[120, 38, 1.4, 1], [90, 30, 2.2, 0.8], [160, 45, 0.9, 1.2], [70, 28, 3, 0.7]].entries()) {
  v(`impact-${i + 1}`, () => {
    const body = decay(osc(t60, (t) => expInterp(f0, f1, Math.min(1, t * 4)), 'sine'), t60, 0.001);
    const click = decay(svf(noise(0.08, 90 + i), () => 3000, 0.7, 'lp'), 0.06, 0.0005);
    const crack = decay(svf(noise(0.4, 95 + i), () => 1800, 0.8, 'bp'), 0.3, 0.001);
    return stereo(reverb(drive(mix([body, 1], [click, punch * 0.8], [crack, 0.35]), 1.8), 0.22, 0.9, 1.5), () => 0, 3);
  });
}
v('boom-sub', () => stereo(drive(decay(osc(3, (t) => expInterp(60, 26, Math.min(1, t * 2))), 3, 0.003), 1.3)));
v('boom-cinematic', () => {
  const body = decay(osc(4, (t) => expInterp(55, 30, Math.min(1, t * 2))), 4, 0.002);
  const n = decay(svf(noise(2, 101), () => 600, 0.7, 'lp'), 1.5, 0.002);
  return stereo(reverb(drive(mix([body, 1], [n, 0.6]), 1.5), 0.35, 1, 3), () => 0, 10);
});
for (const [i, f] of [[220], [330], [180]].entries()) {
  v(`hit-${i + 1}`, () => {
    const t = decay(osc(0.35, (u) => expInterp(f[0] * 2, f[0], Math.min(1, u * 8)), 'tri'), 0.25, 0.0008);
    const n = decay(svf(noise(0.15, 110 + i), () => 2500, 1, 'bp'), 0.1, 0.0005);
    return stereo(drive(mix([t, 0.9], [n, 0.7]), 1.6), () => 0, 1);
  });
}
v('punch-1', () => stereo(drive(mix([decay(osc(0.3, (t) => expInterp(140, 50, Math.min(1, t * 6))), 0.25, 0.0005), 1], [decay(svf(noise(0.1, 120), () => 1200, 0.8, 'lp'), 0.08, 0.0003), 0.9]), 2.2)));
v('thud-1', () => stereo(decay(svf(mix([osc(0.5, () => 65), 1], [noise(0.5, 121), 0.3]), () => 300, 0.7, 'lp'), 0.35, 0.002)));

// Pops / blips / clicks / taps / snaps
for (const [i, [f0, f1, d]] of [[900, 300, 0.09], [1400, 500, 0.07], [600, 200, 0.12], [2000, 700, 0.05]].entries()) {
  v(`pop-${i + 1}`, () => stereo(decay(osc(d, (t) => expInterp(f0, f1, t)), d * 0.8, 0.0008), () => 0, 0.3));
}
for (const [i, [f, w, d]] of [[880, 'square', 0.06], [1320, 'square', 0.05], [660, 'tri', 0.08], [1760, 'sine', 0.05], [990, 'saw', 0.06]].entries()) {
  v(`blip-${i + 1}`, () => stereo(svf(decay(osc(d, () => f, w), d, 0.001), () => 6000, 0.7, 'lp')));
}
v('blip-double', () => stereo(mix([decay(osc(0.05, () => 1200, 'square'), 0.05), 0.6], [decay(osc(0.06, () => 1600, 'square'), 0.06), 0.6, 0.07])));
for (const [i, f] of [4000, 2500, 6000].entries()) {
  v(`click-${i + 1}`, () => stereo(decay(svf(noise(0.03, 130 + i), () => f, 1.5, 'bp'), 0.015, 0.0002)));
}
for (const [i, f] of [1800, 1200, 2600].entries()) {
  v(`tap-${i + 1}`, () => stereo(mix([decay(svf(noise(0.06, 140 + i), () => f, 2, 'bp'), 0.04, 0.0003), 1], [decay(osc(0.06, () => f / 4), 0.04, 0.0005), 0.4])));
}
for (const [i, f] of [3500, 5000].entries()) {
  v(`snap-${i + 1}`, () => stereo(reverb(decay(svf(noise(0.08, 150 + i), () => f, 0.9, 'hp'), 0.05, 0.0002), 0.15, 0.4, 0.3)));
}
v('keyboard-type', () => {
  const parts = [];
  const r = rng(160);
  for (let k = 0; k < 8; k++) parts.push([decay(svf(noise(0.04, 161 + k), () => 2500 + r() * 900, 2, 'bp'), 0.025, 0.0002), 0.8, k * 0.09 + Math.abs(r()) * 0.03]);
  return stereo(mix(...parts), () => 0, 0.5);
});
v('mouse-click', () => stereo(mix([decay(svf(noise(0.02, 170), () => 5000, 2, 'bp'), 0.01, 0.0001), 1], [decay(svf(noise(0.02, 171), () => 3500, 2, 'bp'), 0.01, 0.0001), 0.6, 0.06])));
v('toggle-switch', () => stereo(mix([decay(osc(0.04, () => 1500, 'square'), 0.02), 0.5], [decay(svf(noise(0.03, 172), () => 4000, 2, 'bp'), 0.02), 0.6])));
v('shutter-camera', () => {
  const a = decay(svf(noise(0.06, 180), () => 3000, 1, 'bp'), 0.04, 0.0002);
  const b = decay(svf(noise(0.08, 181), () => 2000, 1, 'bp'), 0.06, 0.0002);
  return stereo(mix([a, 1], [b, 0.8, 0.07]), () => 0, 0.4);
});

// Glitches
for (let i = 0; i < 5; i++) {
  v(`glitch-${i + 1}`, () => {
    const r = rng(200 + i);
    const dur = 0.25 + Math.abs(r()) * 0.35;
    const parts = [];
    let t = 0;
    while (t < dur) {
      const seg = 0.015 + Math.abs(r()) * 0.05;
      const kind = Math.floor(Math.abs(r()) * 3);
      const f = 80 + Math.abs(r()) * 2000;
      const b = kind === 0 ? osc(seg, () => f, 'square') : kind === 1 ? svf(noise(seg, 210 + parts.length), () => f * 3, 3, 'bp') : osc(seg, (u) => f * (1 + u * 4), 'saw');
      parts.push([crush(b, 4 + Math.floor(Math.abs(r()) * 4), 2 + Math.floor(Math.abs(r()) * 8)), 0.6 + Math.abs(r()) * 0.4, t]);
      t += seg + (Math.abs(r()) < 0.25 ? 0.02 : 0);
    }
    return stereo(mix(...parts), (u) => Math.sin(u * 40) * 0.6, 0.3);
  });
}
v('static-burst', () => stereo(env(crush(noise(0.4, 230), 5, 3), [[0, 1], [0.8, 0.7], [1, 0]]), () => 0, 2));
v('tape-stop', () => stereo(drive(env(osc(0.8, (t) => expInterp(440, 30, t), 'saw'), [[0, 1], [1, 0]], 0.7), 1.5)));
v('error-buzz', () => stereo(svf(mix([decay(osc(0.18, () => 110, 'square'), 0.18, 0.002), 0.6], [decay(osc(0.18, () => 110, 'square'), 0.18, 0.002), 0.6, 0.22]), () => 2000, 0.7, 'lp')));

// Chimes / dings / bells / sparkles / notifications
const bell = (f, t60, seed = 0) => {
  const partials = [[1, 1], [2.0, 0.5], [2.76, 0.35], [5.4, 0.2], [8.93, 0.1]];
  return mix(...partials.map(([m, g], k) => [decay(osc(t60, () => f * m * (1 + seed * 0.001)), t60 / (1 + k * 0.7), 0.001), g]));
};
for (const [i, [f, t60]] of [[1046.5, 1.6], [1318.5, 1.4], [784, 2], [1568, 1.2]].entries()) {
  v(`ding-${i + 1}`, () => stereo(reverb(bell(f, t60, i), 0.25, 0.6, 1), () => 0, 4));
}
for (const [i, notes] of [[[784, 1046.5, 1318.5]], [[1046.5, 1318.5, 1568, 2093]], [[659, 880]], [[1318.5, 987.8]]].entries()) {
  v(`chime-${i + 1}`, () => stereo(reverb(mix(...notes[0].map((f, k) => [bell(f, 1.2), 0.7, k * 0.09])), 0.3, 0.7, 1.2), (t) => lerp(-0.2, 0.2, t), 4));
}
v('notification-1', () => stereo(reverb(mix([decay(osc(0.15, () => 1568), 0.15, 0.002), 0.7], [decay(osc(0.25, () => 2093), 0.25, 0.002), 0.7, 0.11]), 0.2, 0.5, 0.6)));
v('notification-2', () => stereo(reverb(mix([decay(osc(0.12, () => 880, 'tri'), 0.12), 0.8], [decay(osc(0.12, () => 1175, 'tri'), 0.12), 0.8, 0.09], [decay(osc(0.3, () => 1760, 'tri'), 0.3), 0.8, 0.18]), 0.2, 0.5, 0.6)));
v('success-1', () => stereo(reverb(mix(...[523.3, 659.3, 784, 1046.5].map((f, k) => [decay(osc(0.4, () => f, 'tri'), 0.4, 0.002), 0.5, k * 0.07])), 0.25, 0.6, 1)));
v('fail-1', () => stereo(reverb(mix(...[392, 370, 349, 330].map((f, k) => [decay(osc(0.35, () => f, 'saw'), 0.3, 0.003), 0.35, k * 0.15])), 0.2, 0.6, 0.8)));
for (let i = 0; i < 3; i++) {
  v(`sparkle-${i + 1}`, () => {
    const r = rng(300 + i);
    const parts = [];
    for (let k = 0; k < 10; k++) parts.push([decay(osc(0.3, () => 2000 + Math.abs(r()) * 4000), 0.2, 0.001), 0.3, k * 0.035 + Math.abs(r()) * 0.02]);
    return stereo(reverb(mix(...parts), 0.35, 0.5, 1), (u) => Math.sin(u * 12) * 0.7, 3);
  });
}
v('coin-1', () => stereo(mix([decay(osc(0.08, () => 988, 'square'), 0.08), 0.4], [decay(osc(0.4, () => 1319, 'square'), 0.4), 0.4, 0.07])));
v('level-up', () => stereo(reverb(mix(...[523.3, 659.3, 784, 1046.5, 1318.5].map((f, k) => [decay(osc(0.18, () => f, 'square'), 0.18), 0.25, k * 0.06])), 0.15, 0.5, 0.6)));

// Bass drops / heartbeat / tick / misc
v('bass-drop', () => stereo(drive(env(osc(1.5, (t) => expInterp(110, 32, t), 'sine'), [[0, 1], [0.8, 0.8], [1, 0]]), 2)));
v('heartbeat', () => stereo(mix([decay(svf(osc(0.2, () => 55), () => 200, 0.7, 'lp'), 0.15, 0.003), 1], [decay(svf(osc(0.2, () => 50), () => 200, 0.7, 'lp'), 0.15, 0.003), 0.7, 0.22])));
v('clock-tick', () => stereo(decay(svf(noise(0.03, 400), () => 3000, 4, 'bp'), 0.02, 0.0001)));
v('clock-ticking-4s', () => stereo(mix(...Array.from({ length: 8 }, (_, k) => [decay(svf(noise(0.03, 401 + k), () => (k % 2 ? 2600 : 3200), 4, 'bp'), 0.02, 0.0001), 1, k * 0.5]))));
v('countdown-beep', () => stereo(mix(...[0, 1, 2].map((k) => [decay(osc(0.12, () => 880, 'sine'), 0.12, 0.002), 0.6, k]), [decay(osc(0.5, () => 1760, 'sine'), 0.5, 0.002), 0.6, 3])));
v('scribble-pen', () => {
  const n = svf(noise(0.9, 410), (t) => 2500 + Math.sin(t * 60) * 1500, 3, 'bp');
  return stereo(env(n, [[0, 0], [0.05, 1], [0.3, 0.6], [0.5, 1], [0.8, 0.7], [1, 0]]), (t) => Math.sin(t * 9) * 0.3);
});
v('page-flip', () => stereo(env(svf(noise(0.4, 420), (t) => expInterp(1500, 6000, t), 1, 'bp'), [[0, 0], [0.3, 1], [1, 0]], 1.5), (t) => lerp(0.5, -0.5, t)));
v('paper-slide', () => stereo(env(svf(noise(0.6, 430), () => 2500, 0.8, 'bp'), [[0, 0], [0.2, 1], [0.8, 0.8], [1, 0]]), (t) => lerp(-0.6, 0.6, t)));
v('zoom-in', () => {
  const t = env(osc(0.5, (u) => expInterp(200, 1600, u), 'saw'), [[0, 0], [0.8, 1], [1, 0]]);
  return stereo(mix([svf(t, (u) => expInterp(500, 6000, u), 1.5, 'lp'), 0.5], [svf(env(noise(0.5, 440), [[0, 0], [0.8, 1], [1, 0]]), (u) => expInterp(1000, 9000, u), 2, 'bp'), 0.6]), () => 0, 3);
});
v('zoom-out', () => {
  const t = env(osc(0.5, (u) => expInterp(1600, 200, u), 'saw'), [[0, 1], [1, 0]]);
  return stereo(svf(t, (u) => expInterp(6000, 500, u), 1.5, 'lp'), () => 0, 3);
});
v('laser', () => stereo(decay(osc(0.3, (t) => expInterp(3000, 200, t), 'square'), 0.3, 0.001)));
v('ui-open', () => stereo(mix([decay(osc(0.1, (t) => expInterp(400, 900, t), 'sine'), 0.1), 0.8], [decay(svf(noise(0.08, 450), () => 5000, 1, 'bp'), 0.05), 0.3])));
v('ui-close', () => stereo(mix([decay(osc(0.1, (t) => expInterp(900, 400, t), 'sine'), 0.1), 0.8], [decay(svf(noise(0.08, 451), () => 4000, 1, 'bp'), 0.05), 0.3])));
v('drum-roll-2s', () => {
  const parts = [];
  for (let k = 0; k < 40; k++) parts.push([decay(svf(noise(0.06, 460 + k), () => 900, 1, 'bp'), 0.05, 0.0005), 0.3 + (k / 40) * 0.7, k * 0.05]);
  parts.push([decay(mix([osc(1.2, () => 60), 1], [svf(noise(1.2, 501), () => 6000, 0.7, 'hp'), 0.6]), 1, 0.001), 1, 2]);
  return stereo(reverb(mix(...parts), 0.2, 0.7, 1));
});
v('rimshot', () => stereo(reverb(mix([decay(osc(0.1, () => 450, 'tri'), 0.08, 0.0005), 0.8], [decay(svf(noise(0.1, 510), () => 3500, 2, 'bp'), 0.07, 0.0003), 0.8]), 0.25, 0.4, 0.4)));

// ---------- render ----------
function writeWav(file, [L, R]) {
  const n = L.length;
  let peak = 1e-9;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = Math.pow(10, -1 / 20) / peak; // normalise to -1 dBFS
  const b = Buffer.alloc(44 + n * 4);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g)) * 32767), 44 + i * 4);
    b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g)) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(file, b);
}

const args = process.argv.slice(2);
if (args.includes('--list')) {
  console.log(Object.keys(P).join('\n'));
  process.exit(0);
}
const names = Object.keys(P).filter((n) => !args.length || args.some((a) => n.startsWith(a)));
fs.mkdirSync(OUT, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sfx-'));
let ok = 0;
try {
  for (const name of names) {
    const wav = path.join(tmp, `${name}.wav`);
    writeWav(wav, trimTail(P[name]()));
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '256k', path.join(OUT, `${name}.mp3`)]);
    ok++;
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`Generated ${ok} sounds in ${path.relative(root, OUT)}`);
