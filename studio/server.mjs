// Lesson Studio: one page on Shalone's Mac to edit a lesson's script, record
// it, watch the video and send it to Ghost. Run: npm start
// It must run locally because browsers only allow the microphone on
// http://localhost (or https). Listens on 127.0.0.1 only.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {ROOT, ffprobeDuration, loadLesson, words} from '../scripts/lib.mjs';
import {applyEdits, setStatus} from '../scripts/studio.mjs';
import {cachedWords, compare, whisperAvailable} from '../scripts/voice.mjs';
import {prepare} from '../scripts/prepare.mjs';
import YAML from 'yaml';
import * as esbuild from 'esbuild';
import {importImage, searchImages, sourceList} from './images.mjs';

const PORT = 5178;
const URL_BASE = `http://localhost:${PORT}`;
const AUDIO_EXT = ['.wav', '.m4a', '.mp3', '.aac', '.flac', '.ogg']; // same order as scripts/prepare.mjs
const run = promisify(execFile);

// ---------- lessons ----------

/** Every lesson as "<course>/<lesson-folder>". */
function lessonIds() {
  const courses = path.join(ROOT, 'courses');
  return fs.readdirSync(courses).sort().flatMap((c) => {
    const cdir = path.join(courses, c);
    if (!fs.statSync(cdir).isDirectory()) return [];
    return fs.readdirSync(cdir).sort()
      .filter((l) => fs.existsSync(path.join(cdir, l, 'lesson.yml')))
      .map((l) => `${c}/${l}`);
  });
}

/** Resolve a lesson id from the page; only ids that exist are accepted. */
function lessonPath(id) {
  if (!lessonIds().includes(id)) throw httpError(404, `No lesson "${id}"`);
  return path.join(ROOT, 'courses', id);
}

const mtime = (f) => (fs.existsSync(f) ? fs.statSync(f).mtimeMs : 0);
const audioFile = (dir, name) => AUDIO_EXT.map((e) => path.join(dir, 'audio', name + e)).find((f) => fs.existsSync(f));
const distDir = (id) => path.join(ROOT, 'dist', id);

function summary(id) {
  try {
    const {lesson, course} = loadLesson(lessonPath(id));
    return {id, course: course.title, number: lesson.number, title: lesson.title, status: lesson.status};
  } catch (e) {
    return {id, course: id.split('/')[0], number: 0, title: id.split('/')[1], status: 'error', error: e.message};
  }
}

function detail(id) {
  const dir = lessonPath(id);
  const {lesson, course, segments} = loadLesson(dir);
  const sections = segments.map((s) => {
    const file = audioFile(dir, s.name);
    const audio = file ? {seconds: ffprobeDuration(file), at: mtime(file), ext: path.extname(file)} : null;
    const base = {key: s.name, kind: s.kind, index: s.index, words: words(s.text), audio, heard: heard(id, s, file)};
    return s.kind === 'point'
      ? {...base, heading: s.heading, lead: s.quote.lead, quote: s.quote.text, cite: s.quote.cite, text: s.explanation}
      : {...base, text: s.text, notes: s.notes ?? []};
  });
  // The video is out of date if the script or any recording changed after it was made.
  const mp4 = path.join(distDir(id), 'lesson.mp4');
  const inputs = [path.join(dir, 'lesson.yml'), path.join(dir, '..', 'course.yml'), ...sections.map((s) => audioFile(dir, s.key)).filter(Boolean)];
  const video = fs.existsSync(mp4)
    ? {size: fs.statSync(mp4).size, at: mtime(mp4), stale: Math.max(...inputs.map(mtime)) > mtime(mp4), poster: fs.existsSync(path.join(distDir(id), 'poster.jpg'))}
    : null;
  return {
    id, course: course.title, number: lesson.number, title: lesson.title, status: lesson.status,
    sections, video, requests: openRequests(dir),
  };
}

// ---------- listening back (Whisper) ----------

const WHISPER = whisperAvailable();
const listening = new Set(); // "<id>|<section>" being transcribed
let listenQueue = Promise.resolve();

/** Transcribe a section's recording in the background (once; cached next to it). */
function listen(id, section, src, hint) {
  const k = `${id}|${section}`;
  if (!WHISPER || listening.has(k)) return;
  listening.add(k);
  const trimmed = path.join(ROOT, 'video', 'public', id, `${section}.wav`);
  listenQueue = listenQueue
    .then(() => run(process.execPath, [path.join(ROOT, 'scripts/voice.mjs'), src, trimmed], {cwd: ROOT, env: {...process.env, VOICE_HINT: hint}}))
    .catch((e) => console.error(`Couldn't transcribe ${k}: ${e.message}`))
    .finally(() => listening.delete(k));
}

/** What she said vs. the script, for one section (or why it isn't known yet). */
function heard(id, s, src) {
  if (!src || !WHISPER) return null;
  const words = cachedWords(src);
  const parts = s.kind === 'point' ? {lead: s.quote.lead, quote: s.quote.text, text: s.explanation} : {text: s.text};
  if (!words) { listen(id, s.name, src, s.text); return {pending: true}; }
  return compare(parts, words);
}

// ---------- timing editor ----------

// The Timing tab's video player (Remotion Player + the lesson composition), built on start.
async function buildPlayer() {
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'studio/player/entry.tsx')], bundle: true, format: 'iife', minify: true,
    outfile: path.join(ROOT, 'studio/player/player.js'), jsx: 'automatic', loader: {'.json': 'json'},
    define: {'process.env.NODE_ENV': '"production"'}, logLevel: 'warning',
  });
}

/** Everything the Timing tab needs: the video's props (with her timing), the automatic timing, and her words. */
function timingData(id) {
  const dir = lessonPath(id);
  const {props, auto} = prepare(id);
  const segments = props.segments.map((seg, si) => {
    const file = audioFile(dir, seg.name);
    const words = file ? cachedWords(file) ?? [] : [];
    return {name: seg.name, words: words.map((w) => ({w: w.w, t: w.start})), autoScenes: auto.segments[si].scenes.map((s) => ({from: s.from, cues: s.cues ?? {}}))};
  });
  const f = path.join(dir, 'timing.yml');
  return {props, segments, timing: fs.existsSync(f) ? YAML.parse(fs.readFileSync(f, 'utf8')) ?? {} : {}};
}

// ---------- adding and removing pictures (scenes) from the Timing tab ----------

/** Where a section's scene list lives in lesson.yml; point scene 0 is the quotation (not in visuals). */
const sceneList = (section) => {
  const m = /^point-(\d+)$/.exec(section);
  return m ? {path: ['points', Number(m[1]) - 1, 'visuals'], first: 1} : {path: [section, 'scenes'], first: 0};
};

/** Splice one scene into (or out of) lesson.yml as text, so comments and layout elsewhere stay as they are. */
function editScenes(dir, section, op, sceneIndex, scene) {
  const file = path.join(dir, 'lesson.yml');
  let src = fs.readFileSync(file, 'utf8');
  const {path: p, first} = sceneList(section);
  const doc = YAML.parseDocument(src);
  const seq = doc.getIn(p, true);
  if (!seq || !Array.isArray(seq.items)) throw httpError(400, `No scene list for ${section}`);
  const k = sceneIndex - first; // index within the YAML list
  const lineStart = (i) => src.lastIndexOf('\n', i - 1) + 1;
  if (op === 'add') {
    if (seq.flow || !seq.items.length) {
      // e.g. "visuals: []": write the list as a block under its key.
      const keyLine = lineStart(seq.range[0]);
      const indent = src.slice(keyLine).match(/^ */)[0].length + 2;
      const text = YAML.stringify([scene], {lineWidth: 0}).trimEnd().split('\n').map((l) => ' '.repeat(indent) + l).join('\n');
      src = src.slice(0, seq.range[0]).replace(/[ \t]*$/, '') + '\n' + text + '\n' + src.slice(seq.range[1]).replace(/^[ \t]*\n?/, '');
    } else {
      const at = Math.max(0, Math.min(k, seq.items.length));
      const ref = seq.items[Math.min(at, seq.items.length - 1)];
      const refLine = lineStart(ref.range[0]);
      const indent = src.slice(refLine, ref.range[0]).length - 2; // the "- " column
      const text = YAML.stringify([scene], {lineWidth: 0}).trimEnd().split('\n').map((l) => ' '.repeat(indent) + l).join('\n') + '\n';
      const pos = at < seq.items.length ? refLine : (src.indexOf('\n', seq.items[seq.items.length - 1].range[1] - 1) + 1 || src.length);
      src = src.slice(0, pos) + text + src.slice(pos);
    }
  } else {
    const item = seq.items[k];
    if (!item) throw httpError(400, 'No such scene');
    const from = lineStart(item.range[0]);
    const next = seq.items[k + 1];
    const to = next ? lineStart(next.range[0]) : src.indexOf('\n', item.range[1] - 1) + 1 || src.length;
    src = src.slice(0, from) + src.slice(to);
    if (seq.items.length === 1) src = src.replace(new RegExp(`(\\n[ ]*${p[p.length - 1]}:)[ ]*\\n`), '$1 []\n');
  }
  YAML.parse(src); // must still be valid
  fs.writeFileSync(file, src);
  // Hand timing follows the scenes it belongs to.
  const tf = path.join(dir, 'timing.yml');
  const timing = fs.existsSync(tf) ? YAML.parse(fs.readFileSync(tf, 'utf8')) ?? {} : {};
  const old = timing[section]?.scenes ?? {};
  const moved = {};
  for (const [i, v] of Object.entries(old)) {
    const n = Number(i);
    if (op === 'remove' && n === sceneIndex) continue;
    moved[op === 'add' ? (n >= sceneIndex ? n + 1 : n) : (n > sceneIndex ? n - 1 : n)] = v;
  }
  (timing[section] ??= {}).scenes = moved;
  return timing;
}

function saveTiming(id, timing) {
  const dir = lessonPath(id);
  const clean = {};
  for (const [sec, v] of Object.entries(timing ?? {})) {
    if (!/^(intro|outro|point-\d+)$/.test(sec) || !v?.scenes) continue;
    const scenes = {};
    for (const [i, o] of Object.entries(v.scenes)) {
      const out = {};
      if (Number.isFinite(o.start)) out.start = Math.round(o.start * 100) / 100;
      const cues = Object.fromEntries(Object.entries(o.cues ?? {}).filter(([, t]) => Number.isFinite(t)).map(([k, t]) => [k, Math.round(t * 100) / 100]));
      if (Object.keys(cues).length) out.cues = cues;
      if (Object.keys(out).length) scenes[i] = out;
    }
    if (Object.keys(scenes).length) clean[sec] = {scenes};
  }
  const f = path.join(dir, 'timing.yml');
  if (!Object.keys(clean).length) { fs.rmSync(f, {force: true}); return; }
  fs.writeFileSync(f, '# Hand-tuned timing from the studio\'s Timing tab, in seconds into each\n# section\'s recording. Scenes not listed keep their automatic timing.\n' + YAML.stringify(clean));
}

// ---------- quote check ----------

async function checkQuotes(id) {
  try {
    const {stdout} = await run(process.execPath, [path.join(ROOT, 'scripts/check-quotes.mjs'), id], {cwd: ROOT});
    return {ok: true, problems: [], summary: lastLine(stdout)};
  } catch (e) {
    const out = String(e.stdout ?? '');
    const lines = out.split('\n').map((l) => l.trim());
    const problems = lines.filter((l) => l.startsWith('✗'));
    const unchecked = lines.filter((l) => l.startsWith('?'));
    return {ok: false, problems, unchecked, summary: lastLine(out) || e.message};
  }
}
const lastLine = (s) => s.trim().split('\n').pop()?.trim() ?? '';

// ---------- requests for Claude ----------

const requestsFile = (dir) => path.join(dir, 'requests.md');
function openRequests(dir) {
  const f = requestsFile(dir);
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.startsWith('- [ ] ')).map((l) => l.slice(6));
}
function addRequest(dir, text) {
  const f = requestsFile(dir);
  if (!fs.existsSync(f)) {
    fs.writeFileSync(f, '# Requests from the Lesson Studio\n\nClaude: handle each one, then tick it off (- [x]).\n\n');
  }
  const when = new Date().toLocaleString('sv-SE', {dateStyle: 'short', timeStyle: 'short'});
  fs.appendFileSync(f, `- [ ] ${when} · ${text.replace(/\s+/g, ' ').trim()}\n`);
}

// ---------- audio ----------

const toWav = (input, output, extra = []) =>
  run('ffmpeg', ['-y', '-v', 'error', '-i', input, ...extra, '-ac', '1', '-ar', '48000', output]);

/** One section recorded on its own: keep the original, convert to WAV. */
async function saveSection(id, section, body, type) {
  const dir = lessonPath(id);
  const {segments} = loadLesson(dir);
  if (!segments.some((s) => s.name === section)) throw httpError(400, `No section "${section}"`);
  const audioDir = path.join(dir, 'audio');
  fs.mkdirSync(audioDir, {recursive: true});
  const original = path.join(audioDir, `${section}${recordingExt(type)}`);
  fs.writeFileSync(original, body);
  const wav = path.join(audioDir, `${section}.wav`);
  await toWav(original, wav);
  return {section, seconds: ffprobeDuration(wav)};
}

/** One continuous take from section `start` on, cut at the moments she tapped Next. */
async function saveTake(id, start, marks, body, type) {
  const dir = lessonPath(id);
  const {segments} = loadLesson(dir);
  if (!Number.isInteger(start) || start < 0 || start >= segments.length) throw httpError(400, 'Bad start section');
  if (!Array.isArray(marks) || marks.some((m, i) => typeof m !== 'number' || m <= (marks[i - 1] ?? 0))) throw httpError(400, 'Bad section marks');
  const covered = segments.slice(start, start + marks.length + 1);
  const audioDir = path.join(dir, 'audio');
  fs.mkdirSync(audioDir, {recursive: true});
  const original = path.join(audioDir, `take${recordingExt(type)}`);
  fs.writeFileSync(original, body);
  // Decode once to WAV so the cuts are sample-exact.
  const full = path.join(audioDir, '.take-full.wav');
  await toWav(original, full);
  const total = ffprobeDuration(full);
  const cuts = [0, ...marks.map((m) => Math.min(m, total)), total];
  const out = [];
  for (const [i, s] of covered.entries()) {
    const wav = path.join(audioDir, `${s.name}.wav`);
    await toWav(full, wav, ['-ss', String(cuts[i]), '-to', String(cuts[i + 1])]);
    out.push({section: s.name, seconds: ffprobeDuration(wav)});
  }
  fs.rmSync(full);
  return {sections: out};
}

const recordingExt = (type) => (/mp4|m4a|aac/.test(type ?? '') ? '.m4a' : '.webm');

// ---------- long jobs (render, publish): one at a time ----------

let job = null;

function startJob(kind, id, script) {
  if (job?.running) throw httpError(409, `Still busy: ${job.kind === 'render' ? 'making the video' : 'sending to Ghost'}`);
  job = {kind, id, running: true, ok: null, startedAt: Date.now(), endedAt: null, step: 'Starting…', progress: null, log: '', error: null, link: null};
  const current = job;
  const child = spawn(process.execPath, [path.join(ROOT, script), id], {cwd: ROOT, env: {...process.env, STUDIO: '1', FORCE_COLOR: '0'}});
  const onData = (chunk) => {
    const text = String(chunk);
    current.log = (current.log + text).slice(-20000);
    for (const line of text.split(/[\r\n]+/)) followProgress(current, line);
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  child.on('close', (code) => {
    current.running = false;
    current.endedAt = Date.now();
    current.ok = code === 0;
    if (code !== 0) current.error = errorMessage(current.log) || `Stopped with code ${code}`;
    else current.step = kind === 'render' ? 'Done' : 'Saved to Ghost as a draft';
  });
  return current;
}

/** Turn the scripts' output into a short step label and a 0–1 progress value. */
function followProgress(j, line) {
  let m;
  if ((m = /^STEP (\d+)\/(\d+) (.+)$/.exec(line))) { j.step = m[3]; j.stepIndex = +m[1]; j.steps = +m[2]; j.progress = null; }
  else if ((m = /^Bundling (\d+)%/.exec(line))) { j.step = 'Getting ready'; j.progress = +m[1] / 100; }
  else if ((m = /^(Rendered|Encoded) (\d+)\/(\d+)/.exec(line))) {
    // Frames are drawn, then encoded a little behind; count both halves.
    j[m[1]] = +m[2] / +m[3];
    j.step = 'Drawing the video';
    j.progress = ((j.Rendered ?? 0) + (j.Encoded ?? 0)) / 2;
  }
  else if ((m = /^Draft saved: (\S+)/.exec(line))) j.link = m[1];
  else if (/^Uploading video/.test(line)) j.step = 'Uploading the video to Ghost…';
}

/** The message of a Node error from a script's output, without the stack trace. */
function errorMessage(log) {
  const lines = log.split('\n');
  const start = lines.findIndex((l) => /^\w*Error: /.test(l));
  if (start < 0) return lines.filter(Boolean).slice(-3).join('\n');
  const msg = [];
  for (const l of lines.slice(start)) { if (/^\s+at /.test(l)) break; msg.push(l); }
  return msg.join('\n').replace(/^\w*Error: /, '').trim();
}

// ---------- HTTP ----------

function httpError(status, message) { return Object.assign(new Error(message), {status}); }

const TYPES = {'.js': 'text/javascript', '.mp3': 'audio/mpeg', '.png': 'image/png', '.html': 'text/html; charset=utf-8', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};

/** Serve a file with Range support (Safari needs it to play audio and video). */
function sendFile(req, res, file) {
  if (!fs.existsSync(file)) throw httpError(404, 'Not found');
  const size = fs.statSync(file).size;
  const headers = {'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache'};
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  if (m && (m[1] || m[2])) {
    const start = m[1] ? +m[1] : Math.max(0, size - +m[2]);
    const end = m[1] && m[2] ? Math.min(+m[2], size - 1) : size - 1;
    if (start > end || start >= size) { res.writeHead(416, {'Content-Range': `bytes */${size}`}); return res.end(); }
    res.writeHead(206, {...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1});
    return fs.createReadStream(file, {start, end}).pipe(res);
  }
  res.writeHead(200, {...headers, 'Content-Length': size});
  fs.createReadStream(file).pipe(res);
}

const json = (res, status, body) => { res.writeHead(status, {'Content-Type': 'application/json'}); res.end(JSON.stringify(body)); };

async function readBody(req, limit) {
  const chunks = [];
  let n = 0;
  for await (const c of req) {
    n += c.length;
    if (n > limit) throw httpError(413, 'Too large');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}
const readJson = async (req) => JSON.parse(String(await readBody(req, 1e6)) || '{}');

const ALLOWED_HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);

async function handle(req, res) {
  // Only this page may use the studio: no other website, and no DNS tricks.
  if (!ALLOWED_HOSTS.has(req.headers.host)) throw httpError(403, 'Forbidden');
  const url = new URL(req.url, URL_BASE);
  const p = url.pathname;
  if (req.method === 'POST') {
    const origin = req.headers.origin;
    if (req.headers['x-studio'] !== '1' || (origin && !ALLOWED_HOSTS.has(origin.replace(/^http:\/\//, '')))) throw httpError(403, 'Forbidden');
  }
  const id = url.searchParams.get('id') ?? '';

  if (req.method === 'GET') {
    if (p === '/') return sendFile(req, res, path.join(ROOT, 'studio', 'index.html'));
    if (p.startsWith('/fonts/')) return sendFile(req, res, path.join(ROOT, 'video', 'public', 'fonts', path.basename(p)));
    if (p === '/api/lessons') return json(res, 200, lessonIds().map(summary));
    if (p === '/api/lesson') return json(res, 200, detail(id));
    if (p === '/api/job') return json(res, 200, job);
    if (p === '/api/timing') return json(res, 200, timingData(id));
    if (p === '/api/images/sources') return json(res, 200, sourceList());
    if (p === '/api/images/search') {
      const q = (url.searchParams.get('q') ?? '').trim();
      if (!q) throw httpError(400, 'Type something to search for');
      return json(res, 200, await searchImages(q.slice(0, 120), url.searchParams.get('source') ?? 'all'));
    }
    if (p === '/player.js') return sendFile(req, res, path.join(ROOT, 'studio/player/player.js'));
    if (p === '/timing.js') return sendFile(req, res, path.join(ROOT, 'studio/timing.js'));
    if (p === '/audio') {
      const section = url.searchParams.get('section');
      if (!/^(intro|outro|point-\d+)$/.test(section ?? '')) throw httpError(400, 'Bad section');
      return sendFile(req, res, audioFile(lessonPath(id), section) ?? '');
    }
    if (p === '/video') {
      lessonPath(id);
      const name = url.searchParams.get('file') === 'poster' ? 'poster.jpg' : 'lesson.mp4';
      return sendFile(req, res, path.join(distDir(id), name));
    }
  }

  if (req.method === 'POST') {
    if (p === '/api/save') {
      const dir = lessonPath(id);
      const {section, lead, text} = await readJson(req);
      const edit = {section};
      if (typeof text === 'string') edit.text = text;
      if (typeof lead === 'string') edit.lead = lead;
      const changes = applyEdits(dir, [edit]);
      // Approval covers the script she approved; a changed script needs approving again.
      const unapproved = changes.length > 0 && setStatus(dir, 'draft');
      const check = changes.length ? await checkQuotes(id) : null;
      return json(res, 200, {changes, unapproved, check, lesson: detail(id)});
    }
    if (p === '/api/use-spoken') {
      // Her words replace the script's lead-in/explanation (quotations stay as written).
      const dir = lessonPath(id);
      const {section} = await readJson(req);
      const s = loadLesson(dir).segments.find((x) => x.name === section);
      const h = s && heard(id, s, audioFile(dir, section));
      if (!h || h.pending) throw httpError(409, 'The recording hasn\'t been listened to yet');
      const changes = applyEdits(dir, [{section, ...h.proposed}]);
      const unapproved = changes.length > 0 && setStatus(dir, 'draft');
      const check = changes.length ? await checkQuotes(id) : null;
      return json(res, 200, {changes, unapproved, check, lesson: detail(id)});
    }
    if (p === '/api/timing') {
      const {timing} = await readJson(req);
      saveTiming(id, timing);
      return json(res, 200, timingData(id));
    }
    if (p === '/api/images/import') {
      // Download a picked image into the lesson (with its credit); the page then adds the scene.
      const {img} = await readJson(req);
      return json(res, 200, await importImage(lessonPath(id), img));
    }
    if (p === '/api/scene') {
      // Add a picture at a time (seconds into the recording), or remove one.
      const dir = lessonPath(id);
      const {op, section, index, scene, start} = await readJson(req);
      if (!/^(intro|outro|point-\d+)$/.test(section ?? '')) throw httpError(400, 'Bad section');
      const {props} = prepare(id);
      const seg = props.segments.find((s) => s.name === section);
      if (!seg) throw httpError(400, 'No such section');
      let at = index;
      if (op === 'add') {
        if (!scene || typeof scene.type !== 'string') throw httpError(400, 'Missing scene');
        // After every scene that starts before it; never before a point's quotation.
        const f = seg.audioOffsetInFrames + start * 30;
        at = Math.max(sceneList(section).first, seg.scenes.filter((s) => (s.from ?? 0) <= f).length);
      } else if (op !== 'remove' || !Number.isInteger(index) || index < sceneList(section).first) throw httpError(400, 'That picture can\'t be removed here');
      const timing = editScenes(dir, section, op, at, scene);
      if (op === 'add') ((timing[section] ??= {}).scenes ??= {})[at] = {start: Math.round(start * 100) / 100};
      saveTiming(id, timing);
      setStatus(dir, 'draft');
      return json(res, 200, timingData(id));
    }
    if (p === '/api/audio') {
      const body = await readBody(req, 300e6);
      const result = await saveSection(id, url.searchParams.get('section'), body, req.headers['content-type']);
      return json(res, 200, {...result, lesson: detail(id)});
    }
    if (p === '/api/take') {
      const body = await readBody(req, 500e6);
      const start = Number(url.searchParams.get('start'));
      const marks = JSON.parse(url.searchParams.get('marks') ?? '[]');
      const result = await saveTake(id, start, marks, body, req.headers['content-type']);
      return json(res, 200, {...result, lesson: detail(id)});
    }
    if (p === '/api/ask') {
      const {text} = await readJson(req);
      if (!text?.trim()) throw httpError(400, 'Empty request');
      addRequest(lessonPath(id), text);
      return json(res, 200, {lesson: detail(id)});
    }
    if (p === '/api/render') {
      lessonPath(id);
      return json(res, 200, startJob('render', id, 'scripts/render.mjs'));
    }
    if (p === '/api/publish') {
      // This request comes only from her "Approve" click: that click is her approval.
      const dir = lessonPath(id);
      if (!fs.existsSync(path.join(distDir(id), 'lesson.mp4'))) throw httpError(400, 'Make the video first.');
      if (job?.running) throw httpError(409, 'Still busy; try again in a moment.');
      setStatus(dir, 'reviewed');
      return json(res, 200, startJob('publish', id, 'scripts/publish.mjs'));
    }
  }
  // The player loads the video's files (staticFile) from the site root: video/public.
  if (req.method === 'GET') {
    const file = path.join(ROOT, 'video', 'public', path.normalize(decodeURIComponent(p)).replace(/^([/\\.])+/, ''));
    if (file.startsWith(path.join(ROOT, 'video', 'public') + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) return sendFile(req, res, file);
  }
  throw httpError(404, 'Not found');
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    if (!e.status) console.error(e);
    if (!res.headersSent) json(res, e.status ?? 500, {error: e.message});
    else res.end();
  });
});

const open = !process.argv.includes('--no-open');
server.on('error', (e) => {
  if (e.code !== 'EADDRINUSE') throw e;
  console.log(`The Lesson Studio is already running: ${URL_BASE}`);
  if (open) spawn('open', [URL_BASE], {stdio: 'ignore'});
  process.exit(0);
});
await buildPlayer().catch((e) => console.error('Timing preview unavailable:', e.message));
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Lesson Studio: ${URL_BASE}\nLeave this window open while you work. Press Control-C to stop.`);
  if (open) spawn('open', [URL_BASE], {stdio: 'ignore'});
});
