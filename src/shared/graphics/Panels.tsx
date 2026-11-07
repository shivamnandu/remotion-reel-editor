import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { theme } from "../../../brand/theme";
import { clamp, useEnter, useExit, useProgress } from "./anim";

/** Number formatting for counters: 17000 -> "17k", 1250000 -> "1.25M" when compact. */
const fmt = (v: number, decimals: number, compact: boolean) => {
  if (compact) {
    if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 2).replace(/\.?0+$/, "")}M`;
    if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1).replace(/\.?0+$/, "")}k`;
  }
  return v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

/**
 * Stat panel: a big number counting up to its value, with a label. Full-screen ("full") or a card.
 * countFrames: how long the count runs (land it on the spoken number's frame).
 */
export const StatPanel: React.FC<{
  value: number; label: string; prefix?: string; suffix?: string; decimals?: number; compact?: boolean;
  countFrames?: number; variant?: "card" | "full"; y?: number; accent?: string; light?: boolean;
}> = ({ value, label, prefix = "", suffix = "", decimals = 0, compact = false, countFrames = 24, variant = "card", y = 620, accent = theme.colors.accent, light = false }) => {
  const enter = useEnter(0, "snappy");
  const exit = useExit(6);
  const p = useProgress(2, 2 + countFrames, (t) => 1 - Math.pow(1 - t, 3));
  const fg = light ? theme.colors.textOnLight : theme.colors.text;
  const content = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ fontFamily: theme.fonts.heading, fontWeight: 900, fontSize: variant === "full" ? 240 : 170, lineHeight: 1, letterSpacing: -8, color: fg, fontVariantNumeric: "tabular-nums" }}>
        {prefix}
        {fmt(value * p, decimals, compact)}
        <span style={{ color: accent }}>{suffix}</span>
      </div>
      <div style={{ fontFamily: theme.fonts.body, fontWeight: 600, fontSize: variant === "full" ? 56 : 44, color: light ? "rgba(0,0,0,0.6)" : theme.colors.muted, textAlign: "center", maxWidth: 820 }}>{label}</div>
    </div>
  );
  if (variant === "full") {
    return (
      <AbsoluteFill style={{ background: light ? theme.colors.secondary : theme.colors.primary, alignItems: "center", justifyContent: "center", opacity: exit, transform: `scale(${1.06 - 0.06 * enter})` }}>
        {content}
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div style={{ position: "absolute", top: y, padding: "48px 64px", borderRadius: theme.radius, background: light ? theme.colors.panelLight : theme.colors.panel, boxShadow: theme.shadow, opacity: exit, transform: `translateY(${(1 - enter) * 80}px) scale(${0.9 + 0.1 * enter})` }}>
        {content}
      </div>
    </AbsoluteFill>
  );
};

/** Lower third: name + role bar sliding in from the left, inside the safe band. */
export const LowerThird: React.FC<{ title: string; subtitle?: string; y?: number; accent?: string }> = ({ title, subtitle, y = 1420, accent = theme.colors.accent }) => {
  const enter = useEnter(0, "snappy");
  const sub = useEnter(4, "snappy");
  const exit = useExit(6);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: theme.safe.side, top: y, opacity: exit, transform: `translateX(${(1 - enter) * -120}px)` }}>
        <div style={{ display: "flex", alignItems: "stretch", gap: 18 }}>
          <div style={{ width: 12, borderRadius: 6, background: accent, transform: `scaleY(${enter})` }} />
          <div>
            <div style={{ fontFamily: theme.fonts.heading, fontWeight: 800, fontSize: 64, color: theme.colors.text, textShadow: "0 3px 14px rgba(0,0,0,0.5)" }}>{title}</div>
            {subtitle ? <div style={{ fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 38, color: theme.colors.muted, opacity: sub, textShadow: "0 3px 14px rgba(0,0,0,0.5)" }}>{subtitle}</div> : null}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Checklist: items tick on at their frames (the spoken word frames). */
export const Checklist: React.FC<{ items: { text: string; at: number }[]; title?: string; y?: number; light?: boolean; accent?: string }> = ({ items, title, y = 520, light = false, accent = theme.colors.accent }) => {
  const frame = useCurrentFrame();
  const enter = useEnter(0, "snappy");
  const exit = useExit(6);
  const fg = light ? theme.colors.textOnLight : theme.colors.text;
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div style={{ position: "absolute", top: y, width: 880, padding: "44px 52px", borderRadius: theme.radius, background: light ? theme.colors.panelLight : theme.colors.panel, boxShadow: theme.shadow, opacity: exit, transform: `translateY(${(1 - enter) * 60}px)` }}>
        {title ? <div style={{ fontFamily: theme.fonts.heading, fontWeight: 900, fontSize: 58, color: fg, marginBottom: 26 }}>{title}</div> : null}
        {items.map((it, i) => {
          const t = frame - it.at;
          const on = interpolate(t, [0, 6], [0, 1], clamp);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 24, margin: "18px 0", opacity: 0.35 + 0.65 * on }}>
              <svg width={56} height={56} viewBox="0 0 56 56">
                <rect x={3} y={3} width={50} height={50} rx={12} fill={on > 0 ? accent : "none"} stroke={on > 0 ? accent : fg} strokeWidth={4} />
                <path d="M15 29 L24 38 L42 18" fill="none" stroke="#fff" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={40} strokeDashoffset={40 * (1 - on)} />
              </svg>
              <span style={{ fontFamily: theme.fonts.body, fontWeight: 700, fontSize: 48, color: fg, textDecoration: "none" }}>{it.text}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Overlay image (screenshot, post, tile): big and centred, straight, square corners, soft shadow
 * (skill: overlay images go big and centred, covering the face rather than shrunk to the edges).
 * src is a public/ path, e.g. "images/post.png".
 */
export const ImageCard: React.FC<{ src: string; width?: number; y?: number; rotate?: number; from?: "bottom" | "scale" }> = ({ src, width = 940, y, rotate = 0, from = "bottom" }) => {
  const enter = useEnter(0, "snappy");
  const exit = useExit(5);
  const transform = from === "scale" ? `scale(${0.7 + 0.3 * enter}) rotate(${rotate}deg)` : `translateY(${(1 - enter) * 500}px) rotate(${rotate}deg)`;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: y === undefined ? "center" : "flex-start" }}>
      <Img src={staticFile(src)} style={{ width, marginTop: y, boxShadow: theme.shadow, transform, opacity: exit }} />
    </AbsoluteFill>
  );
};

/** Progress / comparison bar that fills to a percentage. */
export const ProgressBar: React.FC<{ percent: number; label?: string; y?: number; fillFrames?: number; accent?: string }> = ({ percent, label, y = 900, fillFrames = 20, accent = theme.colors.accent }) => {
  const enter = useEnter(0, "snappy");
  const exit = useExit(5);
  const p = useProgress(3, 3 + fillFrames);
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div style={{ position: "absolute", top: y, width: 860, opacity: exit, transform: `translateY(${(1 - enter) * 40}px)` }}>
        {label ? (
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: theme.fonts.heading, fontWeight: 800, fontSize: 46, color: theme.colors.text, marginBottom: 14, textShadow: "0 3px 14px rgba(0,0,0,0.5)" }}>
            <span>{label}</span>
            <span>{Math.round(percent * p)}%</span>
          </div>
        ) : null}
        <div style={{ height: 34, borderRadius: 17, background: "rgba(255,255,255,0.22)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${percent * p}%`, background: accent, borderRadius: 17 }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
