// Makes a copy of a cart for publishing (BBS, .p8.png, web export) with the
// code's comments and blank lines removed: PICO-8 limits the packed size of
// the code, and comments count against it. The game itself is unchanged.
// Usage: npm run pico8-release [-- game/blessed.p8]  ->  game/blessed-release.p8
import fs from 'node:fs';

const cart = process.argv[2] || 'game/blessed.p8';
const text = fs.readFileSync(cart, 'utf8');
const [head, rest] = text.split('__lua__\n');
const i = rest.search(/\n__\w+__\n/);
const lua = rest.slice(0, i), tail = rest.slice(i);
const out = [];
for (const line of lua.split('\n')) {
  if (line === '-->8') { out.push(line); continue; } // code tab breaks stay
  let code = '', inStr = false;
  for (let k = 0; k < line.length; k++) {
    const ch = line[k];
    if (ch === '"' && line[k - 1] !== '\\') inStr = !inStr;
    if (!inStr && ch === '-' && line[k + 1] === '-') break;
    code += ch;
  }
  code = code.trimEnd();
  if (code.trim()) out.push(code);
}
// the first two lines show on the cart label: title and author
const label = '-- blessed!\n-- by shalone cason\n';
const dest = cart.replace(/\.p8$/, '-release.p8');
fs.writeFileSync(dest, `${head}__lua__\n${label}${out.join('\n')}${tail}`);
console.log(`wrote ${dest}: code ${lua.length} -> ${out.join('\n').length} characters`);
