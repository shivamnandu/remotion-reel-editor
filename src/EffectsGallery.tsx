import React from "react";
import { AbsoluteFill, Composition, Sequence, OffthreadVideo, staticFile } from "remotion";
import { TransitionSeries, linearTiming, type TransitionPresentation } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { flip } from "@remotion/transitions/flip";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { iris } from "@remotion/transitions/iris";
import { cube } from "@remotion/transitions/cube";
import { zoomInOut } from "@remotion/transitions/zoom-in-out";
import { pushCut } from "@remotion/transitions/push-cut";
import { blurSlide } from "@remotion/transitions/blur-slide";
import {
  blurDissolve, dipToBlack, flashCut, glitchCut, pixelate, shapeReveal, spin, splitDoors, swipePush, whipPan, zoomThrough,
  LightLeak, FilmBurnOverlay, DustScratches, VHS, ChromaticAberration, Glitch, Letterbox, Particles, GradientBackground, Spotlight, HudGrid,
  KenBurns, Tilt3D, Wiggle, Entrance, PictureInPicture, SplitScreen, MaskReveal, Censor, ZoomBlur, BeatPulse, Handheld, ImpactShake,
  LetterAnimate, Scramble, NeonText, GradientText, OutlineText, Ticker, EmojiPop, HighlightWord,
  ColorGrade, GRADE_PRESETS,
} from "./shared/effects";

// Every effect, back to back, labelled. Render a contact sheet to verify them all:
//   npm run check -- EffectsGallery <from>-<to> --every 60   (frame 40 of each 60-frame slot is mid-effect)
// Requires a sample clip at public/fx/gallery-sample.mp4 (created by `npm run fx-sample`) for footage effects.

const SLOT = 60;
const SAMPLE = "fx/gallery-sample.mp4";
const Footage: React.FC = () => <OffthreadVideo src={staticFile(SAMPLE)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
const Card: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <AbsoluteFill style={{ background: color, alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", fontWeight: 900, fontSize: 160, color: "#fff" }}>{label}</AbsoluteFill>
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T = (p: TransitionPresentation<any>) => (
  <TransitionSeries>
    <TransitionSeries.Sequence durationInFrames={30}><Card color="#1f6feb" label="A" /></TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={p} timing={linearTiming({ durationInFrames: 20 })} />
    <TransitionSeries.Sequence durationInFrames={50}><Card color="#e5534b" label="B" /></TransitionSeries.Sequence>
  </TransitionSeries>
);

const SAMPLES: { name: string; el: React.ReactNode }[] = [
  // Transitions (built-in)
  { name: "fade", el: T(fade()) }, { name: "slide", el: T(slide()) }, { name: "wipe", el: T(wipe()) }, { name: "flip", el: T(flip()) },
  { name: "clockWipe", el: T(clockWipe({ width: 1080, height: 1920 })) }, { name: "iris", el: T(iris({ width: 1080, height: 1920 })) },
  { name: "cube", el: T(cube({ direction: "from-right" })) }, { name: "zoomInOut (GPU shader)", el: T(zoomInOut({})) }, { name: "pushCut", el: T(pushCut()) }, { name: "blurSlide", el: T(blurSlide()) },
  // Transitions (custom CSS)
  { name: "zoomThrough", el: T(zoomThrough()) }, { name: "whipPan", el: T(whipPan()) }, { name: "glitchCut", el: T(glitchCut()) }, { name: "flashCut", el: T(flashCut()) },
  { name: "spin", el: T(spin()) }, { name: "blurDissolve", el: T(blurDissolve()) }, { name: "shapeReveal", el: T(shapeReveal({ shape: "diamond" })) },
  { name: "splitDoors", el: T(splitDoors()) }, { name: "swipePush", el: T(swipePush()) }, { name: "dipToBlack", el: T(dipToBlack()) }, { name: "pixelate", el: T(pixelate()) },
  // Overlays
  { name: "LightLeak", el: <><Footage /><LightLeak /></> }, { name: "FilmBurn", el: <><Footage /><FilmBurnOverlay /></> }, { name: "DustScratches", el: <><Footage /><DustScratches /></> },
  { name: "VHS", el: <VHS><Footage /></VHS> }, { name: "ChromaticAberration", el: <ChromaticAberration amount={10}><Footage /></ChromaticAberration> },
  { name: "Glitch", el: <Glitch><Footage /></Glitch> }, { name: "Letterbox", el: <><Footage /><Letterbox /></> },
  { name: "Particles confetti", el: <><GradientBackground /><Particles kind="confetti" /></> }, { name: "Particles sparkles", el: <><GradientBackground /><Particles kind="sparkles" count={40} /></> },
  { name: "Particles snow", el: <><Footage /><Particles kind="snow" count={120} /></> }, { name: "Particles bokeh", el: <><Footage /><Particles kind="bokeh" count={30} /></> },
  { name: "Particles embers", el: <><GradientBackground colors={["#1a0500", "#7a1e00", "#ff6a00", "#2a0a00"]} /><Particles kind="embers" count={70} /></> },
  { name: "Particles hearts", el: <><Footage /><Particles kind="hearts" count={25} /></> },
  { name: "Spotlight", el: <><Footage /><Spotlight x={540} y={760} /></> }, { name: "HudGrid", el: <><Footage /><HudGrid /></> },
  // Motion
  { name: "KenBurns", el: <KenBurns src="fx/gallery-still.png" /> }, { name: "Tilt3D", el: <Tilt3D><Card color="#2da44e" label="3D" /></Tilt3D> },
  { name: "Wiggle", el: <Wiggle amount={20}><Card color="#8250df" label="~" /></Wiggle> }, { name: "Entrance drop", el: <Entrance kind="drop"><Card color="#bf8700" label="DROP" /></Entrance> },
  { name: "PictureInPicture", el: <><GradientBackground /><PictureInPicture><Footage /></PictureInPicture></> },
  { name: "SplitScreen", el: <SplitScreen a={<Footage />} b={<Card color="#0a3069" label="B" />} /> },
  { name: "MaskReveal circle", el: <><Card color="#24292f" label="" /><MaskReveal><Footage /></MaskReveal></> },
  { name: "Censor blur", el: <><Footage /><Censor x={240} y={600} w={600} h={300} /></> }, { name: "ZoomBlur", el: <ZoomBlur strength={1}><Footage /></ZoomBlur> },
  { name: "BeatPulse", el: <BeatPulse beats={[0, 15, 30, 45]}><Footage /></BeatPulse> }, { name: "Handheld", el: <Handheld><Footage /></Handheld> },
  { name: "ImpactShake", el: <ImpactShake><Footage /></ImpactShake> },
  // Text effects
  { name: "LetterAnimate rise", el: <><GradientBackground /><LetterAnimate text="LETTERS" /></> }, { name: "LetterAnimate flip", el: <><GradientBackground /><LetterAnimate text="FLIP IN" kind="flip" /></> },
  { name: "Scramble", el: <><GradientBackground /><Scramble text="DECODED" /></> }, { name: "NeonText", el: <><AbsoluteFill style={{ background: "#0b0614" }} /><NeonText text="OPEN" /></> },
  { name: "GradientText", el: <><AbsoluteFill style={{ background: "#111" }} /><GradientText text="GOLDEN" /></> }, { name: "OutlineText", el: <><GradientBackground /><OutlineText text="OUTLINE" /></> },
  { name: "Ticker", el: <><Footage /><Ticker text="BREAKING: reels edited by talking" /></> }, { name: "EmojiPop", el: <><Footage /><EmojiPop emoji="🔥" /></> },
  { name: "HighlightWord", el: <><GradientBackground /><HighlightWord before="this is the" word="secret" after="nobody tells you" /></> },
  // Colour grades
  ...GRADE_PRESETS.map((g) => ({ name: `grade ${g}`, el: <ColorGrade look={g}><Footage /></ColorGrade> })),
];

export const EffectsGallery: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    {SAMPLES.map((s, i) => (
      <Sequence key={s.name} name={s.name} from={i * SLOT} durationInFrames={SLOT} premountFor={0}>
        <AbsoluteFill>{s.el}</AbsoluteFill>
        <div style={{ position: "absolute", top: 60, width: "100%", textAlign: "center", fontFamily: "monospace", fontSize: 46, color: "#fff", textShadow: "0 0 8px #000, 0 0 8px #000" }}>
          {i + 1}. {s.name}
        </div>
      </Sequence>
    ))}
  </AbsoluteFill>
);

export const EFFECT_NAMES = SAMPLES.map((s) => s.name);
export const EffectsGalleryComposition: React.FC = () => (
  <Composition id="EffectsGallery" component={EffectsGallery} durationInFrames={SAMPLES.length * SLOT} fps={30} width={1080} height={1920} />
);
