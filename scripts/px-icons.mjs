// Makes studio/px-icons.js: the few Lucide icons the phone pixel editor uses, as SVG text
// (so the drawing page needs no icon route). Run again after adding a name: node scripts/px-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {icons} from 'lucide-react';
import {ROOT} from './lib.mjs';

const NAMES = {pen: 'Pencil', dither: 'Grip', erase: 'Eraser', fill: 'PaintBucket', line: 'Slash', box: 'Square', circle: 'Circle',
  select: 'SquareDashed', pick: 'Pipette', words: 'Type', undo: 'Undo2', mirror: 'FlipHorizontal2', every: 'Layers', filled: 'SquareSquare',
  copy: 'Copy', cut: 'Scissors', paste: 'ClipboardPaste', flipH: 'FlipHorizontal', flipV: 'FlipVertical', play: 'Play', pause: 'Pause',
  menu: 'Wrench', plus: 'Plus', save: 'Save', saved: 'Check', palette: 'Palette', home: 'House', close: 'X', fit: 'Scan', insert: 'ImagePlus', done: 'Check'};
const out = {};
for (const [k, n] of Object.entries(NAMES)) {
  if (!icons[n]) throw new Error('No Lucide icon ' + n);
  out[k] = renderToStaticMarkup(createElement(icons[n], {size: 26, strokeWidth: 2})).replace(/ class="[^"]*"/, '');
}
fs.writeFileSync(path.join(ROOT, 'studio/px-icons.js'), '// Made by scripts/px-icons.mjs (Lucide icons, ISC license). Don\'t edit by hand.\nwindow.PxIcons = ' + JSON.stringify(out, null, 0) + ';\n');
console.log(Object.keys(out).length, 'icons');
