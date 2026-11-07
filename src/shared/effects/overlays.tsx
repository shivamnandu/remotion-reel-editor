import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { noise2D } from "@remotion/noise";

// ---------------------------------------------------------------------------
// Overlay effects: layer them above footage. All procedural (no image/video assets),
// deterministic (seeded), and CPU-safe. Most take `intensity` 0..1.
// ---------------------------------------------------------------------------

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Light leak: drifting warm blobs, screen-blended. Good across cuts or on a title. */
export const LightLeak: React.FC<{ intensity?: number; hue?: number; seed?: number; speed?: number }> = ({ intensity = 0.7, hue = 25, seed = 1, speed = 1 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const env = interpolate(frame, [0, durationInFrames * 0.3, durationInFrames * 0.7, durationInFrames], [0, 1, 1, 0], clamp);
  const blobs = [0, 1, 2].map((i) => {
    const t = (frame * 0.01 * speed) + i * 10;
    const x = 50 + noise2D(`lx${seed}${i}`, t, 0) * 60;
    const y = 40 + noise2D(`ly${seed}${i}`, 0, t) * 50;
    return `radial-gradient(circle at ${x}% ${y}%, hsla(${hue + i * 18}, 100%, ${60 + i * 8}%, ${0.9 - i * 0.2}) 0%, transparent ${45 + i * 10}%)`;
  });
  return <AbsoluteFill style={{ background: blobs.join(","), mixBlendMode: "screen", opacity: intensity * env, pointerEvents: "none" }} />;
};

/** Film burn: hot orange/white burn sweeping in from an edge (use 10-20 frames across a cut). */
export const FilmBurnOverlay: React.FC<{ from?: "left" | "right" | "top" | "bottom"; seed?: number }> = ({ from = "left", seed = 3 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = frame / Math.max(1, durationInFrames - 1);
  const k = Math.sin(Math.PI * p);
  const pos = interpolate(p, [0, 1], [-30, 130]);
  const ang = { left: 90, right: 270, top: 180, bottom: 0 }[from];
  const flick = 0.85 + random(`fb${seed}${frame}`) * 0.3;
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", opacity: k * flick, pointerEvents: "none", background: `linear-gradient(${ang}deg, transparent ${pos - 40}%, rgba(255,90,0,0.9) ${pos - 15}%, rgba(255,220,150,1) ${pos}%, rgba(255,120,20,0.8) ${pos + 12}%, transparent ${pos + 35}%)` }} />
  );
};

/** Dust & scratches: old-film specks and vertical scratches. */
export const DustScratches: React.FC<{ amount?: number; seed?: number }> = ({ amount = 1, seed = 0 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const f = frame + seed * 1000;
  const specks = Array.from({ length: Math.round(14 * amount) }, (_, i) => ({ x: random(`dx${f}${i}`) * width, y: random(`dy${f}${i}`) * height, r: 1 + random(`dr${f}${i}`) * 4, o: 0.3 + random(`do${f}${i}`) * 0.6 }));
  const scratches = Array.from({ length: random(`sn${f}`) < 0.5 ? 1 : 2 }, (_, i) => ({ x: random(`sx${f}${i}`) * width, o: 0.15 + random(`so${f}${i}`) * 0.3 }));
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {specks.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={i % 3 ? "#000" : "#fff"} opacity={s.o} />)}
      {scratches.map((s, i) => <line key={`s${i}`} x1={s.x} x2={s.x + 3} y1={0} y2={height} stroke="#fff" strokeWidth={1.5} opacity={s.o} />)}
    </svg>
  );
};

/**
 * True RGB split: the layer is drawn three times, each keeping one colour channel (SVG colour
 * matrix), screen-blended over black and offset. Unlike a drop-shadow, this works on opaque
 * full-frame footage. dx/dy are the red channel offset; blue goes the opposite way.
 */
const CHANNELS = { r: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0", g: "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0", b: "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" } as const;
export const RGBSplit: React.FC<{ children: React.ReactNode; dx?: number; dy?: number }> = ({ children, dx = 8, dy = 0 }) => {
  if (!dx && !dy) return <AbsoluteFill>{children}</AbsoluteFill>;
  return (
    <AbsoluteFill style={{ background: "#000", isolation: "isolate" }}>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        {(Object.keys(CHANNELS) as (keyof typeof CHANNELS)[]).map((c) => (
          <filter key={c} id={`rgb-${c}`} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values={CHANNELS[c]} /></filter>
        ))}
      </svg>
      <AbsoluteFill style={{ filter: "url(#rgb-r)", transform: `translate(${dx}px, ${dy}px)`, mixBlendMode: "screen" }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ filter: "url(#rgb-g)", mixBlendMode: "screen" }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ filter: "url(#rgb-b)", transform: `translate(${-dx}px, ${-dy}px)`, mixBlendMode: "screen" }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

/** VHS look: chroma bleed (RGB split), scanlines, rolling tracking band, jitter. Wrap footage in it. */
export const VHS: React.FC<{ children: React.ReactNode; intensity?: number }> = ({ children, intensity = 1 }) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const band = ((frame * 23) % (height + 200)) - 100;
  const jitter = (random(`vj${frame}`) - 0.5) * 6 * intensity;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `translateX(${jitter}px)`, filter: `saturate(${1 + 0.35 * intensity}) contrast(1.08) blur(${0.6 * intensity}px)` }}>
        <RGBSplit dx={4 * intensity}>{children}</RGBSplit>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.25) 0px, rgba(0,0,0,0.25) 2px, transparent 2px, transparent 5px)", opacity: intensity, pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: band, height: 60, background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.22) 50%, transparent)", mixBlendMode: "screen", opacity: intensity }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.45) 100%)", pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

/** Chromatic aberration (RGB split) on any layer; `amount` px, can be animated. */
export const ChromaticAberration: React.FC<{ children: React.ReactNode; amount?: number }> = ({ children, amount = 6 }) => <RGBSplit dx={amount}>{children}</RGBSplit>;

/** Glitch: RGB-split bursts + random horizontal slice displacement. Wrap footage or graphics. */
export const Glitch: React.FC<{ children: React.ReactNode; intensity?: number; seed?: number; everyFrames?: number }> = ({ children, intensity = 1, seed = 0, everyFrames = 2 }) => {
  const frame = useCurrentFrame();
  const s = Math.floor(frame / everyFrames) + seed * 997;
  const on = random(`gon${s}`) < 0.6;
  const slices = on ? Array.from({ length: 3 }, (_, i) => ({ top: random(`gt${s}${i}`) * 95, h: 2 + random(`gh${s}${i}`) * 10, dx: (random(`gd${s}${i}`) - 0.5) * 140 * intensity })) : [];
  const split = on ? 14 * intensity * (random(`gs${s}`) - 0.5) * 2 : 0;
  return (
    <AbsoluteFill>
      <RGBSplit dx={split}>{children}</RGBSplit>
      {slices.map((sl, i) => (
        <AbsoluteFill key={i} style={{ clipPath: `inset(${sl.top}% 0 ${Math.max(0, 100 - sl.top - sl.h)}% 0)`, transform: `translateX(${sl.dx}px)` }}>{children}</AbsoluteFill>
      ))}
    </AbsoluteFill>
  );
};

/** Letterbox bars (cinematic 2.39:1 inside 9:16, or any thickness), animatable in. */
export const Letterbox: React.FC<{ bar?: number; animateFrames?: number; color?: string }> = ({ bar = 260, animateFrames = 10, color = "#000" }) => {
  const frame = useCurrentFrame();
  const h = interpolate(frame, [0, animateFrames], [0, bar], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: h, background: color }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: h, background: color }} />
    </AbsoluteFill>
  );
};

type ParticleKind = "confetti" | "sparkles" | "snow" | "bokeh" | "embers" | "hearts";
/**
 * Particle field: confetti burst, sparkles, snow, bokeh, embers, hearts. Deterministic per seed.
 * origin: burst point for confetti (reel coords); other kinds fill the frame.
 */
export const Particles: React.FC<{ kind?: ParticleKind; count?: number; seed?: number; colors?: string[]; origin?: [number, number] }> = ({
  kind = "confetti", count = 80, seed = 7, colors = ["#FF3B3B", "#FFD60A", "#34C759", "#0A84FF", "#BF5AF2", "#FFFFFF"], origin = [540, 900],
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const ps = useMemo(
    () => Array.from({ length: count }, (_, i) => ({ r1: random(`p1${seed}${i}`), r2: random(`p2${seed}${i}`), r3: random(`p3${seed}${i}`), r4: random(`p4${seed}${i}`), c: colors[i % colors.length] })),
    [count, seed, colors],
  );
  const t = frame / fps;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {ps.map((p, i) => {
        let x = 0, y = 0, size = 10, op = 1, rot = 0;
        let shape: React.CSSProperties = {};
        if (kind === "confetti") {
          // Burst with drag: fast outward, slowing quickly, then drifting down with flutter.
          const ang = p.r1 * Math.PI * 2, v = 600 + p.r2 * 900, drag = 1 - Math.exp(-3 * t);
          x = origin[0] + (Math.cos(ang) * v * drag) / 3 + Math.sin(t * 6 + i) * 25;
          y = origin[1] + (Math.sin(ang) * v * drag) / 3 - (500 * drag) / 3 + 260 * t * t;
          size = 16 + p.r3 * 16; rot = t * 600 * (p.r4 - 0.5);
          op = interpolate(t, [0, 2.4, 3.2], [1, 1, 0], clamp);
          shape = { width: size, height: size * 0.45, background: p.c, borderRadius: 2 };
        } else if (kind === "snow") {
          x = (p.r1 * width + Math.sin(t * (1 + p.r2) + i) * 40) % width; y = ((p.r2 * height + t * (60 + p.r3 * 120)) % (height + 40)) - 20;
          size = 4 + p.r3 * 9; op = 0.5 + p.r4 * 0.5; shape = { width: size, height: size, background: "#fff", borderRadius: "50%", filter: "blur(1px)" };
        } else if (kind === "bokeh") {
          x = p.r1 * width + noise2D(`bx${i}`, t * 0.2, 0) * 60; y = p.r2 * height + noise2D(`by${i}`, 0, t * 0.2) * 60;
          size = 40 + p.r3 * 140; op = 0.12 + p.r4 * 0.25; shape = { width: size, height: size, background: `radial-gradient(circle, ${p.c} 0%, transparent 70%)`, borderRadius: "50%" };
        } else if (kind === "embers") {
          x = p.r1 * width + Math.sin(t * 2 + i) * 30; y = height - ((p.r2 * height + t * (80 + p.r3 * 160)) % (height + 40));
          size = 3 + p.r3 * 6; op = 0.4 + 0.6 * Math.abs(Math.sin(t * 4 + i)); shape = { width: size, height: size, background: "#FFB347", borderRadius: "50%", boxShadow: "0 0 12px #FF7A00" };
        } else if (kind === "hearts") {
          x = p.r1 * width + Math.sin(t * 2 + i) * 50; y = height + 60 - ((t * (200 + p.r2 * 250) + p.r3 * 400) % (height + 200));
          size = 30 + p.r3 * 40; op = 0.9; return <div key={i} style={{ position: "absolute", left: x, top: y, fontSize: size, opacity: op, color: "#FF2D55" }}>♥</div>;
        } else {
          // sparkles: twinkling 4-point stars
          x = p.r1 * width; y = p.r2 * height; size = 14 + p.r3 * 30;
          op = Math.max(0, Math.sin(t * (3 + p.r4 * 4) + i * 1.7));
          return (
            <svg key={i} width={size} height={size} viewBox="0 0 20 20" style={{ position: "absolute", left: x, top: y, opacity: op }}>
              <path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" fill="#fff" />
            </svg>
          );
        }
        return <div key={i} style={{ position: "absolute", left: x, top: y, opacity: op, transform: `rotate(${rot}deg)`, ...shape }} />;
      })}
    </AbsoluteFill>
  );
};

/** Animated gradient background (mesh-like, slow drift) for full-screen graphic moments. */
export const GradientBackground: React.FC<{ colors?: string[]; speed?: number; seed?: number }> = ({ colors = ["#12002f", "#ff3b3b", "#ff9f0a", "#5e5ce6"], speed = 1, seed = 2 }) => {
  const frame = useCurrentFrame();
  const t = frame * 0.008 * speed;
  const layers = colors.slice(1).map((c, i) => {
    const x = 50 + noise2D(`gbx${seed}${i}`, t, i) * 55, y = 50 + noise2D(`gby${seed}${i}`, i, t) * 55;
    return `radial-gradient(circle at ${x}% ${y}%, ${c} 0%, transparent 55%)`;
  });
  return <AbsoluteFill style={{ background: `${layers.join(",")}, ${colors[0]}` }} />;
};

/** Spotlight: darken everything except a soft circle (focus attention on a point). */
export const Spotlight: React.FC<{ x: number; y: number; radius?: number; dim?: number; animateFrames?: number }> = ({ x, y, radius = 260, dim = 0.7, animateFrames = 8 }) => {
  const frame = useCurrentFrame();
  const k = interpolate(frame, [0, animateFrames], [0, 1], clamp);
  return <AbsoluteFill style={{ pointerEvents: "none", background: `radial-gradient(circle ${radius + (1 - k) * 600}px at ${x}px ${y}px, transparent 70%, rgba(0,0,0,${dim * k}) 100%)` }} />;
};

/** Scanline / grid tech overlay (HUD look). */
export const HudGrid: React.FC<{ color?: string; opacity?: number; line?: number; cell?: number }> = ({ color = "rgba(0,255,200,0.35)", opacity = 1, line = 2, cell = 60 }) => (
  <AbsoluteFill style={{ pointerEvents: "none", opacity, backgroundImage: `linear-gradient(${color} ${line}px, transparent ${line}px), linear-gradient(90deg, ${color} ${line}px, transparent ${line}px)`, backgroundSize: `${cell}px ${cell}px` }} />
);
