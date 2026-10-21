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
const clean = (t) => String(t ?? '').trim().replace(/\s+/g, ' ');

/** Question types: choice (default), truefalse, blank. Fails loudly on mistakes. */
export function normalizeQuestion(q, where) {
  const type = q.type ?? 'choice';
  const base = {type, question: clean(q.question), why: clean(q.why)};
  if (!base.question || !base.why) throw new Error(`Quiz in "${where}" needs a question and a why`);
  if (type === 'choice') {
    if (!(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < (q.options?.length ?? 0))) throw new Error(`Quiz in "${where}": answer must be the index (from 0) of one of the options`);
    return {...base, options: q.options.map(clean), answer: q.answer};
  }
  if (type === 'truefalse') {
    if (typeof q.answer !== 'boolean') throw new Error(`Quiz in "${where}": a truefalse answer must be true or false`);
    return {...base, answer: q.answer};
  }
  if (type === 'blank') {
    if (!/_{2,}/.test(base.question) || !q.accept?.length) throw new Error(`Quiz in "${where}": a blank question needs ____ in it and an accept list`);
    return {...base, accept: q.accept.map((a) => clean(a))};
  }
  throw new Error(`Quiz in "${where}": unknown type "${type}" (use choice, truefalse or blank)`);
}

const htmlCard = (inner) => `<!--kg-card-begin: html-->\n${inner}\n<!--kg-card-end: html-->`;

export function buildPost(arg, {videoUrl = VIDEO_PLACEHOLDER, posterUrl = POSTER_PLACEHOLDER} = {}) {
  const dir = lessonDir(arg);
  const {lesson, course, segments, points, kids, pixelArt, id} = loadLesson(dir);
  const site = loadSite();
  const intro = segments[0];
  const outro = segments.find((s) => s.kind === 'outro') ?? {text: ''};

  const quiz = {questions: points.flatMap((p) => p.quiz.map((q) => normalizeQuestion(q, p.heading)))};
  // Readers without JavaScript (and search engines) still get the questions.
  const fallback = `<ol class="cc-quiz-fallback">${quiz.questions.map((q) => `<li>${esc(q.question)}</li>`).join('')}</ol>`;
  const json = JSON.stringify(quiz).replace(/</g, '\\u003c');

  const words = [
    intro.text && `<p>${smart(intro.text)}</p>`,
    ...points.map((p) => [
      p.heading && `<h2>${smart(p.heading)}</h2>`,
      p.quote.text && `<blockquote><p>${smart(p.quote.text)}</p><p>— ${smart(p.quote.cite)}</p></blockquote>`,
      p.explanation && `<p>${smart(p.explanation)}</p>`,
    ].filter(Boolean).join('\n')),
    outro.text && `<p>${smart(outro.text)}</p>`,
  ].filter(Boolean);
  const quizCard = htmlCard(`<section class="cc-quiz" data-lesson="${esc(lesson.slug)}"><h2>Check your understanding</h2><p class="cc-quiz-intro">Your answers stay on your device.</p>${fallback}<script type="application/json">${json}</script></section>`);
  const html = [
    htmlCard(`<figure class="cc-video"><video controls playsinline preload="none" poster="${posterUrl}" src="${videoUrl}"></video></figure>`),
    // Kids: just the video and the quiz; the words of the video stay on the page in a closed
    // toggle (for grown-ups and search engines).
    ...(kids ? [quiz.questions.length && quizCard, htmlCard(`<details class="cc-words"><summary>Read the words of the video</summary>\n${words.join('\n')}\n</details>`)]
      : [...words, quiz.questions.length && quizCard]),
    imageCredits(dir, lesson),
    `<h3>Sources</h3>\n<ul>${lesson.sources.map((s) => `<li>${s.url ? `<a href="${esc(s.url)}">${esc(s.label)}</a>` : esc(s.label)}</li>`).join('')}</ul>`,
    pixelArt && `<p class="cc-credit"><em>Every pixel drawing in this video is drawn by hand by ${esc(site.author || 'the host')}.</em></p>`,
    `<p class="cc-credit"><em>${esc(site.disclosure)}</em></p>`,
  ].filter(Boolean).join('\n\n');

  const meta = {
    title: lesson.title,
    slug: lesson.slug,
    custom_excerpt: lesson.excerpt.trim(),
    // Course tag first (it's the post's primary tag: course page, prev/next).
    // The first lesson also carries #book and the course's categories, which
    // is how the theme lists a course on the home page and category pages.
    tags: [course.title, '#lesson', ...(lesson.number === 1 ? ['#book', ...(course.categories ?? ['All Courses'])] : [])],
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

/**
 * The same lesson for kids.sdcason.com, written the way that site's theme reads quizzes
 * (its assets/js/quiz.js turns them into tap-to-answer cards with a score): a "Quiz: …"
 * heading, each question a paragraph, choices a bulleted list with the right one in bold,
 * "Answer: a / b" for a blank (____), "Why: …", and a divider to end it. Then the words of
 * the video in a toggle card.
 * tags: the top-level tag (Catholic Kids Video Lessons, or Byzantine Catholic Lessons for a
 * Byzantine course) and the course's series tag (course.yml `series`, else its title).
 */
export function buildKidsSitePost(arg, {videoUrl = VIDEO_PLACEHOLDER, posterUrl = POSTER_PLACEHOLDER} = {}) {
  const dir = lessonDir(arg);
  const {lesson, course, segments, points, pixelArt, id} = loadLesson(dir);
  const site = loadSite();
  const intro = segments[0];
  const outro = segments.find((s) => s.kind === 'outro') ?? {text: ''};
  const span = (t) => `<span style="white-space: pre-wrap;">${smart(t)}</span>`;
  const toggle = (heading, content) => `<div class="kg-card kg-toggle-card" data-kg-toggle-state="close"><div class="kg-toggle-heading"><h4 class="kg-toggle-heading-text">${span(heading)}</h4><button class="kg-toggle-card-icon" aria-label="Expand toggle to read content"></button></div><div class="kg-toggle-content">${content}</div></div>`;
  const list = (items, right) => `<ul>${items.map((t, i) => `<li>${i === right ? `<strong>${span(t)}</strong>` : span(t)}</li>`).join('')}</ul>`;
  const question = (q) => [
    `<p>${span(q.question.replace(/_{2,}/g, '____'))}</p>`,
    q.type === 'truefalse' ? list(['True', 'False'], q.answer ? 0 : 1)
      : q.type === 'blank' ? `<p>${span('Answer: ' + q.accept.join(' / '))}</p>`
      : list(q.options, q.answer),
    q.why && `<p>${span('Why: ' + q.why)}</p>`,
  ].filter(Boolean).join('');
  const questions = points.flatMap((p) => p.quiz.map((q) => normalizeQuestion(q, p.heading)));
  const words = [
    intro.text && `<p>${span(intro.text)}</p>`,
    ...points.map((p) => [p.heading && `<p><strong>${span(p.heading)}</strong></p>`, p.quote.lead && `<p>${span(p.quote.lead)}</p>`,
      p.quote.text && `<p><em>${span(`“${p.quote.text}” (${p.quote.cite})`)}</em></p>`, p.explanation && `<p>${span(p.explanation)}</p>`].filter(Boolean).join('')),
    outro.text && `<p>${span(outro.text)}</p>`,
  ].filter(Boolean).join('');
  const html = [
    `<figure class="kg-card kg-video-card kg-width-regular" data-kg-thumbnail="${posterUrl}" data-kg-custom-thumbnail="${posterUrl}"><div class="kg-video-container"><video src="${videoUrl}" poster="${posterUrl}" width="1920" height="1080" playsinline preload="metadata"></video></div></figure>`,
    questions.length && [`<h2>${span('Quiz: ' + lesson.title)}</h2>`, ...questions.map(question), '<hr>'].join('\n'),
    toggle('Read the words of the video', words),
    imageCredits(dir, lesson),
    `<h3>Sources</h3>\n<ul>${lesson.sources.map((s) => `<li>${s.url ? `<a href="${esc(s.url)}">${esc(s.label)}</a>` : esc(s.label)}</li>`).join('')}</ul>`,
    pixelArt && `<p><em>Every pixel drawing in this video is drawn by hand by ${esc(site.author || 'the host')}.</em></p>`,
    `<p><em>${esc(site.disclosure)}</em></p>`,
  ].filter(Boolean).join('\n');
  const tags = course.kids_tags ?? [course.tradition === 'byzantine' ? 'Byzantine Catholic Lessons' : 'Catholic Kids Video Lessons', course.series ?? course.title];
  const meta = {title: lesson.title, slug: lesson.slug, custom_excerpt: lesson.excerpt.trim(), tags};
  fs.writeFileSync(path.join(outDir(id), 'kids-site-post.html'), html);
  return {html, meta};
}

/** "Image credits" for pictures used in the video (CC BY and similar licenses require it). */
function imageCredits(dir, lesson) {
  const f = path.join(dir, 'images', 'credits.json');
  if (!fs.existsSync(f)) return '';
  const credits = JSON.parse(fs.readFileSync(f, 'utf8'));
  const used = new Set();
  for (const sec of [lesson.intro, ...(lesson.points ?? []).map((p) => ({scenes: p.visuals})), lesson.outro]) for (const sc of sec?.scenes ?? []) if (sc.type === 'image') used.add(sc.src);
  const items = [...used].map((src) => credits[src]).filter(Boolean);
  if (!items.length) return '';
  const li = (c) => `<li>${c.page ? `<a href="${esc(c.page)}">${esc(c.title || 'Image')}</a>` : esc(c.title || 'Image')}${c.creator ? `, ${esc(c.creator)}` : ''} (${esc(c.source)}${c.license ? `, ${c.license_url ? `<a href="${esc(c.license_url)}">${esc(c.license)}</a>` : esc(c.license)}` : ''})</li>`;
  return `<h3>Image credits</h3>\n<ul>${items.map(li).join('')}</ul>`;
}

/** Ready-to-paste Ghost code injection (only needed until the new theme ships). */
function writeCodeInjection() {
  const css = fs.readFileSync(path.join(ROOT, 'ghost/quiz.css'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'ghost/confetti.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'ghost/quiz.js'), 'utf8');
  fs.writeFileSync(path.join(ROOT, 'dist/code-injection.html'), `<!-- Site header -->\n<style>\n${css}</style>\n\n<!-- Site footer -->\n<script>\n${js}</script>\n`);
}

function preview(meta, body) {
  const css = fs.readFileSync(path.join(ROOT, 'ghost/quiz.css'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'ghost/confetti.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'ghost/quiz.js'), 'utf8');
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
