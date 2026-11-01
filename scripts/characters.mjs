// Her Blender characters (blender/library.blend), as pictures the studio and the video can use.
//   characters/manifest.json          who is in the library and what each can do (blender/render.py --manifest)
//   characters/<slug>/rest.png        the character standing
//   characters/<slug>/<anim>/NN.png   a short looping clip, with clip.json {fps, frames, width, height}
// Other views add @<view> to the name: rest@left.png, walk@right/ (views: see VIEWS in the manifest).
// A clip is drawn by Blender the first time it's asked for (a few seconds), then kept here.
import fs from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {ROOT} from './lib.mjs';

const run = promisify(execFile);
export const CHARACTERS = path.join(ROOT, 'characters');
const LIBRARY = path.join(ROOT, 'blender', 'library.blend');
const RENDER = path.join(ROOT, 'blender', 'render.py');
export const BLENDER = process.env.BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender';

const readManifest = () => {
  try { return JSON.parse(fs.readFileSync(path.join(CHARACTERS, 'manifest.json'), 'utf8')); } catch { return {fps: 12, characters: []}; }
};
const FRONT = 'front';
const withView = (name, view) => (!view || view === FRONT ? name : `${name}@${view}`);
const clipDir = (slug, anim, view) => path.join(CHARACTERS, slug, withView(anim, view));
const clipReady = (slug, anim, view) => fs.existsSync(path.join(clipDir(slug, anim, view), 'clip.json'));

/** For the Timing tab: every character with its animations and which are already drawn. */
export function figureCast() {
  const m = readManifest();
  const views = m.views ?? [FRONT];
  return {
    blender: fs.existsSync(BLENDER),
    views,
    characters: m.characters.map((c) => ({
      slug: c.slug, name: c.name, category: c.category, fit: !!c.fit, draft: c.origin === 'scaffold',
      rest: fs.existsSync(path.join(CHARACTERS, c.slug, 'rest.png')) ? `/characters/${c.slug}/rest.png` : null,
      anims: c.anims.map((a) => ({...a, views: views.filter((v) => clipReady(c.slug, a.id, v))})),
    })),
  };
}

const inflight = new Map();

/** Make sure the clip exists (drawing it with Blender if needed). Returns {fps, frames, width, height}. */
export async function ensureFigure(slug, anim, view = FRONT) {
  const c = readManifest().characters.find((x) => x.slug === slug);
  if (!c) throw new Error(`No character "${slug}" in the library`);
  if (!c.anims.some((a) => a.id === anim)) throw new Error(`${c.name} can't do "${anim}"`);
  if (!(readManifest().views ?? [FRONT]).includes(view)) throw new Error(`There is no "${view}" view`);
  if (!clipReady(slug, anim, view)) {
    const key = `${slug}/${withView(anim, view)}`;
    if (!inflight.has(key)) {
      if (!fs.existsSync(BLENDER)) throw new Error(`Blender isn't installed at ${BLENDER}, and this clip hasn't been drawn yet. Draw it on the Mac that has Blender (npm run characters -- ${slug} ${withView(anim, view)}), then it syncs here.`);
      const job = run(BLENDER, ['--background', LIBRARY, '--python', RENDER, '--', '--out', CHARACTERS, '--only', slug, '--anims', anim, '--views', view], {timeout: 180000, maxBuffer: 50e6})
        .finally(() => inflight.delete(key));
      inflight.set(key, job);
    }
    await inflight.get(key);
    if (!clipReady(slug, anim, view)) throw new Error(`Blender didn't make the ${anim} clip for ${c.name}`);
  }
  return JSON.parse(fs.readFileSync(path.join(clipDir(slug, anim, view), 'clip.json'), 'utf8'));
}

/**
 * A `figure` scene's clip as a sketch-style drawing (a picture per frame) that the Sprite scene plays.
 * The pictures are copied next to the lesson's video files.
 */
export function figureArt(sc, publicDir, id) {
  const dir = clipDir(sc.figure, sc.anim, sc.view);
  if (!clipReady(sc.figure, sc.anim, sc.view)) throw new Error(`The ${withView(sc.anim, sc.view)} clip of ${sc.figure} hasn't been drawn yet (open it in the Timing tab, or: npm run characters -- ${sc.figure} ${withView(sc.anim, sc.view)})`);
  const clip = JSON.parse(fs.readFileSync(path.join(dir, 'clip.json'), 'utf8'));
  const frames = [];
  for (let i = 1; i <= clip.frames; i++) {
    const name = `${String(i).padStart(2, '0')}.png`;
    const dest = path.join(publicDir, 'figures', sc.figure, withView(sc.anim, sc.view), name);
    fs.mkdirSync(path.dirname(dest), {recursive: true});
    fs.copyFileSync(path.join(dir, name), dest);
    frames.push(path.posix.join(id, 'figures', sc.figure, withView(sc.anim, sc.view), name));
  }
  return {kind: 'sketch', width: clip.width, height: clip.height, fps: clip.fps, palette: [], frames};
}

// `npm run characters -- <slug> <anim> [<anim> …]` draws clips; `-- --all-rest` redraws every still;
// `-- --manifest` rewrites the list; `-- --build <old.blend>` rebuilds the library from the old file.
if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2);
  const py = (script, args, file = LIBRARY) => run(BLENDER, ['--background', file, '--python', path.join(ROOT, 'blender', script), '--', ...args], {maxBuffer: 50e6});
  if (a[0] === '--manifest') await py('render.py', ['--out', CHARACTERS, '--manifest']);
  else if (a[0] === '--all-rest') await py('render.py', ['--out', CHARACTERS, '--anims', 'rest']);
  else if (a[0] === '--build') await py('build_library.py', [LIBRARY], path.resolve(a[1]));
  else if (a[0]) for (const spec of a.slice(1)) { const [anim, view] = spec.split('@'); console.log(slugLine(a[0], spec, await ensureFigure(a[0], anim, view || FRONT))); }
  else console.log('usage: npm run characters -- <character> <animation>[@view]…  |  --manifest  |  --all-rest  |  --build <old.blend>');
}
function slugLine(slug, anim, clip) { return `${slug}/${anim}: ${clip.frames} frames at ${clip.fps} fps`; }
