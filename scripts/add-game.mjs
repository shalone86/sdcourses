// Puts a PICO-8 web game online on Pico Parish, where the kids site's Game pages show it.
// Usage: npm run add-game -- <carts folder>/blessed.html [more.html...]
// Each <name>.html and its <name>.js (from PICO-8's `export <name>.html`) go to Pico Parish's play/
// folder, with the screen filling its frame (PICO-8 leaves a grey 5% margin); then it is committed,
// put online (picoparish.com/play/<name>) and pushed. The kids site needs only a page with slug <name>
// and Template: Game (game/WEBSITE.md).
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import './lib.mjs';
import {siteDir} from './picoparish.mjs';

const htmls = process.argv.slice(2);
if (!htmls.length) { console.error('usage: npm run add-game -- <game.html>...'); process.exit(1); }
const dir = siteDir();
const play = path.join(dir, 'play');
fs.mkdirSync(play, {recursive: true});
for (const h of htmls) {
  const js = h.replace(/\.html$/, '.js');
  for (const f of [h, js]) if (!fs.existsSync(f)) { console.error(`not found: ${f}`); process.exit(1); }
  fs.writeFileSync(path.join(play, path.basename(h)), fs.readFileSync(h, 'utf8')
    .replace('max-width:95vw; height:100vw; max-height:95vh;', 'max-width:100vw; height:100vw; max-height:100vh;')
    .replace('background-color:#222;', 'background-color:#000; overflow:hidden;'));
  fs.copyFileSync(js, path.join(play, path.basename(js)));
}
const names = htmls.map((h) => path.basename(h, '.html'));
const git = (...a) => execFileSync('git', ['-C', dir, ...a], {encoding: 'utf8'});
git('add', 'play');
if (git('status', '--porcelain', '--', 'play').trim()) git('commit', '-qm', `Games: ${names.join(', ')}`);
execFileSync('node', [path.join(dir, 'deploy.mjs')], {stdio: 'inherit'});
try { git('push', '-q'); } catch (e) { console.warn('Not pushed:', e.message); }
for (const n of names) console.log(`Online: https://picoparish.com/play/${n}  (kids site: a page with slug "${n}", Template: Game)`);
