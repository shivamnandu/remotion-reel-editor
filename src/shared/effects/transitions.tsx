import React from "react";
import { AbsoluteFill, interpolate, random } from "remotion";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { RGBSplit } from "./overlays";

// ---------------------------------------------------------------------------
// Transitions for <TransitionSeries> (@remotion/transitions).
//
//   <TransitionSeries>
//     <TransitionSeries.Sequence durationInFrames={90}>{A}</TransitionSeries.Sequence>
//     <TransitionSeries.Transition presentation={zoomThrough()} timing={linearTiming({ durationInFrames: 10 })} />
//     <TransitionSeries.Sequence durationInFrames={90}>{B}</TransitionSeries.Sequence>
//   </TransitionSeries>
//
// Built-in Remotion presentations (import from "@remotion/transitions/<name>"):
//   fade, slide, wipe, flip, clockWipe, iris, cube, bookFlip, none, dissolve, swap, pushCut,
//   blurSlide, linearBlur, zoomBlur, zoomInOut, dreamyZoom, crossZoom, crosswarp, ripple, filmBurn
//   (some of these are GPU shaders: run `npm run check` on them on this CPU-only machine first;
//   the CSS ones below always render).
//
// Custom CSS presentations below: deterministic, CPU-safe, brand-agnostic.
// Typical lengths at 30 fps: cuts-with-flair 6-10 frames, scene changes 12-20.
// ---------------------------------------------------------------------------

type Dir = "left" | "right" | "up" | "down";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const vec = (d: Dir) => (d === "left" ? [-1, 0] : d === "right" ? [1, 0] : d === "up" ? [0, -1] : [0, 1]);

function make<P extends Record<string, unknown>>(Comp: React.FC<TransitionPresentationComponentProps<P>>) {
  return (props: P = {} as P): TransitionPresentation<P> => ({ component: Comp, props });
}

/** Zoom through: outgoing scales up and blurs away, incoming lands from slightly larger. */
const ZoomThrough: React.FC<TransitionPresentationComponentProps<{ amount?: number }>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  const a = passedProps.amount ?? 1.6;
  const exiting = presentationDirection === "exiting";
  const scale = exiting ? interpolate(p, [0, 1], [1, a]) : interpolate(p, [0, 1], [1 / a + 0.4, 1]);
  const blur = exiting ? p * 24 : (1 - p) * 24;
  const opacity = exiting ? 1 - p : Math.min(1, p * 2);
  return <AbsoluteFill style={{ transform: `scale(${scale})`, filter: `blur(${blur}px)`, opacity }}>{children}</AbsoluteFill>;
};
export const zoomThrough = make(ZoomThrough);

/** Whip pan: both shots slide in one direction with heavy directional blur. */
const WhipPan: React.FC<TransitionPresentationComponentProps<{ direction?: Dir }>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  const [dx, dy] = vec(passedProps.direction ?? "left");
  const exiting = presentationDirection === "exiting";
  const t = exiting ? p : p - 1; // exiting 0 -> 1 moves out, entering -1 -> 0 moves in
  const blur = Math.sin(Math.PI * p) * 40;
  return <AbsoluteFill style={{ transform: `translate(${dx * t * 100}%, ${dy * t * 100}%)`, filter: `blur(${blur}px)` }}>{children}</AbsoluteFill>;
};
export const whipPan = make(WhipPan);

/** Glitch cut: RGB-split jitter + slice offsets, then hard switch at the midpoint. */
const GlitchCut: React.FC<TransitionPresentationComponentProps<{ seed?: number }>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  const exiting = presentationDirection === "exiting";
  const visible = exiting ? p < 0.5 : p >= 0.5;
  if (!visible) return null;
  const k = Math.sin(Math.PI * p);
  const s = Math.floor(p * 12) + (passedProps.seed ?? 0) * 100;
  const jx = (random(`gx${s}`) - 0.5) * 80 * k;
  const slice = random(`gs${s}`) * 100;
  return (
    <AbsoluteFill style={{ transform: `translateX(${jx}px)` }}>
      <RGBSplit dx={16 * k}>{children}</RGBSplit>
      <AbsoluteFill style={{ clipPath: `inset(${slice}% 0 ${Math.max(0, 100 - slice - 8)}% 0)`, transform: `translateX(${(random(`go${s}`) - 0.5) * 160 * k}px)` }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};
export const glitchCut = make(GlitchCut);

/** Flash cut: through white (or any colour) at the midpoint. */
const FlashCut: React.FC<TransitionPresentationComponentProps<{ color?: string }>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  const exiting = presentationDirection === "exiting";
  if (exiting ? p >= 0.5 : p < 0.5) return null;
  const flash = interpolate(p, [0, 0.5, 1], [0, 1, 0], clamp);
  return (
    <AbsoluteFill>
      {children}
      <AbsoluteFill style={{ background: passedProps.color ?? "#fff", opacity: flash }} />
    </AbsoluteFill>
  );
};
export const flashCut = make(FlashCut);

/** Spin: outgoing spins + shrinks, incoming spins in from the other side. */
const Spin: React.FC<TransitionPresentationComponentProps<{ degrees?: number }>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  const deg = passedProps.degrees ?? 180;
  const exiting = presentationDirection === "exiting";
  const rot = exiting ? p * deg : (p - 1) * deg;
  const scale = exiting ? 1 - p * 0.6 : 0.4 + p * 0.6;
  return <AbsoluteFill style={{ transform: `rotate(${rot}deg) scale(${scale})`, opacity: exiting ? 1 - p : p, filter: `blur(${Math.sin(Math.PI * p) * 10}px)` }}>{children}</AbsoluteFill>;
};
export const spin = make(Spin);

/** Blur dissolve: cross-dissolve through a soft blur (gentle scene change). */
const BlurDissolve: React.FC<TransitionPresentationComponentProps<{ blur?: number }>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  const exiting = presentationDirection === "exiting";
  const b = (passedProps.blur ?? 30) * (exiting ? p : 1 - p);
  return <AbsoluteFill style={{ filter: `blur(${b}px)`, opacity: exiting ? 1 : p }}>{children}</AbsoluteFill>;
};
export const blurDissolve = make(BlurDissolve);

/** Shape reveal: incoming grows out of a circle / diamond / star / heart from a point. */
const SHAPES: Record<string, (r: number) => string> = {
  circle: (r) => `circle(${r}% at var(--x) var(--y))`,
  diamond: (r) => `polygon(var(--x) calc(var(--y) - ${r * 1.6}%), calc(var(--x) + ${r * 1.6}%) var(--y), var(--x) calc(var(--y) + ${r * 1.6}%), calc(var(--x) - ${r * 1.6}%) var(--y))`,
  rect: (r) => `inset(${Math.max(0, 50 - r)}% ${Math.max(0, 50 - r)}% ${Math.max(0, 50 - r)}% ${Math.max(0, 50 - r)}% round 40px)`,
};
const ShapeReveal: React.FC<TransitionPresentationComponentProps<{ shape?: "circle" | "diamond" | "rect"; x?: number; y?: number }>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  if (presentationDirection === "exiting") return <AbsoluteFill>{children}</AbsoluteFill>;
  const r = interpolate(p, [0, 1], [0, 120], { ...clamp, easing: (t) => t * t * (3 - 2 * t) });
  const style = { clipPath: SHAPES[passedProps.shape ?? "circle"](r), "--x": `${passedProps.x ?? 50}%`, "--y": `${passedProps.y ?? 40}%` } as React.CSSProperties;
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};
export const shapeReveal = make(ShapeReveal);

/** Split doors: outgoing splits in two halves sliding apart (vertical or horizontal). */
const SplitDoors: React.FC<TransitionPresentationComponentProps<{ vertical?: boolean }>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  if (presentationDirection === "entering") return <AbsoluteFill>{children}</AbsoluteFill>;
  const v = passedProps.vertical ?? true;
  const e = p * p;
  const a = v ? { clipPath: "inset(0 50% 0 0)", transform: `translateX(${-e * 55}%)` } : { clipPath: "inset(0 0 50% 0)", transform: `translateY(${-e * 55}%)` };
  const b = v ? { clipPath: "inset(0 0 0 50%)", transform: `translateX(${e * 55}%)` } : { clipPath: "inset(50% 0 0 0)", transform: `translateY(${e * 55}%)` };
  // The entering scene is rendered after (on top of) the exiting one, so lift the doors above it.
  return (
    <AbsoluteFill style={{ zIndex: 1 }}>
      <AbsoluteFill style={a}>{children}</AbsoluteFill>
      <AbsoluteFill style={b}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};
export const splitDoors = make(SplitDoors);

/** Slide push with overshoot (social-style "swipe to next"). */
const SwipePush: React.FC<TransitionPresentationComponentProps<{ direction?: Dir }>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  const [dx, dy] = vec(passedProps.direction ?? "up");
  const ease = 1 - Math.pow(1 - p, 4);
  const t = presentationDirection === "exiting" ? ease : ease - 1;
  return <AbsoluteFill style={{ transform: `translate(${dx * t * 100}%, ${dy * t * 100}%)` }}>{children}</AbsoluteFill>;
};
export const swipePush = make(SwipePush);

/** Luma dip: through black with a slight scale ("dip to black", film-style). */
const DipToBlack: React.FC<TransitionPresentationComponentProps<{ color?: string }>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  const exiting = presentationDirection === "exiting";
  if (exiting ? p >= 0.5 : p < 0.5) return null;
  const dark = interpolate(p, [0, 0.5, 1], [0, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ transform: `scale(${1 + dark * 0.04})` }}>
      {children}
      <AbsoluteFill style={{ background: passedProps.color ?? "#000", opacity: dark }} />
    </AbsoluteFill>
  );
};
export const dipToBlack = make(DipToBlack);

/** Pixelate dissolve (blocky mosaic out and in). CPU-safe approximation using an SVG filter. */
const Pixelate: React.FC<TransitionPresentationComponentProps<{ max?: number }>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  const exiting = presentationDirection === "exiting";
  if (exiting ? p >= 0.5 : p < 0.5) return null;
  const k = interpolate(p, [0, 0.5, 1], [1, passedProps.max ?? 60, 1], clamp);
  const size = Math.max(1, Math.round(k));
  const id = `px${size}`;
  return (
    <AbsoluteFill>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <filter id={id} x="0" y="0" width="100%" height="100%">
          <feFlood x={size / 2} y={size / 2} height="1" width="1" />
          <feComposite width={size} height={size} />
          <feTile result="a" />
          <feComposite in="SourceGraphic" in2="a" operator="in" />
          <feMorphology operator="dilate" radius={size / 2} />
        </filter>
      </svg>
      <AbsoluteFill style={{ filter: size > 1 ? `url(#${id})` : undefined }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};
export const pixelate = make(Pixelate);
