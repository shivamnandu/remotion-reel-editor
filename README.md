# Video Editor: edit reels by talking to Claude

Turns raw talking-head footage into finished vertical reels (1080x1920, 30 fps). Scripts do the routine work (normalising, transcribing, cutting dead air, captions, levels, QA) the same way every time, with no AI involved. Claude adds the creative layer (graphics, hooks, sound design) from a brand-themed component library. You review on a storyboard and get an MP4.

Based on the guide "Claude × Remotion: Edit Your Videos by Talking" (millee.md) and its `remotion-reel` skill. Rules Claude follows here: [CLAUDE.md](CLAUDE.md).

## Quick start

1. Drop clips in `public/recordings/` (screen recordings in `public/screen-recordings/`).
2. Ask Claude: *"Edit these clips into one reel. Cut the dead air, add my captions, and plan motion graphics for each beat in my brand. Lay it out in a storyboard for me to review."*

Or run the steps yourself:

```powershell
npm run ingest                                # transcode .mov/HEVC/HDR, transcribe, measure cuts + silences
npm run auto-edit -- my-reel take1 take2      # rough cut: dead air out, captions in
npm run dev                                   # watch it in Remotion Studio (composition "my-reel")
npm run render -- my-reel --master            # out/my-reel.mp4 (+ .master.mp4 at -14 LUFS), with QA
```

## Pipeline

| Step | What happens | Tool |
| --- | --- | --- |
| Ingest | Probe; transcode to H.264 30 fps (HDR tone-mapped); verify frame count; word-level transcript; scene cuts; silences; contact sheet + measuring grid | `npm run ingest` |
| Transcribe | whisper.cpp `base.en` (or `WHISPER_MODEL=ggml-small.bin`), one entry per word | `npm run transcribe` (ingest calls it) |
| Edit | Rough cut from measured silences (cuts gaps > 0.1 s, keeps 60 ms breathing room), captions chunked by the skill's rules, optional music bed set 17 dB under the voice | `npm run auto-edit` |
| Creative layer | `src/videos/<id>/Video.tsx` (from `templates/Video.tsx.txt`) adds graphics at frames found with `npm run words` | graphics library |
| Storyboard | Clip per beat on a review page: Keep / Maybe / Drop + notes | skill `storyboard-review.html` |
| Render | One-pass render, then frame count, glitch scan, loudness (LUFS / true peak), optional mastering | `npm run render` |

## Assets

| Where | What |
| --- | --- |
| `public/sound pack/generated/` | 90 original sound effects made in code (`npm run sfx`); add your own favourites here too |
| `assets/sfx-library/` | 6,058 CC0 sound effects from 218 OpenGameArt packs (incl. Kenney): impacts, UI, whooshes, foley, ambience... |
| `assets/music-library/` | 392 CC0 tracks/stingers from 129 OpenGameArt packs, 28 public-domain classical recordings (Musopen), 400 Kevin MacLeod tracks across 21 moods (CC BY 4.0, **credit required**) |
| `assets/*-index.json` | Searchable index: duration, loudness, lead-in, mood, bpm, licence |

```powershell
npm run find -- sound "whoosh" --max 1        # search
npm run find -- music "calm piano" --free     # only tracks needing no credit
npm run use -- "assets/sfx-library/..."       # copy into public/, prints staticFile() path + cue lead
```

The libraries live outside `public/` on purpose: Remotion copies all of `public/` into every render on Windows. Credits: `assets/*-library/CREDITS.md`. Every credit for a track you used is logged in `public/music pack/CREDITS-USED.md`.

## Graphics library

`src/shared/graphics`, styled by `brand/theme.ts` (keep in sync with `brand/BRAND.md`): KineticText, TitleReveal, HookText, Typewriter, StatPanel, LowerThird, Checklist, ImageCard, ProgressBar, Callout, CircleMark, Highlight, LineGraph, BarChart, Camera (punch/push/zoom/shake), Whip, Flash, FilmLook, SafeAreaGuide. See them all in the `GraphicsGallery` composition.

Titles behind your head: `npx hyperframes remove-background clip.mp4 -o public/cutouts/clip.mov` (local model, works on this CPU), then layer footage → title → cut-out.

## Effects library

`src/shared/effects` is catalogued in 83 searchable entries (68 shown in the `EffectsGallery` composition, every one rendered and checked):

| Group | Effects |
| --- | --- |
| Transitions | Remotion built-ins (fade, slide, wipe, flip, clock wipe, iris, cube, zoom in/out, push cut, blur slide...) plus zoom-through, whip pan, glitch cut, flash cut, spin, blur dissolve, shape reveal, split doors, swipe push, dip to black, pixelate |
| Overlays | light leak, film burn, dust and scratches, VHS, RGB split / chromatic aberration, glitch, letterbox, particles (confetti, sparkles, snow, bokeh, embers, hearts), animated gradient, spotlight, HUD grid |
| Motion | Ken Burns, parallax, 3D tilt, wiggle, entrances, picture-in-picture, split screen, mask reveals, censor blur/pixel, zoom blur, motion blur, echo trail, beat pulse, handheld drift, impact shake |
| Text | per-letter animation, scramble/decode, neon, gradient, outline fill, ticker, emoji pop, highlighted word |
| Colour | 12 looks: live `<ColorGrade>` preview plus real 3D LUTs (`assets/luts/*.cube`) baked with ffmpeg |
| Footage FX | `npm run fx`: LUT grade, optical-flow slow-mo, speed ramp, reverse, boomerang, stabilise, denoise, sharpen, green-screen key (alpha), voice polish, deflicker, freeze frame |

```powershell
npm run fx-find -- "glitch"                    # search ours + 448 HyperFrames effects
npm run fx -- slowmo take1 --from 3 --to 5     # smooth 2x slow-mo of seconds 3-5
npm run fx -- grade take1 --lut teal-orange --mix 0.8
npm run fx -- voice take1                      # broadcast-style voice clean-up, -14 LUFS
```

## Folder layout

```
public/recordings/        takes (+ .words.json, .analysis.json)      assets/originals/    original .mov/HEVC files
public/screen-recordings/ screen captures                            assets/sfx-library/  CC0 SFX library
public/images/            stills, logos                              assets/music-library/ music library
public/sound pack/        generated + picked SFX                      analysis/            contact sheets, grids, checks
public/music pack/        picked music (+ CREDITS-USED.md)            out/                 finished renders only
public/cutouts/           background-removed clips (ProRes .mov)      brand/               BRAND.md + theme.ts
public/hyperframes/       HyperFrames effect renders                  hyperframes/         HyperFrames projects
src/shared/               AutoReel, captions, graphics library        src/videos/<id>/     edit.json, words.json, Video.tsx
scripts/                  pipeline tools                              bin/whisper.cpp/     whisper binary + models
```

## Filming tips

- Pauses and retakes are fine. Gaps are cut automatically.
- Leave headroom above your head for titles and graphics.
- Film in 4K if you can (punch-ins stay sharp). iPhone HDR is tone-mapped automatically.
- Say the important words clearly. Graphics and captions are timed to them.

## This PC

- CPU only (no NVIDIA GPU), 12 GB RAM: render concurrency is set automatically. A 22 s reel renders in about 2.5 min.
- Node.js, ffmpeg, git installed per-user in `%LOCALAPPDATA%\Programs`. whisper.cpp is the official prebuilt binary. Microsoft VC++ runtime DLLs (signature-checked) sit next to whisper and HyperFrames' onnxruntime.
- HyperFrames telemetry is off. Skill Python helpers use `.venv\Scripts\python.exe`.
- `npm run verify` checks everything and ends with `SETUP_OK`.

Remotion is free for individuals and teams up to 3. Larger companies need a [company license](https://www.remotion.pro/license).
