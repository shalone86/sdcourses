// Course cover image (the course page's picture in Ghost): an icon for the
// course's main idea + its title, in the videos' style. Icon names are from
// https://lucide.dev/icons (e.g. key-round, church, flame); set in course.yml:
//   cover: {icon: key-round}
// Run: npm run cover -- <course-slug>   → dist/<course>/cover.jpg
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import YAML from 'yaml';
import {ROOT} from './lib.mjs';

/** Cover colors for a course from its categories (courses/covers.yml tints; first match wins). */
export function coverTint(categories = []) {
  const f = path.join(ROOT, 'courses', 'covers.yml');
  const tints = fs.existsSync(f) ? YAML.parse(fs.readFileSync(f, 'utf8'))?.tints ?? [] : [];
  const names = new Set(categories.map((c) => String(c).replace(/^_/, '')));
  const t = tints.find((x) => names.has(x.category)) ?? tints.find((x) => x.category === 'default');
  return t ? {bg: t.bg, accent: t.accent, card: t.card} : undefined;
}

export function renderCover(slug) {
  const file = path.join(ROOT, 'courses', slug ?? '', 'course.yml');
  if (!slug || !fs.existsSync(file)) throw new Error('Usage: npm run cover -- <course-slug>');
  const course = YAML.parse(fs.readFileSync(file, 'utf8'));
  const dist = path.join(ROOT, 'dist', slug);
  fs.mkdirSync(dist, {recursive: true});
  const props = path.join(dist, 'cover-props.json');
  fs.writeFileSync(props, JSON.stringify({title: course.title, icon: course.cover?.icon, eyebrow: course.cover?.eyebrow, tint: coverTint(course.categories), watermark: true}));
  const png = path.join(dist, 'cover.png');
  const jpg = path.join(dist, 'cover.jpg');
  execFileSync(path.join(ROOT, 'node_modules/.bin/remotion'), ['still', 'video/index.ts', 'Cover', png, `--props=${props}`, '--log=error'], {cwd: ROOT, stdio: 'inherit'});
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', png, '-q:v', '3', jpg]);
  fs.rmSync(png);
  return jpg;
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(renderCover(process.argv[2]));
