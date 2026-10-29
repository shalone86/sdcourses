// Battles (BATTLES.md): battles/<name>.yml plus the drawings it uses, packed for the Battle scene.
//   import {battleProps} from './battles.mjs'  → {battle, arts}
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {ROOT} from './lib.mjs';
import {SPRITES, spriteSlug} from './sprites.mjs';

export const BATTLES = path.join(ROOT, 'battles');
// The drawings a unit can have: `<kind>-<action>`.
const ACTIONS = ['idle', 'walk', 'gallop', 'ride', 'run', 'attack', 'point', 'fall'];

export function loadBattle(name) {
  const f = path.join(BATTLES, `${name}.yml`);
  if (!fs.existsSync(f)) throw new Error(`No battle "${name}" (battles/${name}.yml)`);
  return YAML.parse(fs.readFileSync(f, 'utf8'));
}

const readArt = (slug) => {
  const f = path.join(SPRITES, `${spriteSlug(slug)}.json`);
  if (!fs.existsSync(f)) return null;
  const art = JSON.parse(fs.readFileSync(f, 'utf8'));
  return art.kind === 'sketch' ? null : art; // battles are pixel art
};

/** The battle and every drawing it can use, by name. Missing drawings are listed, not fatal. */
export function battleProps(nameOrScene) {
  const name = typeof nameOrScene === 'string' ? nameOrScene : nameOrScene.battle;
  const battle = loadBattle(name);
  const names = new Set(Object.values(battle.tiles ?? {}));
  for (const p of battle.props ?? []) names.add(p.sprite);
  for (const e of battle.script ?? []) if (e.fx) names.add(`fx-${e.fx}`);
  for (const u of battle.units ?? []) for (const a of ACTIONS) names.add(`${u.kind}-${a}`);
  const arts = {}, missing = [];
  for (const n of names) {
    const art = readArt(n);
    if (art) arts[spriteSlug(n)] = {width: art.width, height: art.height, fps: art.fps, palette: art.palette, frames: art.frames};
    else if (!/-(walk|gallop|ride|run|attack|point|fall)$/.test(n)) missing.push(n); // optional poses are allowed to be absent
  }
  return {battle, arts, missing};
}

// ---------- the Studio's Battles tab: listing, saving, new battles ----------

export const battleSlug = (n) => String(n ?? '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export function listBattles() {
  if (!fs.existsSync(BATTLES)) return [];
  return fs.readdirSync(BATTLES).filter((f) => f.endsWith('.yml')).sort().map((f) => {
    try { const b = YAML.parse(fs.readFileSync(path.join(BATTLES, f), 'utf8')); return {name: f.slice(0, -4), title: b.title ?? f.slice(0, -4), seconds: b.seconds ?? null}; } catch { return {name: f.slice(0, -4), title: f.slice(0, -4), seconds: null}; }
  });
}

const num = (v, lo, hi, d = 0) => (Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Number(v))) : d);
const round = (v, n = 3) => Math.round(v * 10 ** n) / 10 ** n;
const pt = (p) => (Array.isArray(p) && p.length >= 2 ? [round(num(p[0], -64, 256)), round(num(p[1], -64, 256))] : null);
const word = (v, max = 60) => String(v ?? '').slice(0, max);
const slug = (v) => spriteSlug(v);

/** Only what a battle file can hold, with sane limits (the page sends whatever she edited). */
export function cleanBattle(b) {
  if (!b || typeof b !== 'object') throw new Error('Not a battle');
  const rows = (Array.isArray(b.map) ? b.map : []).slice(0, 64).map((r) => String(r).slice(0, 96));
  if (!rows.length) throw new Error('The map is empty');
  const view = [Math.round(num(b.view?.[0], 4, 32, 16)), Math.round(num(b.view?.[1], 4, 32, 9))];
  const tiles = {};
  for (const [k, v] of Object.entries(b.tiles ?? {})) if (String(k).length === 1 && slug(v)) tiles[k] = slug(v);
  const ids = new Set();
  const units = (Array.isArray(b.units) ? b.units : []).slice(0, 200).map((u) => {
    const id = slug(u.id);
    if (!id || ids.has(id)) throw new Error(`Unit names must be different (${id || 'blank'})`);
    ids.add(id);
    const at = pt(u.at);
    if (!at || !slug(u.kind)) throw new Error(`Unit ${id} needs a kind and a place`);
    return {id, kind: slug(u.kind), at, ...(u.side ? {side: word(u.side, 20)} : {}), ...(u.face === 'right' ? {face: 'right'} : {}),
      ...(u.speed ? {speed: round(num(u.speed, 1, 400))} : {}), ...(u.hidden ? {hidden: true} : {})};
  });
  const props = (Array.isArray(b.props) ? b.props : []).slice(0, 300).map((p) => ({sprite: slug(p.sprite), at: pt(p.at) ?? [0, 0], ...(p.face === 'right' ? {face: 'right'} : {})})).filter((p) => p.sprite);
  const script = (Array.isArray(b.script) ? b.script : []).slice(0, 3000).map((e) => {
    const o = {t: round(num(e.t, 0, 3600))};
    if (e.unit) o.unit = slug(e.unit);
    if (Array.isArray(e.move)) o.move = e.move.map(pt).filter(Boolean).slice(0, 60);
    if (e.speed) o.speed = round(num(e.speed, 1, 400));
    if (e.act) o.act = slug(e.act);
    if (e.dur != null && e.dur !== '') o.dur = round(num(e.dur, 0, 600));
    if (e.face === 'left' || e.face === 'right') o.face = e.face;
    if (typeof e.show === 'boolean') o.show = e.show;
    if (e.fx) o.fx = slug(e.fx);
    if (pt(e.at) && (e.fx || e.label)) o.at = pt(e.at);
    if (e.dx) o.dx = Math.round(num(e.dx, -64, 64)); if (e.dy) o.dy = Math.round(num(e.dy, -64, 64));
    if (pt(e.camera)) o.camera = pt(e.camera);
    if (e.follow) o.follow = slug(e.follow);
    if (e.say) o.say = word(e.say, 240);
    if (e.who) o.who = word(e.who, 40);
    if (e.label) o.label = word(e.label, 40);
    if (e.note) o.note = word(e.note, 240);
    return o;
  }).sort((a, c) => a.t - c.t);
  return {name: battleSlug(b.name), ...(b.title ? {title: word(b.title, 80)} : {}), view, ...(b.seconds ? {seconds: round(num(b.seconds, 1, 3600))} : {}),
    ...(b.ground ? {ground: word(b.ground, 9)} : {}), tiles, map: rows, props, units, script};
}

const scalar = (v) => (typeof v === 'string' ? (/^[A-Za-z0-9_.-]+$/.test(v) && !/^[0-9.+-]/.test(v) && !['true', 'false', 'null', 'yes', 'no'].includes(v) ? v : JSON.stringify(v)) : Array.isArray(v) ? `[${v.map(scalar).join(', ')}]` : String(v));
const flow = (o) => `{${Object.entries(o).map(([k, v]) => `${k}: ${scalar(v)}`).join(', ')}}`;

/** The battle as YAML text in the layout of battles/tours.yml (one line per unit and event), with her top-of-file comments kept. */
export function formatBattle(b, header = '') {
  const out = [];
  if (header.trim()) out.push(header.trimEnd());
  out.push(`name: ${b.name}`);
  if (b.title) out.push(`title: ${scalar(b.title)}`);
  out.push(`view: ${scalar(b.view)}`);
  if (b.seconds) out.push(`seconds: ${b.seconds}`);
  if (b.ground) out.push(`ground: ${scalar(b.ground)}`);
  out.push(`tiles: ${flow(b.tiles)}`);
  out.push('map:', ...b.map.map((r) => `  - ${JSON.stringify(r)}`));
  out.push('props:' + (b.props.length ? '' : ' []'), ...b.props.map((p) => `  - ${flow(p)}`));
  out.push('units:' + (b.units.length ? '' : ' []'), ...b.units.map((u) => `  - ${flow(u)}`));
  out.push('script:' + (b.script.length ? '' : ' []'), ...b.script.map((e) => `  - ${flow(e)}`));
  return out.join('\n') + '\n';
}

const headerOf = (text) => { const lines = []; for (const l of text.split('\n')) { if (l.startsWith('#') || (!l.trim() && lines.length)) lines.push(l); else break; } return lines.join('\n'); };

export function saveBattle(name, battle) {
  const slugName = battleSlug(name);
  if (!slugName) throw new Error('Give the battle a name');
  const b = cleanBattle({...battle, name: slugName});
  fs.mkdirSync(BATTLES, {recursive: true});
  const f = path.join(BATTLES, `${slugName}.yml`);
  const header = fs.existsSync(f) ? headerOf(fs.readFileSync(f, 'utf8')) : '';
  // Safety net: it must read back as the same battle before it replaces the file.
  const text = formatBattle(b, header);
  if (JSON.stringify(YAML.parse(text)) !== JSON.stringify(JSON.parse(JSON.stringify(b)))) throw new Error('That battle could not be saved safely (nothing was changed)');
  fs.writeFileSync(f, text);
  return slugName;
}

/** A new battle: a small grass field with one tree, ready to paint. */
export function newBattle(name, title) {
  const slugName = battleSlug(name);
  if (!slugName) throw new Error('Give the battle a name');
  if (fs.existsSync(path.join(BATTLES, `${slugName}.yml`))) throw new Error('There is already a battle with that name');
  const row = (y) => Array.from({length: 24}, (_, x) => ((x * 7 + y * 3) % 5 === 0 ? 'G' : 'g')).join('');
  return saveBattle(slugName, {name: slugName, title: title || slugName, view: [16, 9], seconds: 10, tiles: {g: 'tile-grass', G: 'tile-grass2', t: 'tile-tree', T: 'tile-forest', h: 'tile-hill', r: 'tile-road', w: 'tile-river', f: 'tile-ford', c: 'tile-camp'},
    map: Array.from({length: 12}, (_, y) => row(y)), props: [], units: [], script: [{t: 0, camera: [0, 0]}]});
}
