import React from "react";
import { AbsoluteFill, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// Layout 5, full screen + silhouette (references/layouts.md). The graphic
// owns the frame; the creator is a matte cut-out (background-removal.md)
// standing small at the bottom edge. Copy into src/shared/ when needed.
//
//   <Sequence from={segStart}>                 // the matte's frame 0 = segStart
//     <Silhouette matte="cutouts/x-subject.mov" capTop={673}
//       spots={[{ at: 0, cx: 810 }, { at: 135, cx: 270 }]} />
//   </Sequence>
//
// The take's audio is mounted separately as <Audio>. Spots are local frames;
// cx is 270 (left), 540 (centre) or 810 (right). Captions go at baseline
// ~y1185, centred, just above the cut-out's head.

const W = 1080;
const SIL_S = 0.55; //  cut-out scale
const CAP_AT = 1240; // the cap top lands here; the source's bottom meets the frame's

export const Silhouette: React.FC<{ matte: string; capTop: number; spots: { at: number; cx: number }[] }> = ({ matte, capTop, spots }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  let cx = spots[0].cx;
  for (let i = 1; i < spots.length; i++) {
    if (frame < spots[i].at) break;
    const p = spring({ frame: frame - spots[i].at, fps, config: { damping: 18, stiffness: 160 } });
    cx = spots[i - 1].cx + (spots[i].cx - spots[i - 1].cx) * p;
  }
  const w = W * SIL_S;
  return (
    <AbsoluteFill>
      <OffthreadVideo
        src={staticFile(matte)}
        transparent
        muted
        style={{
          position: "absolute",
          left: cx - w / 2,
          top: CAP_AT - capTop * SIL_S,
          width: w,
          height: 1920 * SIL_S,
          filter: "drop-shadow(0 12px 28px rgba(0,20,50,0.35))",
        }}
      />
    </AbsoluteFill>
  );
};
