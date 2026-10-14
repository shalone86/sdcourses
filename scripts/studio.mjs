// Round trip between lesson.yml and the Lesson Studio page's database.
//   npm run studio-export -- <course>/<lesson>        → dist/<id>/studio.json (Claude writes it to the studio)
//   npm run studio-import -- <course>/<lesson> <edits.json>  ← Shalone's saved edits, applied to lesson.yml
// edits.json is the list of documents from lessons/<key>/edits: [{section, text, lead?}, ...]
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {lessonDir, loadLesson, outDir} from './lib.mjs';

/** The studio's id for a lesson: "<course>~<NN>" (db path segments can't contain "/"). */
export const studioKey = (dir, course) => `${course.slug}~${path.basename(dir).slice(0, 2)}`;

function exportLesson(arg) {
  const dir = lessonDir(arg);
  const {lesson, course, segments, id} = loadLesson(dir);
  const doc = {
    course: course.slug, courseTitle: course.title, number: lesson.number, title: lesson.title,
    status: lesson.status, updatedAt: new Date().toISOString(),
    sections: segments.map((s) => s.kind === 'point'
      ? {key: s.name, kind: s.kind, index: s.index, heading: s.heading, lead: s.quote.lead, quote: s.quote.text, cite: s.quote.cite, text: s.explanation}
      : {key: s.name, kind: s.kind, index: 0, text: s.text, notes: s.notes ?? []}),
  };
  const file = path.join(outDir(id), 'studio.json');
  fs.writeFileSync(file, JSON.stringify({key: studioKey(dir, course), doc}, null, 2));
  console.log(`${file}\nstudio key: ${studioKey(dir, course)}`);
}

/** Wrap text as a YAML folded block (">-") at the given indent. */
function foldedBlock(text, indent, width = 78) {
  const pad = ' '.repeat(indent);
  const lines = [];
  let line = '';
  for (const w of text.split(' ')) {
    if (line && pad.length + line.length + 1 + w.length > width) { lines.push(pad + line); line = w; }
    else line = line ? `${line} ${w}` : w;
  }
  if (line) lines.push(pad + line);
  return `>-\n${lines.join('\n')}`;
}

// Edits are spliced into the original text at each value's exact position,
// so comments, layout and every untouched line stay byte-for-byte the same.
// Returns the labels of what changed. Used by the import command and the local studio.
export function applyEdits(dir, edits) {
  const file = path.join(dir, 'lesson.yml');
  let src = fs.readFileSync(file, 'utf8');
  const clean = (t) => String(t ?? '').trim().replace(/\s+/g, ' ');
  const changes = [];
  const apply = (keyPath, value, label) => {
    const doc = YAML.parseDocument(src);
    const node = doc.getIn(keyPath, true);
    if (!node || !node.range) throw new Error(`${keyPath.join('.')} isn't in ${file}; add it there first`);
    if (clean(node.value) === clean(value)) return;
    // Indent: the key's line indentation + 2.
    const lineStart = src.lastIndexOf('\n', node.range[0]) + 1;
    const keyIndent = src.slice(lineStart).match(/^ */)[0].length;
    const body = clean(value);
    // A short value that was on one line stays on one line, if YAML reads it back the same.
    const keyLen = src.slice(lineStart, node.range[0]).length;
    const readsBack = (t) => { try { return YAML.parse(`k: ${t}`)?.k === t; } catch { return false; } };
    const plain = node.type === 'PLAIN' && keyLen + body.length <= 78 && readsBack(body);
    const rendered = !body ? '""' : plain ? body : foldedBlock(body, keyIndent + 2);
    // A block scalar's range includes its final line break; keep one.
    const old = src.slice(node.range[0], node.range[1]);
    src = src.slice(0, node.range[0]) + rendered + (old.endsWith('\n') ? '\n' : '') + src.slice(node.range[1]);
    changes.push(label);
  };
  for (const e of [].concat(edits)) {
    const m = /^point-(\d+)$/.exec(e.section);
    if (e.section === 'intro' || e.section === 'outro') apply([e.section, 'text'], e.text, e.section);
    else if (m) {
      const i = Number(m[1]) - 1;
      if ('text' in e) apply(['points', i, 'text'], e.text, `point ${i + 1} explanation`);
      if ('lead' in e) apply(['points', i, 'quote', 'lead'], e.lead, `point ${i + 1} lead-in`);
    } else throw new Error(`Unknown section "${e.section}"`);
  }
  YAML.parse(src); // must still be valid
  if (changes.length) fs.writeFileSync(file, src);
  return changes;
}

/** Set `status:` in lesson.yml, keeping its comment and every other line. */
export function setStatus(dir, status) {
  const file = path.join(dir, 'lesson.yml');
  const src = fs.readFileSync(file, 'utf8');
  const node = YAML.parseDocument(src).get('status', true);
  if (!node?.range) throw new Error(`No status: line in ${file}`);
  if (node.value === status) return false;
  fs.writeFileSync(file, src.slice(0, node.range[0]) + status + src.slice(node.range[1]));
  return true;
}

function importEdits(arg, editsFile) {
  const changes = applyEdits(lessonDir(arg), JSON.parse(fs.readFileSync(editsFile, 'utf8')));
  console.log(changes.length ? `Applied: ${changes.join(', ')}` : 'No changes: the studio matches lesson.yml.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, arg, extra] = process.argv.slice(2);
  if (cmd === 'export') exportLesson(arg);
  else if (cmd === 'import') importEdits(arg, extra);
  else throw new Error('Usage: node scripts/studio.mjs export|import <course>/<lesson> [edits.json]');
}
