// Her pixel animations (the studio's Pixel art tab), shared by every lesson:
//   sprites/<name>.json  {name, width, height, fps, palette: ['#rrggbb', …], frames: [[row, …], …]}
// Each row is a string, one character per pixel: '.' is see-through, otherwise
// the position in the palette (0–9, then a–z). 1 to 8 frames.
// Sketches (free drawing, kind: 'sketch') keep each frame as a picture instead:
//   sprites/<name>.json {name, kind: 'sketch', width, height, fps, frames: ['<name>/1.png', …]}
//   sprites/<name>/1.png …
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './lib.mjs';

export const SPRITES = path.join(ROOT, 'sprites');
const CODES = '0123456789abcdefghijklmnopqrstuvwxyz';
export const spriteSlug = (name) => String(name ?? '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

const FAVORITES = path.join(SPRITES, '.favorites.json');
const readFavorites = () => { try { return new Set(JSON.parse(fs.readFileSync(FAVORITES, 'utf8'))); } catch { return new Set(); } };

/** Star (or unstar) a drawing. Kept in one small file so the drawings themselves stay as they are. */
export function setFavorite(slug, on) {
  const s = spriteSlug(slug);
  if (!s || !fs.existsSync(path.join(SPRITES, `${s}.json`))) throw new Error('That drawing isn\'t saved');
  const fav = readFavorites();
  if (on) fav.add(s); else fav.delete(s);
  fs.writeFileSync(FAVORITES, JSON.stringify([...fav].sort()) + '\n');
}

export function listSprites() {
  if (!fs.existsSync(SPRITES)) return [];
  const fav = readFavorites();
  return fs.readdirSync(SPRITES).filter((f) => f.endsWith('.json') && !f.startsWith('.')).sort()
    .map((f) => { try { return {slug: f.slice(0, -5), favorite: fav.has(f.slice(0, -5)), at: Math.round(fs.statSync(path.join(SPRITES, f)).mtimeMs), ...JSON.parse(fs.readFileSync(path.join(SPRITES, f), 'utf8'))}; } catch { return null; } })
    .filter(Boolean)
    // A sketch's frames as addresses the studio serves (with a version, so a re-save shows).
    .map((s) => s.kind === 'sketch' ? {...s, urls: s.frames.map((fr) => `/sprites/${fr}?v=${Math.round(fs.statSync(path.join(SPRITES, fr)).mtimeMs)}`)} : s);
}

/** A sketch's frame pictures copied next to a lesson's video files; returns the drawing with their paths there. */
export function publishSketch(art, publicDir, id) {
  if (art?.kind !== 'sketch') return art;
  const frames = art.frames.map((fr) => {
    const dest = path.join(publicDir, 'sprites', fr);
    fs.mkdirSync(path.dirname(dest), {recursive: true});
    fs.copyFileSync(path.join(SPRITES, fr), dest);
    return path.posix.join(id, 'sprites', fr);
  });
  return {...art, frames};
}

export function loadSprite(slug) {
  const f = path.join(SPRITES, `${spriteSlug(slug)}.json`);
  if (!fs.existsSync(f)) throw new Error(`No pixel animation "${slug}" in sprites/ (make it in the studio's Pixel art tab)`);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

/** Lessons that show this animation (a `sprite: <slug>` scene in lesson.yml). */
export function spriteUsedBy(slug) {
  const courses = path.join(ROOT, 'courses');
  const out = [];
  for (const c of fs.readdirSync(courses, {withFileTypes: true})) {
    if (!c.isDirectory()) continue;
    for (const l of fs.readdirSync(path.join(courses, c.name), {withFileTypes: true})) {
      const f = path.join(courses, c.name, l.name, 'lesson.yml');
      if (l.isDirectory() && fs.existsSync(f) && new RegExp(`^\\s*sprite:\\s*["']?${slug}["']?\\s*$`, 'm').test(fs.readFileSync(f, 'utf8'))) out.push(`${c.name}/${l.name}`);
    }
  }
  return out;
}

/** Delete one: it moves to sprites/.deleted/ (kept on this Mac), unless a lesson still uses it. */
export function deleteSprite(slug) {
  const s = spriteSlug(slug);
  const f = path.join(SPRITES, `${s}.json`);
  if (!s || !fs.existsSync(f)) throw new Error('That drawing isn\'t saved');
  const used = spriteUsedBy(s);
  if (used.length) throw new Error(`It's still in ${used.join(', ')}. Remove it there first (Timing tab, ×).`);
  const bin = path.join(SPRITES, '.deleted');
  fs.mkdirSync(bin, {recursive: true});
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.renameSync(f, path.join(bin, `${s}-${stamp}.json`));
  if (fs.existsSync(path.join(SPRITES, s))) fs.renameSync(path.join(SPRITES, s), path.join(bin, `${s}-${stamp}`));
}

/** A sketch: each frame arrives as a PNG data address and is saved as sprites/<slug>/<n>.png. */
function saveSketch(slug, s) {
  const {width: w, height: h} = s;
  if (![w, h].every((n) => Number.isInteger(n) && n >= 64 && n <= 1920)) throw new Error('Bad sketch size');
  if (!Array.isArray(s.frames) || s.frames.length < 1 || s.frames.length > 8) throw new Error('1 to 8 frames');
  const pngs = s.frames.map((d) => {
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(d ?? '');
    const buf = m && Buffer.from(m[1], 'base64');
    if (!buf || buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('A frame isn\'t a picture');
    return buf;
  });
  const dir = path.join(SPRITES, slug);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  const frames = pngs.map((buf, i) => { fs.writeFileSync(path.join(dir, `${i + 1}.png`), buf); return `${slug}/${i + 1}.png`; });
  const fps = Math.max(1, Math.min(12, Math.round(Number(s.fps) || 4)));
  fs.writeFileSync(path.join(SPRITES, `${slug}.json`), JSON.stringify({name: String(s.name).trim().slice(0, 60), kind: 'sketch', width: w, height: h, fps, frames}, null, 1) + '\n');
  return slug;
}

/** Check and save one animation; returns its slug. */
export function saveSprite(s) {
  const slug = spriteSlug(s?.name);
  if (!slug) throw new Error('Give it a name');
  const {width: w, height: h} = s;
  if (s.kind === 'sketch') return saveSketch(slug, s);
  if (![w, h].every((n) => Number.isInteger(n) && n >= 8 && n <= 64)) throw new Error('Size must be 8 to 64 pixels');
  const palette = (s.palette ?? []).slice(0, CODES.length);
  if (!palette.every((c) => /^#[0-9a-f]{6}$/i.test(c))) throw new Error('Bad color in the palette');
  const allowed = new RegExp(`^[.${CODES.slice(0, palette.length)}]{${w}}$`);
  if (!Array.isArray(s.frames) || s.frames.length < 1 || s.frames.length > 8) throw new Error('1 to 8 frames');
  for (const fr of s.frames) if (!Array.isArray(fr) || fr.length !== h || !fr.every((row) => allowed.test(row))) throw new Error('A frame doesn\'t match the size');
  const fps = Math.max(1, Math.min(12, Math.round(Number(s.fps) || 4)));
  fs.mkdirSync(SPRITES, {recursive: true});
  const out = {name: String(s.name).trim().slice(0, 60), width: w, height: h, fps, palette, frames: s.frames};
  fs.writeFileSync(path.join(SPRITES, `${slug}.json`), JSON.stringify(out, null, 1) + '\n');
  return slug;
}
