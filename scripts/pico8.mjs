// Copies Shalone's drawings (sprites/<name>.json) into the PICO-8 cart's
// sprite sheet, per game/sprites.json, and writes the cart's `parts` and
// `tops` tables (which colors to swap for each person's, priest's and
// deacon's look). Colors snap to
// PICO-8's 16 unless sprites.json's `colors` says otherwise; "." stays
// see-through (color 0). Usage: npm run pico8 [-- game/blessed.p8]
import fs from 'node:fs';

const cart = process.argv[2] || 'game/blessed.p8';
const cfg = JSON.parse(fs.readFileSync('game/sprites.json', 'utf8'));
const force = Object.fromEntries(Object.entries(cfg.colors || {}).map(([h, n]) => [h.toUpperCase(), n]));

const PICO = ['000000', '1d2b53', '7e2553', '008751', 'ab5236', '5f574f', 'c2c3c7', 'fff1e8',
  'ff004d', 'ffa300', 'ffec27', '00e436', '29adff', '83769c', 'ff77a8', 'ffccaa'];
const rgb = (h) => [0, 2, 4].map((i) => parseInt(h.replace('#', '').slice(i, i + 2), 16));
const nearest = (hex) => {
  if (hex.toUpperCase() in force) return force[hex.toUpperCase()];
  const c = rgb(hex);
  let best = 1, bd = Infinity;
  for (let i = 1; i < 16; i++) { // never 0: that one is see-through
    const p = rgb(PICO[i]);
    const d = (c[0] - p[0]) ** 2 * 2 + (c[1] - p[1]) ** 2 * 4 + (c[2] - p[2]) ** 2 * 3;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
};

const text = fs.readFileSync(cart, 'utf8');
const old = (text.match(/__gfx__\n([0-9a-f\n]*)/) || [])[1]?.split('\n').filter(Boolean) || [];
const sheet = Array.from({ length: 128 }, (_, y) =>
  Array.from({ length: 128 }, (_, x) => parseInt(old[y]?.[x] || '0', 16)));
for (const [slot, name] of Object.entries(cfg.slots)) {
  const file = `sprites/${name}.json`;
  if (!fs.existsSync(file)) { console.warn(`missing drawing: ${name}`); continue; }
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cols = s.palette.map(nearest);
  const cw = Math.ceil(s.width / 8);
  s.frames.forEach((rows, f) => {
    const n = Number(slot) + f * cw;
    const x0 = (n % 16) * 8, y0 = Math.floor(n / 16) * 8;
    for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++)
      if (y0 + y < 128 && x0 + x < 128) sheet[y0 + y][x0 + x] = 0;
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== '.' && x0 + x < 128 && y0 + y < 128) sheet[y0 + y][x0 + x] = cols[parseInt(ch, 36)] ?? 0;
    }));
  });
  console.log(`slot ${slot}: ${name} (${s.width}x${s.height}, ${s.frames.length} frame${s.frames.length > 1 ? 's' : ''})`);
}

// parts: per group (people, priest, deacon), which PICO-8 colors the
// game swaps. Two different kinds on one color can't be told apart.
const groups = [];
for (const [group, hexes] of Object.entries(cfg.parts || {})) {
  const parts = {};
  for (const [hex, kind] of Object.entries(hexes)) {
    const n = nearest(hex);
    if (parts[n] && parts[n] !== kind) console.warn(`${group}: ${parts[n]} and ${kind} both became PICO-8 color ${n}; set one in "colors"`);
    parts[n] = kind;
  }
  groups.push(`${group}={${Object.entries(parts).map(([n, k]) => `[${n}]="${k}"`).join(',')}}`);
}
const partsLua = `parts={\n ${groups.join(',\n ')},\n}`;

// tops: the top-of-head color of each listed people slot (the most
// used color in its first row), so a person can wear it as hair or a hat
const tops = [];
for (const slot of cfg.tops || []) {
  const s = JSON.parse(fs.readFileSync(`sprites/${cfg.slots[slot]}.json`, 'utf8'));
  const count = {};
  for (const ch of s.frames[0][0]) if (ch !== '.') count[ch] = (count[ch] || 0) + 1;
  const ch = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
  if (ch !== undefined) tops.push(`[${slot}]=${nearest(s.palette[parseInt(ch, 36)])}`);
}
const topsLua = `tops={${tops.join(',')}}`;

// big: her 32x32 art. The first 8 go on the bottom half of the sprite
// sheet (sprites 128-255; the game reads only the top half of the map, so
// nothing else uses it). The rest don't fit, so they go in the code as one
// run-length string (each character: a color and a run of 1-4 pixels, 1024
// pixels per picture), unpacked at start into extra sprite sheets in upper
// memory.
const ALPHA = '0123456789abcdefghijklmnopqrstuvwxyz!#$%&()*+,-./:;<=>?@[]^_{|}~';
let bigLua = 'bigart=""';
if (cfg.big?.length) {
  let art = '';
  cfg.big.forEach((name, i) => {
    const s = JSON.parse(fs.readFileSync(`sprites/${name}.json`, 'utf8'));
    if (s.width !== 32 || s.height !== 32) throw new Error(`${name} is ${s.width}x${s.height}; big art must be 32x32`);
    const cols = s.palette.map(nearest);
    const px = s.frames[0].flatMap((row) => [...row].map((ch) => (ch === '.' ? 0 : cols[parseInt(ch, 36)] ?? 0)));
    if (i < 8) {
      const x0 = (i % 4) * 32, y0 = 64 + Math.floor(i / 4) * 32;
      px.forEach((c, k) => { sheet[y0 + Math.floor(k / 32)][x0 + (k % 32)] = c; });
      return;
    }
    for (let k = 0; k < px.length;) {
      let n = 1;
      while (n < 4 && px[k + n] === px[k]) n++;
      art += ALPHA[px[k] * 4 + n - 1];
      k += n;
    }
  });
  // the game refers to them by number, in this order
  bigLua = `bigart="${art}"`;
  console.log(`big art: ${Math.min(8, cfg.big.length)} on the sprite sheet, ${Math.max(0, cfg.big.length - 8)} in the code (${art.length} characters)`);
}

const gfx = sheet.map((r) => r.map((c) => c.toString(16)).join('')).join('\n');
const out = text.replace(/(-- @parts.*\n)[\s\S]*?(?=-- @end)/, `$1${partsLua}\n${topsLua}\n`)
  .replace(/(-- @big.*\n)[\s\S]*?(?=-- @end big)/, `$1${bigLua}\n`).replace(/__gfx__\n[\s\S]*?(?=\n__\w+__|$)/, `__gfx__\n${gfx}`);
fs.writeFileSync(cart, out.endsWith('\n') ? out : out + '\n');
console.log(`wrote ${cart}`);
