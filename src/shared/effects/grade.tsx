import React from "react";
import { AbsoluteFill } from "remotion";

// ---------------------------------------------------------------------------
// Live colour grades (CSS/SVG filters) for previewing a look on any layer.
// For final, accurate grading of footage bake a real 3D LUT with ffmpeg:
//   npm run fx -- grade <take> --lut teal-orange [--mix 0.8]   (LUTs in assets/luts/*.cube)
// The preset names match the generated .cube files so preview and bake agree in intent.
// ---------------------------------------------------------------------------

export type GradePreset =
  | "teal-orange" | "warm-film" | "cool-blue" | "bleach-bypass" | "faded-matte" | "mono-contrast"
  | "vintage-70s" | "moody-green" | "golden-hour" | "clean-punch" | "noir" | "pastel";

// feColorMatrix rows (R,G,B,A) + CSS filter tail. Matrices are hand-tuned approximations of the LUTs.
const LOOKS: Record<GradePreset, { matrix?: string; css: string }> = {
  "teal-orange": { matrix: "1.08 0.02 -0.05 0 0.02  -0.02 1.0 0.02 0 0  -0.08 0.04 1.12 0 0.03  0 0 0 1 0", css: "contrast(1.08) saturate(1.15)" },
  "warm-film": { matrix: "1.06 0.04 0 0 0.03  0.02 1.0 0 0 0.01  0 0 0.9 0 0  0 0 0 1 0", css: "contrast(1.05) saturate(1.05) sepia(0.08)" },
  "cool-blue": { matrix: "0.92 0 0.02 0 0  0 1.0 0.03 0 0.01  0.03 0.05 1.12 0 0.03  0 0 0 1 0", css: "contrast(1.06) saturate(0.95)" },
  "bleach-bypass": { css: "contrast(1.35) saturate(0.45) brightness(1.02)" },
  "faded-matte": { matrix: "0.9 0 0 0 0.07  0 0.9 0 0 0.07  0 0 0.9 0 0.08  0 0 0 1 0", css: "contrast(0.92) saturate(0.85)" },
  "mono-contrast": { css: "grayscale(1) contrast(1.35)" },
  "vintage-70s": { matrix: "1.0 0.08 0 0 0.04  0.04 0.95 0 0 0.03  0 0.05 0.8 0 0.02  0 0 0 1 0", css: "sepia(0.25) contrast(1.05) saturate(1.1)" },
  "moody-green": { matrix: "0.92 0.04 0 0 0  0.02 1.04 0 0 0.01  0 0.04 0.92 0 0.01  0 0 0 1 0", css: "contrast(1.12) saturate(0.8) brightness(0.95)" },
  "golden-hour": { matrix: "1.12 0.05 0 0 0.04  0.03 1.02 0 0 0.02  0 0 0.85 0 0  0 0 0 1 0", css: "contrast(1.04) saturate(1.2) brightness(1.03)" },
  "clean-punch": { css: "contrast(1.12) saturate(1.18) brightness(1.02)" },
  noir: { css: "grayscale(1) contrast(1.6) brightness(0.9)" },
  pastel: { matrix: "0.85 0.05 0.05 0 0.1  0.05 0.85 0.05 0 0.1  0.05 0.05 0.85 0 0.12  0 0 0 1 0", css: "saturate(0.9) brightness(1.05)" },
};

/** Wrap footage/graphics to apply a grade. intensity 0..1 cross-fades with the original. */
export const ColorGrade: React.FC<{ children: React.ReactNode; look: GradePreset; intensity?: number }> = ({ children, look, intensity = 1 }) => {
  const l = LOOKS[look];
  const id = `grade-${look}`;
  const filter = `${l.matrix ? `url(#${id}) ` : ""}${l.css}`;
  return (
    <AbsoluteFill>
      {l.matrix ? (
        <svg width={0} height={0} style={{ position: "absolute" }}>
          <filter id={id} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values={l.matrix} /></filter>
        </svg>
      ) : null}
      {intensity < 1 ? <AbsoluteFill>{children}</AbsoluteFill> : null}
      <AbsoluteFill style={{ filter, opacity: intensity }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Quick adjustments (exposure-ish brightness, contrast, saturation, temperature tint, blur). */
export const Adjust: React.FC<{ children: React.ReactNode; brightness?: number; contrast?: number; saturation?: number; hue?: number; blur?: number; warmth?: number }> = ({
  children, brightness = 1, contrast = 1, saturation = 1, hue = 0, blur = 0, warmth = 0,
}) => (
  <AbsoluteFill>
    <AbsoluteFill style={{ filter: `brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) hue-rotate(${hue}deg) blur(${blur}px)` }}>{children}</AbsoluteFill>
    {warmth !== 0 ? <AbsoluteFill style={{ background: warmth > 0 ? "#ff9a3c" : "#3c8dff", mixBlendMode: "soft-light", opacity: Math.min(1, Math.abs(warmth)) * 0.5 }} /> : null}
  </AbsoluteFill>
);

export const GRADE_PRESETS = Object.keys(LOOKS) as GradePreset[];
