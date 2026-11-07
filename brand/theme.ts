// Brand theme tokens: the code side of brand/BRAND.md. Every graphic component in
// src/shared/graphics reads from here, so changing the brand is one edit in this file.
// Keep the values in sync with BRAND.md (colours, fonts, caption and title styles).

import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadCaveat } from "@remotion/google-fonts/Caveat";

const inter = loadInter("normal", { weights: ["400", "600", "800", "900"] });
const playfair = loadPlayfair("normal", { weights: ["500", "700"] });
const playfairItalic = loadPlayfair("italic", { weights: ["500"] });
const caveat = loadCaveat("normal", { weights: ["700"] }); // hand-drawn annotations

export const theme = {
  colors: {
    primary: "#000000", // BRAND.md Primary
    secondary: "#FFFFFF", // BRAND.md Secondary
    accent: "#FF0000", // BRAND.md Accent
    text: "#FFFFFF",
    textOnLight: "#0B0B0B",
    panel: "rgba(10,10,10,0.82)",
    panelLight: "rgba(255,255,255,0.94)",
    muted: "rgba(255,255,255,0.65)",
  },
  fonts: {
    heading: inter.fontFamily, // BRAND.md Headings: Inter
    body: inter.fontFamily, // BRAND.md Body: Inter
    title: playfair.fontFamily, // BRAND.md Title style: elegant serif
    titleItalic: playfairItalic.fontFamily,
    hand: caveat.fontFamily,
  },
  caption: { uppercase: true, weight: 800 }, // BRAND.md Caption style: bold, uppercase, centered
  frame: { width: 1080, height: 1920, fps: 30 },
  // Instagram 4:5 grid crop keeps roughly y285-y1635: anything that must not be clipped lives inside.
  safe: { top: 285, bottom: 1635, side: 60 },
  radius: 28,
  shadow: "0 18px 46px rgba(20,15,10,0.28)", // skill CARD_SHADOW
  motion: {
    // Springs used everywhere so every video moves the same way.
    snappy: { damping: 200, stiffness: 300, mass: 0.6 },
    smooth: { damping: 200, stiffness: 120, mass: 1 },
    bouncy: { damping: 12, stiffness: 180, mass: 0.7 },
  },
} as const;

export type Theme = typeof theme;
