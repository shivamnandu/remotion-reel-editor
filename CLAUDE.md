# Video editor: operating rules for Claude

Vertical reels (1080x1920, 30 fps) edited in code with Remotion. Follow the `remotion-reel` skill for editing craft; this file says **how to work in this project cheaply and accurately**. Scripts do the mechanical work deterministically. Spend tokens only on creative decisions.

## Commands (use these instead of doing the work by hand)

| Need | Command | Output |
| --- | --- | --- |
| Normalise + transcribe + measure takes | `npm run ingest` (or `-- take1`) | `public/recordings/<take>.analysis.json`, `.words.json`, `analysis/<take>/contact.jpg`, `grid.jpg` |
| Rough cut (dead air out, captions) | `npm run auto-edit -- <id> <take...> [--caption-y N] [--zoom 1.08] [--music "music pack/x.mp3"]` | `src/videos/<id>/edit.json`, `words.json`, composition `<id>` |
| Frame of a spoken phrase | `npm run words -- <id> "gone viral"` / `-- <id> --list 300-450` | frame numbers on the output timeline |
| Find a sound / track | `npm run find -- sound "whoosh" --max 1` / `npm run find -- music "upbeat" --min 60 --free` | paths + duration, lead, loudness, licence |
| Put it in the project | `npm run use -- "<path>"` | `staticFile()` path, lead in frames, credit line |
| Make a new sound | add a preset to `scripts/generate-sfx.mjs`, `npm run sfx -- <name>` | `public/sound pack/generated/<name>.mp3` |
| Look at frames | `npm run check -- <id> A-B --every N` | ONE contact sheet `analysis/check/<id>-A-B.jpg` |
| Final render + QA | `npm run render -- <id> [--master]` | `out/<id>.mp4` + frame count, glitch scan, LUFS; `--master` = -14 LUFS copy |
| Find any effect (ours + 448 HyperFrames) | `npm run fx-find -- "glitch"` / `-- --list` | name, exact usage line, where to import |
| Footage FX (ffmpeg) | `npm run fx -- <grade\|slowmo\|speed\|reverse\|boomerang\|stabilize\|denoise\|sharpen\|key\|voice\|deflicker\|still> <take> [--from s --to s]` | `public/fx/<take>.<op>.mp4` |
| Re-make LUTs | `npm run luts` | 12 `.cube` in `assets/luts/` |
| Re-register after adding Video.tsx | `npm run registry` | |
| Health check | `npm run verify` | `SETUP_OK` |

## Token rules

- Never list or read `assets/`, the sound/music libraries, `node_modules/`, `bin/`, or `analysis/` folders. Use `npm run find`.
- Never read whole `*.words.json` or `edit.json` files. Use `npm run words`. The ingest output and `analysis.json` `speech`/`cuts` summary are enough to plan.
- Look at **one contact sheet per check**, never many stills. View `grid.jpg` once per take to read framing (eye line, chin, mic top, hair top).
- Never re-transcribe an unchanged take (whisper jitters; anchored beats drift).
- Build graphics from `src/shared/graphics` (see the library below) and `brand/theme.ts`. Write a new component only when nothing fits, then add it to the library and to `src/Gallery.tsx` so it's reusable.
- Prefer editing `src/videos/<id>/Video.tsx` (copy `templates/Video.tsx.txt`) over rewriting `edit.json` by hand. Re-run `auto-edit` to change cut or caption settings.
- Keep replies short: report changes in frames (`f894`) and timecodes.

## Accuracy rules (non-negotiable)

- Every graphic, cue and caption tweak is anchored to a **measured** frame: a word start (`npm run words`) or a detected cut (`analysis.json` `cuts`). Never "around 30 seconds".
- Sound cues start `lead` frames early (`npm run use` prints it) so the hit lands on the frame.
- Music bed 15-18 dB under the voice (auto-edit `--music` sets the gain from measured levels).
- Captions draw last (`<AutoReel hideCaptions />` + `<CaptionTrack/>` in `Video.tsx`). Under full-screen graphics, move them with `yOverrides`; never drop them.
- Anything that must not be clipped stays inside the IG 4:5 safe band y285-y1635 (`theme.safe`). Put `<SafeAreaGuide/>` in check renders when placing graphics.
- Verify before showing: `npm run check` on every changed beat, then `npm run render`. Read its QA lines (frame count matches, no flashes, peak < -1 dBFS).
- Video sequences of the same source must not overlap (decoder deadlock): use `premountFor={0}` on `<Sequence>` wrapping `<OffthreadVideo>`.

## Graphics library (`src/shared/graphics`, all brand-themed)

Wrap each in `<Sequence from={cueFrame} durationInFrames={len} premountFor={0}>`. Local frame 0 = the cue. Exits use the last frames of the Sequence.

- Text: `KineticText` (words land on their frames: rise/pop/slam), `TitleReveal` (serif title, for behind-the-head), `HookText` (3 variants), `Typewriter`
- Panels: `StatPanel` (count-up; card/full), `LowerThird`, `Checklist` (ticks at frames), `ImageCard` (big centred overlay), `ProgressBar`
- Drawn: `Callout` (hand-drawn arrow + label), `CircleMark`, `Highlight` (marker/underline), `LineGraph` (self-drawing), `BarChart`
- FX: `Camera` (punch/push/zoomIn/shake around a focus point), `Whip`, `Flash`, `FilmLook`, `Ground`, `SafeAreaGuide`
- Skill components: `Caption`, `TextHook`, `TwoThirdsPanel`, `Silhouette` in `src/shared/`
- Preview all: composition `GraphicsGallery`.
- Behind-the-head titles: `npx hyperframes remove-background clip.mp4 -o public/cutouts/x.mov` (works on CPU here), then layer footage, `TitleReveal`, cut-out.

## Effects library (`src/shared/effects`, 83 entries in `catalog.json`; all visually verified in `EffectsGallery`)

Find with `npm run fx-find`. Never browse the source.
- Transitions for `<TransitionSeries>`: Remotion built-ins (fade, slide, wipe, flip, clockWipe, iris, cube, zoomInOut, pushCut, blurSlide, and more) plus custom CSS ones: zoomThrough, whipPan, glitchCut, flashCut, spin, blurDissolve, shapeReveal, splitDoors, swipePush, dipToBlack, pixelate.
- Overlays: LightLeak, FilmBurnOverlay, DustScratches, VHS, RGBSplit/ChromaticAberration, Glitch, Letterbox, Particles (confetti/sparkles/snow/bokeh/embers/hearts), GradientBackground, Spotlight, HudGrid.
- Motion: KenBurns, Parallax, Tilt3D, Wiggle, Entrance, PictureInPicture, SplitScreen, MaskReveal, Censor, ZoomBlur, MotionBlur, EchoTrail, BeatPulse, Handheld, ImpactShake.
- Text: LetterAnimate, Scramble, NeonText, GradientText, OutlineText, Ticker, EmojiPop, HighlightWord.
- Colour: `<ColorGrade look>` for live preview. Bake the matching real LUT into footage with `npm run fx -- grade <take> --lut <look>`.
- Effect not here: search HyperFrames (`npm run fx-find -- "<look>" --hf`), render that one asset per `references/hyperframes-hybrid.md`, then composite it.
- New effect: add it to the right file, a line to `catalog.json`, and a slot to `src/EffectsGallery.tsx`. Then `npm run check` it.
- Check scale: lines under ~4 px vanish in 0.2-0.25 scale checks. Verify thin detail at `--scale 1` on a single frame.
- GPU-shader transitions (zoomInOut verified) render on this CPU via software GL but are slower. Check each once before use.

## Free-only rule (user requirement)

Use only free, local tools and CC0/PD/credited-free assets. Never use paid or key-gated services: no `hyperframes cloud`/`auth`/`publish`/`templates` (Pro), no HeyGen media, ElevenLabs, fal.ai, OpenAI, Gemini or Groq APIs, no Remotion Lambda or Cloud Run, no Mapbox or MapTiler tokens. Installed skills that mention such options (hyperframes, remotion-best-practices): always take the local path. Remotion is free for individuals and companies of up to 3 people. Tell the user if a client edit needs a company licence.

Installed design and editing skills (reviewed, free): `remotion-reel` (workflow), `remotion-best-practices` (official Remotion API, captions, rendering), `hyperframes` (official HTML-to-video effects; render locally), `canvas-design` (posters and stills), `algorithmic-art` (generative visuals), `theme-factory` (palette and type pairings), `better-typography` (type rules), `animation-vocabulary` (motion terms).

## Machine facts

- CPU only (i5-8265U, 12 GB). Render concurrency is chosen automatically (`scripts/lib/media.mjs`). 8 tabs crashed Chrome, and more than 2-4 is not faster.
- Remotion copies all of `public/` into every render on Windows. Keep big libraries in `assets/`. Only `npm run use` picks go into `public/`.
- Kevin MacLeod tracks need a credit line in the post (`npm run find` marks them; `npm run use` logs the credit to `public/music pack/CREDITS-USED.md`). Use `--free` to avoid them.
- Python helper scripts from the skill run with `.venv\Scripts\python.exe`. Ask the user before running downloaded scripts.
