// Adding and removing slides from the studio, and starting a new lesson.
// lesson.yml is edited as text (only the slide's own lines change), and the
// slide's recordings, camera clips and hand timing move with it when the
// slides after it are renumbered. A removed slide's recordings go to
// audio/removed/ (kept on this Mac) rather than being thrown away.
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {ROOT} from './lib.mjs';

export const slugify = (t) => String(t).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);

// A slide she writes in the studio: every box there, empty.
const BLANK_POINT = {heading: '', quote: {lead: '', text: '', cite: '', link: ''}, text: '', visuals: [], quiz: []};
const lineStart = (src, i) => src.lastIndexOf('\n', i - 1) + 1;
const lineAfter = (src, i) => { const n = src.indexOf('\n', Math.max(0, i - 1)); return n < 0 ? src.length : n + 1; };
const indented = (obj, col) => YAML.stringify([obj], {lineWidth: 0}).trimEnd().split('\n').map((l) => ' '.repeat(col) + l).join('\n') + '\n';

/** Rename a section's files (recordings, transcripts, camera clips) and its hand timing. moves: [[from, to], …] */
function moveSections(dir, moves) {
  const tmp = `.moving-${Date.now()}`;
  const files = [];
  for (const sub of ['audio', 'camera']) {
    const d = path.join(dir, sub);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      for (const [from, to] of moves) {
        if (f === from || f.startsWith(from + '.')) files.push({d, f, to: to + f.slice(from.length)});
      }
    }
  }
  // Two steps, so point-2 → point-3 never overwrites the old point-3 before it has moved.
  for (const x of files) fs.renameSync(path.join(x.d, x.f), path.join(x.d, tmp + x.f));
  for (const x of files) {
    if (x.to.startsWith('removed/')) { fs.mkdirSync(path.join(x.d, 'removed'), {recursive: true}); }
    fs.renameSync(path.join(x.d, tmp + x.f), path.join(x.d, x.to));
  }
  const tf = path.join(dir, 'timing.yml');
  if (fs.existsSync(tf)) {
    const t = YAML.parse(fs.readFileSync(tf, 'utf8')) ?? {};
    const out = {...t};
    for (const [from] of moves) delete out[from];
    for (const [from, to] of moves) if (t[from] && !to.startsWith('removed/')) out[to] = t[from];
    fs.writeFileSync(tf, '# Hand-tuned timing from the studio\'s Timing tab, in seconds into each\n# section\'s recording. Scenes not listed keep their automatic timing.\n' + YAML.stringify(out));
  }
}

/** Add a blank slide after `after` (intro, point-N, or the end). Returns the new slide's name. */
export function addSlide(dir, after) {
  const file = path.join(dir, 'lesson.yml');
  let src = fs.readFileSync(file, 'utf8');
  const doc = YAML.parseDocument(src);
  const seq = doc.get('points', true);
  const n = seq?.items?.length ?? 0;
  const m = /^point-(\d+)$/.exec(after ?? '');
  const at = after === 'intro' ? 0 : m ? Math.min(n, Number(m[1])) : n; // index of the new point
  if (!seq || seq.flow || !n) {
    // No slides yet ("points: []" or none at all): write the list under its key.
    const block = 'points:\n' + indented(BLANK_POINT, 2);
    if (seq) {
      const keyLine = lineStart(src, doc.contents.items.find((p) => p.key.value === 'points').key.range[0]);
      src = src.slice(0, keyLine) + block + src.slice(lineAfter(src, seq.range[1]));
    } else {
      const outro = doc.contents.items.find((p) => p.key.value === 'outro');
      const pos = outro ? lineStart(src, outro.key.range[0]) : src.length;
      src = src.slice(0, pos) + (pos === src.length && !src.endsWith('\n') ? '\n' : '') + '\n' + block + '\n' + src.slice(pos);
    }
  } else {
    const ref = seq.items[Math.min(at, n - 1)];
    const col = src.slice(lineStart(src, ref.range[0]), ref.range[0]).length - 2; // the "- " column
    const pos = at < n ? lineStart(src, ref.range[0]) : lineAfter(src, seq.items[n - 1].range[1]);
    src = src.slice(0, pos) + indented(BLANK_POINT, col) + src.slice(pos);
  }
  YAML.parse(src);
  // Slides after it move up one: their recordings and timing go with them.
  moveSections(dir, Array.from({length: n - at}, (_, k) => n - k).map((i) => [`point-${i}`, `point-${i + 1}`]));
  fs.writeFileSync(file, src);
  return `point-${at + 1}`;
}

/** Add the closing slide (the outro, with the lesson summary). */
export function addClosing(dir) {
  const file = path.join(dir, 'lesson.yml');
  const src = fs.readFileSync(file, 'utf8');
  if (YAML.parse(src).outro) throw new Error('There is already a closing slide');
  fs.writeFileSync(file, src.replace(/\n*$/, '\n\n') + 'outro:\n  text: ""\n  scenes:\n    - type: recap\n');
  return 'outro';
}

/** Remove a slide (a point, or the closing slide). Its recordings move to audio/removed/. */
export function removeSlide(dir, section) {
  const file = path.join(dir, 'lesson.yml');
  let src = fs.readFileSync(file, 'utf8');
  const doc = YAML.parseDocument(src);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (section === 'outro') {
    const pair = doc.contents.items.find((p) => p.key.value === 'outro');
    if (!pair) throw new Error('No closing slide');
    src = src.slice(0, lineStart(src, pair.key.range[0])).replace(/\n+$/, '\n') + src.slice(lineAfter(src, pair.value.range[1]));
    YAML.parse(src);
    moveSections(dir, [['outro', `removed/outro-${stamp}`]]);
    fs.writeFileSync(file, src);
    return;
  }
  const m = /^point-(\d+)$/.exec(section ?? '');
  const seq = doc.get('points', true);
  if (!m || !seq?.items?.[Number(m[1]) - 1]) throw new Error('No such slide');
  const i = Number(m[1]) - 1, n = seq.items.length;
  if (n === 1) {
    const key = doc.contents.items.find((p) => p.key.value === 'points');
    src = src.slice(0, lineStart(src, key.key.range[0])) + 'points: []\n' + src.slice(lineAfter(src, seq.range[1]));
  } else {
    const item = seq.items[i];
    const from = lineStart(src, item.range[0]);
    const to = seq.items[i + 1] ? lineStart(src, seq.items[i + 1].range[0]) : lineAfter(src, item.range[1]);
    src = src.slice(0, from) + src.slice(to);
  }
  YAML.parse(src);
  moveSections(dir, [[section, `removed/${section}-${stamp}`],
    ...Array.from({length: n - i - 1}, (_, k) => i + 2 + k).map((j) => [`point-${j}`, `point-${j - 1}`])]);
  fs.writeFileSync(file, src);
}

/**
 * A new lesson with one blank slide (the intro, with the usual opening pictures).
 * course: {slug} of a course here, or {slug, title, style?} to start one (a course on
 * Ghost, or a brand-new one). `after`: lessons already published for it (so numbering continues).
 */
export function newLesson({course, title, published = 0}) {
  if (!title?.trim()) throw new Error('Give the lesson a title');
  const slug = slugify(course.slug || course.title);
  if (!slug) throw new Error('Give the course a title');
  const cdir = path.join(ROOT, 'courses', slug);
  if (!fs.existsSync(path.join(cdir, 'course.yml'))) {
    if (!course.title?.trim()) throw new Error('Give the course a title');
    fs.mkdirSync(cdir, {recursive: true});
    fs.writeFileSync(path.join(cdir, 'course.yml'), YAML.stringify({slug, title: course.title.trim(), summary: '',
      ...(course.style === 'kids' ? {style: 'kids'} : {}), planned: [title.trim()]}));
  }
  const here = fs.readdirSync(cdir).filter((d) => /^\d\d-/.test(d)).length;
  const number = Math.max(here, published) + 1;
  const lslug = slugify(title);
  const dir = path.join(cdir, `${String(number).padStart(2, '0')}-${lslug}`);
  if (fs.existsSync(dir)) throw new Error('That lesson already exists');
  fs.mkdirSync(path.join(dir, 'audio'), {recursive: true});
  fs.writeFileSync(path.join(dir, 'lesson.yml'), `# Started in the Lesson Studio.
status: draft
course: ${slug}
number: ${number}
slug: ${lslug}
title: ${JSON.stringify(title.trim())}
excerpt: ""

sources: []

intro:
  text: ""
  scenes:
    - type: title
    - type: host         # your name, when you say "I'm your host"
      at: I'm your host
    - type: trinity      # triangle (Father), cross (Son), dove (Holy Spirit)
      at: in the name of the Father
      cues: {son: the Son, spirit: the Holy Spirit}

points: []
`);
  return `${slug}/${path.basename(dir)}`;
}
