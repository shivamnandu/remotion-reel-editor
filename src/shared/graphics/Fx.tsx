import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../../../brand/theme";
import { clamp } from "./anim";

/** White (or colour) flash over `frames` frames: put it on a cut for a punchy transition. */
export const Flash: React.FC<{ frames?: number; color?: string; peak?: number }> = ({ frames = 6, color = "#fff", peak = 0.9 }) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: color, opacity: interpolate(frame, [0, 1, frames], [peak, peak, 0], clamp), pointerEvents: "none" }} />;
};

/**
 * Camera move wrapper for the footage layer: punch-in / zoom / push / shake.
 * - punch: instant scale on the cut (jump-cut punch-in; 4K source stays sharp up to ~1.4x)
 * - push: slow continuous push-in across the Sequence
 * - zoomIn: eased zoom over `frames`
 * focus: the point that stays put while scaling (reel coordinates), e.g. the speaker's face.
 */
export const Camera: React.FC<{ children: React.ReactNode; mode: "punch" | "push" | "zoomIn" | "shake"; scale?: number; frames?: number; focus?: [number, number]; intensity?: number }> = ({
  children, mode, scale = 1.15, frames = 10, focus = [540, 760], intensity = 10,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  let s = 1, tx = 0, ty = 0;
  if (mode === "punch") s = scale;
  if (mode === "push") s = interpolate(frame, [0, durationInFrames], [1, scale], clamp);
  if (mode === "zoomIn") s = interpolate(frame, [0, frames], [1, scale], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
  if (mode === "shake") {
    const decay = interpolate(frame, [0, frames], [1, 0], clamp);
    tx = (random(`x${frame}`) - 0.5) * 2 * intensity * decay;
    ty = (random(`y${frame}`) - 0.5) * 2 * intensity * decay;
    s = 1 + 0.02 * decay;
  }
  return (
    <AbsoluteFill style={{ transform: `translate(${tx}px, ${ty}px) scale(${s})`, transformOrigin: `${focus[0]}px ${focus[1]}px` }}>{children}</AbsoluteFill>
  );
};

/** Whip transition: directional motion blur + slide over `frames` (place across a cut, half each side). */
export const Whip: React.FC<{ children: React.ReactNode; frames?: number; direction?: "left" | "right" | "up" | "down"; out?: boolean }> = ({ children, frames = 8, direction = "left", out = false }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = out ? interpolate(frame, [durationInFrames - frames, durationInFrames], [0, 1], clamp) : interpolate(frame, [0, frames], [1, 0], clamp);
  const dist = 1080 * 0.6 * t * (direction === "left" || direction === "up" ? -1 : 1) * (out ? 1 : -1);
  const horiz = direction === "left" || direction === "right";
  return (
    <AbsoluteFill style={{ transform: horiz ? `translateX(${dist}px)` : `translateY(${dist}px)`, filter: `blur(${t * 28}px)` }}>{children}</AbsoluteFill>
  );
};

/** Film look: vignette + animated grain (deterministic). Subtle by default. */
export const FilmLook: React.FC<{ vignette?: number; grain?: number }> = ({ vignette = 0.35, grain = 0.06 }) => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 2);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,${vignette}) 100%)` }} />
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: grain, mixBlendMode: "overlay" }}>
        <filter id={`g${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={seed} />
        </filter>
        <rect width="100%" height="100%" filter={`url(#g${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

/** Coloured ground with a soft gradient, for full-screen graphic moments. */
export const Ground: React.FC<{ color?: string; to?: string; children?: React.ReactNode }> = ({ color = theme.colors.primary, to, children }) => (
  <AbsoluteFill style={{ background: to ? `linear-gradient(160deg, ${color}, ${to})` : color }}>{children}</AbsoluteFill>
);

/**
 * QA overlay (never in deliverables): Instagram 4:5 safe band, side margins, and a 100px grid,
 * so placement can be checked numerically in `npm run check` renders. Enable via a prop.
 */
export const SafeAreaGuide: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      {Array.from({ length: 19 }, (_, i) => (
        <line key={`h${i}`} x1={0} x2={1080} y1={(i + 1) * 100} y2={(i + 1) * 100} stroke="rgba(0,255,255,0.25)" strokeWidth={2} />
      ))}
      <rect x={theme.safe.side} y={theme.safe.top} width={1080 - theme.safe.side * 2} height={theme.safe.bottom - theme.safe.top} fill="none" stroke="#00ff66" strokeWidth={4} strokeDasharray="16 10" />
      <text x={70} y={theme.safe.top - 12} fill="#00ff66" fontSize={30} fontFamily="monospace">IG 4:5 safe y{theme.safe.top}-{theme.safe.bottom}</text>
    </svg>
  </AbsoluteFill>
);
