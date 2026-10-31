// Puts a 128x128 picture into a cart as its label (the picture on the
// .p8.png cartridge, in Splore and on the BBS). Colors snap to PICO-8's 16.
// Needs ffmpeg (as the studio's GIF export does).
// Usage: npm run pico8-label [-- game/label.png [game/blessed.p8]]
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const png = process.argv[2] || 'game/label.png';
const cart = process.argv[3] || 'game/blessed.p8';
const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', png, '-vf', 'scale=128:128:flags=neighbor',
  '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
const PICO = ['000000', '1d2b53', '7e2553', '008751', 'ab5236', '5f574f', 'c2c3c7', 'fff1e8',
  'ff004d', 'ffa300', 'ffec27', '00e436', '29adff', '83769c', 'ff77a8', 'ffccaa']
  .map((h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)));
const rows = [];
for (let y = 0; y < 128; y++) {
  let row = '';
  for (let x = 0; x < 128; x++) {
    const o = (y * 128 + x) * 3;
    let best = 0, bd = Infinity;
    PICO.forEach((p, i) => {
      const d = (raw[o] - p[0]) ** 2 + (raw[o + 1] - p[1]) ** 2 + (raw[o + 2] - p[2]) ** 2;
      if (d < bd) { bd = d; best = i; }
    });
    row += best.toString(16);
  }
  rows.push(row);
}
let text = fs.readFileSync(cart, 'utf8');
const block = `__label__\n${rows.join('\n')}`;
const re = /__label__\n[\s\S]*?(?=\n__\w+__|$)/;
// PICO-8 keeps the label right after the graphics
text = text.replace(re, '').replace(/\n+(?=__gfx__)/, '\n');
text = text.replace(/(__gfx__\n[\s\S]*?)(?=\n__\w+__|$)/, `$1\n${block}`);
fs.writeFileSync(cart, text);
console.log(`label from ${png} written into ${cart}`);
