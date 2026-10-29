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
