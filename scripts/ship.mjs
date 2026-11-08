// Copies the exported game carts to her devices (handheld, arcade,
// laptop) over ssh, in one go. The devices and which carts each gets
// are in game/devices.json (copy game/devices.example.json; it stays
// on her computer, not in the repo). See game/SHIP.md.
//
// Usage: npm run ship                 every device
//        npm run ship -- arcade       only devices whose name has "arcade"
//        npm run ship -- --dry        show what would be copied
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const cfgFile = path.join(root, 'game', 'devices.json');
if (!fs.existsSync(cfgFile)) {
  console.error('No game/devices.json yet: copy game/devices.example.json to game/devices.json and fill it in (see game/SHIP.md).');
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const only = args.filter((a) => !a.startsWith('--')).map((a) => a.toLowerCase());

// PICO-8's carts folder, where `save blessed.p8.png` puts the carts
const home = os.homedir();
const carts = cfg.carts || {
  darwin: path.join(home, 'Library', 'Application Support', 'pico-8', 'carts'),
  win32: path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'pico-8', 'carts'),
}[process.platform] || path.join(home, '.lexaloffle', 'pico-8', 'carts');

// the -release cart each export comes from: if the repo's is newer,
// she probably forgot to save the cart again in PICO-8
const from = {
  'blessed.p8.png': 'game/blessed-release.p8', 'blessed4.p8.png': 'game/blessed4-release.p8',
  'candles.p8.png': 'game/nuns/nuns-release.p8', 'candles4.p8.png': 'game/nuns/nuns4-release.p8',
};

let bad = 0;
for (const d of cfg.devices) {
  if (only.length && !only.some((w) => d.name.toLowerCase().includes(w))) continue;
  const files = [];
  for (const f of d.files) {
    const p = path.join(carts, f);
    if (!fs.existsSync(p)) { console.log(`  ! ${f} isn't in ${carts} (save it in PICO-8 first)`); bad++; continue; }
    const src = from[f] && path.join(root, from[f]);
    if (src && fs.existsSync(src) && fs.statSync(src).mtimeMs > fs.statSync(p).mtimeMs + 60000)
      console.log(`  ! ${f} is older than ${from[f]}: load it in PICO-8 and save ${f} again?`);
    files.push(p);
  }
  if (!files.length) continue;
  console.log(`${d.name}: ${files.map((f) => path.basename(f)).join(', ')} -> ${d.host}:${d.dir}`);
  if (dry) continue;
  const r = spawnSync('scp', [...(d.scp || []), ...files, `${d.host}:${d.dir}/`], { stdio: 'inherit' });
  if (r.status !== 0) { console.log(`  ! couldn't copy to ${d.name} (is it on and on the Wi-Fi?)`); bad++; }
  else console.log('  done');
}
if (bad) process.exit(1);
