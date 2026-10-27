// Copies Shalone's drawings (sprites/<name>.json) into the PICO-8 cart's
// sprite sheet, per game/sprites.json. Colors snap to PICO-8's 16; "." stays
// see-through (color 0). Usage: npm run pico8 [-- game/blessed.p8]
import fs from 'node:fs';

const cart = process.argv[2] || 'game/blessed.p8';
const map = JSON.parse(fs.readFileSync('game/sprites.json', 'utf8'));

const PICO = ['000000', '1d2b53', '7e2553', '008751', 'ab5236', '5f574f', 'c2c3c7', 'fff1e8',
  'ff004d', 'ffa300', 'ffec27', '00e436', '29adff', '83769c', 'ff77a8', 'ffccaa'];
const rgb = (h) => [0, 2, 4].map((i) => parseInt(h.replace('#', '').slice(i, i + 2), 16));
const nearest = (hex) => {
  const c = rgb(hex);
  let best = 1, bd = Infinity;
  for (let i = 1; i < 16; i++) { // never 0: that one is see-through
    const p = rgb(PICO[i]);
    const d = (c[0] - p[0]) ** 2 * 2 + (c[1] - p[1]) ** 2 * 4 + (c[2] - p[2]) ** 2 * 3;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
};

const sheet = Array.from({ length: 128 }, () => Array(128).fill(0));
for (const [slot, name] of Object.entries(map)) {
  if (slot.startsWith('_')) continue;
  const file = `sprites/${name}.json`;
  if (!fs.existsSync(file)) { console.warn(`missing drawing: ${name}`); continue; }
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cols = s.palette.map(nearest);
  const cw = Math.ceil(s.width / 8);
  s.frames.forEach((rows, f) => {
    const n = Number(slot) + f * cw;
    const x0 = (n % 16) * 8, y0 = Math.floor(n / 16) * 8;
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== '.' && x0 + x < 128 && y0 + y < 128) sheet[y0 + y][x0 + x] = cols[parseInt(ch, 36)] ?? 0;
    }));
  });
  console.log(`slot ${slot}: ${name} (${s.width}x${s.height}, ${s.frames.length} frame${s.frames.length > 1 ? 's' : ''})`);
}

const gfx = sheet.map((r) => r.map((c) => c.toString(16)).join('')).join('\n');
const text = fs.readFileSync(cart, 'utf8');
const out = text.replace(/__gfx__\n[\s\S]*?(?=\n__\w+__|$)/, `__gfx__\n${gfx}`);
fs.writeFileSync(cart, out.endsWith('\n') ? out : out + '\n');
console.log(`wrote ${cart}`);
