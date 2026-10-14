// Verifies that every quotation in a lesson appears word for word in one of
// its sources. Sources are fetched once and cached in the lesson's sources/
// folder. Run: npm run check -- <course>/<lesson>
//
// Each point's anchor quote must match the exact source it names. Anything
// else in "double quotes" of 4+ words (in explanations, intro, outro, quiz)
// must match some primary source. Shorter quoted bits ("see", "father") are
// glosses, not quotations, and are skipped.
// Sources marked `reference: true` (e.g. Wikipedia) are cited for background
// but never count as verifying a quotation.
import fs from 'node:fs';
import path from 'node:path';
import {lessonDir, loadLesson} from './lib.mjs';

const MIN_WORDS = 4;

const norm = (s) => s.normalize('NFKD').toLowerCase().replace(/[‘’]/g, "'")
  .replace(/[^a-z0-9']+/g, ' ').replace(/\s+/g, ' ').trim();

function textOf(html) {
  return html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, ' ').replace(/<sup[\s\S]*?<\/sup>/g, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&rsquo;|&#8217;/g, "'")
    .replace(/\s\*\s/g, ' '); // Bible footnote markers
}

async function fetchSource(src, cacheDir) {
  const file = path.join(cacheDir, `${src.id}.txt`);
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  let url = src.url;
  const wiki = url.match(/^https:\/\/en\.wikipedia\.org\/wiki\/(.+)$/);
  if (wiki) url = `https://en.wikipedia.org/api/rest_v1/page/html/${wiki[1]}`;
  const res = await fetch(url, {headers: {'User-Agent': 'sdcourses-quote-check/1.0'}});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ctype = res.headers.get('content-type') ?? '';
  const html = buf.toString(/8859-1|windows-1252/i.test(ctype) || /vatican\.va/.test(url) ? 'latin1' : 'utf8');
  const text = textOf(html);
  fs.mkdirSync(cacheDir, {recursive: true});
  fs.writeFileSync(file, text);
  return text;
}

function collectQuotes(segments) {
  const quotes = [];
  const add = (q, where, source) => {
    for (const part of q.split(/\s*(?:…|\.\.\.)\s*/)) {
      // Quotation marks inside a quotation (a source quoting another) aren't part of the words.
      const words = part.replace(/"/g, '').trim();
      if (words.split(/\s+/).filter(Boolean).length >= MIN_WORDS) quotes.push({quote: words, where, source});
    }
  };
  const inline = (text, where) => { for (const m of (text ?? '').matchAll(/"([^"]+)"/g)) add(m[1], where); };
  for (const s of segments) {
    const where = s.heading ?? s.name;
    if (s.kind === 'point') {
      add(s.quote.text, `${where} (anchor quote)`, s.quote.source);
      inline(s.explanation, where);
      for (const q of s.quiz) inline(q.why, `${where} (quiz)`);
    } else {
      inline(s.text, where);
    }
  }
  return quotes;
}

const dir = lessonDir(process.argv[2]);
const {lesson, segments} = loadLesson(dir);
const ids = new Set(lesson.sources.map((x) => x.id));
const cacheDir = path.join(dir, 'sources');
const texts = [];
for (const src of lesson.sources) {
  if (!src.id || src.reference) continue;
  try {
    texts.push({src, text: norm(await fetchSource(src, cacheDir))});
  } catch (e) {
    console.warn(`  ! could not fetch ${src.label} (${e.message}); quotes from it can't be checked`);
  }
}

let bad = 0;
for (const {quote, where, source} of collectQuotes(segments)) {
  if (source && !ids.has(source)) { bad++; console.log(`  ✗ ${where}: source "${source}" isn't in the sources list`); continue; }
  const pool = source ? texts.filter((t) => t.src.id === source) : texts;
  const hit = pool.find((t) => t.text.includes(norm(quote)));
  if (hit) console.log(`  ✓ "${quote}"  [${hit.src.label}]`);
  else { bad++; console.log(`  ✗ "${quote}"  (${where}): not found word for word in ${source ? `"${source}"` : 'any primary source'}`); }
}
console.log(bad ? `\n${bad} quotation(s) need fixing or a source.` : '\nAll quotations match their sources.');
process.exit(bad ? 1 : 0);
