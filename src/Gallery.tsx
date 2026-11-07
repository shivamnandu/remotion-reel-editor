import React from "react";
import { AbsoluteFill, Composition, Sequence } from "remotion";
import { theme } from "../brand/theme";
import {
  BarChart, Callout, Checklist, CircleMark, FilmLook, Flash, Ground, Highlight, HookText, KineticText,
  LineGraph, LowerThird, ProgressBar, SafeAreaGuide, StatPanel, TitleReveal, Typewriter,
} from "./shared/graphics";

// One sample of every graphic in the brand theme, back to back. Use it to:
//  - eyeball the whole kit in Studio (npm run dev -> GraphicsGallery)
//  - render a contact sheet (npm run check -- GraphicsGallery 0-1259 --every 35)
//  - seed a Brand Lab review (rate Keep / Maybe / Drop per sample)

const LEN = 70;
const SAMPLES: { name: string; el: React.ReactNode }[] = [
  { name: "KineticText rise", el: <KineticText words={["this", "changed", "everything"].map((t, i) => ({ text: t, at: i * 6, emphasis: i === 2 }))} y={780} /> },
  { name: "KineticText slam", el: <KineticText style="slam" uppercase words={["stop", "scrolling"].map((t, i) => ({ text: t, at: i * 8 }))} y={800} size={150} /> },
  { name: "TitleReveal", el: <TitleReveal text="The Method" kicker="part one" /> },
  { name: "HookText", el: <HookText lines={["I edited this reel", "without opening an editor"]} /> },
  { name: "StatPanel card", el: <StatPanel value={17000} compact suffix="+" label="views in 48 hours" /> },
  { name: "StatPanel full", el: <StatPanel variant="full" value={312} prefix="$" label="saved every month" /> },
  { name: "LowerThird", el: <LowerThird title="Your Name" subtitle="Creator · Editor" /> },
  { name: "Checklist", el: <Checklist title="Before you post" items={[{ text: "Hook in 1 second", at: 8 }, { text: "Captions on", at: 18 }, { text: "Music under voice", at: 28 }]} /> },
  { name: "ProgressBar", el: <ProgressBar percent={83} label="Retention" /> },
  { name: "LineGraph", el: <LineGraph values={[3, 4, 3.5, 6, 5.5, 9, 14]} label="+367%" /> },
  { name: "BarChart", el: <BarChart bars={[{ label: "Jan", value: 12 }, { label: "Feb", value: 19 }, { label: "Mar", value: 27 }, { label: "Apr", value: 48, highlight: true }]} /> },
  { name: "Callout + CircleMark", el: <><Callout from={[300, 600]} to={[620, 960]} label="look here" /><CircleMark cx={700} cy={1010} rx={150} ry={90} /></> },
  { name: "Highlight", el: <><Highlight x={170} y={900} w={740} h={120} /><div style={{ position: "absolute", top: 905, width: 1080, textAlign: "center", fontFamily: theme.fonts.heading, fontWeight: 900, fontSize: 96, color: "#fff" }}>key insight</div></> },
  { name: "Typewriter", el: <Typewriter text={"claude, cut the dead air\nand add my captions"} /> },
  { name: "Flash", el: <><KineticText words={[{ text: "CUT", at: 0 }]} size={200} y={820} /><Flash /></> },
];

export const Gallery: React.FC<{ guides?: boolean }> = ({ guides = false }) => (
  <AbsoluteFill>
    <Ground color="#1b1b22" to="#3a1f1f" />
    {SAMPLES.map((s, i) => (
      <Sequence key={s.name} name={s.name} from={i * LEN} durationInFrames={LEN}>
        {s.el}
        <div style={{ position: "absolute", bottom: 90, width: "100%", textAlign: "center", fontFamily: "monospace", fontSize: 30, color: "rgba(255,255,255,0.5)" }}>
          {i + 1}. {s.name}
        </div>
      </Sequence>
    ))}
    <FilmLook vignette={0.3} grain={0.04} />
    {guides ? <SafeAreaGuide /> : null}
  </AbsoluteFill>
);

export const GalleryComposition: React.FC = () => (
  <Composition id="GraphicsGallery" component={Gallery} durationInFrames={SAMPLES.length * LEN} fps={30} width={1080} height={1920} defaultProps={{ guides: false }} />
);
