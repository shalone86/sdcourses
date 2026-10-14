// Quick visual check without a full render: one still per scene (plus each
// point's heading), tiled into dist/<lesson>/contact-sheet.jpg.
// Run: npm run stills -- <course>/<lesson>
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {ROOT} from './lib.mjs';
import {prepare} from './prepare.mjs';

const HEADING_FRAMES = 66;
const {props, dist} = prepare(process.argv[2]);
const frames = [];
let at = 0;
for (const s of props.segments) {
  const start = s.kind === 'point' ? HEADING_FRAMES : 0;
  const per = Math.floor((s.durationInFrames - start) / s.scenes.length);
  if (s.kind === 'point') frames.push(at + 30);
  s.scenes.forEach((_, i) => frames.push(at + start + i * per + Math.min(per - 15, Math.floor(per * 0.8))));
  at += s.durationInFrames;
}

const serveUrl = await bundle({entryPoint: path.join(ROOT, 'video/index.ts'), publicDir: path.join(ROOT, 'video/public')});
const browserExecutable = process.env.REMOTION_BROWSER ?? null;
const composition = await selectComposition({serveUrl, id: 'Lesson', inputProps: props, browserExecutable});
const tmp = fs.mkdtempSync(path.join(dist, 'stills-'));
for (const [i, frame] of frames.entries()) {
  await renderStill({serveUrl, composition, frame, inputProps: props, output: path.join(tmp, `${String(i).padStart(2, '0')}.png`), scale: 0.5, browserExecutable});
}
const cols = 3;
const rows = Math.ceil(frames.length / cols);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-pattern_type', 'glob', '-i', path.join(tmp, '*.png'),
  '-vf', `tile=${cols}x${rows}:padding=8:color=white`, '-frames:v', '1', '-q:v', '4', path.join(dist, 'contact-sheet.jpg')]);
fs.rmSync(tmp, {recursive: true});
console.log(`${frames.length} stills -> ${path.join(dist, 'contact-sheet.jpg')}`);
