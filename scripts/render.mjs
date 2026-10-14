// Renders the lesson video, then re-encodes it as small as it can go for Ghost hosting.
// Run: npm run render -- <course>/<lesson> [--720]
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {ROOT} from './lib.mjs';
import {prepare} from './prepare.mjs';

const arg = process.argv[2];
const small = process.argv.includes('--720');
// The Lesson Studio (studio/server.mjs) reads the STEP lines and Remotion's
// "Rendered x/y" lines to show progress; on the command line they stay quiet.
const log = process.env.STUDIO === '1' ? '--log=info' : '--log=error';
const step = (n, label) => console.log(`STEP ${n}/3 ${label}`);

step(1, 'Drawing the video');
const {dist} = prepare(arg);
const propsFile = path.join(dist, 'props.json');
const master = path.join(dist, 'master.mp4');
const final = path.join(dist, 'lesson.mp4');
const poster = path.join(dist, 'poster.jpg');

const remotion = path.join(ROOT, 'node_modules', '.bin', 'remotion');
const run = (cmd, args) => execFileSync(cmd, args, {stdio: 'inherit', cwd: ROOT});

// 1. High-quality master (kept locally, never uploaded).
run(remotion, ['render', 'video/index.ts', 'Lesson', master, `--props=${propsFile}`, '--crf=16', '--x264-preset=fast', log]);
// 2. Poster frame from the title card.
step(2, 'Making the cover picture');
run(remotion, ['still', 'video/index.ts', 'Lesson', path.join(dist, 'poster.png'), `--props=${propsFile}`, '--frame=75', '--log=error']);
run('ffmpeg', ['-y', '-v', 'error', '-i', path.join(dist, 'poster.png'), '-vf', 'scale=1280:-2', '-q:v', '5', poster]);
fs.rmSync(path.join(dist, 'poster.png'));

// 3. Web copy. Flat colors + "animation" tuning + a high CRF keep it tiny;
//    voice needs little more than 64 kbps mono.
step(3, 'Making a small copy for Ghost');
run('ffmpeg', ['-y', '-v', 'error', '-i', master,
  ...(small ? ['-vf', 'scale=1280:720:flags=lanczos'] : []),
  '-c:v', 'libx264', '-preset', 'veryslow', '-tune', 'animation', '-crf', small ? '28' : '30',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-c:a', 'aac', '-b:a', '64k', '-ac', '1', final]);

const mb = (f) => (fs.statSync(f).size / 1e6).toFixed(1) + ' MB';
console.log(`\nlesson.mp4  ${mb(final)}   (master ${mb(master)}, poster ${mb(poster)})\n${dist}`);
