import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import YAML from 'yaml';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

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
  const segments = [
    {kind: 'intro', index: 0, name: 'intro', ...lesson.intro},
    ...lesson.points.map((p, i) => ({kind: 'point', index: i + 1, name: `point-${i + 1}`, ...p})),
    {kind: 'outro', index: 0, name: 'outro', ...lesson.outro},
  ];
  for (const s of segments) s.text = s.text.trim().replace(/\s+/g, ' ');
  return {lesson, course, segments, id: `${course.slug}/${path.basename(dir)}`};
}

export const words = (t) => t.split(/\s+/).filter(Boolean).length;

export function ffprobeDuration(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return parseFloat(String(out));
}

export function outDir(id) {
  const d = path.join(ROOT, 'dist', id);
  fs.mkdirSync(d, {recursive: true});
  return d;
}
