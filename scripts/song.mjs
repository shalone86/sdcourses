// Makes a music video: npm run song -- <name> [--still <seconds>] [--seconds <n>] [--out <file>]
//   dist/songs/<name>/<name>.mp4; --still makes one picture, --seconds only the start (to try it out).
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {ROOT} from './lib.mjs';
import {songProps, songSlug} from './songs.mjs';

const args = process.argv.slice(2);
const flags = ['--still', '--seconds', '--out'];
const name = songSlug(args.find((a, i) => !a.startsWith('--') && !flags.includes(args[i - 1])));
if (!name) { console.error('Usage: npm run song -- <name> [--still <seconds>] [--seconds <n>] [--out <file>]'); process.exit(1); }
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const log = process.env.STUDIO === '1' ? '--log=info' : '--log=error';

console.log('STEP 1/2 Drawing the video');
const {song, audio, duration, parts, arts, missing} = songProps(name);
if (!audio) throw new Error('This song has no sound file yet');
if (missing.length) console.warn(`Not found (nothing shows for them): ${missing.join(', ')}`);
const dist = path.join(ROOT, 'dist', 'songs', name);
fs.mkdirSync(dist, {recursive: true});
const props = path.join(dist, 'props.json');
fs.writeFileSync(props, JSON.stringify({song, audio, duration, parts, arts}));
const remotion = path.join(ROOT, 'node_modules', '.bin', 'remotion');
const run = (cmd, a) => execFileSync(cmd, a, {stdio: 'inherit', cwd: ROOT});

if (opt('--still') != null) {
  const out = opt('--out') ?? path.join(dist, `${name}-${opt('--still')}s.png`);
  run(remotion, ['still', 'video/index.ts', 'MusicVideo', out, `--props=${props}`, `--frame=${Math.round(Number(opt('--still')) * 30)}`, '--log=error']);
  console.log(out);
} else {
  const master = path.join(dist, 'master.mp4');
  const out = opt('--out') ?? path.join(dist, `${name}.mp4`);
  const some = opt('--seconds') ? [`--frames=0-${Math.round(Number(opt('--seconds')) * 30) - 1}`] : [];
  run(remotion, ['render', 'video/index.ts', 'MusicVideo', master, `--props=${props}`, '--crf=16', '--x264-preset=fast', ...some, log]);
  // Flat colors compress small; the song keeps good sound (it is the point of the video).
  console.log('STEP 2/2 Making a small copy');
  run('ffmpeg', ['-y', '-v', 'error', '-i', master, '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', out]);
  fs.rmSync(master);
  console.log(`${path.basename(out)}  ${(fs.statSync(out).size / 1e6).toFixed(1)} MB\n${out}`);
}
