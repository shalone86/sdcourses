// Lesson Studio: one page on Shalone's Mac to edit a lesson's script, record
// it, watch the video and send it to Ghost. Run: npm start
// It must run locally because browsers only allow the microphone on
// http://localhost (or https). Listens on 127.0.0.1 only.
import http from 'node:http';
import crypto from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {ROOT, ffprobeDuration, loadLesson, words} from '../scripts/lib.mjs';
import {kidsThumbProps, picAspect} from '../scripts/kids-thumb.mjs';
import {applyEdits, setStatus, setValue} from '../scripts/studio.mjs';
import {normalizeQuestion} from '../scripts/build-post.mjs';
import {cachedWords, compare, whisperAvailable} from '../scripts/voice.mjs';
import {prepare} from '../scripts/prepare.mjs';
import YAML from 'yaml';
import {icons as LUCIDE} from 'lucide-react';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as esbuild from 'esbuild';
import {importImage, importUpload, searchImages, sourceList} from './images.mjs';
import {battleProps, battleSlug, listBattles, newBattle, saveBattle} from '../scripts/battles.mjs';
import {colorVersion, copyPose, deleteSprite, listSprites, puppetBases, puppetCast, saveSprite, setFavorite} from '../scripts/sprites.mjs';
import {addClosing, addSlide, newLesson, removeSlide} from '../scripts/slides.mjs';
import {ghost} from '../scripts/ghost.mjs';

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

/**
 * Courses to start a lesson in: the ones here, and the courses on the site (Ghost tags)
 * that aren't here yet. Category tags (like "All Courses") are left out.
 */
async function courseChoices() {
  const local = fs.readdirSync(path.join(ROOT, 'courses'), {withFileTypes: true})
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(ROOT, 'courses', d.name, 'course.yml')))
    .map((d) => YAML.parse(fs.readFileSync(path.join(ROOT, 'courses', d.name, 'course.yml'), 'utf8')) ?? {})
    .filter((c) => c.slug);
  const categories = new Set(local.flatMap((c) => c.categories ?? []).map((x) => x.toLowerCase()));
  const titles = new Set(local.map((c) => String(c.title).toLowerCase()));
  const slugs = new Set(local.map((c) => c.slug));
  let site = [], error = null;
  try {
    const r = await ghost().call('GET', '/tags/?limit=all&include=count.posts&filter=visibility:public');
    site = r.tags.filter((t) => !categories.has(t.name.toLowerCase()) && !titles.has(t.name.toLowerCase()) && !slugs.has(t.slug) && t.count?.posts > 0)
      .map((t) => ({slug: t.slug, title: t.name, posts: t.count.posts})).sort((a, b) => a.title.localeCompare(b.title));
  } catch (e) { error = `Couldn't get the courses from the site: ${e.message}`; }
  return {local: local.map((c) => ({slug: c.slug, title: c.title, style: c.style ?? 'classic'})).sort((a, b) => a.title.localeCompare(b.title)), site, error};
}

/**
 * A picture from the web for the drawing tabs' reference (a link she copied from Google,
 * DuckDuckGo or any site), fetched here so the page can draw it. Public addresses only.
 */
async function fetchImage(res, address) {
  let u;
  try { u = new URL(address); } catch { throw httpError(400, 'That isn\'t a web address'); }
  if (!/^https?:$/.test(u.protocol)) throw httpError(400, 'Only http and https links');
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$|\[?f[cd])/i.test(u.hostname) || u.hostname.endsWith('.local')) throw httpError(400, 'Only public web addresses');
  const r = await fetch(u, {headers: {'User-Agent': 'sdcourses-lesson-studio/1.0 (https://courses.sdcason.com)', Accept: 'image/*'}, redirect: 'follow', signal: AbortSignal.timeout(20000)})
    .catch((e) => { throw httpError(502, `Couldn't get it (${e.message})`); });
  const type = r.headers.get('content-type') ?? '';
  if (!r.ok) throw httpError(502, `That site answered ${r.status}`);
  if (!type.startsWith('image/')) throw httpError(400, 'That link isn\'t a picture (try “Copy Image Address” on the picture itself)');
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 25e6) throw httpError(413, 'That picture is too big');
  res.writeHead(200, {'Content-Type': type, 'Content-Length': buf.length, 'Cache-Control': 'no-store'});
  res.end(buf);
}

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
  const {lesson, course, segments, kids} = loadLesson(dir);
  const sections = segments.map((s) => {
    const file = audioFile(dir, s.name);
    const audio = file ? {seconds: ffprobeDuration(file), at: mtime(file), ext: path.extname(file)} : null;
    const base = {key: s.name, kind: s.kind, index: s.index, words: words(s.text), audio, heard: heard(id, s, file)};
    return s.kind === 'point'
      ? {...base, heading: s.heading, lead: s.quote.lead, quote: s.quote.text, cite: s.quote.cite, link: s.quote.link ?? '', highlight: s.quote.highlight ?? '', own: !!s.own, quiz: s.quiz, text: s.explanation}
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
    backup: backup.last, // the studio's last backup to GitHub (any lesson)
    sections, video, requests: openRequests(dir),
    // Kids lessons: the drawing on the kids-site thumbnail (`thumb:` in lesson.yml), else what it falls back to.
    kids: kids ? {thumb: lesson.thumb?.sprite ?? null, fallback: course.thumb?.sprite ?? segments.flatMap((x) => x.scenes).find((sc) => sc?.type === 'sprite')?.sprite ?? null} : null,
  };
}

/** The thumbnail maker's data: the props to draw it, what's saved, and each drawing's width for its height. */
function kidsThumb(id, pics) {
  const {props, auto} = kidsThumbProps(lessonPath(id), pics);
  const saved = loadLesson(lessonPath(id)).lesson.thumb?.pics ?? null;
  return {props, saved, auto, aspects: props.pics.map((q) => picAspect(q.art)), autoAspect: props.art ? picAspect(props.art) : 1};
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
    return {name: seg.name, words: words.map((w) => ({w: w.w, t: w.start})), autoScenes: auto.segments[si].scenes.map((s) => ({from: s.from, cues: s.cues ?? {}})), autoDuration: auto.segments[si].durationInFrames};
  });
  const f = path.join(dir, 'timing.yml');
  return {props, segments, timing: fs.existsSync(f) ? YAML.parse(fs.readFileSync(f, 'utf8')) ?? {} : {}};
}

// ---------- adding and removing pictures (scenes) from the Timing tab ----------

/** Where a section's scene list lives in lesson.yml; point scene 0 is the quotation (not in visuals). */
const sceneList = (section, dir) => {
  const m = /^point-(\d+)$/.exec(section);
  if (!m) return {path: [section, 'scenes'], first: 0};
  // Scene 0 of a point is its quotation, when it has one.
  const point = loadLesson(dir).segments.find((s) => s.name === section);
  return {path: ['points', Number(m[1]) - 1, 'visuals'], first: point?.hasQuote ? 1 : 0};
};

/** Splice one scene into (or out of) lesson.yml as text, so comments and layout elsewhere stay as they are. */
function editScenes(dir, section, op, sceneIndex, scene, key, value) {
  const file = path.join(dir, 'lesson.yml');
  let src = fs.readFileSync(file, 'utf8');
  const {path: p, first} = sceneList(section, dir);
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
  } else if (op === 'replace') {
    // Change a picture in place: its lines become the new ones (same spot, same hand timing).
    const item = seq.items[k];
    if (!item) throw httpError(400, 'No such scene');
    const from = lineStart(item.range[0]);
    const next = seq.items[k + 1];
    const to = next ? lineStart(next.range[0]) : src.indexOf('\n', item.range[1] - 1) + 1 || src.length;
    const indent = src.slice(from, item.range[0]).length - 2; // the "- " column
    src = src.slice(0, from) + YAML.stringify([scene], {lineWidth: 0}).trimEnd().split('\n').map((l) => ' '.repeat(indent) + l).join('\n') + '\n' + src.slice(to);
    YAML.parse(src);
    fs.writeFileSync(file, src);
    const tf = path.join(dir, 'timing.yml');
    return fs.existsSync(tf) ? YAML.parse(fs.readFileSync(tf, 'utf8')) ?? {} : {};
  } else if (op === 'set') {
    // One setting on a scene (e.g. `with: side`): drop its old line, then add the new one at the end of the scene.
    const item = seq.items[k];
    if (!item || !Array.isArray(item.items) || item.flow) throw httpError(400, 'No such scene');
    const pair = item.items.find((pr) => pr.key?.value === key);
    if (pair && pair !== item.items[0]) {
      const from = lineStart(pair.key.range[0]);
      src = src.slice(0, from) + src.slice(src.indexOf('\n', (pair.value?.range ?? pair.key.range)[1] - 1) + 1);
    }
    if (value != null) {
      const again = YAML.parseDocument(src).getIn(p, true).items[k];
      const col = again.items[0].key.range[0] - lineStart(again.items[0].key.range[0]);
      const pos = src.indexOf('\n', again.range[1] - 1) + 1 || src.length;
      src = src.slice(0, pos) + ' '.repeat(col) + `${key}: ${value}\n` + src.slice(pos);
    }
    YAML.parse(src);
    fs.writeFileSync(file, src);
    const tf = path.join(dir, 'timing.yml');
    return fs.existsSync(tf) ? YAML.parse(fs.readFileSync(tf, 'utf8')) ?? {} : {};
  } else {
    const item = seq.items[k];
    if (!item) throw httpError(400, 'No such scene');
    const from = lineStart(item.range[0]);
    const next = seq.items[k + 1];
    const to = next ? lineStart(next.range[0]) : src.indexOf('\n', item.range[1] - 1) + 1 || src.length;
    // The last picture gone: write "visuals: []" on THIS slide's key (it's before the cut, so its place holds).
    const key = doc.getIn(p.slice(0, -1), true).items.find((pr) => pr.key?.value === p[p.length - 1]).key;
    src = src.slice(0, from) + src.slice(to);
    if (seq.items.length === 1) src = src.slice(0, key.range[1]) + src.slice(key.range[1]).replace(/^:[ \t]*\n/, ': []\n');
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
    if (!/^(intro|outro|point-\d+)$/.test(sec) || !v) continue;
    const scenes = {};
    for (const [i, o] of Object.entries(v.scenes ?? {})) {
      const out = {};
      if (Number.isFinite(o.start)) out.start = Math.round(o.start * 100) / 100;
      if (Number.isFinite(o.end)) out.end = Math.round(o.end * 100) / 100;
      const cues = Object.fromEntries(Object.entries(o.cues ?? {}).filter(([, t]) => Number.isFinite(t)).map(([k, t]) => [k, Math.round(t * 100) / 100]));
      if (Object.keys(cues).length) out.cues = cues;
      // Moved/resized in the Timing tab (pixels of 1920×1080, size in %).
      const n = o.nudge ?? {};
      const nx = Math.round(Number(n.x) || 0), ny = Math.round(Number(n.y) || 0), size = Math.min(200, Math.max(30, Math.round(Number(n.size) || 100)));
      if (nx || ny || size !== 100) out.nudge = {x: nx, y: ny, size};
      // The keyboard puppet's recording: [seconds into the recording, key, down 1/0].
      const KEYS = ['left', 'right', 'shift', 'up', 'down', 'p', 't', 'a', 'x', 'h', 'i'];
      if (Array.isArray(o.puppet)) {
        const ev = o.puppet.filter((e) => Array.isArray(e) && Number.isFinite(e[0]) && KEYS.includes(e[1])).slice(0, 4000)
          .map(([t, k, d]) => [Math.round(Math.max(0, t) * 100) / 100, k, d ? 1 : 0]);
        if (ev.length) out.puppet = ev;
      }
      if (Object.keys(out).length) scenes[i] = out;
    }
    const keep = {};
    if (['off', 'bubble', 'card', 'full', 'side', 'lower', 'only'].includes(v.camera)) keep.camera = v.camera === 'full' ? 'card' : v.camera;
    if (Number.isFinite(v.end)) keep.end = Math.round(v.end * 100) / 100;
    if (v.side === 'left' || v.side === 'right') keep.side = v.side;
    if (Object.keys(scenes).length) keep.scenes = scenes;
    if (Object.keys(keep).length) clean[sec] = keep;
  }
  const f = path.join(dir, 'timing.yml');
  if (!Object.keys(clean).length) { fs.rmSync(f, {force: true}); return; }
  fs.writeFileSync(f, '# Hand-tuned timing from the studio\'s Timing tab, in seconds into each\n# section\'s recording. Scenes not listed keep their automatic timing.\n' + compactYaml(clean));
}

/** YAML with each puppet key press on one line ([2.5, left, 1]) instead of four. */
function compactYaml(obj) {
  const doc = new YAML.Document(obj);
  YAML.visit(doc, {Seq(_, node) { if (node.items.length === 3 && node.items.every((x) => YAML.isScalar(x))) node.flow = true; }});
  return doc.toString();
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

/**
 * Camera clips (when she records with "Record my video too"): <lesson>/camera/<section>.mp4,
 * H.264 without sound (the voice comes from the WAV). `extra` cuts a take.
 */
const toCamera = (input, output, extra = []) => {
  fs.mkdirSync(path.dirname(output), {recursive: true});
  return run('ffmpeg', ['-y', '-v', 'error', '-i', input, ...extra, '-an', '-vf', 'scale=1280:-2,fps=30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output], {maxBuffer: 1 << 26});
};
const cameraFile = (dir, section) => path.join(dir, 'camera', `${section}.mp4`);
const isVideo = (type) => /^video\//.test(type ?? '');

/** One section recorded on its own: keep the original, convert to WAV (and the camera clip, if any). */
async function saveSection(id, section, body, type) {
  const dir = lessonPath(id);
  const {segments} = loadLesson(dir);
  if (!segments.some((s) => s.name === section)) throw httpError(400, `No section "${section}"`);
  const audioDir = path.join(dir, 'audio');
  fs.mkdirSync(audioDir, {recursive: true});
  // Camera recordings (video + voice) are kept in camera/, which stays on this Mac (gitignored).
  const original = path.join(isVideo(type) ? path.join(dir, 'camera') : audioDir, `${section}${isVideo(type) ? '.source' : ''}${recordingExt(type)}`);
  fs.mkdirSync(path.dirname(original), {recursive: true});
  fs.writeFileSync(original, body);
  const wav = path.join(audioDir, `${section}.wav`);
  await toWav(original, wav);
  // A voice-only re-recording drops the old camera clip, which no longer matches.
  if (isVideo(type)) await toCamera(original, cameraFile(dir, section));
  else fs.rmSync(cameraFile(dir, section), {force: true});
  return {section, seconds: ffprobeDuration(wav), camera: isVideo(type)};
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
  const original = path.join(isVideo(type) ? path.join(dir, 'camera') : audioDir, `take${isVideo(type) ? '.source' : ''}${recordingExt(type)}`);
  fs.mkdirSync(path.dirname(original), {recursive: true});
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
    if (isVideo(type)) await toCamera(original, cameraFile(dir, s.name), ['-ss', String(cuts[i]), '-to', String(cuts[i + 1])]);
    else fs.rmSync(cameraFile(dir, s.name), {force: true});
    out.push({section: s.name, seconds: ffprobeDuration(wav)});
  }
  fs.rmSync(full);
  return {sections: out};
}

const recordingExt = (type) => (isVideo(type) ? (/mp4/.test(type) ? '.mp4' : '.webm') : /mp4|m4a|aac/.test(type ?? '') ? '.m4a' : '.webm');

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
    // Sent to Ghost: back the lesson up right away.
    if (code === 0 && kind === 'publish') backupSoon(id, lessonPaths(id), `${id} (sent to Ghost)`, true);
  });
  return current;
}

// ---------- backup to GitHub ----------
// Her work is saved on this Mac as she goes. A few minutes after she stops changing a lesson
// (and right after she sends one to Ghost), the studio commits that lesson's folder (script,
// recordings, pictures, timing; not her camera clips, which stay on this Mac) and pushes it.
const BACKUP_WAIT = 3 * 60 * 1000;
const backup = {timers: new Map(), chain: Promise.resolve(), last: null};
const lessonPaths = (id) => { const [course, lesson] = id.split('/'); return [`courses/${course}/${lesson}`, `courses/${course}/course.yml`]; };

function backupSoon(key, paths, label, now = false) {
  clearTimeout(backup.timers.get(key));
  const go = () => { backup.timers.delete(key); backup.chain = backup.chain.then(() => runBackup(paths, label)).catch(() => {}); };
  if (now) go(); else backup.timers.set(key, setTimeout(go, BACKUP_WAIT));
}

async function runBackup(paths, label) {
  const git = (...args) => run('git', args, {cwd: ROOT, maxBuffer: 1 << 24});
  const there = paths.filter((x) => fs.existsSync(path.join(ROOT, x)));
  try {
    if (!there.length) return;
    await git('add', '-A', '--', ...there);
    const staged = await git('diff', '--cached', '--name-only', '--', ...there);
    if (!staged.stdout.trim()) return;
    await git('commit', '-q', '-m', `Studio backup: ${label}`, '--', ...there);
    const branch = (await git('rev-parse', '--abbrev-ref', 'HEAD')).stdout.trim();
    if (branch === 'main') await git('push', '-q', 'origin', 'main');
    backup.last = {at: Date.now(), ok: true, label};
    console.log(`Backed up to GitHub: ${label}`);
  } catch (e) {
    backup.last = {at: Date.now(), ok: false, label, error: String(e.stderr || e.message).trim().split('\n').pop()};
    console.log(`Backup to GitHub failed (${label}): ${backup.last.error}`);
  }
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
  else if ((m = /^Draft saved \(kids site\): (\S+)/.exec(line))) j.kidsLink = m[1];
  else if (/^Kids site skipped/.test(line)) j.kidsSkipped = true;
  else if (/^Uploading video \(kids site\)/.test(line)) j.step = 'Uploading the video to the kids site…';
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
    if (p === '/api/sprites') return json(res, 200, listSprites());
    if (p === '/api/kids-thumb') return json(res, 200, kidsThumb(id));
    if (p === '/api/puppet-cast') return json(res, 200, puppetCast());
    if (p === '/api/battles') return json(res, 200, listBattles());
    if (p === '/api/battle') {
      // A battle file and the drawings it can use (the Battles tab and the Timing tab's Battle picture).
      try { const {battle, arts, missing} = battleProps(battleSlug(url.searchParams.get('name'))); return json(res, 200, {battle, arts, missing}); }
      catch (e) { throw httpError(404, e.message); }
    }
    if (p === '/battles.js') return sendFile(req, res, path.join(ROOT, 'studio/battles.js'));
    if (p === '/api/puppet-bases') return json(res, 200, {...puppetBases(), cast: puppetCast().characters});
    if (p === '/api/icons') {
      // Lucide icons whose name matches, with a small drawing of each, for the Icons picker.
      const q = (url.searchParams.get('q') ?? '').trim().toLowerCase().replace(/\s+/g, '-');
      const all = Object.keys(LUCIDE).map((n) => [n, n.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([a-zA-Z])(\d)/g, '$1-$2').toLowerCase()]);
      const hits = all.filter(([, k]) => !q || k.includes(q)).sort((a, b) => (a[1].startsWith(q) ? 0 : 1) - (b[1].startsWith(q) ? 0 : 1) || a[1].length - b[1].length).slice(0, 72);
      return json(res, 200, hits.map(([n, k]) => ({name: k, svg: renderToStaticMarkup(createElement(LUCIDE[n], {size: 36, strokeWidth: 1.6}))})));
    }
    if (p === '/api/map-areas') {
      // The names a map can highlight beyond countries (video/data/areas.json), for the Timing tab.
      const {areas} = JSON.parse(fs.readFileSync(path.join(ROOT, 'video/data/areas.json'), 'utf8'));
      const of = (kind) => areas.filter((a) => a.kind === kind).map((a) => a.label.replace(/,.*$/, '').replace(/ members$/, ''));
      return json(res, 200, [{title: 'Continents', names: of('continent')}, {title: 'Groups of countries', names: of('bloc')}, {title: 'Empires (borders approximate)', names: of('empire').sort()},
        {title: 'Countries', names: ['any country by name, e.g. Ukraine, Brazil, United States, Democratic Republic of the Congo']}]);
    }
    if (p === '/api/fetch-image') return fetchImage(res, url.searchParams.get('url') ?? '');
    if (p === '/api/courses') return json(res, 200, await courseChoices());
    if (p === '/pixels.js') return sendFile(req, res, path.join(ROOT, 'studio/pixels.js'));
    if (p === '/sketch.js') return sendFile(req, res, path.join(ROOT, 'studio/sketch.js'));
    if (p === '/reference.js') return sendFile(req, res, path.join(ROOT, 'studio/reference.js'));
    if (p === '/ask.js') return sendFile(req, res, path.join(ROOT, 'studio/ask.js'));
    if (/^\/sprites\/[a-z0-9-]+\/\d+\.png$/.test(p)) return sendFile(req, res, path.join(ROOT, p.slice(1)));
    if (p === '/api/images/search') {
      const q = (url.searchParams.get('q') ?? '').trim();
      if (!q) throw httpError(400, 'Type something to search for');
      return json(res, 200, await searchImages(q.slice(0, 120), url.searchParams.get('source') ?? 'all', Math.max(0, Math.min(40, Number(url.searchParams.get('page')) || 0))));
    }
    if (p === '/player.js') return sendFile(req, res, path.join(ROOT, 'studio/player/player.js'));
    if (p === '/timing.js') return sendFile(req, res, path.join(ROOT, 'studio/timing.js'));
    if (p === '/thumb.js') return sendFile(req, res, path.join(ROOT, 'studio/thumb.js'));
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
    // Anything that changes a lesson or a drawing: back it up a few minutes after the last change.
    if (id && /^\/api\/(save|use-spoken|quiz|slide|timing|scene|audio|take|ask|images\/import)$/.test(p)) backupSoon(id, lessonPaths(id), id);
    if (/^\/api\/sprite(\/delete|\/favorite)?$/.test(p)) backupSoon('sprites', ['sprites'], 'drawings');
    if (/^\/api\/battle(\/new)?$/.test(p)) backupSoon('battles', ['battles'], 'battles');
    if (p === '/api/battle') {
      const body = await readJson(req);
      try { const name = saveBattle(body.name, body.battle); return json(res, 200, {name, battles: listBattles()}); } catch (e) { throw httpError(400, e.message); }
    }
    if (p === '/api/battle/new') {
      const body = await readJson(req);
      try { const name = newBattle(body.name, body.title); return json(res, 200, {name, battles: listBattles()}); } catch (e) { throw httpError(400, e.message); }
    }
    if (p === '/api/save') {
      const dir = lessonPath(id);
      const body = await readJson(req);
      const edit = {section: body.section};
      if (typeof body.text === 'string') edit.text = body.text;
      if (typeof body.lead === 'string') edit.lead = body.lead;
      // Her own slides: the title, quotation and source too (a lesson's checked quotations stay locked).
      const own = loadLesson(dir).segments.find((x) => x.name === body.section)?.own;
      if (own) for (const k of ['heading', 'quote', 'cite', 'link', 'highlight']) if (typeof body[k] === 'string') edit[k] = body[k];
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
    if (p === '/api/new-lesson') {
      const {course, title} = await readJson(req);
      // A course on Ghost that isn't here yet: continue its numbering after its published lessons.
      const published = course?.ghost ? Number(course.posts) || 0 : 0;
      try {
        const made = newLesson({course: course ?? {}, title, published});
        backupSoon(made, lessonPaths(made), `${made} (new lesson)`);
        return json(res, 200, {id: made, lessons: lessonIds().map(summary)});
      }
      catch (e) { throw httpError(400, e.message); }
    }
    if (p === '/api/kids-thumb') {
      // The thumbnail maker: {pics: [{sprite, x, y, size, frame, flip}]} (none: back to automatic).
      const {pics, save} = await readJson(req);
      if (!Array.isArray(pics) || pics.length > 3) throw httpError(400, 'Up to 3 drawings');
      const names = new Set(listSprites().map((x) => x.slug));
      const clean = pics.map((q) => {
        if (!names.has(q.sprite)) throw httpError(400, 'No drawing called ' + q.sprite);
        const n = (v, lo, hi) => Math.round(Math.min(hi, Math.max(lo, Number(v) || 0)));
        return {sprite: q.sprite, x: n(q.x, -200, 1480), y: n(q.y, -200, 920), size: n(q.size, 40, 1400), frame: n(q.frame, 0, 7), ...(q.flip ? {flip: true} : {})};
      });
      if (save) {
        const dir = lessonPath(id);
        const {pics: _, ...old} = loadLesson(dir).lesson.thumb ?? {};
        setValue(dir, ['thumb'], clean.length ? {...old, sprite: clean[0].sprite, pics: clean} : old);
      }
      return json(res, 200, kidsThumb(id, save ? undefined : clean));
    }
    if (p === '/api/thumb') {
      // A kids lesson's thumbnail drawing (`thumb: {sprite}` in lesson.yml).
      const dir = lessonPath(id);
      const {sprite} = await readJson(req);
      if (!listSprites().some((x) => x.slug === sprite)) throw httpError(400, 'No drawing by that name');
      const old = loadLesson(dir).lesson.thumb ?? {};
      setValue(dir, ['thumb'], {...old, sprite});
      return json(res, 200, detail(id));
    }
    if (p === '/api/quiz') {
      // A slide's quiz questions (her own slides), checked the same way the post checks them.
      const dir = lessonPath(id);
      const {section, quiz} = await readJson(req);
      const point = loadLesson(dir).segments.find((x) => x.name === section);
      if (!point || point.kind !== 'point' || !point.own) throw httpError(400, 'Quiz questions can be edited here on slides you made in the studio');
      if (!Array.isArray(quiz)) throw httpError(400, 'Bad quiz');
      const clean = quiz.map((q, i) => {
        try { normalizeQuestion(q, String(i + 1)); } catch (e) { throw httpError(400, e.message.replace(/^Quiz in "(\d+)"[: ]*/, 'Question $1: ')); }
        const type = q.type ?? 'choice';
        return type === 'choice' ? {type, question: q.question.trim(), options: q.options.map((o) => o.trim()), answer: q.answer, why: q.why.trim()}
          : type === 'truefalse' ? {type, question: q.question.trim(), answer: q.answer, why: q.why.trim()}
          : {type, question: q.question.trim(), accept: q.accept.map((a) => a.trim()).filter(Boolean), why: q.why.trim()};
      });
      setValue(dir, ['points', point.index - 1, 'quiz'], clean);
      setStatus(dir, 'draft');
      const check = await checkQuotes(id);
      return json(res, 200, {check, lesson: detail(id)});
    }
    if (p === '/api/slide') {
      // Add a blank slide after this one, add the closing slide, or remove a slide.
      const dir = lessonPath(id);
      const {op, section} = await readJson(req);
      let slide;
      try {
        if (op === 'add') slide = addSlide(dir, section);
        else if (op === 'add-closing') slide = addClosing(dir);
        else if (op === 'remove') removeSlide(dir, section);
        else throw new Error('Unknown change');
      } catch (e) { throw httpError(400, e.message); }
      setStatus(dir, 'draft');
      return json(res, 200, {slide, lesson: detail(id)});
    }
    if (p === '/api/sprite/favorite') {
      const {slug, on} = await readJson(req);
      try { setFavorite(slug, !!on); } catch (e) { throw httpError(409, e.message); }
      return json(res, 200, {sprites: listSprites()});
    }
    if (p === '/api/sprite/delete') {
      const {slug} = await readJson(req);
      try { deleteSprite(slug); } catch (e) { throw httpError(409, e.message); }
      return json(res, 200, {sprites: listSprites()});
    }
    if (p === '/api/sprite') {
      // (a sketch's frames are pictures, so this can be a few megabytes)
      const slug = saveSprite(JSON.parse(String(await readBody(req, 60e6)) || '{}'));
      return json(res, 200, {slug, sprites: listSprites()});
    }
    if (p === '/api/sprite/version') {
      // A color version of a base character: her recolored idle, and the other poses made from it.
      let out;
      try { out = colorVersion(await readJson(req)); } catch (e) { throw httpError(409, e.message); }
      return json(res, 200, {...out, sprites: listSprites(), ...puppetBases()});
    }
    if (p === '/api/sprite/copy-pose') {
      // A pose she drew on one character, as drafts for others ({from, pose, to: [...], save}).
      let out;
      try { out = copyPose(await readJson(req)); } catch (e) { throw httpError(409, e.message); }
      return json(res, 200, {drafts: out, sprites: listSprites()});
    }
    if (p === '/api/sprite/gif') {
      // A drawing as an animated GIF (frames come as PNG pictures, already enlarged): made with ffmpeg.
      const {frames, fps} = JSON.parse(String(await readBody(req, 60e6)) || '{}');
      if (!Array.isArray(frames) || !frames.length || frames.length > 8) throw httpError(400, 'No frames');
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sd-gif-'));
      try {
        frames.forEach((f, i) => fs.writeFileSync(path.join(tmp, `${i}.png`), Buffer.from(String(f).replace(/^data:image\/png;base64,/, ''), 'base64')));
        const rate = Math.min(30, Math.max(1, Number(fps) || 6));
        await run('ffmpeg', ['-y', '-v', 'error', '-framerate', String(rate), '-i', path.join(tmp, '%d.png'),
          '-filter_complex', 'split[a][b];[a]palettegen=reserve_transparent=1:stats_mode=full[p];[b][p]paletteuse=dither=none:alpha_threshold=128', '-loop', '0', path.join(tmp, 'out.gif')]);
        const gif = fs.readFileSync(path.join(tmp, 'out.gif'));
        res.writeHead(200, {'Content-Type': 'image/gif', 'Content-Length': gif.length});
        return res.end(gif);
      } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
    }
    if (p === '/api/timing') {
      const {timing} = await readJson(req);
      saveTiming(id, timing);
      return json(res, 200, timingData(id));
    }
    if (p === '/api/images/upload') {
      // A picture from her Mac, sent as the raw file.
      const buf = await readBody(req, 60e6);
      return json(res, 200, importUpload(lessonPath(id), Buffer.from(buf), url.searchParams.get('name') ?? 'picture'));
    }
    if (p === '/api/images/import') {
      // Download a picked image into the lesson (with its credit); the page then adds the scene.
      const {img} = await readJson(req);
      return json(res, 200, await importImage(lessonPath(id), img));
    }
    if (p === '/api/scene') {
      // Add a picture at a time (seconds into the recording), or remove one.
      const dir = lessonPath(id);
      const lastBody = await readJson(req);
      let {op, scene, start} = lastBody;
      const {section, index, value} = lastBody;
      if (!/^(intro|outro|point-\d+)$/.test(section ?? '')) throw httpError(400, 'Bad section');
      const {props} = prepare(id);
      const seg = props.segments.find((s) => s.name === section);
      if (!seg) throw httpError(400, 'No such section');
      let at = index;
      if (op === 'duplicate') {
        // A copy of this picture, a second later, as its own picture.
        if (!Number.isInteger(index) || index < sceneList(section, dir).first || !seg.scenes[index]) throw httpError(400, 'No such picture');
        const old = loadLesson(dir).segments.find((x) => x.name === section).scenes[index];
        if (!old) throw httpError(400, 'That one can\'t be copied');
        const {at: _at, with: _with, ...copy} = old;
        op = 'add'; scene = copy; start = (seg.scenes[index].from - seg.audioOffsetInFrames) / 30 + 1;
      }
      if (op === 'add') {
        if (!scene || typeof scene.type !== 'string') throw httpError(400, 'Missing scene');
        // After every scene that starts before it; never before a point's quotation.
        const f = seg.audioOffsetInFrames + start * 30;
        at = Math.max(sceneList(section, dir).first, seg.scenes.filter((s) => (s.from ?? 0) <= f).length);
        // Beside or over the picture before: only when there is one it can share with.
        if (scene.with != null && (!['side', 'over'].includes(scene.with) || at < 1)) delete scene.with;
      } else if (op === 'with') {
        // Show this picture with the one before it: beside it, over it, or on its own (null).
        if (!Number.isInteger(index) || index < 1 || index < sceneList(section, dir).first) throw httpError(400, 'Only a picture after another one can share its space');
        if (![null, 'side', 'over'].includes(value)) throw httpError(400, 'Bad choice');
        editScenes(dir, section, 'set', index, null, 'with', value);
        setStatus(dir, 'draft');
        return json(res, 200, timingData(id));
      } else if (op === 'replace') {
        // Edit a picture (from the Timing tab's form): keep what the form doesn't show.
        if (!Number.isInteger(index) || index < sceneList(section, dir).first) throw httpError(400, 'No such picture');
        if (!scene || typeof scene.type !== 'string') throw httpError(400, 'Missing scene');
        const old = loadLesson(dir).segments.find((x) => x.name === section).scenes[index] ?? {};
        const keep = Object.fromEntries(['with', 'at', 'cues', 'src', 'aspect', 'credit', 'fit', 'focus'].filter((k) => old[k] !== undefined && scene[k] === undefined).map((k) => [k, old[k]]));
        editScenes(dir, section, 'replace', index, {...scene, ...keep});
        setStatus(dir, 'draft');
        return json(res, 200, timingData(id));
      } else if (op === 'set') {
        // A picture's framing, crop focus, caption or credit line (null removes it).
        const {key} = lastBody;
        const ok = {fit: ['cover', 'screen'], focus: ['top', 'bottom']};
        if (!Number.isInteger(index) || index < sceneList(section, dir).first) throw httpError(400, 'No such picture');
        if (!['fit', 'focus', 'caption', 'credit'].includes(key)) throw httpError(400, 'That can\'t be changed here');
        if (seg.scenes[index]?.type !== 'image') throw httpError(400, 'Only a picture has these options');
        if (value != null && (ok[key] ? !ok[key].includes(value) : typeof value !== 'string' || value.length > 200)) throw httpError(400, 'Bad choice');
        editScenes(dir, section, 'set', index, null, key, value == null ? null : ok[key] ? value : JSON.stringify(value));
        setStatus(dir, 'draft');
        return json(res, 200, timingData(id));
      } else if (op !== 'remove' || !Number.isInteger(index) || index < sceneList(section, dir).first) throw httpError(400, 'That picture can\'t be removed here');
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

// ---------- the iPad drawing page ----------
// Only the Pixel art tab, on the home Wi-Fi, behind her PIN (STUDIO_DRAW_PIN in .env):
// http://<this Mac>.local:5179/draw. Everything else (recording, lessons, Ghost) stays on this
// Mac only. A right PIN gets a cookie for this run of the studio; 5 wrong ones wait a minute.
const DRAW_PORT = 5179;
const DRAW_PATHS = /^(\/ask\.js|\/pixels\.js|\/sketch\.js|\/reference\.js|\/fonts\/[\w.-]+|\/sprites\/[a-z0-9-]+\/\d+\.png|\/api\/sprites|\/api\/sprite|\/api\/sprite\/delete|\/api\/sprite\/favorite|\/api\/sprite\/gif|\/api\/sprite\/version|\/api\/sprite\/copy-pose|\/api\/puppet-bases|\/api\/fetch-image|\/api\/images\/search|\/api\/images\/sources)$/;
const draw = {tokens: new Set(), misses: 0, waitUntil: 0};
const cookieToken = (req) => /(?:^|;\s*)sd_draw=([a-f0-9]{48})/.exec(req.headers.cookie ?? '')?.[1];

function drawPage(res, signedIn, message = '') {
  const html = fs.readFileSync(path.join(ROOT, 'studio', 'index.html'), 'utf8');
  const style = (/<style>[\s\S]*?<\/style>/.exec(html) ?? [''])[0];
  const body = signedIn
    ? `<main class="draw-only"><h1 class="draw-title">Pixel art</h1><div id="draw"></div></main>
<script src="/ask.js"></script><script src="/reference.js"></script><script src="/pixels.js"></script><script src="/sketch.js"></script>
<script>
'use strict';
const api = (p, o = {}) => fetch(p, {...o, headers: {...(o.headers || {}), 'X-Studio': '1'}}).then((r) => r.json().catch(() => ({})).then((j) => { if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j; }));
const post = (p, d) => api(p, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(d || {})});
const get = (k) => { try { return localStorage.getItem('studio.' + k); } catch { return null; } };
const root = document.getElementById('draw');
let tab = null;
function show() {
  const mode = get('drawMode') === '"sketch"' ? 'sketch' : 'pixel';
  const inner = document.createElement('div'); inner.className = 'stack';
  const seg = document.createElement('div'); seg.className = 'seg'; seg.setAttribute('role', 'group');
  for (const [m, label] of [['pixel', 'Pixel art (on a grid)'], ['sketch', 'Sketch (free drawing)']]) {
    const b = document.createElement('button'); b.textContent = label; b.setAttribute('aria-pressed', String(mode === m));
    b.onclick = () => { if (mode === m) return; if (tab && tab.dirty() && !confirm('Your drawing isn’t saved. Leave it?')) return; try { localStorage.setItem('studio.drawMode', JSON.stringify(m)); } catch {} show(); };
    seg.append(b);
  }
  root.replaceChildren(seg, inner);
  tab = (mode === 'sketch' ? window.SketchTab : window.PixelTab).open(inner, api, post, window.DrawReference);
}
window.addEventListener('beforeunload', (e) => { if (tab && tab.dirty()) { e.preventDefault(); e.returnValue = ''; } });
show();
</script>`
    : `<main class="draw-only"><h1 class="draw-title">Lesson Studio drawing</h1>
<form method="post" action="/draw/login" class="card stack" style="max-width:360px">
<label for="pin">PIN</label><input id="pin" name="pin" class="read-line" inputmode="numeric" autocomplete="off" maxlength="12" autofocus>
${message ? `<div class="small bad">${message}</div>` : ''}<button class="btn primary">Open</button></form></main>`;
  res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'});
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pixel art · Lesson Studio</title>${style}
<style>.draw-only{max-width:1200px;margin:0 auto;padding:18px}.draw-title{font:600 28px/1.2 var(--serif);margin:0 0 14px}body{-webkit-user-select:none;user-select:none}input,textarea{-webkit-user-select:text;user-select:text}</style></head><body class="wide">${body}</body></html>`);
}

async function handleDraw(req, res) {
  const pin = process.env.STUDIO_DRAW_PIN;
  const url = new URL(req.url, 'http://draw');
  const p = url.pathname;
  const signedIn = !!cookieToken(req) && draw.tokens.has(cookieToken(req));
  if (p === '/' || p === '/draw' || p === '/draw/') return drawPage(res, signedIn);
  if (p === '/draw/login' && req.method === 'POST') {
    if (Date.now() < draw.waitUntil) return drawPage(res, false, 'Too many tries. Wait a minute, then try again.');
    const given = new URLSearchParams(String(await readBody(req, 2000))).get('pin') ?? '';
    const a = crypto.createHash('sha256').update(given).digest(), b = crypto.createHash('sha256').update(pin).digest();
    if (!crypto.timingSafeEqual(a, b)) {
      if (++draw.misses >= 5) { draw.misses = 0; draw.waitUntil = Date.now() + 60000; }
      return drawPage(res, false, 'That PIN isn’t right.');
    }
    draw.misses = 0;
    const token = crypto.randomBytes(24).toString('hex');
    draw.tokens.add(token);
    res.writeHead(303, {Location: '/draw', 'Set-Cookie': `sd_draw=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`});
    return res.end();
  }
  if (!signedIn) throw httpError(401, 'Open /draw and enter the PIN first');
  if (!DRAW_PATHS.test(p)) throw httpError(404, 'Not found');
  if (req.method === 'POST' && (req.headers['x-studio'] !== '1' || (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host))) throw httpError(403, 'Forbidden');
  // Hand the request to the studio as if it came from this Mac (it's one of the drawing paths above).
  req.headers.host = `localhost:${PORT}`;
  if (req.headers.origin) req.headers.origin = `http://localhost:${PORT}`;
  return handle(req, res);
}

if (process.env.STUDIO_DRAW_PIN) {
  const drawServer = http.createServer((req, res) => handleDraw(req, res).catch((e) => {
    if (!e.status) console.error(e);
    if (!res.headersSent) json(res, e.status ?? 500, {error: e.message}); else res.end();
  }));
  drawServer.on('error', (e) => console.log(`iPad drawing page unavailable: ${e.message}`));
  drawServer.listen(DRAW_PORT, '0.0.0.0', () => console.log(`iPad drawing page: http://${os.hostname().split('.')[0]}.local:${DRAW_PORT}/draw (PIN in .env)`));
}

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
