// Thumbnail for a kids lesson on kids.sdcason.com, in the look of her kids thumbnails there
// (video/KidsThumb.tsx). The drawing: lesson.yml `thumb: {pics: [...]}` (placed by hand in the
// studio), else lesson.yml or course.yml `thumb: {sprite: <name>, fit: frame | bleed, strip: true}` (strip: every frame of the drawing side by side, in order),
// else the lesson's first pixel animation. Run: node scripts/kids-thumb.mjs <course>/<lesson>
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {ROOT, lessonDir, loadLesson, outDir} from './lib.mjs';
import {loadSprite, publishSketch} from './sprites.mjs';

// "What is …", "Who was …": the opening words go small above the rest.
const LEAD = /^(what|who|why|how|when|where)\s+(is|was|are|were|does|do|did|is a|is the)\b/i;

// Her decorative shapes: thumb-shapes/*.png|svg, copied next to the lesson's other render files.
// corner-<tl|tr|bl|br>-… names mark pieces that sit flush in a corner.
function shapeFiles(id) {
  const src = path.join(ROOT, 'thumb-shapes');
  if (!fs.existsSync(src)) return [];
  const dest = path.join(ROOT, 'video', 'public', id, 'thumb-shapes');
  fs.mkdirSync(dest, {recursive: true});
  const out = [];
  for (const f of fs.readdirSync(src).sort()) {
    const ext = path.extname(f).toLowerCase();
    if (!['.png', '.svg'].includes(ext)) continue;
    const buf = fs.readFileSync(path.join(src, f));
    let w, h;
    if (ext === '.png') { w = buf.readUInt32BE(16); h = buf.readUInt32BE(20); }
    else {
      const t = buf.toString('utf8');
      const vb = /viewBox\s*=\s*["']\s*[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(t);
      if (vb) { w = +vb[1]; h = +vb[2]; } else { w = +(/\bwidth\s*=\s*["']([\d.]+)/.exec(t)?.[1] ?? 100); h = +(/\bheight\s*=\s*["']([\d.]+)/.exec(t)?.[1] ?? 100); }
    }
    fs.copyFileSync(path.join(src, f), path.join(dest, f));
    out.push({src: path.posix.join(id, 'thumb-shapes', f), w, h, corner: /^corner-(tl|tr|bl|br)-/.exec(f)?.[1]});
  }
  return out;
}

// How wide a placed drawing is for its height (what shows: a pixel drawing's colored part, a
// sketch's whole picture), so the studio's thumbnail maker can draw a box around it.
export function picAspect(art) {
  if (art.kind === 'sketch') return art.width / art.height;
  let x0 = art.width, y0 = art.height, x1 = -1, y1 = -1;
  for (const rows of art.frames) rows.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }));
  return x1 < 0 ? 1 : (x1 - x0 + 1) / (y1 - y0 + 1);
}

/**
 * The thumbnail's props. The drawings: `thumb.pics` in lesson.yml (placed in the studio's
 * thumbnail maker: [{sprite, x, y, size, frame, flip}], up to 3), else one drawing placed
 * automatically. `pics` here overrides lesson.yml (the studio's live preview).
 */
export function kidsThumbProps(arg, pics) {
  const {lesson, course, segments, id} = loadLesson(lessonDir(arg));
  const pub = (name) => publishSketch(loadSprite(name), path.join(ROOT, 'video', 'public', id), id);
  const name = lesson.thumb?.sprite ?? course.thumb?.sprite ?? segments.flatMap((s) => s.scenes).find((sc) => sc?.type === 'sprite')?.sprite;
  const placed = (pics ?? lesson.thumb?.pics ?? []).slice(0, 3).map((p) => ({art: pub(p.sprite), x: +p.x, y: +p.y, size: +p.size, frame: +p.frame || 0, flip: !!p.flip}));
  const art = !placed.length && name ? pub(name) : null;
  const m = LEAD.exec(lesson.title);
  const lead = m ? lesson.title.slice(0, m[0].length) : '';
  const title = (m ? lesson.title.slice(m[0].length) : lesson.title).trim();
  return {id, props: {lead, title, art, pics: placed, shapes: shapeFiles(id), fit: lesson.thumb?.fit ?? course.thumb?.fit ?? 'frame', strip: !!lesson.thumb?.strip}, auto: name ?? null};
}

export function renderKidsThumb(arg) {
  const {id, props: p} = kidsThumbProps(arg);
  const dist = outDir(id);
  const props = path.join(dist, 'kids-thumb-props.json');
  fs.writeFileSync(props, JSON.stringify(p));
  const png = path.join(dist, 'kids-thumb.png');
  execFileSync(path.join(ROOT, 'node_modules/.bin/remotion'), ['still', 'video/index.ts', 'KidsThumb', png, `--props=${props}`, '--log=error'], {cwd: ROOT, stdio: 'inherit'});
  return png;
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(renderKidsThumb(process.argv[2]));
