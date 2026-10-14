// Builds the Ghost post body (HTML) and a local preview from lesson.yml.
// Run: npm run post -- <course>/<lesson>
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, lessonDir, loadLesson, loadSite, outDir} from './lib.mjs';

export const VIDEO_PLACEHOLDER = '__VIDEO_URL__';
export const POSTER_PLACEHOLDER = '__POSTER_URL__';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Typographic quotes for prose; the YAML stays plain-ASCII and easy to edit.
const smart = (s) => esc(s).replace(/(^|[\s(\[—-])&quot;/g, '$1“').replace(/&quot;/g, '”').replace(/(\w)'(\w)/g, '$1’$2').replace(/'/g, '’');
const htmlCard = (inner) => `<!--kg-card-begin: html-->\n${inner}\n<!--kg-card-end: html-->`;

export function buildPost(arg, {videoUrl = VIDEO_PLACEHOLDER, posterUrl = POSTER_PLACEHOLDER} = {}) {
  const dir = lessonDir(arg);
  const {lesson, course, segments, id} = loadLesson(dir);
  const intro = segments[0];
  const outro = segments[segments.length - 1];
  const points = segments.filter((s) => s.kind === 'point');

  const quiz = {
    questions: lesson.points.map((p) => ({
      question: p.quiz.question,
      options: p.quiz.options,
      answer: p.quiz.answer,
      why: p.quiz.why.trim().replace(/\s+/g, ' '),
    })),
  };
  for (const [i, q] of quiz.questions.entries()) {
    if (!(q.answer >= 0 && q.answer < q.options.length)) throw new Error(`Point ${i + 1}: quiz answer index ${q.answer} is out of range`);
  }
  // Readers without JavaScript (and search engines) still get the questions.
  const fallback = `<ol class="cc-quiz-fallback">${quiz.questions.map((q) => `<li>${esc(q.question)}</li>`).join('')}</ol>`;
  const json = JSON.stringify(quiz).replace(/</g, '\\u003c');

  const html = [
    htmlCard(`<figure class="cc-video"><video controls playsinline preload="none" poster="${posterUrl}" src="${videoUrl}"></video></figure>`),
    `<p>${smart(intro.text)}</p>`,
    ...points.map((p) => `<h2>${smart(p.heading)}</h2>\n<p>${smart(p.text)}</p>`),
    `<p>${smart(outro.text)}</p>`,
    htmlCard(`<section class="cc-quiz" data-lesson="${esc(lesson.slug)}"><h2>Check your understanding</h2><p class="cc-quiz-intro">One question for each point. Your answers stay on your device.</p>${fallback}<script type="application/json">${json}</script></section>`),
    `<h3>Sources</h3>\n<ul>${lesson.sources.map((s) => `<li><a href="${esc(s.url)}">${esc(s.label)}</a></li>`).join('')}</ul>`,
    `<p class="cc-credit"><em>${esc(loadSite().disclosure)}</em></p>`,
  ].join('\n\n');

  const meta = {
    title: lesson.title,
    slug: lesson.slug,
    custom_excerpt: lesson.excerpt.trim(),
    tags: [course.title, '#lesson'],
    courseSlug: course.slug,
    number: lesson.number,
  };
  const dist = outDir(id);
  fs.writeFileSync(path.join(dist, 'post.html'), html);
  fs.writeFileSync(path.join(dist, 'post.json'), JSON.stringify(meta, null, 2));
  fs.writeFileSync(path.join(dist, 'preview.html'), preview(meta, html.replace(VIDEO_PLACEHOLDER, 'lesson.mp4').replace(POSTER_PLACEHOLDER, 'poster.jpg')));
  writeCodeInjection();
  return {html, meta, dist};
}

/** Ready-to-paste Ghost code injection (only needed until the new theme ships). */
function writeCodeInjection() {
  const css = fs.readFileSync(path.join(ROOT, 'ghost/quiz.css'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'ghost/quiz.js'), 'utf8');
  fs.writeFileSync(path.join(ROOT, 'dist/code-injection.html'), `<!-- Site header -->\n<style>\n${css}</style>\n\n<!-- Site footer -->\n<script>\n${js}</script>\n`);
}

function preview(meta, body) {
  const css = fs.readFileSync(path.join(ROOT, 'ghost/quiz.css'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'ghost/quiz.js'), 'utf8');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(meta.title)}</title><style>
body{margin:0;background:#fff;color:#1E2740;font:19px/1.65 Georgia,serif}
main{max-width:720px;margin:0 auto;padding:40px 16px 80px}
.kicker{font:600 13px/1 system-ui,sans-serif;letter-spacing:.15em;text-transform:uppercase;color:#7A1F2B}
h1{font-size:2.4em;line-height:1.1;margin:.3em 0 .4em}h2{line-height:1.2;margin:1.6em 0 .4em}a{color:#7A1F2B}
${css}</style></head><body><main>
<div class="kicker">${esc(meta.tags[0])} · Lesson ${meta.number}</div><h1>${esc(meta.title)}</h1>
${body}
</main><script>${js}</script></body></html>`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const {dist} = buildPost(process.argv[2]);
  console.log(`post.html, post.json, preview.html -> ${dist}`);
}
