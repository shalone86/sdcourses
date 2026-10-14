// Scaffolds a course or a lesson so every one starts from the same shape.
//   npm run new -- course <slug> "<Course Title>"
//   npm run new -- lesson <course-slug> "<Lesson Title>"
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {ROOT} from './lib.mjs';

const [kind, a, title] = process.argv.slice(2);
const slugify = (t) => t.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

if (kind === 'course' && a && title) {
  const dir = path.join(ROOT, 'courses', a);
  if (fs.existsSync(dir)) throw new Error(`${dir} already exists`);
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, 'course.yml'), YAML.stringify({slug: a, title, summary: 'TODO: one or two sentences.', planned: []}));
  console.log(`Created courses/${a}/course.yml`);
} else if (kind === 'lesson' && a && title) {
  const cdir = path.join(ROOT, 'courses', a);
  if (!fs.existsSync(path.join(cdir, 'course.yml'))) throw new Error(`No course "${a}"; create it first`);
  const n = fs.readdirSync(cdir).filter((d) => /^\d\d-/.test(d)).length + 1;
  const slug = slugify(title);
  const dir = path.join(cdir, `${String(n).padStart(2, '0')}-${slug}`);
  fs.mkdirSync(path.join(dir, 'audio'), {recursive: true});
  const tpl = fs.readFileSync(path.join(ROOT, 'templates', 'lesson.yml'), 'utf8')
    .replace(/__COURSE__/g, a).replace(/__NUMBER__/g, String(n)).replace(/__SLUG__/g, slug).replace(/__TITLE__/g, title);
  fs.writeFileSync(path.join(dir, 'lesson.yml'), tpl);
  console.log(`Created ${path.relative(ROOT, dir)}/lesson.yml`);
} else {
  throw new Error('Usage: npm run new -- course <slug> "<Title>"  |  npm run new -- lesson <course-slug> "<Title>"');
}
