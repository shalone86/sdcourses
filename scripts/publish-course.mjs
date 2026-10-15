// Creates or updates a course in Ghost. A course is a Ghost tag (name,
// description, cover picture from `npm run cover`); lessons join it through
// their primary tag.
// Run: npm run publish-course -- <course-slug>
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {renderCover} from './cover.mjs';
import {ghost} from './ghost.mjs';
import {ROOT} from './lib.mjs';

const slug = process.argv[2];
const file = path.join(ROOT, 'courses', slug ?? '', 'course.yml');
if (!slug || !fs.existsSync(file)) throw new Error('Usage: npm run publish-course -- <course-slug>  (needs courses/<slug>/course.yml)');
const course = YAML.parse(fs.readFileSync(file, 'utf8'));
const g = ghost();
const cover = await g.upload('images', renderCover(slug), 'image/jpeg');
const tag = await g.saveTag({name: course.title, slug: course.slug, description: course.summary.trim().slice(0, 500), feature_image: cover});
console.log(`Course tag ready: ${tag.name} (${tag.url ?? tag.slug})`);
