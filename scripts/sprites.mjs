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

// ---------- the keyboard puppet (PUPPET.md) ----------
// A character is every drawing named <character>-<action>; items are item-<name>.
export const PUPPET_ACTIONS = ['idle-front', 'look-up', 'idle', 'walk', 'run', 'point', 'talk', 'pray', 'cross', 'bow', 'blessing', 'kneel'];
const ACTION_RE = new RegExp(`^(.+?)-(${PUPPET_ACTIONS.join('|')})$`);

/** Characters and items for the Timing tab: [{name, actions: [...], missing: [...]}], [item names]. */
export function puppetCast() {
  const chars = {};
  const items = [];
  for (const s of listSprites()) {
    if (s.kind === 'sketch') continue;
    if (s.slug.startsWith('item-')) { items.push(s.slug.slice(5)); continue; }
    const m = ACTION_RE.exec(s.slug);
    if (m && m[1] !== 'item') (chars[m[1]] ??= []).push(m[2]);
  }
  const need = ['idle', 'walk'];
  return {characters: Object.entries(chars).map(([name, actions]) => ({name, actions, missing: PUPPET_ACTIONS.filter((a) => !actions.includes(a)), ready: need.every((a) => actions.includes(a))})), items};
}

/** A puppet scene's drawings: {actions: {walk: art, …}, items: [{name, art}]} (its own item first). */
export function puppetArt(sc) {
  const actions = {};
  for (const a of PUPPET_ACTIONS) {
    const f = path.join(SPRITES, `${spriteSlug(`${sc.character}-${a}`)}.json`);
    if (fs.existsSync(f)) { const art = JSON.parse(fs.readFileSync(f, 'utf8')); if (art.kind !== 'sketch') actions[a] = art; }
  }
  const names = puppetCast().items;
  const order = sc.item && names.includes(sc.item) ? [sc.item, ...names.filter((n) => n !== sc.item)] : names;
  return {actions, items: order.map((name) => ({name, art: loadSprite(`item-${name}`)}))};
}

// ---------- color versions of her base characters (PUPPET.md) ----------
// A base is a character with all five poses that she drew herself. She recolors only its idle and
// names the new character; every other pose is made from the base's with the same color swaps.
// sprites/.versions.json remembers each version's base and swaps: {st-joseph: {base, swaps: {'#old': '#new'}}}.
export const BASE_POSES = ['idle', 'point', 'look-up', 'walk', 'run'];
const VERSIONS = path.join(SPRITES, '.versions.json');
export const readVersions = () => { try { return JSON.parse(fs.readFileSync(VERSIONS, 'utf8')); } catch { return {}; } };

/** The bases she can start from (with their idle drawing), and the versions made so far. */
export function puppetBases() {
  const versions = readVersions();
  const bases = puppetCast().characters.filter((c) => !versions[c.name] && BASE_POSES.every((p) => c.actions.includes(p)))
    .map((c) => ({name: c.name, idle: loadSprite(`${c.name}-idle`)}));
  return {bases, versions};
}

// One color (or null) per pixel, per frame.
const pixelsOf = (art) => art.frames.map((rows) => rows.join('').split('').map((c) => (c === '.' ? null : art.palette[CODES.indexOf(c)].toUpperCase())));

/**
 * Make (or, with dry, only check) a color version: `idle` is her recolored idle (saved form) of
 * `base`, `name` the new character. Returns {slug, swaps, split: [{from, to: [...]}], shape, made: [...], exists: [...]}.
 * split: a base color that became more than one color (the most used one is copied to the other poses);
 * shape: how many squares she added or erased (only colors are copied, not shape changes).
 */
export function colorVersion({base, name, idle, dry}) {
  const slug = spriteSlug(name);
  if (!slug) throw new Error('Give the new character a name');
  const {bases, versions} = puppetBases();
  if (!bases.some((b) => b.name === base)) throw new Error(`"${base}" isn't a base character with all five poses`);
  if (slug === base || (bases.some((b) => b.name === slug))) throw new Error(`"${slug}" is a base; pick another name`);
  const from = loadSprite(`${base}-idle`);
  if (idle.width !== from.width || idle.height !== from.height) throw new Error('The idle drawing must stay the same size as the base');
  const a = pixelsOf(from), b = pixelsOf(idle);
  const count = {};
  let shape = 0;
  for (let f = 0; f < Math.min(a.length, b.length); f++) a[f].forEach((c, i) => {
    const d = b[f][i];
    if (c && d) { (count[c] ??= {})[d] = (count[c][d] ?? 0) + 1; } else if (c || d) shape++;
  });
  const swaps = {}, split = [];
  for (const [c, to] of Object.entries(count)) {
    const ranked = Object.entries(to).sort((x, y) => y[1] - x[1]).map(([k]) => k);
    if (ranked[0] !== c) swaps[c] = ranked[0];
    if (ranked.length > 1) split.push({from: c, to: ranked});
  }
  // (and any extra poses the base has, like blessing or kneel)
  const others = PUPPET_ACTIONS.filter((p) => p !== 'idle' && fs.existsSync(path.join(SPRITES, `${base}-${p}.json`)));
  const made = [`${slug}-idle`, ...others.map((p) => `${slug}-${p}`)];
  const exists = made.filter((s) => fs.existsSync(path.join(SPRITES, `${s}.json`)));
  if (dry) return {slug, swaps, split, shape, made, exists};
  saveSprite({...idle, name: `${slug}-idle`});
  for (const p of others) {
    const art = loadSprite(`${base}-${p}`);
    saveSprite({...art, name: `${slug}-${p}`, palette: art.palette.map((c) => swaps[c.toUpperCase()] ?? c)});
  }
  versions[slug] = {base, swaps};
  fs.writeFileSync(VERSIONS, JSON.stringify(versions, null, 1) + '\n');
  return {slug, swaps, split, shape, made, exists};
}

// ---------- copying a pose to other characters ----------
// She draws a new pose (e.g. eastern-monk-blessing) once; each other character gets a draft of it
// made from its own idle: the source idle is lined up with each pose frame (the best shift, for
// poses like kneeling that move the body), and only the squares the pose changed are painted on
// the target's idle, in the target's colors for those parts (matched square by square between
// the two idles). Drafts never replace a drawing that exists; she touches them up by hand.
const shiftPx = (px, w, h, dx, dy) => px.map((_, i) => { const x = (i % w) - dx, y = Math.floor(i / w) - dy; return x >= 0 && x < w && y >= 0 && y < h ? px[y * w + x] : null; });
const artOfPixels = (name, w, h, fps, frames) => {
  const palette = [...new Set(frames.flat().filter(Boolean))].slice(0, CODES.length);
  return {name, width: w, height: h, fps, palette, frames: frames.map((px) => Array.from({length: h}, (_, y) =>
    px.slice(y * w, y * w + w).map((c) => (c && palette.includes(c) ? CODES[palette.indexOf(c)] : '.')).join('')))};
};

/** A draft of `<from character>-<pose>` for character `to` (null if it has no idle or a different size). */
export function poseDraft(fromChar, pose, to) {
  const src = loadSprite(`${fromChar}-${pose}`), srcIdle = loadSprite(`${fromChar}-idle`);
  let tgtIdle;
  try { tgtIdle = loadSprite(`${to}-idle`); } catch { return null; }
  const {width: w, height: h} = src;
  if (srcIdle.width !== w || srcIdle.height !== h || tgtIdle.width !== w || tgtIdle.height !== h) return null;
  const si = pixelsOf(srcIdle)[0], ti = pixelsOf(tgtIdle)[0];
  // Which of the target's colors each source color stands for (most squares in common).
  const count = {};
  si.forEach((c, i) => { if (c && ti[i]) (count[c] ??= {})[ti[i]] = (count[c][ti[i]] ?? 0) + 1; });
  const map = Object.fromEntries(Object.entries(count).map(([c, n]) => [c, Object.entries(n).sort((a, b) => b[1] - a[1])[0][0]]));
  const frames = pixelsOf(src).map((fr) => {
    let best = null;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const s = shiftPx(si, w, h, dx, dy);
      const miss = s.reduce((n, c, i) => n + (c !== fr[i]), 0) + (Math.abs(dx) + Math.abs(dy)) * 0.5;
      if (!best || miss < best.miss) best = {dx, dy, miss, s};
    }
    const t = shiftPx(ti, w, h, best.dx, best.dy), out = [...t];
    // A changed square takes the target's color at the nearest square that had the same color in
    // the source (so a robe's hem matches the target's hem, not its hat), else the overall match.
    const near = (c, i) => {
      let at = null, d = Infinity;
      best.s.forEach((sc, j) => { if (sc === c && t[j]) { const e = Math.hypot((j % w) - (i % w), Math.floor(j / w) - Math.floor(i / w)); if (e < d) { d = e; at = t[j]; } } });
      return at ?? map[c] ?? c;
    };
    fr.forEach((c, i) => { if (c !== best.s[i]) out[i] = c ? near(c, i) : null; });
    return out;
  });
  return artOfPixels(`${to}-${pose}`, w, h, src.fps, frames);
}

/** Drafts of one pose for several characters; with save, writes the ones that don't exist yet. */
export function copyPose({from, pose, to, save}) {
  if (!PUPPET_ACTIONS.includes(pose)) throw new Error(`"${pose}" isn't a pose the puppet knows`);
  const out = [];
  for (const t of to ?? []) {
    const slug = spriteSlug(`${t}-${pose}`);
    const exists = fs.existsSync(path.join(SPRITES, `${slug}.json`));
    const art = t === from ? null : poseDraft(from, pose, t);
    if (!art) { out.push({character: t, slug, skipped: true}); continue; }
    if (save && !exists) saveSprite(art);
    out.push({character: t, slug, exists, saved: !!(save && !exists), art});
  }
  return out;
}
