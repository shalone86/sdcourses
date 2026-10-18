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
import {coverTint} from './cover.mjs';

const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const only = args.filter((a) => !a.startsWith('--'));

const covers = YAML.parse(fs.readFileSync(path.join(ROOT, 'courses/covers.yml'), 'utf8'));
delete covers.tints;
// Single posts (feature image) are listed under `posts:`; everything else is a course (tag image).
const postCovers = covers.posts ?? {};
delete covers.posts;
for (const [slug, c] of Object.entries(postCovers)) covers[slug] = {...c, post: true};
for (const d of fs.readdirSync(path.join(ROOT, 'courses'))) {
  const f = path.join(ROOT, 'courses', d, 'course.yml');
  if (!fs.existsSync(f)) continue;
  const c = YAML.parse(fs.readFileSync(f, 'utf8'));
  if (c.cover) covers[c.slug] = {...c.cover, title: c.cover.title ?? c.title, categories: c.categories ?? []};
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
  // Category (for the tint): course.yml's, else the course's category tags on the site.
  let cats = c.categories;
  if (!cats) {
    const filter = c.post ? `slug:${slug}` : `tag:${slug}`;
    const posts = (await g.call('GET', `/posts/?limit=all&filter=${encodeURIComponent(filter)}&include=tags&formats=plaintext`)).posts;
    cats = [...new Set(posts.flatMap((p) => p.tags.filter((t) => t.slug.startsWith('_')).map((t) => t.name)))];
  }
  // The small line above the title says it too ("Catholic Kids Course", "Byzantine Catholic Course", …).
  const byEyebrow = {kids: 'Catholic Kids Courses', saint: 'Catholic Saints', 'art history': 'Catholic Art History', byzantine: 'Byzantine Catholic Courses'};
  for (const [k, v] of Object.entries(byEyebrow)) if ((c.eyebrow ?? '').toLowerCase().includes(k)) cats = [v, ...cats];
  const inputProps = {title: c.title ?? item.title ?? item.name, icon: c.icon, eyebrow: c.eyebrow, photo: c.photo, tint: coverTint(cats), watermark: true};
  const composition = await selectComposition({serveUrl, id: 'Cover', inputProps});
  const png = path.join(out, `${slug}.png`);
  await renderStill({serveUrl, composition, output: png, inputProps});
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', png, '-q:v', '3', path.join(out, `${slug}.jpg`)]);
  fs.rmSync(png);
  console.log(`rendered ${slug}`);
}
// A contact sheet of exactly what was rendered (4 across).
const shots = slugs.map((x) => path.join(out, `${x}.jpg`));
execFileSync('ffmpeg', ['-y', '-v', 'error', ...shots.flatMap((f) => ['-i', f]), '-filter_complex',
  shots.map((_, i) => `[${i}]scale=400:-1[v${i}]`).join(';') + ';' + shots.map((_, i) => `[v${i}]`).join('') +
  `xstack=inputs=${shots.length}:layout=` + shots.map((_, i) => `${(i % 4) * 408}_${Math.floor(i / 4) * 233}`).join('|') + ':fill=white',
  path.join(out, 'sheet.jpg')]);
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
