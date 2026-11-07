import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";

// Layout 4b, the two-thirds split (references/layouts.md). The graphic or
// screen recording sits behind, full-bleed; the take sits 1:1 in a
// full-width panel with big rounded top corners, the whole head inside.
// Copy into src/shared/ when a video first needs it.
//
//   <Graphic />                                  // behind, y0-1400
//   <TwoThirdsPanel src="recordings/x.mp4" capTop={673} />
//   <SplitCaption text={chunk.text} light={isLight(chunk, LUM)} />
//
// capTop is the cap (or hair) top in the source take, measured per video.

const W = 1080;
const H = 1920;
export const PANEL_TOP = 1165; // ~40px above the cap
export const PANEL_R = 110;
export const CAPTION_Y = 1130; // baseline just above the panel edge
const CAP_AT = 1205; //          the cap top lands here

const panelPath = `M0 ${H} L0 ${PANEL_TOP + PANEL_R} Q0 ${PANEL_TOP} ${PANEL_R} ${PANEL_TOP} L${W - PANEL_R} ${PANEL_TOP} Q${W} ${PANEL_TOP} ${W} ${PANEL_TOP + PANEL_R} L${W} ${H} Z`;

export const TwoThirdsPanel: React.FC<{ src: string; capTop: number }> = ({ src, capTop }) => (
  <AbsoluteFill style={{ filter: "drop-shadow(0 -8px 24px rgba(0,0,0,0.28))" }}>
    <AbsoluteFill style={{ clipPath: `path('${panelPath}')` }}>
      <OffthreadVideo src={staticFile(src)} style={{ position: "absolute", left: 0, top: CAP_AT - capTop, width: W, height: H }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: PANEL_TOP, height: 40, background: "linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0))" }} />
    </AbsoluteFill>
  </AbsoluteFill>
);

/** Is the ground behind a caption chunk light? `lum` is the per-frame
    luminance written by scripts/caption-tone.py (null where unmeasured). */
export const isLight = (c: { from: number; to: number }, lum: (number | null)[]) => {
  let sum = 0;
  let n = 0;
  for (let f = c.from; f < c.to; f++) {
    const v = lum[f];
    if (typeof v === "number") (sum += v), n++;
  }
  return n > 0 && sum / n > 140;
};

/** The caption for this layout: black on white over a light ground, the
    usual white on black over a dark one. Pass the caption font family. */
export const SplitCaption: React.FC<{ text: string; light: boolean; fontFamily: string }> = ({ text, light, fontFamily }) => (
  <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
    <text
      x={W / 2}
      y={CAPTION_Y}
      textAnchor="middle"
      fontFamily={fontFamily}
      fontWeight={800}
      fontSize={78}
      letterSpacing={-2}
      fill={light ? "#000" : "#fff"}
      stroke={light ? "#fff" : "#000"}
      strokeWidth={10}
      strokeLinejoin="round"
      style={{ paintOrder: "stroke" }}
    >
      {text}
    </text>
  </svg>
);
