// Transcribe a video to word-level timestamps using ffmpeg + whisper.cpp.
//
// Usage:
//   node scripts/transcribe.mjs <video.mp4> [out.words.json]
//
// Default output: next to the video as <name>.words.json
// (e.g. public/recordings/take1.mp4 -> public/recordings/take1.words.json),
// which is where the remotion-reel skill expects transcripts.
//
// Output shape (what the remotion-reel skill and its retime-captions.py expect):
//   [ { "text": "Hello", "startMs": 320, "endMs": 370 }, ... ]
//
// Notes vs. the original workflow snippet (needed on current whisper.cpp / Windows):
//  - whisper.cpp renamed `main` to `whisper-cli`; the binary lives in bin/whisper.cpp/build/bin/.
//  - `--max-len 1 --split-on-word` makes each segment a single word (true word-level timing).
//  - Uses `offsets` (integer ms) instead of `timestamps` (strings like "00:00:01,230").
//  - Uses execFileSync with argument arrays (no shell), so file names with spaces or
//    special characters cannot break or inject into the command.
//  - Intermediate .wav / raw whisper JSON go to the OS temp dir; out/ holds only renders.
//
// Env: WHISPER_MODEL=ggml-small.bin  multilingual, more accurate (slower) model
//      WHISPER_LANG=hi|en|auto         spoken language (needs a multilingual model, e.g. ggml-small.bin)
//      WHISPER_TRANSLATE=1             output English translation instead of the spoken language

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';

const [videoArg, outArg] = process.argv.slice(2);
if (!videoArg) {
  console.error('Usage: node scripts/transcribe.mjs <video.mp4> [out.words.json]');
  process.exit(1);
}
const videoPath = path.resolve(videoArg);
if (!fs.existsSync(videoPath)) {
  console.error(`Input not found: ${videoPath}`);
  process.exit(1);
}

const whisperDir = path.join(root, 'bin', 'whisper.cpp');
const exe = isWin ? 'whisper-cli.exe' : 'whisper-cli';
const whisperBin = [path.join(whisperDir, 'build', 'bin', exe), path.join(whisperDir, 'build', 'bin', 'Release', exe)].find((p) =>
  fs.existsSync(p),
);
const modelPath = path.join(whisperDir, 'models', process.env.WHISPER_MODEL ?? 'ggml-base.en.bin');

if (!whisperBin) {
  console.error(`whisper-cli not found under ${path.join(whisperDir, 'build', 'bin')}. Run setup first.`);
  process.exit(1);
}
if (!fs.existsSync(modelPath)) {
  console.error(`Model not found: ${modelPath}. Run setup first.`);
  process.exit(1);
}

const baseName = path.basename(videoPath, path.extname(videoPath));
const jsonPath = path.resolve(outArg ?? path.join(path.dirname(videoPath), `${baseName}.words.json`));
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transcribe-'));
const audioPath = path.join(tmpDir, 'audio.wav');
const whisperOutBase = path.join(tmpDir, 'whisper');

try {
  console.log('Extracting audio...');
  execFileSync(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-y', '-i', videoPath, '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', audioPath],
    { stdio: 'inherit' },
  );

  console.log(`Transcribing with whisper.cpp (${path.basename(modelPath)})...`);
  // WHISPER_LANG: language code (hi, en, ...) or "auto". Multilingual models only (not *.en).
  const lang = process.env.WHISPER_LANG ? ['-l', process.env.WHISPER_LANG] : [];
  const translate = process.env.WHISPER_TRANSLATE === '1' ? ['--translate'] : [];
  execFileSync(whisperBin, ['-m', modelPath, '-f', audioPath, ...lang, ...translate, '--max-len', '1', '--split-on-word', '-oj', '-of', whisperOutBase, '-np'], {
    stdio: 'inherit',
  });

  console.log('Formatting JSON...');
  const raw = JSON.parse(fs.readFileSync(`${whisperOutBase}.json`, 'utf8'));

  const words = [];
  for (const segment of raw.transcription ?? []) {
    const text = segment.text.trim();
    if (!text) continue;
    words.push({ text, startMs: segment.offsets.from, endMs: segment.offsets.to });
  }

  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(words, null, 2));
  console.log(`Success! Saved to ${path.relative(root, jsonPath)} (${words.length} words)`);
} catch (error) {
  console.error('Transcription failed:', error.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
