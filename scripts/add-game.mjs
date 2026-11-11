// Puts a PICO-8 web game online on Pico Parish, where the kids site's Game pages show it.
// Usage: npm run add-game -- <carts folder>/blessed.html [more.html...]
// Each <name>.html and its <name>.js (from PICO-8's `export <name>.html`) go to Pico Parish's play/
// folder, with the screen filling its frame (PICO-8 leaves a grey 5% margin) and ?autoplay starting it; then it is committed,
// put online (picoparish.com/play/<name>) and pushed. The kids site needs only a page with slug <name>
// and Template: Game (game/WEBSITE.md).
// A game with no trailer yet gets a stand-in one (scripts/trailer.mjs: a bot plays 10 seconds) as
// games/<name>.gif, so its card is never empty; she replaces it in the Studio (Pico Parish tab →
// Record a trailer). A trailer she made is never replaced.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import './lib.mjs';
import {siteDir, saveGif} from './picoparish.mjs';
import {autoTrailer} from './trailer.mjs';

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
    .replace('background-color:#222;', 'background-color:#000; overflow:hidden;')
    // picoparish.com starts the game right on its card (play/<name>?autoplay=1) after a click there
    .replace('var p8_autoplay = false;', 'var p8_autoplay = /[?&]autoplay/.test(location.search);')
    // and with sound at once: the sound player the click on the card made (template.html playHere)
    .replace('\tvar pico8_audio_context;\n', '\tvar pico8_audio_context;\n\ttry { if (/[?&]autoplay/.test(location.search) && parent !== window && parent.__p8audio) pico8_audio_context = parent.__p8audio; } catch (e) {}\n')
    .replace('\tif (p8_autoplay)\n\t{\n\t\tvar temp_context', '\tif (p8_autoplay && pico8_audio_context) p8_run_cart();\n\telse if (p8_autoplay)\n\t{\n\t\tvar temp_context'));
  fs.copyFileSync(js, path.join(play, path.basename(js)));
}
const names = htmls.map((h) => path.basename(h, '.html'));
// The computer versions, if PICO-8 made them (`export <name>.bin`, and `<name>4.bin` for a 4-player
// edition): their zips go to Pico Parish's downloads/<name>/, shown on the game's own page.
for (const h of htmls) {
  const n = path.basename(h, '.html');
  for (const base of [n, n + '4']) {
    const bin = path.join(path.dirname(h), base + '.bin');
    if (!fs.existsSync(bin)) continue;
    fs.mkdirSync(path.join(dir, 'downloads', n), {recursive: true});
    for (const z of fs.readdirSync(bin).filter((f) => /_(windows|osx|linux|raspi)\.zip$/.test(f))) fs.copyFileSync(path.join(bin, z), path.join(dir, 'downloads', n, z));
    console.log(`Downloads: ${base}.bin → downloads/${n}/`);
  }
}
const catFile = path.join(dir, 'catalog.json');
const catalog = JSON.parse(fs.readFileSync(catFile, 'utf8'));
for (const n of names) {
  const item = (catalog.items || []).find((i) => i.id === n);
  if (!fs.existsSync(path.join(dir, 'games', n + '.gif'))) {
    console.log(`Making a stand-in trailer for ${n} (a bot plays it for a few seconds)…`);
    try { saveGif(n, await autoTrailer(n, {playDir: play})); } catch (e) { console.warn(`No trailer for ${n}: ${e.message}`); }
  }
  if (item && !item.gif && fs.existsSync(path.join(dir, 'games', n + '.gif'))) item.gif = `games/${n}.gif`;
  if (item && !item.url) item.url = `/games/${n}`;
  if (!item) console.log(`Note: Pico Parish has no game "${n}" yet. Add it in the Studio's Pico Parish tab (its id must be "${n}") and it plays on its card.`);
}
fs.writeFileSync(catFile, JSON.stringify(catalog, null, 2) + '\n');
const git = (...a) => execFileSync('git', ['-C', dir, ...a], {encoding: 'utf8'});
git('add', 'play', 'games', 'downloads', 'catalog.json');
if (git('status', '--porcelain', '--', 'play', 'games', 'downloads', 'catalog.json').trim()) git('commit', '-qm', `Games: ${names.join(', ')}`);
execFileSync('node', [path.join(dir, 'deploy.mjs')], {stdio: 'inherit'});
try { git('push', '-q'); } catch (e) { console.warn('Not pushed:', e.message); }
for (const n of names) console.log(`Online: https://picoparish.com/play/${n}  (kids site: a page with slug "${n}", Template: Game)`);
