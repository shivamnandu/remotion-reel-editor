import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { evolvePath } from "@remotion/paths";
import { theme } from "../../../brand/theme";
import { clamp, useExit, useProgress } from "./anim";

/** Seeded wobble so hand-drawn strokes look drawn, but render identically every time. */
const wobble = (i: number, seed: number) => Math.sin(i * 12.9898 + seed * 78.233) * 4;

/**
 * Hand-drawn arrow + label pointing at a point (annotation style). Draws itself over drawFrames.
 * from/to are reel coordinates (1080x1920).
 */
export const Callout: React.FC<{ from: [number, number]; to: [number, number]; label?: string; color?: string; drawFrames?: number; seed?: number; labelSize?: number }> = ({
  from, to, label, color = theme.colors.accent, drawFrames = 12, seed = 1, labelSize = 64,
}) => {
  const p = useProgress(0, drawFrames);
  const head = useProgress(drawFrames - 2, drawFrames + 4);
  const exit = useExit(5);
  const [x1, y1] = from, [x2, y2] = to;
  const mx = (x1 + x2) / 2 + (y2 - y1) * 0.2 + wobble(1, seed), my = (y1 + y2) / 2 - (x2 - x1) * 0.2 + wobble(2, seed);
  const d = `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
  const evo = evolvePath(p, d);
  const ang = Math.atan2(y2 - my, x2 - mx);
  const hl = 34;
  const hd = `M ${x2 - hl * Math.cos(ang - 0.5)} ${y2 - hl * Math.sin(ang - 0.5)} L ${x2} ${y2} L ${x2 - hl * Math.cos(ang + 0.5)} ${y2 - hl * Math.sin(ang + 0.5)}`;
  const hevo = evolvePath(head, hd);
  return (
    <AbsoluteFill style={{ opacity: exit }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <path d={d} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" strokeDasharray={evo.strokeDasharray} strokeDashoffset={evo.strokeDashoffset} />
        <path d={hd} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={hevo.strokeDasharray} strokeDashoffset={hevo.strokeDashoffset} />
      </svg>
      {label ? (
        <div style={{ position: "absolute", left: x1, top: y1, transform: `translate(-50%, ${y1 < y2 ? "-110%" : "10%"}) rotate(${-3 + wobble(3, seed) * 0.5}deg)`, fontFamily: theme.fonts.hand, fontWeight: 700, fontSize: labelSize, color, opacity: interpolate(p, [0, 0.3], [0, 1], clamp), whiteSpace: "nowrap", textShadow: "0 2px 10px rgba(0,0,0,0.35)" }}>
          {label}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** Hand-drawn circle around a region (cx, cy, rx, ry in reel coordinates). */
export const CircleMark: React.FC<{ cx: number; cy: number; rx: number; ry: number; color?: string; drawFrames?: number; seed?: number }> = ({ cx, cy, rx, ry, color = theme.colors.accent, drawFrames = 14, seed = 2 }) => {
  const p = useProgress(0, drawFrames);
  const exit = useExit(5);
  const pts = Array.from({ length: 26 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2 - 0.4;
    return [cx + Math.cos(a) * (rx + wobble(i, seed)), cy + Math.sin(a) * (ry + wobble(i + 9, seed))];
  });
  const d = `M ${pts[0][0]} ${pts[0][1]} ` + pts.slice(1).map(([x, y]) => `L ${x} ${y}`).join(" ");
  const evo = evolvePath(p, d);
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: exit }}>
      <path d={d} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={evo.strokeDasharray} strokeDashoffset={evo.strokeDashoffset} />
    </svg>
  );
};

/** Marker highlight sweeping across a box (x, y, w, h) behind/over text. */
/** onLight: multiply-blend like a real marker on white/light grounds; otherwise a solid band behind the text. */
export const Highlight: React.FC<{ x: number; y: number; w: number; h: number; color?: string; sweepFrames?: number; mode?: "marker" | "underline"; onLight?: boolean }> = ({ x, y, w, h, color = theme.colors.accent, sweepFrames = 8, mode = "marker", onLight = false }) => {
  const p = useProgress(0, sweepFrames);
  const exit = useExit(5);
  return mode === "underline" ? (
    <div style={{ position: "absolute", left: x, top: y + h - 12, width: w * p, height: 12, borderRadius: 6, background: color, opacity: exit }} />
  ) : (
    <div style={{ position: "absolute", left: x - 8, top: y, width: (w + 16) * p, height: h, borderRadius: 10, background: color, opacity: (onLight ? 0.45 : 0.9) * exit, mixBlendMode: onLight ? "multiply" : "normal" }} />
  );
};

/** Self-drawing line graph. values are plotted left->right inside the box; optional end label. */
export const LineGraph: React.FC<{ values: number[]; x?: number; y?: number; w?: number; h?: number; color?: string; drawFrames?: number; label?: string; showDots?: boolean }> = ({
  values, x = 110, y = 620, w = 860, h = 560, color = theme.colors.accent, drawFrames = 24, label, showDots = true,
}) => {
  const p = useProgress(0, drawFrames);
  const exit = useExit(6);
  const min = Math.min(...values), max = Math.max(...values);
  const pts = values.map((v, i) => [x + (i / Math.max(1, values.length - 1)) * w, y + h - ((v - min) / (max - min || 1)) * h]);
  const d = `M ${pts[0][0]} ${pts[0][1]} ` + pts.slice(1).map(([px, py]) => `L ${px} ${py}`).join(" ");
  const evo = evolvePath(p, d);
  const last = pts[pts.length - 1];
  return (
    <AbsoluteFill style={{ opacity: exit }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <line x1={x} y1={y + h} x2={x + w} y2={y + h} stroke="rgba(255,255,255,0.35)" strokeWidth={4} />
        <path d={d} fill="none" stroke={color} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={evo.strokeDasharray} strokeDashoffset={evo.strokeDashoffset} />
        {showDots ? pts.map(([px, py], i) => (i / Math.max(1, pts.length - 1) <= p ? <circle key={i} cx={px} cy={py} r={13} fill={color} /> : null)) : null}
      </svg>
      {label ? (
        <div style={{ position: "absolute", left: Math.min(last[0] + 20, 1080 - theme.safe.side), top: last[1] - 110, transform: "translateX(-100%)", fontFamily: theme.fonts.heading, fontWeight: 900, fontSize: 72, color: theme.colors.text, opacity: interpolate(p, [0.85, 1], [0, 1], clamp), textShadow: "0 3px 16px rgba(0,0,0,0.5)" }}>{label}</div>
      ) : null}
    </AbsoluteFill>
  );
};

/** Bars growing from the baseline, staggered. */
export const BarChart: React.FC<{ bars: { label: string; value: number; highlight?: boolean }[]; y?: number; h?: number; stagger?: number; accent?: string }> = ({ bars, y = 600, h = 640, stagger = 4, accent = theme.colors.accent }) => {
  const frame = useCurrentFrame();
  const exit = useExit(6);
  const max = Math.max(...bars.map((b) => b.value));
  const bw = Math.min(170, 820 / bars.length - 24);
  return (
    <AbsoluteFill style={{ alignItems: "center", opacity: exit }}>
      <div style={{ position: "absolute", top: y, height: h, display: "flex", alignItems: "flex-end", gap: 24 }}>
        {bars.map((b, i) => {
          const g = interpolate(frame - i * stagger, [0, 14], [0, 1], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ fontFamily: theme.fonts.heading, fontWeight: 800, fontSize: 40, color: theme.colors.text, opacity: g }}>{Math.round(b.value * g)}</div>
              <div style={{ width: bw, height: (b.value / max) * (h - 140) * g, borderRadius: 14, background: b.highlight ? accent : "rgba(255,255,255,0.85)" }} />
              <div style={{ fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 32, color: theme.colors.muted }}>{b.label}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
