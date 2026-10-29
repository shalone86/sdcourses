// Renders a battle on its own: npm run battle -- <name> [--still <seconds>] [--out <file>]
//   mp4 by default (dist/battles/<name>.mp4); --still makes one frame (PNG) to look at.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {ROOT} from './lib.mjs';
import {battleProps} from './battles.mjs';

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--still' && args[args.indexOf(a) - 1] !== '--out');
if (!name) { console.error('Usage: npm run battle -- <name> [--still <seconds>] [--out <file>]'); process.exit(1); }
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);

const {battle, arts, missing} = battleProps(name);
if (missing.length) console.warn(`Not drawn yet (nothing shows for them): ${missing.join(', ')}`);

const dist = path.join(ROOT, 'dist', 'battles');
fs.mkdirSync(dist, {recursive: true});
const props = path.join(dist, `${name}.props.json`);
fs.writeFileSync(props, JSON.stringify({battle, arts}));
const remotion = path.join(ROOT, 'node_modules', '.bin', 'remotion');
const run = (a) => execFileSync(remotion, [...a, `--props=${props}`, '--log=error'], {stdio: 'inherit', cwd: ROOT});

if (opt('--still') != null) {
  const out = opt('--out') ?? path.join(dist, `${name}-${opt('--still')}s.png`);
  run(['still', 'video/index.ts', 'Battle', out, `--frame=${Math.round(Number(opt('--still')) * 30)}`]);
  console.log(out);
} else {
  const out = opt('--out') ?? path.join(dist, `${name}.mp4`);
  run(['render', 'video/index.ts', 'Battle', out, '--crf=18']);
  console.log(out);
}
