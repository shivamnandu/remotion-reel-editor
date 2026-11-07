// Creates the procedural sample footage the EffectsGallery composition uses:
// public/fx/gallery-sample.mp4 (4 s, 1080x1920, skin-tone-ish gradient scene with motion)
// and public/fx/gallery-still.png. Usage: npm run fx-sample
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PUBLIC } from './lib/media.mjs';

const dir = path.join(PUBLIC, 'fx');
fs.mkdirSync(dir, { recursive: true });
const scene = 'gradients=s=1080x1920:r=30:c0=0xd89070:c1=0x2a4d8f:c2=0x3f8f5a:c3=0xf2e6d0:c4=0x1a1a1a:n=5:seed=11:speed=0.015,format=yuv420p,'
  + 'drawbox=x=340:y=520:w=400:h=520:color=0xe0a88a@1:t=fill,drawbox=x=260:y=1040:w=560:h=880:color=0x203a5c@1:t=fill';
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', scene, '-t', '4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', path.join(dir, 'gallery-sample.mp4')], { stdio: 'inherit' });
execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '1', '-i', path.join(dir, 'gallery-sample.mp4'), '-frames:v', '1', path.join(dir, 'gallery-still.png')], { stdio: 'inherit' });
console.log('Wrote public/fx/gallery-sample.mp4 and public/fx/gallery-still.png');
