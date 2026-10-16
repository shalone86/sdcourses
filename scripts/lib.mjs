import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import YAML from 'yaml';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// Local secrets (Ghost key) live in .env at the repo root on the Mac; the
// cloud sets them in the environment instead. Real environment values win.
if (fs.existsSync(path.join(ROOT, '.env'))) process.loadEnvFile(path.join(ROOT, '.env'));

/** Resolve "what-is-the-pope/01-what-is-the-pope" (or a path to it) to a lesson dir. */
export function lessonDir(arg) {
  if (!arg) throw new Error('Usage: npm run <script> -- <course>/<lesson-folder>   e.g. what-is-the-pope/01-what-is-the-pope');
  const candidates = [path.resolve(arg), path.join(ROOT, 'courses', arg)];
  const dir = candidates.find((d) => fs.existsSync(path.join(d, 'lesson.yml')));
  if (!dir) throw new Error(`No lesson.yml found for "${arg}"`);
  return dir;
}

export function loadLesson(dir) {
  const lesson = YAML.parse(fs.readFileSync(path.join(dir, 'lesson.yml'), 'utf8'));
  const course = YAML.parse(fs.readFileSync(path.join(dir, '..', 'course.yml'), 'utf8'));
  const clean = (t) => (t ?? '').trim().replace(/\s+/g, ' ');
  const points = lesson.points.map((p, i) => {
    const q = p.quote;
    if (!q?.text || !q.source || !q.cite) throw new Error(`Point ${i + 1} ("${p.heading}") needs quote.text, quote.source and quote.cite`);
    const quote = {...q, text: clean(q.text), lead: clean(q.lead)};
    const anchor = q.scene === 'keys'
      ? {type: 'keys', quote: quote.text, cite: quote.cite}
      : {type: 'quote', text: quote.text, cite: quote.cite, highlight: quote.highlight};
    const explanation = clean(p.text);
    return {
      kind: 'point', index: i + 1, name: `point-${i + 1}`, heading: p.heading,
      quote, explanation,
      // Narration: lead-in, the quotation itself, then the explanation.
      text: [quote.lead, quote.text, explanation].filter(Boolean).join(' '),
      scenes: [anchor, ...(p.visuals ?? [])],
      quiz: [].concat(p.quiz ?? []),
    };
  });
  const segments = [
    {kind: 'intro', index: 0, name: 'intro', ...lesson.intro, text: clean(lesson.intro?.text)},
    ...points,
    {kind: 'outro', index: 0, name: 'outro', ...lesson.outro, text: clean(lesson.outro?.text)},
  ];
  return {lesson, course, segments, points, id: `${course.slug}/${path.basename(dir)}`};
}

export const words = (t) => (t ?? '').split(/\s+/).filter(Boolean).length;

export function ffprobeDuration(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return parseFloat(String(out));
}

export function outDir(id) {
  const d = path.join(ROOT, 'dist', id);
  fs.mkdirSync(d, {recursive: true});
  return d;
}

/** Site-wide settings (author, AI disclosure) with {author} filled in. */
export function loadSite() {
  const site = YAML.parse(fs.readFileSync(path.join(ROOT, 'site.yml'), 'utf8')) ?? {};
  const author = (site.author ?? '').trim();
  const fill = (t) => (t ?? '').trim().replace(/\s+/g, ' ')
    .replace(/\{author\}/g, author || 'the author')
    // Without a name, drop the "Narrated by …" part of short credits.
    .replace(/^Narrated by the author · /, '');
  return {author, hostPhoto: site.host_photo ?? '', whisperModel: site.whisper_model ?? '', disclosure: fill(site.disclosure), videoCredit: fill(site.video_credit), music: site.music ?? {}};
}

/** Straight quotes/apostrophes to typographic ones, for display text. */
export const smartQuotes = (t) => String(t)
  .replace(/(^|[\s(\[—-])"/g, '$1\u201c').replace(/"/g, '\u201d')
  .replace(/(\w)'(\w)/g, '$1\u2019$2').replace(/(^|\s)'/g, '$1\u2018').replace(/'/g, '\u2019');

/** Apply smartQuotes to every string inside a scene definition. */
export const smartScene = (v) => typeof v === 'string' ? smartQuotes(v)
  : Array.isArray(v) ? v.map(smartScene)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'type' ? x : smartScene(x)]))
  : v;
