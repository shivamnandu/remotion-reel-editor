import React from "react";
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../../../brand/theme";

// ---------------------------------------------------------------------------
// Text effects beyond graphics/Text.tsx: per-letter animation, scramble/decode,
// neon, gradient, outline, ticker, emoji/sticker pop. Reel coordinates.
// ---------------------------------------------------------------------------

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
type Base = { text: string; y?: number; size?: number; color?: string; font?: string; weight?: number };

/** Per-letter animation. kinds: wave, rise, drop, flip, blur, scale, rotate, typewriter. stagger in frames. */
export const LetterAnimate: React.FC<Base & { kind?: "wave" | "rise" | "drop" | "flip" | "blur" | "scale" | "rotate" | "typewriter"; stagger?: number; loop?: boolean }> = ({
  text, y = 820, size = 120, color = theme.colors.text, font = theme.fonts.heading, weight = 900, kind = "rise", stagger = 2, loop = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div style={{ position: "absolute", top: y, display: "flex", justifyContent: "center", flexWrap: "wrap", maxWidth: 980, perspective: 800 }}>
        {[...text].map((ch, i) => {
          const f = frame - i * stagger;
          const s = spring({ frame: f, fps, config: { damping: 14, stiffness: 160 } });
          let transform = "", opacity = 1, filter: string | undefined;
          switch (kind) {
            case "wave": transform = `translateY(${Math.sin((frame - i * 3) / 5) * size * 0.12 * (loop ? 1 : Math.max(0, 1 - frame / 60))}px)`; opacity = f < 0 ? 0 : 1; break;
            case "rise": transform = `translateY(${(1 - s) * size}px)`; opacity = s; break;
            case "drop": transform = `translateY(${(1 - s) * -size * 1.5}px)`; opacity = s; break;
            case "flip": transform = `rotateX(${(1 - s) * 90}deg)`; opacity = s; break;
            case "blur": opacity = s; filter = `blur(${(1 - s) * 16}px)`; break;
            case "scale": transform = `scale(${s})`; break;
            case "rotate": transform = `rotate(${(1 - s) * -90}deg)`; opacity = s; break;
            case "typewriter": opacity = f >= 0 ? 1 : 0; break;
          }
          return (
            <span key={i} style={{ display: "inline-block", whiteSpace: "pre", fontFamily: font, fontWeight: weight, fontSize: size, color, transform, opacity, filter, lineHeight: 1.05 }}>{ch}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** Scramble / decode: random glyphs resolve to the text left to right over `frames`. */
export const Scramble: React.FC<Base & { frames?: number; glyphs?: string; seed?: number }> = ({
  text, y = 820, size = 100, color = theme.colors.text, font = "monospace", weight = 800, frames = 24, glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*@", seed = 1,
}) => {
  const frame = useCurrentFrame();
  const settled = Math.floor(interpolate(frame, [0, frames], [0, text.length], clamp));
  const out = [...text].map((ch, i) => (i < settled || ch === " " ? ch : glyphs[Math.floor(random(`sc${seed}${frame}${i}`) * glyphs.length)])).join("");
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div style={{ position: "absolute", top: y, fontFamily: font, fontWeight: weight, fontSize: size, color, letterSpacing: 2, whiteSpace: "pre" }}>{out}</div>
    </AbsoluteFill>
  );
};

/** Neon sign text with flicker-on and glow. */
export const NeonText: React.FC<Base & { glow?: string; flicker?: boolean }> = ({ text, y = 820, size = 130, color = "#fff", glow = "#ff2d95", font = theme.fonts.heading, weight = 800, flicker = true }) => {
  const frame = useCurrentFrame();
  const on = !flicker || frame > 14 || [2, 3, 7, 10, 11].includes(frame);
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div style={{ position: "absolute", top: y, fontFamily: font, fontWeight: weight, fontSize: size, color: on ? color : "rgba(255,255,255,0.15)", textShadow: on ? `0 0 8px ${glow}, 0 0 22px ${glow}, 0 0 48px ${glow}, 0 0 90px ${glow}` : "none" }}>{text}</div>
    </AbsoluteFill>
  );
};

/** Gradient-filled text with a moving sheen. */
export const GradientText: React.FC<Base & { colors?: string[]; sheen?: boolean }> = ({ text, y = 820, size = 140, font = theme.fonts.heading, weight = 900, colors = ["#ff3b3b", "#ff9f0a", "#ffd60a"], sheen = true }) => {
  const frame = useCurrentFrame();
  const pos = sheen ? (frame * 3) % 300 : 0;
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div style={{ position: "absolute", top: y, fontFamily: font, fontWeight: weight, fontSize: size, backgroundImage: `linear-gradient(100deg, ${colors.join(", ")}), linear-gradient(100deg, transparent ${pos - 40}%, rgba(255,255,255,0.8) ${pos - 20}%, transparent ${pos}%)`, backgroundBlendMode: "screen", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{text}</div>
    </AbsoluteFill>
  );
};

/** Outline (stroke-only) text that fills in over `fillFrames`. SVG stroke (never -webkit-text-stroke). */
export const OutlineText: React.FC<Base & { stroke?: number; fillFrames?: number }> = ({ text, y = 900, size = 150, color = theme.colors.text, font = theme.fonts.heading, weight = 900, stroke = 4, fillFrames = 15 }) => {
  const frame = useCurrentFrame();
  const fill = interpolate(frame, [0, fillFrames], [0, 1], clamp);
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <text x={540} y={y} textAnchor="middle" fontFamily={font} fontWeight={weight} fontSize={size} fill={color} fillOpacity={fill} stroke={color} strokeWidth={stroke}>{text}</text>
    </svg>
  );
};

/** News-style ticker / marquee band scrolling continuously. */
export const Ticker: React.FC<{ text: string; y?: number; speed?: number; size?: number; background?: string; color?: string }> = ({ text, y = 1640, speed = 6, size = 44, background = theme.colors.accent, color = "#fff" }) => {
  const frame = useCurrentFrame();
  const item = `${text}   •   `;
  const approxW = item.length * size * 0.55;
  const x = -((frame * speed) % approxW);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: y, height: size * 1.8, background, overflow: "hidden", display: "flex", alignItems: "center" }}>
      <div style={{ transform: `translateX(${x}px)`, whiteSpace: "pre", fontFamily: theme.fonts.heading, fontWeight: 800, fontSize: size, color }}>{item.repeat(8)}</div>
    </div>
  );
};

/** Emoji / sticker pop with overshoot and a little wobble (system colour emoji font). */
export const EmojiPop: React.FC<{ emoji: string; x?: number; y?: number; size?: number; rotate?: number }> = ({ emoji, x = 760, y = 520, size = 180, rotate = -10 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 9, stiffness: 200 } });
  return (
    <div style={{ position: "absolute", left: x, top: y, fontSize: size, transform: `translate(-50%, -50%) scale(${s}) rotate(${rotate + Math.sin(frame / 6) * 4}deg)`, fontFamily: "'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif", filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.35))" }}>{emoji}</div>
  );
};

/** Word highlight inside a sentence: one word gets a colour block that slides in at `at`. */
export const HighlightWord: React.FC<{ before: string; word: string; after?: string; at?: number; y?: number; size?: number; color?: string; block?: string }> = ({
  before, word, after = "", at = 6, y = 860, size = 92, color = theme.colors.text, block = theme.colors.accent,
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - at, [0, 6], [0, 1], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div style={{ position: "absolute", top: y, maxWidth: 960, textAlign: "center", fontFamily: theme.fonts.heading, fontWeight: 900, fontSize: size, color, lineHeight: 1.15 }}>
        {before}{" "}
        <span style={{ position: "relative", display: "inline-block", padding: "0 12px", isolation: "isolate" }}>
          <span style={{ position: "absolute", inset: "8% 0", background: block, transform: `scaleX(${p})`, transformOrigin: "left", borderRadius: 10, zIndex: -1 }} />
          {word}
        </span>{" "}
        {after}
      </div>
    </AbsoluteFill>
  );
};
