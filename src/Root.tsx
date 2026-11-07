import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { GalleryComposition } from "./Gallery";
import { EffectsGalleryComposition } from "./EffectsGallery";
import { AutoReel } from "./shared/AutoReel";
import { VIDEOS } from "./videos/registry";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <GalleryComposition />
      <EffectsGalleryComposition />
      {/* One composition per video in src/videos/<id>/ (edit.json from `npm run auto-edit`;
          Video.tsx, when present, layers the creative edit on top of the rough cut). */}
      {VIDEOS.map(({ edit, component }) => (
        <Composition
          key={edit.id}
          id={edit.id}
          component={component ?? AutoReel}
          durationInFrames={edit.durationInFrames}
          fps={edit.fps}
          width={edit.width}
          height={edit.height}
          defaultProps={{ edit }}
        />
      ))}
    </>
  );
};
