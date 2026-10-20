// Uploads the video + poster to Ghost and creates (or updates) the lesson as a DRAFT.
// Nothing goes live until Shalone presses Publish in Ghost.
// Run: npm run publish -- <course>/<lesson>
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildKidsSitePost, buildPost} from './build-post.mjs';
import {ghost, ghostReady} from './ghost.mjs';
import {renderKidsThumb} from './kids-thumb.mjs';
import {ROOT, lessonDir, loadLesson, loadSite} from './lib.mjs';

const arg = process.argv[2];
// --update-live: replace an already published lesson in place (only when Shalone asks).
const updateLive = process.argv.includes('--update-live');
const {id, lesson, course, segments, kids} = loadLesson(lessonDir(arg));
// Kids lessons go to both sites (course.yml `sites:` can say otherwise).
const sites = lesson.sites ?? course.sites ?? (kids ? ['courses', 'kids'] : ['courses']);

// A person signs off on every lesson before it can reach the site.
const problems = [];
if (lesson.status !== 'reviewed') problems.push(`lesson.yml says status: ${lesson.status} (Shalone reviews it, then it becomes status: reviewed)`);
if (!loadSite().author) problems.push('site.yml has no author');
for (const s of segments) if ((s.kind === 'intro' || s.kind === 'outro') && !s.text) problems.push(`the ${s.name} isn't written yet`);
for (const s of segments) if (s.kind === 'point' && !s.heading) problems.push(`slide ${s.index + 1} needs a section title`);
const dist = path.join(ROOT, 'dist', id);
for (const f of ['lesson.mp4', 'poster.jpg']) if (!fs.existsSync(path.join(dist, f))) problems.push(`${f} is missing (npm run render -- ${arg})`);
if (problems.length) throw new Error(`Not publishing yet:\n  - ${problems.join('\n  - ')}`);
try {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/check-quotes.mjs'), arg], {stdio: 'inherit'});
} catch {
  throw new Error('Quotation check failed; fix the quotes above before publishing.');
}

for (const which of sites) {
  const label = which === 'kids' ? ' (kids site)' : '';
  if (which === 'kids' && !ghostReady('kids')) {
    console.log('Kids site skipped: add KIDS_GHOST_URL and KIDS_GHOST_ADMIN_API_KEY to .env to send it there too.');
    continue;
  }
  const g = ghost(which);
  console.log(`Uploading video${label}…`);
  const videoUrl = await g.upload('media', path.join(dist, 'lesson.mp4'), 'video/mp4');
  const posterUrl = await g.upload('images', path.join(dist, 'poster.jpg'), 'image/jpeg');
  const {html, meta} = which === 'kids' ? buildKidsSitePost(arg, {videoUrl, posterUrl}) : buildPost(arg, {videoUrl, posterUrl});
  // The kids site's thumbnails have their own look (turquoise, big letters, her pixel art).
  const feature = which === 'kids' ? await g.upload('images', renderKidsThumb(arg), 'image/png') : posterUrl;
  const saved = await g.saveDraft('posts', {
    title: meta.title, slug: meta.slug, custom_excerpt: meta.custom_excerpt, html,
    tags: meta.tags.map((name) => ({name})), feature_image: feature,
  }, {updateLive});
  console.log(saved.status === 'published' ? `Live post updated${label}: ${saved.url}` : `Draft saved${label}: ${saved.editorUrl}`);
}
