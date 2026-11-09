// Towns (the Studio's Town tab): towns/<name>.yml is a town she lays out herself — ground tiles,
// buildings and trees, people and what they say — and packTown() turns it into a PICO-8 cart
// (sprite sheet, map, and a block of Lua the small engine in game/town-engine.lua reads).
//   npm run town -- <name>            make ~/Projects/games/sanpico/<name>.p8
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import {ROOT} from './lib.mjs';
import {SPRITES, spriteSlug} from './sprites.mjs';

export const TOWNS = path.join(ROOT, 'towns');
export const townSlug = (n) => String(n ?? '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const TILE_CHARS = 'gGtThrwfcabdeijklmnopqsuvxyzABCDEFHIJKLMNOPQRSUVWXYZ0123456789';
const BLOCKS = ['all', 'base', 'trunk', 'none'];
const int = (v, lo, hi, d = lo) => (Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Math.round(Number(v)))) : d);
const word = (v, max) => String(v ?? '').replace(/\r/g, '').slice(0, max);

const readArt = (slug) => {
  const f = path.join(SPRITES, `${spriteSlug(slug)}.json`);
  if (!slug || !fs.existsSync(f)) return null;
  const art = JSON.parse(fs.readFileSync(f, 'utf8'));
  return art.kind === 'sketch' || !Array.isArray(art.frames) || !art.frames.length ? null : art;
};

// ---------- the file ----------

export function listTowns() {
  if (!fs.existsSync(TOWNS)) return [];
  return fs.readdirSync(TOWNS).filter((f) => f.endsWith('.yml')).sort().map((f) => {
    const name = f.slice(0, -4);
    try { return {name, title: YAML.parse(fs.readFileSync(path.join(TOWNS, f), 'utf8')).title ?? name}; } catch { return {name, title: name}; }
  });
}

export function loadTown(name) {
  const f = path.join(TOWNS, `${townSlug(name)}.yml`);
  if (!townSlug(name) || !fs.existsSync(f)) throw new Error(`No town "${name}" (towns/${name}.yml)`);
  return cleanTown({...YAML.parse(fs.readFileSync(f, 'utf8')), name: townSlug(name)});
}

/** Only what a town file can hold, with sane limits (the page sends whatever she edited). */
export function cleanTown(t) {
  if (!t || typeof t !== 'object') throw new Error('Not a town');
  const size = [int(t.size?.[0], 16, 64, 64), int(t.size?.[1], 16, 64, 64)];
  const tiles = {};
  for (const [k, v] of Object.entries(t.tiles ?? {})) if (TILE_CHARS.includes(k) && String(k).length === 1 && spriteSlug(v)) tiles[k] = spriteSlug(v);
  const fill = Object.keys(tiles)[0] ?? 'g';
  const src = Array.isArray(t.map) ? t.map : [];
  const map = Array.from({length: size[1]}, (_, y) => [...String(src[y] ?? '').slice(0, size[0]).padEnd(size[0], fill)].map((c) => (tiles[c] ? c : fill)).join(''));
  const blocked = [...new Set((Array.isArray(t.blocked) ? t.blocked : []).map(String).filter((c) => tiles[c]))];
  const at = (p) => [int(p?.[0], 0, size[0] - 1), int(p?.[1], 0, size[1] - 1)];
  const things = (Array.isArray(t.things) ? t.things : []).slice(0, 300).filter((o) => o && spriteSlug(o.sprite)).map((o) => ({
    sprite: spriteSlug(o.sprite), at: at(o.at), block: BLOCKS.includes(o.block) ? o.block : 'all',
    ...(o.door != null && o.door !== '' ? {door: int(o.door, 0, 15)} : {}), ...(word(o.name, 30).trim() ? {name: word(o.name, 30).trim()} : {})}));
  const people = (Array.isArray(t.people) ? t.people : []).slice(0, 60).filter((o) => o && spriteSlug(o.sprite)).map((o) => ({
    sprite: spriteSlug(o.sprite), at: at(o.at), name: word(o.name, 24).trim(), job: word(o.job, 30).trim(), says: word(o.says, 600).trim()}));
  return {name: townSlug(t.name), title: word(t.title, 60).trim() || townSlug(t.name), size, ...(spriteSlug(t.player) ? {player: spriteSlug(t.player)} : {}),
    start: at(t.start ?? [size[0] >> 1, size[1] >> 1]), tiles, blocked, map, things, people};
}

const scalar = (v) => (Array.isArray(v) ? `[${v.map(scalar).join(', ')}]` : typeof v === 'string' ? (/^[A-Za-z][A-Za-z0-9_-]*$/.test(v) && !['true', 'false', 'null', 'yes', 'no', 'on', 'off', 'y', 'n'].includes(v.toLowerCase()) ? v : JSON.stringify(v)) : String(v));
const flow = (o) => `{${Object.entries(o).map(([k, v]) => `${scalar(k)}: ${scalar(v)}`).join(', ')}}`;
const headerOf = (text) => { const lines = []; for (const l of text.split('\n')) { if (l.startsWith('#') || (!l.trim() && lines.length)) lines.push(l); else break; } return lines.join('\n'); };

/** The town as YAML she (or Claude) can read: one line per map row, thing and person. */
export function formatTown(t, header = '') {
  const out = [];
  if (header.trim()) out.push(header.trimEnd());
  out.push(`name: ${t.name}`, `title: ${scalar(t.title)}`, `size: ${scalar(t.size)}`);
  if (t.player) out.push(`player: ${scalar(t.player)}`);
  out.push(`start: ${scalar(t.start)}`, `tiles: ${flow(t.tiles)}`, `blocked: ${scalar(t.blocked)}`);
  out.push('map:', ...t.map.map((r) => `  - ${JSON.stringify(r)}`));
  out.push('things:' + (t.things.length ? '' : ' []'), ...t.things.map((o) => `  - ${flow(o)}`));
  out.push('people:' + (t.people.length ? '' : ' []'), ...t.people.map((o) => `  - ${flow(o)}`));
  return out.join('\n') + '\n';
}

export function saveTown(name, town) {
  const slug = townSlug(name);
  if (!slug) throw new Error('Give the town a name');
  const t = cleanTown({...town, name: slug});
  fs.mkdirSync(TOWNS, {recursive: true});
  const f = path.join(TOWNS, `${slug}.yml`);
  const text = formatTown(t, fs.existsSync(f) ? headerOf(fs.readFileSync(f, 'utf8')) : '');
  // Safety net: it must read back as the same town before it replaces the file.
  if (JSON.stringify(YAML.parse(text)) !== JSON.stringify(t)) throw new Error('That town could not be saved safely (nothing was changed)');
  fs.writeFileSync(f, text);
  return slug;
}

/** A new town: 64 × 64 squares of grass, ready to paint. */
export function newTown(name, title) {
  const slug = townSlug(name);
  if (!slug) throw new Error('Give the town a name');
  if (fs.existsSync(path.join(TOWNS, `${slug}.yml`))) throw new Error('There is already a town with that name');
  const two = !!readArt('tile-grass2');
  const row = (y) => Array.from({length: 64}, (_, x) => (two && (x * 7 + y * 13 + ((x * y) % 5)) % 6 === 0 ? 'G' : 'g')).join('');
  const player = ['thick-guy', 'skinny-guy', 'priest'].find((p) => readArt(`${p}-idle`));
  return saveTown(slug, {name: slug, title: String(title || name).trim(), size: [64, 64], player, start: [32, 32],
    tiles: {g: 'tile-grass', ...(two ? {G: 'tile-grass2'} : {})}, blocked: [], map: Array.from({length: 64}, (_, y) => row(y)), things: [], people: []});
}

// ---------- where you can't walk ----------

const cells = (art) => [Math.ceil(art.width / 8), Math.ceil(art.height / 8)];
/** The squares of a thing that stop you: all of it, its bottom row, the middle of its bottom row (a trunk), or none. */
function blockCells(o, art) {
  const [cw, ch] = cells(art), out = [];
  if (o.block === 'none') return out;
  const mid = cw % 2 ? [cw >> 1] : [cw / 2 - 1, cw / 2];
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    if (o.block === 'all' || (y === ch - 1 && (o.block === 'base' || mid.includes(x)))) out.push([o.at[0] + x, o.at[1] + y]);
  }
  return out;
}

/** One string per row, "1" where the player can't stand. People count: you walk up to them, not through them. */
export function solidRows(t, arts) {
  const [w, h] = t.size;
  const g = t.map.map((r) => [...r].map((c) => (t.blocked.includes(c) ? 1 : 0)));
  const set = (x, y) => { if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = 1; };
  for (const o of t.things) { const a = arts[o.sprite]; if (a) for (const [x, y] of blockCells(o, a)) set(x, y); }
  for (const p of t.people) { const a = arts[`${p.sprite}-idle`]; if (a) { const [cw] = cells(a); for (let x = 0; x < cw; x++) set(p.at[0] + x, p.at[1]); } }
  return g.map((r) => r.join(''));
}

// ---------- packing for PICO-8 ----------

const PICO = ['#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8', '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA'];
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
// Her colors become the nearest of PICO-8's 16, the same way as Blessed! (scripts/pico8.mjs, and the
// same hand-picked ones from game/sprites.json). Never color 0: that one is see-through.
function colorPicker() {
  let force = {};
  try { force = Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(path.join(ROOT, 'game/sprites.json'), 'utf8')).colors ?? {}).map(([k, v]) => [k.toUpperCase(), v])); } catch { /* no Blessed! settings: nearest only */ }
  const memo = new Map();
  return (hex) => {
    const key = String(hex).toUpperCase();
    if (key in force) return force[key];
    if (memo.has(key)) return memo.get(key);
    const c = rgb(key);
    let best = 1, bd = Infinity;
    for (let i = 1; i < 16; i++) { const p = rgb(PICO[i]); const d = (c[0] - p[0]) ** 2 * 2 + (c[1] - p[1]) ** 2 * 4 + (c[2] - p[2]) ** 2 * 3; if (d < bd) { bd = d; best = i; } }
    memo.set(key, best);
    return best;
  };
}

const ALPHA = '0123456789abcdefghijklmnopqrstuvwxyz!#$%&()*+,-./:;<=>?@[]^_{|}~';
// Words for the PICO-8 screen: its own letters only (capitals there are the small font), no "|" (our divider).
const p8text = (s) => String(s ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ').replace(/[^\x20-\x7e]/g, '').replace(/[|\\]/g, '/').toLowerCase().trim();
const lua = (s) => `"${s.replace(/"/g, '\\"')}"`;

/**
 * Everything the cart needs, and how much room it takes.
 * → {gfx, gff, map, data (Lua), budget: {slots, pages, letters, problems, warnings}, solid, arts}
 */
export function packTown(town) {
  const t = cleanTown(town);
  const [w, h] = t.size;
  const problems = [], warnings = [];
  const nearest = colorPicker();
  const arts = {};
  const need = (slug, what) => {
    if (slug in arts) return arts[slug];
    const a = readArt(slug);
    if (!a) problems.push(`There is no drawing called “${slug}” (${what}).`);
    return (arts[slug] = a);
  };

  // Three sheets of 16 × 16 squares: the cart's own, and two more kept as text in the code.
  const pages = [0, 1, 2].map(() => Array.from({length: 16}, () => Array(16).fill(false)));
  pages[0][0][0] = true; // sprite 0 stays empty: PICO-8 draws it as nothing on the map
  const fit = (pg, cw, ch) => {
    for (let y = 0; y + ch <= 16; y++) for (let x = 0; x + cw <= 16; x++) {
      let ok = true;
      for (let j = 0; ok && j < ch; j++) for (let i = 0; i < cw; i++) if (pages[pg][y + j][x + i]) { ok = false; break; }
      if (ok) { for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) pages[pg][y + j][x + i] = true; return {pg, sx: x * 8, sy: y * 8}; }
    }
    return null;
  };
  const sheet = Array.from({length: 128}, () => Array(128).fill(0));
  const px = (art, f) => { const cols = art.palette.map(nearest); return art.frames[f % art.frames.length].map((row) => [...row].map((ch) => (ch === '.' ? 0 : cols[parseInt(ch, 36)] ?? 0))); };
  const paint = (rows, sx, sy) => rows.forEach((r, y) => r.forEach((c, x) => { if (sy + y < 128 && sx + x < 128) sheet[sy + y][sx + x] = c; }));
  const big = []; // pictures on the extra sheets: {pg, sx, sy, w, h, rows}
  /** Room for a drawing's frames side by side. `only0`: it has to be on the cart's own sheet. */
  const place = (art, frames, only0, what) => {
    const [cw, ch] = cells(art);
    const n = Math.max(1, Math.min(frames, Math.floor(16 / cw)));
    for (const pg of only0 ? [0] : [0, 1, 2]) {
      const at = fit(pg, cw * n, ch);
      if (!at) continue;
      for (let f = 0; f < n; f++) {
        if (pg === 0) paint(px(art, f), at.sx + f * cw * 8, at.sy);
        else big.push({pg, sx: at.sx + f * cw * 8, sy: at.sy, w: art.width, h: art.height, rows: px(art, f)});
      }
      return {...at, w: art.width, h: art.height, n};
    }
    problems.push(`No room left for ${what}. Use fewer different drawings.`);
    return null;
  };

  // Ground tiles first (the map can only use the cart's own sheet). A moving tile gets one square
  // the map shows, and one per frame that the game copies into it.
  const slotOf = {}, anim = [], gff = Array(256).fill(0);
  const usedChars = new Set(t.map.join(''));
  for (const [ch, name] of Object.entries(t.tiles)) {
    if (!usedChars.has(ch)) continue;
    const a = need(name, 'a ground tile');
    if (!a) continue;
    if (a.width !== 8 || a.height !== 8) { problems.push(`Ground tile “${name}” is ${a.width} × ${a.height}; tiles are 8 × 8.`); continue; }
    const n = Math.min(a.frames.length, 8);
    const at = place(a, n > 1 ? n + 1 : 1, true, `the tile “${name}”`);
    if (!at) continue;
    const slot = (at.sy / 8) * 16 + at.sx / 8;
    if (n > 1) { paint(px(a, 0), at.sx, at.sy); for (let f = 0; f < n; f++) paint(px(a, f), at.sx + (f + 1) * 8, at.sy); anim.push(slot, slot + 1, n); }
    slotOf[ch] = slot;
    if (t.blocked.includes(ch)) gff[slot] = 1;
  }

  // The player: standing and walking.
  let pd = [8, 8, 0, 0, 1, 0, 0, 1];
  if (!t.player) problems.push('Pick who you play as (the Start spot tool).');
  else {
    const idle = need(`${t.player}-idle`, 'the player standing');
    const walk = readArt(`${t.player}-walk`);
    if (walk) arts[`${t.player}-walk`] = walk;
    if (idle) {
      const i = place(idle, idle.frames.length, true, 'the player');
      const wk = walk && walk.width === idle.width && walk.height === idle.height ? place(walk, walk.frames.length, true, 'the player walking') : null;
      if (!walk) warnings.push(`“${t.player}” has no walk drawing, so they slide instead of walking.`);
      if (i) pd = [idle.width, idle.height, i.sx, i.sy, i.n, (wk || i).sx, (wk || i).sy, (wk || i).n];
    }
  }

  // People, then things (the biggest first, so they pack tightly).
  const where = {};
  for (const p of t.people) {
    const key = `${p.sprite}-idle`;
    if (key in where) continue;
    const a = need(key, 'a person');
    where[key] = a ? place(a, a.frames.length, true, `“${p.sprite}”`) : null;
  }
  const kinds = [...new Set(t.things.map((o) => o.sprite))].map((s) => [s, need(s, 'a thing')]).filter(([, a]) => a)
    .sort(([, a], [, b]) => cells(b)[0] * cells(b)[1] - cells(a)[0] * cells(a)[1]);
  for (const [s, a] of kinds) where[s] = place(a, 1, false, `“${s}”`);

  // The Lua the engine reads.
  const thingLines = t.things.filter((o) => where[o.sprite]).map((o) => {
    const at = where[o.sprite], a = arts[o.sprite], [cw, ch] = cells(a);
    const door = o.door != null ? [o.at[0] + Math.min(o.door, cw - 1), o.at[1] + ch] : [-1, -1]; // the square you stand on, just under the door
    return lua(`${[at.pg, at.sx, at.sy, a.width, a.height, o.at[0] * 8, o.at[1] * 8 + ch * 8 - a.height, ...door].join(',')}|${p8text(o.name)}`);
  });
  const peopleLines = t.people.filter((p) => where[`${p.sprite}-idle`]).map((p) => {
    const at = where[`${p.sprite}-idle`], a = arts[`${p.sprite}-idle`];
    return lua(`${[at.sx, at.sy, a.width, a.height, at.n, p.at[0] * 8, p.at[1] * 8 + 8 - a.height].join(',')}|${p8text(p.name) || '?'}|${p8text(p.job)}|${p8text(p.says)}`);
  });
  for (const p of t.people) if (!p.says) warnings.push(`${p.name || p.sprite} has nothing to say yet.`);
  let bigart = '';
  for (const b of big) {
    const flat = b.rows.flat();
    for (let k = 0; k < flat.length;) { let n = 1; while (n < 4 && k + n < flat.length && flat[k + n] === flat[k]) n++; bigart += ALPHA[flat[k] * 4 + n - 1]; k += n; }
  }
  const solid = solidRows(t, arts);
  const bits = solid.join('').padEnd(Math.ceil((w * h) / 4) * 4, '0');
  const hex = bits.match(/.{4}/g).map((b) => parseInt(b, 2).toString(16)).join('');
  if (solid[t.start[1]]?.[t.start[0]] === '1') problems.push('The start spot is on a square you can’t walk on. Move it (the Start spot tool).');
  const data = [
    `-- ${p8text(t.title)}`,
    `tw,th=${w},${h}`,
    `ground=3`,
    `start=split"${t.start.join(',')}"`,
    `pd=split"${pd.join(',')}"`,
    anim.length ? `anim=split"${anim.join(',')}"` : 'anim={}',
    `solid="${hex}"`,
    `things={${thingLines.length ? '\n ' + thingLines.join(',\n ') + '\n' : ''}}`,
    `people={${peopleLines.length ? '\n ' + peopleLines.join(',\n ') + '\n' : ''}}`,
    big.length ? `bigrects=split"${big.map((b) => [b.pg, b.sx, b.sy, b.w, b.h].join(',')).join(',')}"` : 'bigrects={}',
    `bigart="${bigart.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
  ].join('\n');

  // The map: PICO-8 keeps 128 × 32 squares to itself, so the town's top half goes on the left and its bottom half on the right.
  const mapRows = Array.from({length: 32}, (_, y) => {
    const cell = (x, yy) => (yy < h && x < w ? slotOf[t.map[yy][x]] ?? 0 : 0);
    return Array.from({length: 128}, (_, x) => (x < 64 ? cell(x, y) : cell(x - 64, y + 32)).toString(16).padStart(2, '0')).join('');
  });
  const slots = pages[0].flat().filter(Boolean).length;
  const extra = [1, 2].map((pg) => pages[pg].flat().filter(Boolean).length);
  return {
    gfx: sheet.map((r) => r.map((c) => c.toString(16)).join('')), gff: gff.map((v) => v.toString(16).padStart(2, '0')).join(''), map: mapRows, data, solid, arts,
    budget: {slots, of: 256, extra, letters: data.length, lettersOf: 65535, problems: [...new Set(problems)], warnings: [...new Set(warnings)]},
  };
}

// ---------- the cart ----------

export function gamesDir() {
  const dir = [process.env.GAMES_DIR, path.join(os.homedir(), 'Projects/games')].find((d) => d && fs.existsSync(d));
  if (!dir) throw new Error('The games folder was not found (~/Projects/games, or GAMES_DIR in .env).');
  return dir;
}
export const cartPath = (name) => path.join(gamesDir(), 'sanpico', `${townSlug(name)}.p8`);

/** Write the town into its cart. A new cart gets the small walk-around engine; an existing one keeps its code, sounds and music. */
export function exportTown(name, file = cartPath(name)) {
  const t = loadTown(name);
  const packed = packTown(t);
  if (packed.budget.problems.length) throw new Error(packed.budget.problems.join(' '));
  const fresh = !fs.existsSync(file);
  let text = fresh ? `pico-8 cartridge // http://www.pico-8.com\nversion 41\n__lua__\n${fs.readFileSync(path.join(ROOT, 'game/town-engine.lua'), 'utf8')}` : fs.readFileSync(file, 'utf8');
  // Split into its sections (__lua__, __gfx__, …), swap ours in, and put them back in PICO-8's order.
  const parts = text.split(/^(__[a-z]+__)\n/m);
  const head = parts[0], sec = {};
  for (let i = 1; i < parts.length; i += 2) sec[parts[i]] = parts[i + 1].replace(/\n*$/, '\n');
  const code = sec.__lua__ ?? '';
  if (!/^--town:begin$/m.test(code) || !/^--town:end$/m.test(code)) throw new Error(`${path.basename(file)} has no “--town:begin” and “--town:end” lines, so the town can’t be put in.`);
  sec.__lua__ = code.replace(/^--town:begin$[\s\S]*?^--town:end$/m, () => `--town:begin\n${packed.data}\n--town:end`);
  sec.__gfx__ = packed.gfx.join('\n') + '\n';
  sec.__gff__ = packed.gff.slice(0, 256) + '\n' + packed.gff.slice(256) + '\n';
  sec.__map__ = packed.map.join('\n') + '\n';
  const order = ['__lua__', '__gfx__', '__label__', '__gff__', '__map__', '__sfx__', '__music__'];
  text = head + [...order, ...Object.keys(sec).filter((k) => !order.includes(k))].filter((k) => sec[k] != null).map((k) => `${k}\n${sec[k]}`).join('');
  if (text.length - (sec.__gfx__.length + sec.__map__.length) > 200000) throw new Error('The cart came out too big.');
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, text);
  return {file, fresh, budget: packed.budget};
}
