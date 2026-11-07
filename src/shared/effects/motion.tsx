import React from "react";
import { AbsoluteFill, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { noise2D } from "@remotion/noise";
import { CameraMotionBlur, Trail } from "@remotion/motion-blur";

// ---------------------------------------------------------------------------
// Motion effects: wrap layers (footage, images, graphics) to move them.
// All deterministic. Coordinates are reel pixels (1080x1920).
// For camera moves on footage see also graphics/Fx.tsx <Camera> (punch/push/zoomIn/shake).
// ---------------------------------------------------------------------------

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (t: number) => t * t * (3 - 2 * t);

/** Ken Burns on a still: slow zoom + pan between two framings over the Sequence. */
export const KenBurns: React.FC<{ src: string; fromScale?: number; toScale?: number; from?: [number, number]; to?: [number, number] }> = ({ src, fromScale = 1.05, toScale = 1.25, from = [50, 50], to = [50, 40] }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = ease(frame / Math.max(1, durationInFrames - 1));
  const s = interpolate(t, [0, 1], [fromScale, toScale]);
  const x = interpolate(t, [0, 1], [from[0], to[0]]), y = interpolate(t, [0, 1], [from[1], to[1]]);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${s})`, transformOrigin: `${x}% ${y}%` }} />
    </AbsoluteFill>
  );
};

/** Parallax: stack layers that move at different depths (0 = background, 1 = foreground). */
export const Parallax: React.FC<{ layers: { node: React.ReactNode; depth: number }[]; distance?: number; direction?: "x" | "y" }> = ({ layers, distance = 160, direction = "x" }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / Math.max(1, durationInFrames - 1) - 0.5;
  return (
    <AbsoluteFill>
      {layers.map((l, i) => {
        const d = t * distance * (0.2 + l.depth);
        return <AbsoluteFill key={i} style={{ transform: direction === "x" ? `translateX(${-d}px) scale(${1 + l.depth * 0.08})` : `translateY(${-d}px) scale(${1 + l.depth * 0.08})` }}>{l.node}</AbsoluteFill>;
      })}
    </AbsoluteFill>
  );
};

/** 3D tilt: card rotates in perspective (enter from tilted, settle flat, gentle float). */
export const Tilt3D: React.FC<{ children: React.ReactNode; fromX?: number; fromY?: number; float?: boolean; perspective?: number }> = ({ children, fromX = 25, fromY = -30, float = true, perspective = 1600 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const fx = float ? Math.sin(frame / 25) * 4 : 0, fy = float ? Math.cos(frame / 31) * 5 : 0;
  return (
    <AbsoluteFill style={{ perspective }}>
      <AbsoluteFill style={{ transform: `rotateX(${(1 - s) * fromX + fx}deg) rotateY(${(1 - s) * fromY + fy}deg) scale(${0.85 + 0.15 * s})`, transformStyle: "preserve-3d" }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Organic wiggle/float (noise-driven, deterministic). amount in px, rotate in degrees. */
export const Wiggle: React.FC<{ children: React.ReactNode; amount?: number; rotate?: number; speed?: number; seed?: string }> = ({ children, amount = 8, rotate = 1.5, speed = 1, seed = "w" }) => {
  const frame = useCurrentFrame();
  const t = frame * 0.03 * speed;
  return <AbsoluteFill style={{ transform: `translate(${noise2D(`${seed}x`, t, 0) * amount}px, ${noise2D(`${seed}y`, 0, t) * amount}px) rotate(${noise2D(`${seed}r`, t, t) * rotate}deg)` }}>{children}</AbsoluteFill>;
};

/** Bounce-in / pop-in / drop-in entrance for any element. */
export const Entrance: React.FC<{ children: React.ReactNode; kind?: "pop" | "drop" | "rise" | "slideLeft" | "slideRight" | "spin" | "blur"; delay?: number }> = ({ children, kind = "pop", delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: kind === "drop" || kind === "pop" ? { damping: 11, stiffness: 170 } : { damping: 200, stiffness: 200 } });
  const map: Record<string, string> = {
    pop: `scale(${s})`,
    drop: `translateY(${(1 - s) * -700}px)`,
    rise: `translateY(${(1 - s) * 300}px)`,
    slideLeft: `translateX(${(1 - s) * 1100}px)`,
    slideRight: `translateX(${(1 - s) * -1100}px)`,
    spin: `rotate(${(1 - s) * -180}deg) scale(${s})`,
    blur: `scale(${1.15 - 0.15 * s})`,
  };
  return <AbsoluteFill style={{ transform: map[kind], opacity: frame < delay ? 0 : Math.min(1, s * 1.4), filter: kind === "blur" ? `blur(${(1 - s) * 30}px)` : undefined }}>{children}</AbsoluteFill>;
};

/** Picture-in-picture: a rounded inset (webcam over screen recording, reaction, etc.). */
export const PictureInPicture: React.FC<{ children: React.ReactNode; x?: number; y?: number; width?: number; height?: number; radius?: number; border?: string; circle?: boolean }> = ({
  children, x = 640, y = 1180, width = 380, height = 500, radius = 36, border = "6px solid #fff", circle = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 16, stiffness: 160 } });
  const w = circle ? Math.min(width, height) : width, h = circle ? w : height;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, borderRadius: circle ? "50%" : radius, overflow: "hidden", border, boxShadow: "0 20px 50px rgba(0,0,0,0.45)", transform: `scale(${s})` }}>
      <AbsoluteFill>{children}</AbsoluteFill>
    </div>
  );
};

/** Split screen: two layers, top/bottom (default, vertical reel) or left/right, with a seam. */
export const SplitScreen: React.FC<{ a: React.ReactNode; b: React.ReactNode; split?: number; horizontal?: boolean; seam?: number; seamColor?: string; animate?: boolean }> = ({
  a, b, split = 0.5, horizontal = true, seam = 6, seamColor = "#fff", animate = true,
}) => {
  const frame = useCurrentFrame();
  const k = animate ? interpolate(frame, [0, 10], [0, 1], { ...clamp, easing: ease }) : 1;
  const pct = split * 100 * k + (1 - k) * 100;
  return horizontal ? (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: `${pct}%`, overflow: "hidden" }}><AbsoluteFill>{a}</AbsoluteFill></div>
      <div style={{ position: "absolute", left: 0, right: 0, top: `${pct}%`, bottom: 0, overflow: "hidden" }}><AbsoluteFill>{b}</AbsoluteFill></div>
      <div style={{ position: "absolute", left: 0, right: 0, top: `calc(${pct}% - ${seam / 2}px)`, height: seam, background: seamColor }} />
    </AbsoluteFill>
  ) : (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${pct}%`, overflow: "hidden" }}><AbsoluteFill>{a}</AbsoluteFill></div>
      <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pct}%`, right: 0, overflow: "hidden" }}><AbsoluteFill>{b}</AbsoluteFill></div>
      <div style={{ position: "absolute", top: 0, bottom: 0, left: `calc(${pct}% - ${seam / 2}px)`, width: seam, background: seamColor }} />
    </AbsoluteFill>
  );
};

/** Mask reveal: a layer revealed by a growing circle / wipe / bars over `frames`. */
export const MaskReveal: React.FC<{ children: React.ReactNode; shape?: "circle" | "wipeLeft" | "wipeUp" | "bars" | "diagonal"; frames?: number; x?: number; y?: number }> = ({ children, shape = "circle", frames = 14, x = 50, y = 45 }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, frames], [0, 1], { ...clamp, easing: ease });
  const clip: Record<string, string> = {
    circle: `circle(${p * 120}% at ${x}% ${y}%)`,
    wipeLeft: `inset(0 ${100 - p * 100}% 0 0)`,
    wipeUp: `inset(${100 - p * 100}% 0 0 0)`,
    diagonal: `polygon(0 0, ${p * 200}% 0, ${p * 200 - 100}% 100%, 0 100%)`,
    bars: `polygon(${Array.from({ length: 6 }, (_, i) => { const t = i / 6, h = 1 / 6; return `0 ${t * 100}%, ${p * 100}% ${t * 100}%, ${p * 100}% ${(t + h) * 100}%, 0 ${(t + h) * 100}%`; }).join(", ")})`,
  };
  return <AbsoluteFill style={{ clipPath: clip[shape] }}>{children}</AbsoluteFill>;
};

/** Censor: blur or pixelate a rectangle of whatever is underneath (use backdrop-filter). */
export const Censor: React.FC<{ x: number; y: number; w: number; h: number; mode?: "blur" | "pixel" | "bar"; strength?: number; radius?: number }> = ({ x, y, w, h, mode = "blur", strength = 30, radius = 16 }) => {
  if (mode === "bar") return <div style={{ position: "absolute", left: x, top: y, width: w, height: h, background: "#000", borderRadius: 6 }} />;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, borderRadius: radius, overflow: "hidden", backdropFilter: mode === "blur" ? `blur(${strength}px)` : `blur(${strength / 3}px) contrast(1.4) saturate(0.6)`, WebkitBackdropFilter: `blur(${strength}px)` }}>
      {mode === "pixel" ? <div style={{ width: "100%", height: "100%", backgroundImage: `linear-gradient(rgba(0,0,0,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.25) 1px, transparent 1px)`, backgroundSize: `${strength}px ${strength}px` }} /> : null}
    </div>
  );
};

/** Zoom blur: radial blur feel by stacking scaled copies (strength 0..1). CPU-friendly. */
export const ZoomBlur: React.FC<{ children: React.ReactNode; strength?: number; copies?: number; origin?: string }> = ({ children, strength = 0.5, copies = 6, origin = "50% 45%" }) => (
  <AbsoluteFill>
    {Array.from({ length: copies }, (_, i) => (
      <AbsoluteFill key={i} style={{ transform: `scale(${1 + (i / copies) * 0.25 * strength})`, transformOrigin: origin, opacity: i === 0 ? 1 : (1 - i / copies) * 0.45, filter: i ? `blur(${i * 2 * strength}px)` : undefined }}>{children}</AbsoluteFill>
    ))}
  </AbsoluteFill>
);

/** Real motion blur for fast-moving graphics (renders sub-frames: costs `samples`x render time). */
export const MotionBlur: React.FC<{ children: React.ReactNode; samples?: number; shutterAngle?: number }> = ({ children, samples = 6, shutterAngle = 180 }) => (
  <CameraMotionBlur samples={samples} shutterAngle={shutterAngle}>{children}</CameraMotionBlur>
);

/** Echo trail behind moving elements (stylised motion blur). */
export const EchoTrail: React.FC<{ children: React.ReactNode; layers?: number; lag?: number; opacity?: number }> = ({ children, layers = 5, lag = 0.6, opacity = 0.6 }) => (
  <Trail layers={layers} lagInFrames={lag} trailOpacity={opacity}>{children}</Trail>
);

/** Beat pulse: scale bump on given frames (music beats, word hits). */
export const BeatPulse: React.FC<{ children: React.ReactNode; beats: number[]; amount?: number; decay?: number }> = ({ children, beats, amount = 0.06, decay = 8 }) => {
  const frame = useCurrentFrame();
  const last = beats.filter((b) => b <= frame).pop();
  const k = last === undefined ? 0 : Math.max(0, 1 - (frame - last) / decay);
  return <AbsoluteFill style={{ transform: `scale(${1 + amount * k * k})` }}>{children}</AbsoluteFill>;
};

/** Handheld drift: subtle continuous camera float, makes static shots feel alive. */
export const Handheld: React.FC<{ children: React.ReactNode; amount?: number }> = ({ children, amount = 6 }) => {
  const frame = useCurrentFrame();
  const t = frame * 0.02;
  return <AbsoluteFill style={{ transform: `translate(${noise2D("hx", t, 0) * amount}px, ${noise2D("hy", 0, t) * amount}px) rotate(${noise2D("hr", t, t) * 0.3}deg) scale(1.02)` }}>{children}</AbsoluteFill>;
};

/** Earthquake / impact shake that decays (on a boom or punchline). */
export const ImpactShake: React.FC<{ children: React.ReactNode; intensity?: number; frames?: number }> = ({ children, intensity = 24, frames = 12 }) => {
  const frame = useCurrentFrame();
  const d = Math.max(0, 1 - frame / frames);
  return <AbsoluteFill style={{ transform: `translate(${(random(`ix${frame}`) - 0.5) * 2 * intensity * d}px, ${(random(`iy${frame}`) - 0.5) * 2 * intensity * d}px) rotate(${(random(`ir${frame}`) - 0.5) * 2 * d}deg)` }}>{children}</AbsoluteFill>;
};
