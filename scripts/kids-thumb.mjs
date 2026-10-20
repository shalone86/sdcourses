// Thumbnail for a kids lesson on kids.sdcason.com, in the look of her kids thumbnails there
// (video/KidsThumb.tsx). The drawing: lesson.yml or course.yml `thumb: {sprite: <name>}`,
// else the lesson's first pixel animation. Run: node scripts/kids-thumb.mjs <course>/<lesson>
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {ROOT, lessonDir, loadLesson, outDir} from './lib.mjs';
import {loadSprite} from './sprites.mjs';

// "What is …", "Who was …": the opening words go small above the rest.
const LEAD = /^(what|who|why|how|when|where)\s+(is|was|are|were|does|do|did|is a|is the)\b/i;

export function renderKidsThumb(arg) {
  const {lesson, course, segments, id} = loadLesson(lessonDir(arg));
  const name = lesson.thumb?.sprite ?? course.thumb?.sprite ?? segments.flatMap((s) => s.scenes).find((sc) => sc?.type === 'sprite')?.sprite;
  const art = name ? loadSprite(name) : null;
  const m = LEAD.exec(lesson.title);
  const lead = m ? lesson.title.slice(0, m[0].length) : '';
  const title = (m ? lesson.title.slice(m[0].length) : lesson.title).trim();
  const dist = outDir(id);
  const props = path.join(dist, 'kids-thumb-props.json');
  fs.writeFileSync(props, JSON.stringify({lead, title, art}));
  const png = path.join(dist, 'kids-thumb.png');
  execFileSync(path.join(ROOT, 'node_modules/.bin/remotion'), ['still', 'video/index.ts', 'KidsThumb', png, `--props=${props}`, '--log=error'], {cwd: ROOT, stdio: 'inherit'});
  return png;
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(renderKidsThumb(process.argv[2]));
