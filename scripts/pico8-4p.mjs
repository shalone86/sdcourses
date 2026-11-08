// Makes the 4-player cart from the 1-player one: game/blessed.p8 ->
// (or game/nuns/nuns.p8 -> nuns4.p8, the same way)
// game/blessed4.p8. In blessed.p8, lines ending in "--1p" are only in the
// 1-player cart (the 4-player one leaves them out: spring rain, winter
// snow, the title's falling grace, the time-lost line), and lines starting
// "--4p " are only in the 4-player cart (a comment in the 1-player one,
// so they cost it nothing). Everything else (sprites, music, saves) is
// shared; both carts keep the same high scores and unlocks.
// Usage: npm run pico8-4p
import fs from 'node:fs';

const src = process.argv[2] || 'game/blessed.p8';
const dest = src.replace(/\.p8$/, '4.p8');
const text = fs.readFileSync(src, 'utf8');
const [head, rest] = text.split('__lua__\n');
const i = rest.search(/\n__\w+__\n/);
const lua = rest.slice(0, i).split('\n')
  .filter((line) => !/--1p\s*$/.test(line))
  .map((line) => line.replace(/^--4p ?/, ''));
fs.writeFileSync(dest, `${head}__lua__\n${lua.join('\n')}${rest.slice(i)}`);
console.log(`wrote ${dest}`);
