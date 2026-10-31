// Adds a PICO-8 web export (the .html and .js that `export blessed.html`
// makes) to a Ghost theme zip, under assets/games/, so the game is served
// from her own site at /assets/games/<name>.html. Writes a new zip beside
// the old one to upload in Ghost (Settings > Design > Change theme > Upload).
// Usage: npm run game-to-theme -- <theme.zip> <game.html>
//   e.g. npm run game-to-theme -- ~/Downloads/kids-theme.zip ~/Library/Application\ Support/pico-8/carts/blessed.html
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const [zip, html] = process.argv.slice(2);
if (!zip || !html) {
  console.error('usage: npm run game-to-theme -- <theme.zip> <game.html>');
  process.exit(1);
}
const js = html.replace(/\.html$/, '.js');
for (const f of [zip, html, js]) if (!fs.existsSync(f)) { console.error(`not found: ${f}`); process.exit(1); }

// unpack the theme, find its top folder (the one with package.json)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-'));
execFileSync('unzip', ['-q', zip, '-d', tmp]);
const find = (dir) => {
  if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
  for (const d of fs.readdirSync(dir, {withFileTypes: true})) {
    if (d.isDirectory() && d.name !== '__MACOSX') { const r = find(path.join(dir, d.name)); if (r) return r; }
  }
  return null;
};
const root = find(tmp);
if (!root) { console.error('no package.json in that zip: is it a Ghost theme?'); process.exit(1); }

const games = path.join(root, 'assets', 'games');
fs.mkdirSync(games, {recursive: true});
for (const f of [html, js]) fs.copyFileSync(f, path.join(games, path.basename(f)));

const out = zip.replace(/\.zip$/, '') + '-with-games.zip';
fs.rmSync(out, {force: true});
execFileSync('zip', ['-qr', path.resolve(out), '.', '-x', '*.DS_Store', '-x', '__MACOSX/*'], {cwd: root});
fs.rmSync(tmp, {recursive: true, force: true});
console.log(`wrote ${out}`);
console.log(`after uploading it in Ghost, the game is at /assets/games/${path.basename(html)}`);
