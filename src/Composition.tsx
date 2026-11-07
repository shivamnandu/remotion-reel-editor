import { AbsoluteFill, CalculateMetadataFunction, Composition } from "remotion";

// Starter composition for vertical short-form reels (1080x1920 @ 30 fps), the format
// the remotion-reel skill and the Claude x Remotion guide target. Each real video gets
// its own folder in src/<video>/ and its own <Composition> registered in Root.tsx.

type Props = {};

const calculateMetadata: CalculateMetadataFunction<Props> = () => {
  return {};
};

export const REEL = { width: 1080, height: 1920, fps: 30 } as const;

export const MyComposition = () => {
  return (
    <Composition
      id="Reel"
      component={MyComponent}
      durationInFrames={REEL.fps * 5}
      fps={REEL.fps}
      width={REEL.width}
      height={REEL.height}
      calculateMetadata={calculateMetadata}
    />
  );
};

export const MyComponent: React.FC<Props> = () => {
  return <AbsoluteFill style={{ backgroundColor: "#000" }} />;
};
