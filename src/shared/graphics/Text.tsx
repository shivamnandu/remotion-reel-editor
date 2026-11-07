import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../../../brand/theme";
import { clamp, useEnter, useExit } from "./anim";

type Align = "left" | "center" | "right";

/**
 * Kinetic sentence: each word lands on its own frame (pass the spoken word frames, relative to
 * the Sequence start) and stays; words appear once (skill motion-graphics: cinematic type).
 * Styles: "rise" (slide up + unblur), "pop" (scale), "slam" (oversized -> settle).
 */
export const KineticText: React.FC<{
  words: { text: string; at: number; emphasis?: boolean }[];
  y?: number;
  size?: number;
  color?: string;
  emphasisColor?: string;
  font?: string;
  weight?: number;
  style?: "rise" | "pop" | "slam";
  maxWidth?: number;
  align?: Align;
  uppercase?: boolean;
}> = ({ words, y = 700, size = 110, color = theme.colors.text, emphasisColor = theme.colors.accent, font = theme.fonts.heading, weight = 900, style = "rise", maxWidth = 920, align = "center", uppercase = false }) => {
  const frame = useCurrentFrame();
  const exit = useExit(5);
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div style={{ position: "absolute", top: y, width: maxWidth, display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : align === "left" ? "flex-start" : "flex-end", gap: `${size * 0.12}px ${size * 0.26}px`, opacity: exit }}>
        {words.map((w, i) => {
          const t = frame - w.at;
          if (t < 0) return null;
          const p = interpolate(t, [0, 6], [0, 1], clamp);
          const transform =
            style === "pop" ? `scale(${interpolate(t, [0, 4, 7], [0.6, 1.08, 1], clamp)})` : style === "slam" ? `scale(${interpolate(t, [0, 5], [1.8, 1], clamp)})` : `translateY(${(1 - p) * size * 0.5}px)`;
          return (
            <span key={i} style={{ fontFamily: font, fontWeight: weight, fontSize: size, lineHeight: 1.02, letterSpacing: -size * 0.03, color: w.emphasis ? emphasisColor : color, transform, filter: style === "rise" ? `blur(${(1 - p) * 8}px)` : undefined, opacity: style === "slam" ? 1 : Math.min(1, p * 2), textTransform: uppercase ? "uppercase" : undefined, display: "inline-block" }}>
              {w.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Title reveal: elegant serif title wiped in from a mask. Put it *behind* the speaker by rendering
 * it before a cut-out layer (see background-removal / <Silhouette/>): video -> TitleReveal -> cut-out.
 */
export const TitleReveal: React.FC<{ text: string; kicker?: string; y?: number; size?: number; color?: string; italic?: boolean; align?: Align }> = ({
  text, kicker, y = 380, size = 168, color = theme.colors.text, italic = false, align = "center",
}) => {
  const enter = useEnter(0, "smooth");
  const exit = useExit(6);
  const k = useEnter(4, "smooth");
  return (
    <AbsoluteFill style={{ alignItems: align === "center" ? "center" : align === "left" ? "flex-start" : "flex-end", padding: `0 ${theme.safe.side}px` }}>
      <div style={{ position: "absolute", top: y, textAlign: align, opacity: exit }}>
        <div style={{ overflow: "hidden", paddingBottom: size * 0.12 }}>
          <div style={{ fontFamily: italic ? theme.fonts.titleItalic : theme.fonts.title, fontWeight: italic ? 500 : 700, fontSize: size, lineHeight: 1, letterSpacing: -size * 0.02, color, transform: `translateY(${(1 - enter) * 105}%)` }}>{text}</div>
        </div>
        {kicker ? (
          <div style={{ fontFamily: theme.fonts.body, fontWeight: 600, fontSize: size * 0.2, letterSpacing: size * 0.02, textTransform: "uppercase", color: theme.colors.muted, opacity: k, transform: `translateY(${(1 - k) * 20}px)` }}>{kicker}</div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/** On-screen hook / header in the clear band above the head: words pop in as a block. */
export const HookText: React.FC<{ lines: string[]; y?: number; size?: number; variant?: "whiteOnBlack" | "blackOnWhite" | "plain"; uppercase?: boolean }> = ({
  lines, y = theme.safe.top + 40, size = 64, variant = "blackOnWhite", uppercase = false,
}) => {
  const enter = useEnter(0, "snappy");
  const exit = useExit(5);
  const bg = variant === "blackOnWhite" ? theme.colors.secondary : variant === "whiteOnBlack" ? theme.colors.primary : "transparent";
  const fg = variant === "blackOnWhite" ? theme.colors.textOnLight : theme.colors.text;
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div style={{ position: "absolute", top: y, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, transform: `scale(${0.85 + 0.15 * enter})`, opacity: Math.min(enter * 1.5, exit) }}>
        {lines.map((l, i) => (
          <span key={i} style={{ background: bg, color: fg, fontFamily: theme.fonts.heading, fontWeight: 800, fontSize: size, lineHeight: 1.15, padding: variant === "plain" ? 0 : `${size * 0.08}px ${size * 0.28}px`, borderRadius: size * 0.18, textTransform: uppercase ? "uppercase" : undefined, textShadow: variant === "plain" ? "0 4px 18px rgba(0,0,0,0.55)" : undefined }}>
            {l}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** Typewriter line with a blinking cursor (code, prompts, search bars). */
export const Typewriter: React.FC<{ text: string; charsPerFrame?: number; y?: number; size?: number; color?: string; font?: string; startAt?: number }> = ({
  text, charsPerFrame = 1.2, y = 860, size = 58, color = theme.colors.text, font = theme.fonts.body, startAt = 0,
}) => {
  const frame = useCurrentFrame();
  const n = Math.max(0, Math.floor((frame - startAt) * charsPerFrame));
  const exit = useExit(5);
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div style={{ position: "absolute", top: y, maxWidth: 940, fontFamily: font, fontWeight: 600, fontSize: size, color, opacity: exit, whiteSpace: "pre-wrap" }}>
        {text.slice(0, n)}
        <span style={{ opacity: Math.floor(frame / 8) % 2 === 0 || n < text.length ? 1 : 0 }}>|</span>
      </div>
    </AbsoluteFill>
  );
};
