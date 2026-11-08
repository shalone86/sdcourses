// Adds PICO-8 web exports (the .html and .js that `export blessed.html`
// makes) to a Ghost theme zip, under assets/games/, so each game is served
// from her own site at /assets/games/<name>.html, plus the "Game" page
// template from game/theme/ (custom-game.hbs, css/game.css, js/game.js).
// Writes a new zip beside the old one to upload in Ghost
// (Settings > Design > Change theme > Upload).
// Usage: npm run game-to-theme -- <theme.zip> <game.html>...
//   e.g. npm run game-to-theme -- ~/Downloads/kids-theme.zip ~/Library/Application\ Support/pico-8/carts/blessed.html
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const [zip, ...htmls] = process.argv.slice(2);
if (!zip || !htmls.length) {
  console.error('usage: npm run game-to-theme -- <theme.zip> <game.html>...');
  process.exit(1);
}
const games = htmls.flatMap((h) => [h, h.replace(/\.html$/, '.js')]);
for (const f of [zip, ...games]) if (!fs.existsSync(f)) { console.error(`not found: ${f}`); process.exit(1); }

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

const gamesDir = path.join(root, 'assets', 'games');
fs.mkdirSync(gamesDir, {recursive: true});
for (const f of games) fs.copyFileSync(f, path.join(gamesDir, path.basename(f)));
// PICO-8's shell keeps a 5% margin (95vw/95vh) and a grey page; inside the
// Game template's 512px screen that leaves a grey strip, so fill the frame.
for (const h of htmls) {
  const out = path.join(gamesDir, path.basename(h));
  fs.writeFileSync(out, fs.readFileSync(out, 'utf8')
    .replace('max-width:95vw; height:100vw; max-height:95vh;', 'max-width:100vw; height:100vw; max-height:100vh;')
    .replace('background-color:#222;', 'background-color:#000;'));
}
const template = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'game', 'theme');
fs.cpSync(template, root, {recursive: true});

const out = zip.replace(/\.zip$/, '') + '-with-games.zip';
fs.rmSync(out, {force: true});
execFileSync('zip', ['-qr', path.resolve(out), '.', '-x', '*.DS_Store', '-x', '__MACOSX/*'], {cwd: root});
fs.rmSync(tmp, {recursive: true, force: true});
console.log(`wrote ${out}`);
for (const h of htmls) console.log(`after uploading it in Ghost, the game is at /assets/games/${path.basename(h)}`);
console.log('pages show it with Template: Game, when the page slug is the game name');
