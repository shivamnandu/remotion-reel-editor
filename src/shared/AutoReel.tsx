import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Caption } from "./Caption";

// ---------------------------------------------------------------------------
// AutoReel: plays an edit.json produced by `npm run auto-edit` (scripts/auto-edit.mjs).
//
// It is the deterministic rough cut: jump cuts with the dead air removed, captions
// chunked by the remotion-reel skill's rules, optional music bed and sound cues.
// Creative work (graphics, hooks, layouts) is layered on top in a video's own
// component, which can render <AutoReel edit={edit} /> as its base.
//
// One clip is mounted at a time (premountFor={0}): two <OffthreadVideo> elements on
// the same source in one composition can deadlock the decoder (skill gotcha 3).
// ---------------------------------------------------------------------------

export type EditClip = { src: string; fromFrame: number; toFrame: number; outFrom: number };
export type CaptionChunk = { from: number; to: number; text: string };
export type SfxCue = { at: number; src: string; volume?: number; leadFrames?: number };
export type MusicBed = { src: string; gain: number; trimBefore?: number; fadeOutFrames?: number };
export type Edit = {
  id: string;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  clips: EditClip[];
  captions?: { y: number; outlined?: boolean; size?: number; chunks: CaptionChunk[] };
  music?: MusicBed;
  sfx?: SfxCue[];
  zoomOnCuts?: number; // e.g. 1.08: alternate punch-in on every other jump cut (needs 4K source to stay sharp)
};

/**
 * Caption layer. Render it LAST (above graphics) in a custom Video.tsx with <AutoReel hideCaptions />.
 * yOverrides moves the line for frame ranges, e.g. into the clear band under a full-screen graphic
 * (skill: reposition captions under full-screen graphics, never drop them).
 */
export const CaptionTrack: React.FC<{
  captions: NonNullable<Edit["captions"]>;
  width?: number;
  height?: number;
  yOverrides?: { from: number; to: number; y: number }[];
}> = ({ captions, width = 1080, height = 1920, yOverrides = [] }) => {
  const frame = useCurrentFrame();
  let cur: CaptionChunk | null = null;
  for (const c of captions.chunks) if (frame >= c.from && frame < c.to) cur = c; // newest overlapping chunk wins
  if (!cur) return null;
  // One position per chunk (decided at its first frame) so a line never jumps mid-read.
  const start = cur.from;
  const y = yOverrides.find((o) => start >= o.from && start < o.to)?.y ?? captions.y;
  return (
    <Caption
      words={cur.text.split(" ").map((text) => ({ text }))}
      y={y}
      outlined={captions.outlined ?? true}
      size={captions.size}
      width={width}
      height={height}
    />
  );
};

export const AutoReel: React.FC<{ edit: Edit; hideCaptions?: boolean }> = ({ edit, hideCaptions }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {edit.clips.map((c, i) => {
        const len = c.toFrame - c.fromFrame;
        const scale = edit.zoomOnCuts && i % 2 === 1 ? edit.zoomOnCuts : 1;
        return (
          <Sequence key={i} from={c.outFrom} durationInFrames={len} premountFor={0}>
            <AbsoluteFill style={{ transform: `scale(${scale})` }}>
              <OffthreadVideo
                src={staticFile(c.src)}
                trimBefore={c.fromFrame}
                trimAfter={c.toFrame}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                // one-frame ramps at each cut remove clicks without eating syllables
                volume={(f) => interpolate(f, [0, 1, len - 1, len], [0.4, 1, 1, 0.4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}
      {edit.music ? (
        <Audio
          src={staticFile(edit.music.src)}
          trimBefore={edit.music.trimBefore ?? 0}
          volume={(f) =>
            edit.music!.gain *
            interpolate(f, [0, 5, edit.durationInFrames - (edit.music!.fadeOutFrames ?? 36), edit.durationInFrames - 1], [0, 1, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          }
        />
      ) : null}
      {(edit.sfx ?? []).map((s, i) => {
        const from = Math.max(0, s.at - (s.leadFrames ?? 0));
        return (
          <Sequence key={`sfx${i}`} from={from} durationInFrames={edit.durationInFrames - from} premountFor={0}>
            <Audio src={staticFile(s.src)} volume={s.volume ?? 1} />
          </Sequence>
        );
      })}
      {edit.captions && !hideCaptions ? <CaptionTrack captions={edit.captions} width={edit.width} height={edit.height} /> : null}
    </AbsoluteFill>
  );
};
