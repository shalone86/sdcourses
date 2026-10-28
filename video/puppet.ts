// The keyboard puppet (PUPPET.md): her key presses, recorded against the video in the
// studio's Timing tab, replayed into what the character is doing at any frame. Used by the
// Puppet scene, so the studio preview and the render agree exactly.
//
// A recording is a list of [frame, key, down] (frame from the scene's start, down 1/0).
// Keys: left, right (walk; shift held = run), up (look up), down (bow, once), p (point; the
// item appears beside the character), t (talk), a (pray), x (sign of the cross, once),
// b (blessing), k (kneel: stays down while held), i (next item).
import type {Art} from './scenes/Sprite';

export type PuppetEvent = [number, string, 0 | 1];

// Drawings are `<character>-<action>`; side views face left (right is a flip).
export const ACTIONS = ['idle', 'idle-front', 'walk', 'run', 'point', 'look-up', 'talk', 'pray', 'cross', 'bow', 'blessing', 'kneel'] as const;
export type Action = (typeof ACTIONS)[number];
const SIDE: Action[] = ['idle', 'walk', 'run', 'point', 'look-up'];
const ONCE: Record<string, Action> = {x: 'cross', down: 'bow'};
const HELD: Record<string, Action> = {p: 'point', up: 'look-up', t: 'talk', a: 'pray', b: 'blessing', k: 'kneel'};
// Held poses that play through and stay on their last drawing (the rest loop).
const STAY: Action[] = ['kneel'];
// What to show when a drawing is missing.
const FALLBACK: Partial<Record<Action, Action[]>> = {
  'idle-front': ['idle'], run: ['walk', 'idle'], walk: ['idle'], 'look-up': ['idle'], point: ['idle'],
  talk: ['idle-front', 'idle'], pray: ['idle-front', 'idle'], cross: ['pray', 'idle-front', 'idle'], bow: ['idle-front', 'idle'],
  blessing: ['idle-front', 'idle'], kneel: ['idle-front', 'idle'],
};

export type PuppetState = {action: Action; frame: number; x: number; facing: -1 | 1; flip: boolean; item: number; showItem: boolean; since: number};

/** Which drawing stands in for an action (its own, else the nearest one she has drawn). */
export function pick(actions: Partial<Record<Action, Art>>, a: Action): Action | null {
  for (const x of [a, ...(FALLBACK[a] ?? []), 'idle' as Action]) if (actions[x]) return x;
  const any = Object.keys(actions)[0];
  return (any as Action) ?? null;
}

/**
 * The puppet at frame `f`. x is in pixels from the left of the room it walks in; it starts at
 * `x0` and stays between `minX` and `maxX`. Speeds are pixels per second.
 */
export function puppetAt(events: PuppetEvent[], f: number, fps: number, actions: Partial<Record<Action, Art>>,
  {x0, minX, maxX, walk = 260, run = 560}: {x0: number; minX: number; maxX: number; walk?: number; run?: number}): PuppetState {
  const held = new Map<string, number>(); // key → frame pressed
  let x = x0, facing: -1 | 1 = -1, moved = false, item = 0;
  let once: {a: Action; at: number} | null = null;
  let last = 0;
  const lenOf = (a: Action) => { const p = pick(actions, a); const art = p ? actions[p] : null; return art ? Math.max(1, Math.round((art.frames.length / Math.max(1, art.fps)) * fps)) : fps; };
  const dirOf = () => {
    // The direction key pressed last wins while both are held.
    const l = held.get('left'), r = held.get('right');
    return l == null && r == null ? 0 : r == null || (l != null && l > r) ? -1 : 1;
  };
  const step = (to: number) => {
    const d = dirOf();
    if (d && !(once && to - once.at < lenOf(once.a))) {
      x = Math.max(minX, Math.min(maxX, x + d * (held.has('shift') ? run : walk) * ((to - last) / fps)));
      moved = true;
    }
    last = to;
  };
  for (const [at, k, down] of [...events].sort((a, b) => a[0] - b[0])) {
    if (at > f) break;
    step(at);
    if (down) {
      if (held.has(k)) continue;
      held.set(k, at);
      if (k === 'left') facing = -1;
      if (k === 'right') facing = 1;
      if (k === 'i') item++;
      if (ONCE[k]) once = {a: ONCE[k], at};
    } else held.delete(k);
  }
  step(f);

  let action: Action;
  let since = 0; // frame its animation started
  const d = dirOf();
  if (once && f - once.at < lenOf(once.a)) { action = once.a; since = once.at; }
  else if (d) action = held.has('shift') ? 'run' : 'walk';
  else {
    const pose = [...held.entries()].filter(([k]) => HELD[k]).sort((a, b) => b[1] - a[1])[0];
    action = pose ? HELD[pose[0]] : moved ? 'idle' : 'idle-front';
    if (pose) since = pose[1];
  }
  const shown = pick(actions, action) ?? action;
  const art = actions[shown];
  const n = art?.frames.length ?? 1;
  const t = (f - since) / fps;
  // Once-only actions (and kneeling) play through and stop on their last drawing; the rest loop.
  const frame = ONCE.x === action || ONCE.down === action || STAY.includes(action) ? Math.min(n - 1, Math.floor(t * (art?.fps ?? 4))) : Math.floor(t * (art?.fps ?? 4)) % n;
  return {action: shown, frame, x, facing, flip: SIDE.includes(shown) && facing === 1, item, showItem: action === 'point', since};
}
