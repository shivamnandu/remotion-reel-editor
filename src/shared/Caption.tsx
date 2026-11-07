import React from "react";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

// ---------------------------------------------------------------------------
// A neutral caption line (references/captions.md). Use the project's brand
// sheet captions when one exists (brand/BRAND.md); this is the default when
// it does not. Copy into src/shared/.
//
//   outlined (default): the TikTok caption. Inter 800, 78px, letter spacing
//     -2, white fill, a 10px black SVG stroke painted behind the fill.
//   plain: Inter 800 white, 64px, no outline or shadow, for dark grounds.
//
// An emphasis style for single words (a serif in an accent colour, say) can
// be passed in from the brand sheet; it is never stroked.
// y is the text baseline, measured per take. Captions appear and disappear
// with their chunk: no pop, no motion, no sound.
// ---------------------------------------------------------------------------
export const { fontFamily: CAPTION_SANS } = loadInter("normal", { weights: ["800"] });

export type CaptionWord = { text: string; emph?: boolean };
export type EmphasisStyle = { fontFamily: string; color: string; scale?: number; letterSpacing?: number };

export const Caption: React.FC<{
  words: CaptionWord[];
  y: number;
  outlined?: boolean;
  size?: number;
  emphasis?: EmphasisStyle;
  width?: number;
  height?: number;
}> = ({ words, y, outlined = true, size, emphasis, width = 1080, height = 1920 }) => {
  const px = size ?? (outlined ? 78 : 64);
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <text x={width / 2} y={y} textAnchor="middle" style={{ paintOrder: "stroke" }}>
        {words.map((w, i) => {
          const space = i > 0 ? " " : "";
          return w.emph && emphasis ? (
            <tspan key={i} fontFamily={emphasis.fontFamily} fontSize={Math.round(px * (emphasis.scale ?? 1.22))} letterSpacing={emphasis.letterSpacing ?? -0.5} fill={emphasis.color} stroke="none">
              {space + w.text}
            </tspan>
          ) : (
            <tspan
              key={i}
              fontFamily={CAPTION_SANS}
              fontWeight={800}
              fontSize={px}
              letterSpacing={outlined ? -2 : -0.01 * px}
              fill="#FFFFFF"
              {...(outlined ? { stroke: "#000", strokeWidth: px * (10 / 78), strokeLinejoin: "round" as const } : { stroke: "none" })}
            >
              {space + w.text}
            </tspan>
          );
        })}
      </text>
    </svg>
  );
};

// Overlay images (screenshots, tiles, thumbnails): straight, square, no
// border, this soft shadow (references/motion-graphics.md).
export const CARD_SHADOW = "0 18px 46px rgba(20,15,10,0.28)";
