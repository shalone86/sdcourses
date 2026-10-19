// Her pixel animations (the studio's Pixel art tab), shared by every lesson:
//   sprites/<name>.json  {name, width, height, fps, palette: ['#rrggbb', …], frames: [[row, …], …]}
// Each row is a string, one character per pixel: '.' is see-through, otherwise
// the position in the palette (0–9, then a–z). 1 to 4 frames.
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './lib.mjs';

export const SPRITES = path.join(ROOT, 'sprites');
const CODES = '0123456789abcdefghijklmnopqrstuvwxyz';
export const spriteSlug = (name) => String(name ?? '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

export function listSprites() {
  if (!fs.existsSync(SPRITES)) return [];
  return fs.readdirSync(SPRITES).filter((f) => f.endsWith('.json')).sort()
    .map((f) => { try { return {slug: f.slice(0, -5), ...JSON.parse(fs.readFileSync(path.join(SPRITES, f), 'utf8'))}; } catch { return null; } })
    .filter(Boolean);
}

export function loadSprite(slug) {
  const f = path.join(SPRITES, `${spriteSlug(slug)}.json`);
  if (!fs.existsSync(f)) throw new Error(`No pixel animation "${slug}" in sprites/ (make it in the studio's Pixel art tab)`);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

/** Check and save one animation; returns its slug. */
export function saveSprite(s) {
  const slug = spriteSlug(s?.name);
  if (!slug) throw new Error('Give it a name');
  const {width: w, height: h} = s;
  if (![w, h].every((n) => Number.isInteger(n) && n >= 8 && n <= 64)) throw new Error('Size must be 8 to 64 pixels');
  const palette = (s.palette ?? []).slice(0, CODES.length);
  if (!palette.every((c) => /^#[0-9a-f]{6}$/i.test(c))) throw new Error('Bad color in the palette');
  const allowed = new RegExp(`^[.${CODES.slice(0, palette.length)}]{${w}}$`);
  if (!Array.isArray(s.frames) || s.frames.length < 1 || s.frames.length > 4) throw new Error('1 to 4 frames');
  for (const fr of s.frames) if (!Array.isArray(fr) || fr.length !== h || !fr.every((row) => allowed.test(row))) throw new Error('A frame doesn\'t match the size');
  const fps = Math.max(1, Math.min(12, Math.round(Number(s.fps) || 4)));
  fs.mkdirSync(SPRITES, {recursive: true});
  const out = {name: String(s.name).trim().slice(0, 60), width: w, height: h, fps, palette, frames: s.frames};
  fs.writeFileSync(path.join(SPRITES, `${slug}.json`), JSON.stringify(out, null, 1) + '\n');
  return slug;
}
