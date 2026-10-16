// Renders and uploads cover pictures for every course in courses/covers.yml
// (and every course.yml with a `cover:`), bundling the video once.
//   npm run covers                 render all to dist/covers/, then upload
//   npm run covers -- --dry-run    render only (look at dist/covers/sheet.jpg)
//   npm run covers -- <slug> …     just these courses
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import YAML from 'yaml';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {ROOT} from './lib.mjs';

const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const only = args.filter((a) => !a.startsWith('--'));

const covers = YAML.parse(fs.readFileSync(path.join(ROOT, 'courses/covers.yml'), 'utf8'));
// Single posts (feature image) are listed under `posts:`; everything else is a course (tag image).
const postCovers = covers.posts ?? {};
delete covers.posts;
for (const [slug, c] of Object.entries(postCovers)) covers[slug] = {...c, post: true};
for (const d of fs.readdirSync(path.join(ROOT, 'courses'))) {
  const f = path.join(ROOT, 'courses', d, 'course.yml');
  if (!fs.existsSync(f)) continue;
  const c = YAML.parse(fs.readFileSync(f, 'utf8'));
  if (c.cover) covers[c.slug] = {...c.cover, title: c.cover.title ?? c.title};
}
const slugs = Object.keys(covers).filter((s) => !only.length || only.includes(s));

const {ghost} = await import('./ghost.mjs');
const g = ghost();
const out = path.join(ROOT, 'dist', 'covers');
fs.mkdirSync(out, {recursive: true});
const serveUrl = await bundle({entryPoint: path.join(ROOT, 'video/index.ts'), publicDir: path.join(ROOT, 'video/public')});
for (const slug of slugs) {
  const c = covers[slug];
  const item = (await g.call('GET', `/${c.post ? 'posts' : 'tags'}/slug/${slug}/`))[c.post ? 'posts' : 'tags'][0];
  const inputProps = {title: c.title ?? item.title ?? item.name, icon: c.icon, eyebrow: c.eyebrow, photo: c.photo};
  const composition = await selectComposition({serveUrl, id: 'Cover', inputProps});
  const png = path.join(out, `${slug}.png`);
  await renderStill({serveUrl, composition, output: png, inputProps});
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', png, '-q:v', '3', path.join(out, `${slug}.jpg`)]);
  fs.rmSync(png);
  console.log(`rendered ${slug}`);
}
// A contact sheet to look over before (or after) uploading.
execFileSync('ffmpeg', ['-y', '-v', 'error', '-pattern_type', 'glob', '-i', path.join(out, '*.jpg').replace(/ /g, '\\ '), '-vf', 'scale=400:-1,tile=4x8:padding=8:color=white', '-frames:v', '1', path.join(out, 'sheet.jpg')], {cwd: out});
if (dry) process.exit(0);
for (const slug of slugs) {
  const url = await g.upload('images', path.join(out, `${slug}.jpg`), 'image/jpeg');
  const kind = covers[slug].post ? 'posts' : 'tags';
  const item = (await g.call('GET', `/${kind}/slug/${slug}/`))[kind][0];
  if (kind === 'posts') {
    // #cover (internal) tells the theme the picture carries the title. It goes
    // last: the theme picks a card's type from the first internal tag.
    const full = (await g.call('GET', `/posts/${item.id}/?include=tags`)).posts[0];
    const tags = full.tags.filter((t) => t.slug !== 'hash-cover').map((t) => ({id: t.id}));
    await g.call('PUT', `/posts/${item.id}/`, {posts: [{feature_image: url, tags: [...tags, {name: '#cover'}], updated_at: full.updated_at}]});
  } else {
    await g.call('PUT', `/${kind}/${item.id}/`, {[kind]: [{feature_image: url, updated_at: item.updated_at}]});
  }
  console.log(`uploaded ${slug}`);
}
