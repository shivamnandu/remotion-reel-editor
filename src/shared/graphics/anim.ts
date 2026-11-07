import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../../../brand/theme";

// Timing convention for every graphic: wrap it in <Sequence from={cueFrame} durationInFrames={len}>.
// Local frame 0 is the cue (the word's start frame or a cut). Entrances are fast and start with
// motion already happening (skill: fade-ins read as slow on short-form); exits use the last frames
// of the Sequence, so the Sequence length is the on-screen time.

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0 -> 1 entrance spring starting at local frame `delay`. */
export const useEnter = (delay = 0, config: keyof typeof theme.motion = "snappy") => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: theme.motion[config] });
};

/** 1 -> 0 over the last `frames` frames of the enclosing Sequence. */
export const useExit = (frames = 6) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return interpolate(frame, [durationInFrames - frames, durationInFrames], [1, 0], { ...clamp, easing: Easing.in(Easing.cubic) });
};

/** Linear 0 -> 1 progress between two local frames, eased. */
export const useProgress = (from: number, to: number, easing: (t: number) => number = Easing.inOut(Easing.cubic)) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [from, to], [0, 1], { ...clamp, easing });
};

export const toFrames = (ms: number, fps = 30) => Math.round((ms / 1000) * fps);
