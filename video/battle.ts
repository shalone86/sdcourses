// The battle engine (BATTLES.md): a small, deterministic "PICO-8 style" world. Everything is
// a pure function of the time, so the studio preview and the render agree exactly, and the
// same battle file can be turned into a PICO-8 cart later.
//
// PICO-8 rules it follows on purpose: 8 × 8 cells, whole-pixel positions, a script that is a
// plain list of timed events, sprites looked up by name, one anchor per sprite (its bottom-left
// cell). Positions in the file are in cells (fractions are fine); the engine works in pixels.
import {recolor, type Art, type Colors} from './scenes/Sprite';

export type Pt = [number, number];
export const CELL = 8;

export type BattleUnit = {
  id: string;
  kind: string; // sprites are `<kind>-<action>` (idle, walk/gallop/ride, attack, point, fall)
  side?: string; // its army (`armies:`), whose colors it wears
  colors?: Colors; // this one's own colors, over its army's
  at: Pt; // bottom-left cell the unit starts on
  face?: 'left' | 'right';
  speed?: number; // pixels per second when it moves
  hidden?: boolean; // not drawn until a `show` event
};
export type BattleProp = {sprite: string; at: Pt; face?: 'left' | 'right'};

// One line of the script. `t` is seconds from the start. What it does depends on its keys:
//   unit + move: [[x,y],…]   walk/ride along the points (speed: px/s, else the unit's)
//   unit + act: attack|point|fall|…   play that drawing for `dur` seconds (fall stays down)
//   unit + face / show
//   fx: spark|dust + (at: [x,y] | unit: id)   a one-shot effect (dx, dy: pixel nudge)
//   camera: [x,y] (cells, top-left of the view) + dur: slide there; follow: <unit id> keeps it centered
//   say: "text" + who + dur: a caption
//   label: "Charles Martel" + (unit: id | at: [x,y]) + dur: a name tag over a person or a place
export type BattleEvent = {
  t: number;
  unit?: string; move?: Pt[]; speed?: number; act?: string; dur?: number; face?: 'left' | 'right'; show?: boolean;
  fx?: string; at?: Pt; dx?: number; dy?: number;
  camera?: Pt; follow?: string;
  say?: string; who?: string;
  label?: string;
  note?: string; // for people reading the file (sources, what is uncertain); never shown
};

export type Battle = {
  name: string;
  title?: string;
  view: Pt; // cells shown: [16, 9] is 128 × 72 pixels (16:9)
  map: string[]; // one character per cell
  tiles: Record<string, string>; // map character → sprite name
  units: BattleUnit[];
  props?: BattleProp[];
  script: BattleEvent[];
  seconds?: number; // length; else the last event
  ground?: string; // color behind everything
  // Armies: each side's colors, so one neutral drawing per kind of soldier serves every battle.
  armies?: Record<string, {name?: string; colors?: Colors}>;
};

export type ArtMap = Record<string, Art>;

export type UnitState = {id: string; kind: string; sprite: string; frame: number; x: number; y: number; flip: boolean; dead: boolean; w: number; h: number};
export type FxState = {sprite: string; frame: number; x: number; y: number};
export type BattleState = {
  camera: {x: number; y: number};
  units: UnitState[];
  props: {sprite: string; frame: number; x: number; y: number; flip: boolean}[];
  fx: FxState[];
  say: {text: string; who?: string} | null;
  labels: {text: string; x: number; y: number}[]; // x: middle, y: top of what it names (pixels of the world)
};

// Every drawing a unit can have (`<kind>-<action>`).
export const UNIT_ACTIONS = ['idle', 'walk', 'gallop', 'ride', 'run', 'attack', 'point', 'fall'];

/** A unit's colors: its army's, then its own over them (or null for the colors as drawn). */
export function unitColors(b: Battle, u: BattleUnit): Colors | null {
  const c = {...(u.side ? b.armies?.[u.side]?.colors : null), ...u.colors};
  return Object.keys(c).length ? c : null;
}
const colorKey = (b: Battle, u: BattleUnit) => (u.colors && Object.keys(u.colors).length ? 'u-' + u.id : unitColors(b, u) ? 'a-' + u.side : '');

/** The drawings plus a recolored copy of each unit's poses for every army (and unit) with its own colors (`<name>__<key>`). */
export function withColors(b: Battle, arts: ArtMap): ArtMap {
  const out = {...arts};
  for (const u of b.units) {
    const k = colorKey(b, u), c = unitColors(b, u);
    if (!k || !c) continue;
    for (const a of UNIT_ACTIONS) { const n = `${u.kind}-${a}`; if (arts[n] && !out[`${n}__${k}`]) out[`${n}__${k}`] = recolor(arts[n], c); }
  }
  return out;
}

const MOVE_ORDER = ['walk', 'gallop', 'ride', 'run', 'idle'];
const ORDER: Record<string, string[]> = {
  move: MOVE_ORDER, attack: ['attack', 'idle'], fall: ['fall', 'idle'], point: ['point', 'idle'], idle: ['idle'],
};

export const mapSize = (b: Battle) => ({w: Math.max(...b.map.map((r) => r.length)), h: b.map.length});
export const viewPx = (b: Battle) => ({w: b.view[0] * CELL, h: b.view[1] * CELL});

export function battleSeconds(b: Battle): number {
  if (b.seconds) return b.seconds;
  let end = 0;
  for (const e of b.script) end = Math.max(end, e.t + (e.dur ?? 0.5));
  return end + 1;
}

const px = (p: Pt): Pt => [p[0] * CELL, p[1] * CELL];
const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

type Mode =
  | {k: 'idle'; since: number}
  | {k: 'move'; t0: number; t1: number; pts: Pt[]; lens: number[]; total: number}
  | {k: 'act'; t0: number; t1: number; action: string};

/** Where a unit is (pixels of its bottom-left corner), what it's doing and which way it faces at time T. */
function unitRun(u: BattleUnit, events: BattleEvent[], T: number) {
  let pos: Pt = px(u.at);
  let face: 'left' | 'right' = u.face ?? 'left';
  let hidden = !!u.hidden;
  let dead = false;
  let mode: Mode = {k: 'idle', since: 0};

  // Brings position and mode up to time `te`; returns the facing the current leg points.
  const settle = (te: number) => {
    if (mode.k === 'move') {
      if (te >= mode.t1) {
        pos = mode.pts[mode.pts.length - 1];
        const a = mode.pts[mode.pts.length - 2] ?? pos;
        if (pos[0] !== a[0]) face = pos[0] < a[0] ? 'left' : 'right';
        mode = {k: 'idle', since: mode.t1};
      } else {
        let d = ((te - mode.t0) / (mode.t1 - mode.t0)) * mode.total;
        let i = 0;
        while (i < mode.lens.length - 1 && d > mode.lens[i]) { d -= mode.lens[i]; i++; }
        const a = mode.pts[i], b = mode.pts[i + 1];
        const k = mode.lens[i] ? d / mode.lens[i] : 1;
        pos = [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
        if (b[0] !== a[0]) face = b[0] < a[0] ? 'left' : 'right';
      }
    } else if (mode.k === 'act' && te >= mode.t1 && !dead) {
      mode = {k: 'idle', since: mode.t1};
    }
  };

  for (const ev of events) {
    if (ev.t > T) break;
    settle(ev.t);
    if (ev.face) face = ev.face;
    if (ev.show != null) hidden = !ev.show;
    if (ev.move?.length) {
      const pts: Pt[] = [pos, ...ev.move.map(px)];
      const lens = pts.slice(1).map((p, i) => dist(pts[i], p));
      const total = lens.reduce((a, b) => a + b, 0);
      const speed = ev.speed ?? u.speed ?? 20;
      mode = {k: 'move', t0: ev.t, t1: ev.t + (total ? total / speed : 0.001), pts, lens, total};
    }
    if (ev.act) {
      if (ev.act === 'fall') dead = true;
      mode = {k: 'act', t0: ev.t, t1: ev.t + (ev.dur ?? 0.6), action: ev.act};
    }
  }
  settle(T);

  let action = 'idle', since = mode.k === 'idle' ? mode.since : 0;
  if (dead) { action = 'fall'; since = mode.k === 'act' ? mode.t0 : since; }
  else if (mode.k === 'move') { action = 'move'; since = mode.t0; }
  else if (mode.k === 'act') { action = mode.action; since = mode.t0; }
  return {pos, face, hidden, dead, action, since};
}

function pickSprite(arts: ArtMap, kind: string, action: string): string | null {
  for (const a of ORDER[action] ?? [action, 'idle']) if (arts[`${kind}-${a}`]) return `${kind}-${a}`;
  return null;
}

const frameOf = (art: Art, t: number, hold: boolean) => {
  const n = art.frames.length;
  const i = Math.floor(Math.max(0, t) * Math.max(1, art.fps));
  return hold ? Math.min(n - 1, i) : i % n;
};

/** Unit position (bottom-left, pixels) at time T, for effects that stick to a unit. */
export function unitPos(b: Battle, id: string, T: number): Pt | null {
  const u = b.units.find((x) => x.id === id);
  if (!u) return null;
  return unitRun(u, eventsFor(b, id), T).pos;
}

const eventsFor = (b: Battle, id: string) => b.script.filter((e) => e.unit === id).sort((a, c) => a.t - c.t);

export function battleAt(b: Battle, arts: ArtMap, T: number): BattleState {
  const view = viewPx(b), map = mapSize(b);
  const clamp = (p: Pt): Pt => [
    Math.max(0, Math.min(map.w * CELL - view.w, p[0])),
    Math.max(0, Math.min(map.h * CELL - view.h, p[1])),
  ];

  // Camera: a list of slides and follows, resolved in order.
  const camEvents = b.script.filter((e) => e.camera || e.follow).sort((a, c) => a.t - c.t);
  const centerOn = (id: string, t: number): Pt => {
    const p = unitPos(b, id, t) ?? [0, 0];
    return [p[0] + CELL / 2 - view.w / 2, p[1] - CELL / 2 - view.h / 2];
  };
  let cam: Pt = clamp(camEvents[0]?.camera ? px(camEvents[0].camera) : [0, 0]);
  let slide: {from: Pt; to: Pt; t0: number; dur: number} | null = null;
  let follow: string | null = null;
  const camNow = (t: number): Pt => {
    if (follow) return clamp(centerOn(follow, t));
    if (slide) { const k = slide.dur ? Math.max(0, Math.min(1, (t - slide.t0) / slide.dur)) : 1; return clamp([lerp(slide.from[0], slide.to[0], k), lerp(slide.from[1], slide.to[1], k)]); }
    return cam;
  };
  for (const e of camEvents) {
    if (e.t > T) break;
    cam = camNow(e.t);
    if (e.follow) { follow = e.follow; slide = null; }
    else if (e.camera) { follow = null; slide = {from: cam, to: px(e.camera), t0: e.t, dur: e.dur ?? 0}; }
  }
  const c = camNow(T);
  const camera = {x: Math.round(c[0]), y: Math.round(c[1])};

  // Units
  const units: UnitState[] = [];
  for (const u of b.units) {
    const run = unitRun(u, eventsFor(b, u.id), T);
    if (run.hidden) continue;
    const base = pickSprite(arts, u.kind, run.action);
    if (!base) continue;
    const k = colorKey(b, u), name = k && arts[`${base}__${k}`] ? `${base}__${k}` : base; // (its army's colors, from withColors)
    const art = arts[name];
    const frame = frameOf(art, T - run.since, run.dead || base.endsWith('-fall'));
    // Her drawings face left; facing right flips them.
    units.push({id: u.id, kind: u.kind, sprite: name, frame, x: Math.round(run.pos[0]), y: Math.round(run.pos[1]) - art.height + CELL,
      flip: run.face === 'right', dead: run.dead, w: art.width, h: art.height});
  }
  // Painter's order: the fallen first, then from the back (top of the screen) to the front.
  units.sort((a, d) => Number(d.dead) - Number(a.dead) || a.y + a.h - (d.y + d.h) || a.x - d.x);

  // Props
  const props = (b.props ?? []).flatMap((p) => {
    const art = arts[p.sprite];
    if (!art) return [];
    return [{sprite: p.sprite, frame: frameOf(art, T, false), x: Math.round(p.at[0] * CELL), y: Math.round(p.at[1] * CELL) - art.height + CELL, flip: p.face === 'right'}];
  });

  // One-shot effects
  const fx: FxState[] = [];
  for (const e of b.script) {
    if (!e.fx || e.t > T) continue;
    const name = `fx-${e.fx}`, art = arts[name];
    if (!art) continue;
    const len = e.dur ?? art.frames.length / Math.max(1, art.fps);
    if (T >= e.t + len) continue;
    const base = e.unit ? unitPos(b, e.unit, e.t) : e.at ? px(e.at) : null;
    if (!base) continue;
    fx.push({sprite: name, frame: Math.min(art.frames.length - 1, Math.floor((T - e.t) * art.fps)),
      x: Math.round(base[0] + (e.dx ?? 0)), y: Math.round(base[1] + (e.dy ?? 0)) - art.height + CELL});
  }

  // Caption: the latest `say` still showing.
  let say: BattleState['say'] = null;
  for (const e of b.script) if (e.say && e.t <= T && T < e.t + (e.dur ?? 3)) say = {text: e.say, who: e.who};

  // Name tags: over a unit (following it) or at a place, while their time lasts.
  const labels: BattleState['labels'] = [];
  for (const e of b.script) {
    if (!e.label || e.t > T || T >= e.t + (e.dur ?? 4)) continue;
    const u = e.unit ? units.find((x) => x.id === e.unit) : null;
    if (u) labels.push({text: e.label, x: u.x + u.w / 2, y: u.y});
    else if (e.at) labels.push({text: e.label, x: e.at[0] * CELL + CELL / 2, y: e.at[1] * CELL - (e.dy ?? 0)});
  }

  return {camera, units, props, fx, say, labels};
}

/** Everything a battle needs drawn: sprite names its tiles, props, units and effects can use. */
export function spriteNeeds(b: Battle): {names: string[]; kinds: string[]} {
  const names = new Set<string>(Object.values(b.tiles));
  for (const p of b.props ?? []) names.add(p.sprite);
  for (const e of b.script) if (e.fx) names.add(`fx-${e.fx}`);
  return {names: [...names], kinds: [...new Set(b.units.map((u) => u.kind))]};
}
