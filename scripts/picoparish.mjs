// Pico Parish (picoparish.com) for the Lesson Studio's Pico Parish tab.
// The site is its own folder and git repo (PICOPARISH_DIR in .env, else the usual places):
// catalog.json holds everything she edits (the games, videos, books and comics in "items", and the
// page's own choices in "page"); its build.mjs turns template.html + catalog.json + her drawings
// into index.html. Saving here writes catalog.json, builds, and commits in that repo.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';

const run = promisify(execFile);

export function siteDir() {
  const tries = [process.env.PICOPARISH_DIR, path.join(os.homedir(), 'Projects/picoparish'), path.join(os.homedir(), '.gemini/antigravity/scratch/picoparish')];
  const dir = tries.find((d) => d && fs.existsSync(path.join(d, 'catalog.json')) && fs.existsSync(path.join(d, 'build.mjs')));
  if (!dir) throw new Error('Pico Parish folder not found. Set PICOPARISH_DIR in .env to its folder.');
  return dir;
}

// The site's own scripts, loaded fresh each time so edits to them count without a restart.
const load = (dir, file) => import(pathToFileURL(path.join(dir, file)).href + '?t=' + Date.now());

export function siteState() {
  const dir = siteDir();
  const catalog = JSON.parse(fs.readFileSync(path.join(dir, 'catalog.json'), 'utf8'));
  const gamesDir = path.join(dir, 'games');
  const gifs = fs.existsSync(gamesDir) ? fs.readdirSync(gamesDir).filter((f) => f.endsWith('.gif')).map((f) => 'games/' + f) : [];
  const built = fs.existsSync(path.join(dir, 'index.html')) ? fs.statSync(path.join(dir, 'index.html')).mtimeMs : 0;
  return {dir, catalog, gifs, built};
}

export async function saveSite(catalog) {
  const dir = siteDir();
  const {validate} = await load(dir, 'validate-catalog.mjs');
  const check = validate(catalog);
  if (!check.ok) throw new Error(check.fatal);
  fs.writeFileSync(path.join(dir, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  const {build} = await load(dir, 'build.mjs');
  const result = build();
  const committed = await commit(dir, 'Pico Parish: update from the Lesson Studio');
  return {...result, committed, state: siteState()};
}

async function commit(dir, message) {
  try {
    await run('git', ['-C', dir, 'add', 'catalog.json', 'index.html', 'games']);
    const {stdout} = await run('git', ['-C', dir, 'status', '--porcelain', '--', 'catalog.json', 'index.html', 'games']);
    if (!stdout.trim()) return false;
    await run('git', ['-C', dir, 'commit', '-q', '-m', message, '--', 'catalog.json', 'index.html', 'games']);
    return true;
  } catch { return false; }
}

/** A gameplay GIF for one entry, saved as games/<id>.gif. */
export function saveGif(id, buf) {
  const slug = String(id).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  if (!slug) throw new Error('That entry has no id yet');
  if (buf.subarray(0, 4).toString('latin1') !== 'GIF8') throw new Error('That file isn\'t a GIF');
  const dir = siteDir();
  fs.mkdirSync(path.join(dir, 'games'), {recursive: true});
  fs.writeFileSync(path.join(dir, 'games', slug + '.gif'), buf);
  return 'games/' + slug + '.gif';
}

/** Every link on the page (not hidden ones), opened to see whether it still works. */
export async function checkLinks(catalog) {
  const links = [];
  if (catalog.site?.imprintUrl) links.push({id: 'imprint', title: 'Cyril & Methodius Media link', url: catalog.site.imprintUrl});
  for (const i of catalog.items || []) if (i && i.status !== 'hidden' && /^https?:\/\//.test(i.url || '')) links.push({id: i.id, title: i.title, url: i.url});
  return Promise.all(links.map(async (l) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 10000);
    try {
      let r = await fetch(l.url, {method: 'HEAD', redirect: 'follow', signal: ctl.signal});
      if (r.status === 405 || r.status === 403) r = await fetch(l.url, {redirect: 'follow', signal: ctl.signal});
      return {...l, status: r.status, ok: r.ok};
    } catch (e) {
      return {...l, status: 0, ok: false, error: e.name === 'AbortError' ? 'no answer' : 'could not open'};
    } finally { clearTimeout(timer); }
  }));
}

/** The built page and its GIFs, for the preview. */
export function siteFile(rel) {
  const dir = siteDir();
  if (rel === '' || rel === 'index.html') return path.join(dir, 'index.html');
  if (/^games\/[a-z0-9-]+\.gif$/.test(rel)) return path.join(dir, rel);
  return null;
}
