// Trailer GIFs for the PICO-8 games on Pico Parish (games/<id>.gif, shown on each game's card).
//   framesToGif(pixels)  the recorded frames (studio/trailer-capture.js) → a 256 × 256 GIF, like PICO-8's own
//   autoTrailer(id)      a stand-in made without her: the game runs in a hidden Chrome (Remotion's), a bot
//                        presses the buttons, and 10 seconds of it become the GIF. She can replace it with
//                        one she plays (Pico Parish tab → Record a trailer).
// Usage: node scripts/trailer.mjs <id> [out.gif]   (writes games/<id>.gif in the Pico Parish folder if no out)
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn, execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIZE = 128;

/** RGBA frames (128 × 128 each, one after another) → GIF bytes, doubled to 256 × 256 with sharp pixels. */
export async function framesToGif(pixels, fps = 30) {
  const one = SIZE * SIZE * 4;
  const n = Math.floor(pixels.length / one);
  if (n < fps) throw new Error('Not enough of the game was recorded yet (under a second). Play a little longer.');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trailer-'));
  try {
    fs.writeFileSync(path.join(tmp, 'frames.rgba'), Buffer.from(pixels.buffer, pixels.byteOffset, n * one));
    await promisify(execFile)('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${SIZE}x${SIZE}`, '-r', String(fps),
      '-i', path.join(tmp, 'frames.rgba'),
      '-vf', 'scale=256:256:flags=neighbor,split[a][b];[a]palettegen=max_colors=32:stats_mode=full[p];[b][p]paletteuse=dither=none',
      '-loop', '0', path.join(tmp, 'out.gif')], {maxBuffer: 1e7});
    return fs.readFileSync(path.join(tmp, 'out.gif'));
  } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
}

const chromePath = () => {
  const base = path.join(ROOT, 'node_modules/.remotion/chrome-headless-shell');
  const found = fs.existsSync(base) && fs.readdirSync(base, {recursive: true}).find((f) => path.basename(f) === 'chrome-headless-shell' || path.basename(f) === 'chrome-headless-shell.exe');
  const p = process.env.REMOTION_BROWSER || (found && path.join(base, found));
  if (!p || !fs.existsSync(p)) throw new Error('No Chrome for trailers yet: run `npm run render` once (Remotion downloads it), or set REMOTION_BROWSER.');
  return p;
};

/** Serves a folder on 127.0.0.1 at a free port. */
function serve(dir) {
  const types = {'.html': 'text/html', '.js': 'text/javascript'};
  const server = http.createServer((req, res) => {
    const f = path.join(dir, path.basename(decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {'Content-Type': types[path.extname(f)] || 'application/octet-stream'});
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

/** A tiny DevTools connection to one page. */
async function openPage(chrome) {
  const proc = spawn(chrome, ['--remote-debugging-port=0', '--autoplay-policy=no-user-gesture-required', '--mute-audio',
    '--no-first-run', '--window-size=600,600', `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'trailer-chrome-'))}`, 'about:blank'],
  {stdio: ['ignore', 'ignore', 'pipe']});
  const wsUrl = await new Promise((ok, no) => {
    let err = '';
    const t = setTimeout(() => no(new Error('Chrome did not start')), 20000);
    proc.stderr.on('data', (d) => { err += d; const m = /DevTools listening on (ws:\S+)/.exec(err); if (m) { clearTimeout(t); ok(m[1]); } });
    proc.on('exit', () => no(new Error('Chrome stopped: ' + err.slice(-300))));
  });
  const ws = new WebSocket(wsUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = () => no(new Error('Could not reach Chrome')); });
  let id = 0;
  const waiting = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.error ? w.no(new Error(m.error.message)) : w.ok(m.result); }
  };
  const send = (method, params = {}, sessionId) => new Promise((ok, no) => {
    const n = ++id; waiting.set(n, {ok, no}); ws.send(JSON.stringify({id: n, method, params, sessionId}));
  });
  const {targetInfos} = await send('Target.getTargets');
  const page = targetInfos.find((t) => t.type === 'page');
  const {sessionId} = await send('Target.attachToTarget', {targetId: page.targetId, flatten: true});
  const s = (method, params) => send(method, params, sessionId);
  await s('Page.enable'); await s('Runtime.enable');
  const evaluate = async (expression) => {
    const r = await s('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  return {s, evaluate, close: () => { try { ws.close(); } catch {} proc.kill(); }};
}

const KEYS = {left: ['ArrowLeft', 37], up: ['ArrowUp', 38], right: ['ArrowRight', 39], down: ['ArrowDown', 40], o: ['z', 90], x: ['x', 88]};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The stand-in trailer: a bot plays `id` (play/<id>.html in the Pico Parish folder) and 10 seconds are kept. */
export async function autoTrailer(id, {playDir, seconds = 10, warmup = 5, seed = 1} = {}) {
  const dir = playDir || path.join((await import('./picoparish.mjs')).siteDir(), 'play');
  if (!fs.existsSync(path.join(dir, id + '.html'))) throw new Error(`No play/${id}.html to record`);
  const server = await serve(dir);
  const page = await openPage(chromePath());
  let rnd = seed;
  const rand = () => ((rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const key = async (k, down) => {
    const [name, code] = KEYS[k];
    await page.s('Input.dispatchKeyEvent', {type: down ? 'keyDown' : 'keyUp', key: name, code: name.length > 1 ? name : 'Key' + name.toUpperCase(), windowsVirtualKeyCode: code, nativeVirtualKeyCode: code});
  };
  const tap = async (k) => { await key(k, true); await sleep(90); await key(k, false); };
  try {
    await page.s('Page.navigate', {url: `http://127.0.0.1:${server.address().port}/${id}.html?autoplay=1`});
    for (let i = 0; i < 40 && !(await page.evaluate('typeof p8_is_running!=="undefined"&&p8_is_running&&!!document.getElementById("canvas")')); i++) await sleep(250);
    await page.evaluate(fs.readFileSync(path.join(ROOT, 'studio/trailer-capture.js'), 'utf8') + ';0');
    await sleep(3500); // PICO-8's boot screen
    for (let i = 0; i < 3; i++) { await tap('x'); await sleep(700); } // past the title
    // Play: walk somewhere for a moment, now and then press a button; record the last `seconds`.
    await page.evaluate(`window.__rec = TrailerRecorder(() => document.getElementById('canvas'), {seconds: ${seconds}}); 0`);
    const end = Date.now() + (warmup + seconds) * 1000;
    const dirs = ['left', 'right', 'up', 'down'];
    while (Date.now() < end) {
      const d = dirs[Math.floor(rand() * 4)];
      await key(d, true);
      const hold = 350 + rand() * 900;
      const stop = Date.now() + hold;
      while (Date.now() < stop) { if (rand() < 0.12) await tap('x'); await sleep(150); }
      await key(d, false);
    }
    const n = await page.evaluate('__rec.stop(), __rec.count()');
    const one = SIZE * SIZE * 4, parts = [];
    for (let i = 0; i < n; i += 30) {
      const b64 = await page.evaluate(`(() => { const p = __rec.pixels().subarray(${i * one}, ${Math.min(n, i + 30) * one}); let s = ''; for (let j = 0; j < p.length; j += 0x8000) s += String.fromCharCode.apply(null, p.subarray(j, j + 0x8000)); return btoa(s); })()`);
      parts.push(Buffer.from(b64, 'base64'));
    }
    return await framesToGif(new Uint8Array(Buffer.concat(parts)));
  } finally { page.close(); server.close(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [id, out] = process.argv.slice(2);
  if (!id) { console.error('usage: node scripts/trailer.mjs <id> [out.gif]'); process.exit(1); }
  const {siteDir, saveGif} = await import('./picoparish.mjs');
  const gif = await autoTrailer(id);
  if (out) fs.writeFileSync(out, gif); else saveGif(id, gif);
  console.log(`Trailer: ${out || path.join(siteDir(), 'games', id + '.gif')} (${Math.round(gif.length / 1024)} KB)`);
}
