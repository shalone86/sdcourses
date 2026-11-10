// Music videos (the studio's Music videos tool): songs/<name>/song.yml plus the song itself
// (song.mp3 or .wav, made in Logic) and, when she has it, its MIDI (song.mid).
//   slides: lyric lines with a start time on the song, a background and her characters,
//   each dancing to the beat or to one part of the song (drums, bass, melody…).
//   parts: when each part plays. Exact from the MIDI's tracks; without a MIDI, guessed from
//   the sound (low sounds, sharp hits, the middle).
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import YAML from 'yaml';
import {ROOT} from './lib.mjs';
import {detectBeats} from './beats.mjs';
import {loadSprite, publishSketch, spriteSlug} from './sprites.mjs';

export const SONGS = path.join(ROOT, 'songs');
export const songSlug = (n) => String(n ?? '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const AUDIO = ['.mp3', '.wav', '.m4a', '.aif', '.aiff'];
const dirOf = (name) => path.join(SONGS, songSlug(name));
const round = (v, n = 3) => Math.round(v * 10 ** n) / 10 ** n;
const num = (v, lo, hi, d = 0) => (Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Number(v))) : d);
const color = (c) => (/^#[0-9a-f]{6}$/i.test(String(c ?? '')) ? String(c).toUpperCase() : null);

export const audioFile = (name) => AUDIO.map((e) => path.join(dirOf(name), `song${e}`)).find((f) => fs.existsSync(f)) ?? null;
export const midiFile = (name) => { const f = path.join(dirOf(name), 'song.mid'); return fs.existsSync(f) ? f : null; };

export function listSongs() {
  if (!fs.existsSync(SONGS)) return [];
  return fs.readdirSync(SONGS).filter((d) => fs.existsSync(path.join(SONGS, d, 'song.yml'))).sort().map((d) => {
    let title = d;
    try { title = YAML.parse(fs.readFileSync(path.join(SONGS, d, 'song.yml'), 'utf8')).title ?? d; } catch {}
    return {name: d, title};
  });
}

export function loadSong(name) {
  const f = path.join(dirOf(name), 'song.yml');
  if (!songSlug(name) || !fs.existsSync(f)) throw new Error(`No song "${name}" (songs/${songSlug(name)}/song.yml)`);
  return cleanSong(YAML.parse(fs.readFileSync(f, 'utf8')) ?? {});
}

const MOVES = ['hop', 'sway', 'grow', 'still'];
const cleanBack = (b) => {
  if (!b || typeof b !== 'object') return undefined;
  if (b.sprite && spriteSlug(b.sprite)) return {sprite: spriteSlug(b.sprite), ...(color(b.color) ? {color: color(b.color)} : {})};
  return color(b.color) ? {color: color(b.color)} : undefined;
};
const cleanCast = (list) => (Array.isArray(list) ? list.slice(0, 12).map((c) => ({
  sprite: spriteSlug(c?.sprite), x: Math.round(num(c?.x, -400, 2320, 960)), y: Math.round(num(c?.y, -400, 1480, 600)), size: Math.round(num(c?.size, 24, 1400, 420)),
  ...(c?.flip ? {flip: true} : {}), to: String(c?.to ?? 'beat').slice(0, 60), ...(MOVES.includes(c?.move) && c.move !== 'hop' ? {move: c.move} : {}),
})).filter((c) => c.sprite) : undefined);

/** Only what a song file can hold, with sane limits (the page sends whatever she edited). */
export function cleanSong(s) {
  if (!s || typeof s !== 'object') throw new Error('Not a song');
  const slides = (Array.isArray(s.slides) ? s.slides : []).slice(0, 400).map((sl) => {
    const words = String(sl?.words ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
    const at = sl?.at == null || sl.at === '' || !Number.isFinite(Number(sl.at)) ? null : round(num(sl.at, 0, 3600), 2);
    const count = words ? words.split(' ').length : 0;
    // Word times (sing-along): one per word, or none.
    const times = Array.isArray(sl?.times) && sl.times.length === count && count && sl.times.every((t) => Number.isFinite(Number(t))) ? sl.times.map((t) => round(num(t, 0, 3600), 2)) : undefined;
    const back = cleanBack(sl?.back), cast = cleanCast(sl?.cast);
    return {at, words, ...(times ? {times} : {}), ...(back ? {back} : {}), ...(cast ? {cast} : {})};
  });
  if (!slides.length) slides.push({at: 0, words: ''});
  return {
    title: String(s.title ?? '').trim().slice(0, 100) || 'Song',
    color: color(s.color) ?? '#FFF6E0',
    shapes: s.shapes !== false,
    words: ['top', 'middle', 'bottom'].includes(s.words) ? s.words : 'bottom',
    slides,
  };
}

export function saveSong(name, song) {
  const slug = songSlug(name);
  if (!slug) throw new Error('Give the song a name');
  const s = cleanSong(song);
  fs.mkdirSync(dirOf(slug), {recursive: true});
  const flow = (v) => JSON.stringify(v).replace(/"([a-z]+)":/g, '$1: ').replace(/,/g, ', ');
  // One slide per block, short lists on one line, so the file stays readable.
  const out = [`title: ${JSON.stringify(s.title)}`, `color: '${s.color}'`, `shapes: ${s.shapes}`, `words: ${s.words}`, 'slides:'];
  for (const sl of s.slides) {
    out.push(`  - at: ${sl.at == null ? 'null' : sl.at}`, `    words: ${JSON.stringify(sl.words)}`);
    if (sl.times) out.push(`    times: [${sl.times.join(', ')}]`);
    if (sl.back) out.push(`    back: ${flow(sl.back)}`);
    if (sl.cast) out.push('    cast:' + (sl.cast.length ? '' : ' []'), ...sl.cast.map((c) => `      - ${flow(c)}`));
  }
  const text = out.join('\n') + '\n';
  // Safety net: it must read back as the same song before it replaces the file.
  if (JSON.stringify(cleanSong(YAML.parse(text))) !== JSON.stringify(s)) throw new Error('That song could not be saved safely (nothing was changed)');
  fs.writeFileSync(path.join(dirOf(slug), 'song.yml'), text);
  return slug;
}

export function newSong(name, title) {
  const slug = songSlug(name);
  if (!slug) throw new Error('Give the song a name');
  // A song whose sound never arrived (the file was refused) can be started again.
  if (fs.existsSync(path.join(dirOf(slug), 'song.yml')) && audioFile(slug)) throw new Error('There is already a song with that name');
  return saveSong(slug, {title: title || name, slides: [{at: 0, words: ''}]});
}

/** Put the song's sound (or its MIDI) in its folder, replacing the one before. */
export function setSongFile(name, kind, buffer, ext) {
  const slug = songSlug(name);
  if (!fs.existsSync(path.join(dirOf(slug), 'song.yml'))) throw new Error('No such song');
  if (kind === 'midi') {
    if (buffer.toString('ascii', 0, 4) !== 'MThd') throw new Error('That is not a MIDI file');
    fs.writeFileSync(path.join(dirOf(slug), 'song.mid'), buffer);
    return;
  }
  const e = '.' + String(ext ?? '').toLowerCase().replace(/^\./, '');
  if (!AUDIO.includes(e)) throw new Error('The song should be an mp3, wav, m4a or aiff file');
  for (const x of AUDIO) fs.rmSync(path.join(dirOf(slug), `song${x}`), {force: true});
  fs.rmSync(path.join(dirOf(slug), 'song.beats.json'), {force: true});
  fs.writeFileSync(path.join(dirOf(slug), `song${e}`), buffer);
}

// ---------- when each part plays ----------

/** A MIDI file's notes by track name: {tracks: {name: [seconds…]}, beats: [seconds…], bpm}. Tracks with one name (Logic's regions) are one part. */
export function readMidi(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'MThd') throw new Error('Not a MIDI file');
  const n = b.readUInt16BE(10), div = b.readUInt16BE(12);
  if (div & 0x8000) throw new Error('This kind of MIDI timing is not supported');
  const tempos = [], notes = [];
  let p = 14;
  for (let t = 0; t < n && p < b.length; t++) {
    p += 4; const len = b.readUInt32BE(p); p += 4;
    const end = p + len;
    let tick = 0, run = 0, name = '';
    const mine = [];
    const vlq = () => { let v = 0, c; do { c = b[p++]; v = (v << 7) | (c & 127); } while (c & 128); return v; };
    while (p < end) {
      tick += vlq();
      let s = b[p];
      if (s & 128) { p++; if (s < 0xf0) run = s; } else s = run;
      if (s === 0xff) { const ty = b[p++], l = vlq(); if (ty === 3) name = b.toString('utf8', p, p + l).trim(); if (ty === 0x51) tempos.push([tick, (b[p] << 16) | (b[p + 1] << 8) | b[p + 2]]); p += l; }
      else if (s === 0xf0 || s === 0xf7) p += vlq();
      else { const hi = s & 0xf0, a = b[p++]; let v = 0; if (hi !== 0xc0 && hi !== 0xd0) v = b[p++]; if (hi === 0x90 && v > 0) mine.push([tick, a]); }
    }
    p = end;
    if (mine.length) notes.push({name: name || `Track ${t + 1}`, notes: mine});
  }
  tempos.sort((x, y) => x[0] - y[0]);
  if (!tempos.length || tempos[0][0] > 0) tempos.unshift([0, 500000]);
  const secs = (tick) => { let s = 0; for (let i = 0; i < tempos.length; i++) { const [t0, us] = tempos[i], t1 = tempos[i + 1]?.[0] ?? Infinity; if (tick <= t0) break; s += ((Math.min(tick, t1) - t0) / div) * us / 1e6; } return s; };
  const tracks = {};
  for (const tr of notes) (tracks[tr.name] ??= []).push(...tr.notes.map(([tick]) => secs(tick)));
  // A chord is one hit.
  for (const k of Object.keys(tracks)) { const a = tracks[k].sort((x, y) => x - y); tracks[k] = a.filter((t, i) => !i || t - a[i - 1] > 0.03).map((t) => round(t)); }
  const lastTick = Math.max(0, ...notes.flatMap((tr) => tr.notes.map(([t]) => t)));
  const beats = [];
  for (let tick = 0; tick <= lastTick + div; tick += div) beats.push(round(secs(tick)));
  return {tracks, beats, bpm: round(60e6 / tempos[0][1], 1)};
}

const RATE = 22050, HOP = 512;
/** The moments a sound starts in one band of the song (seconds). */
function onsets(file, filter) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-af', filter, '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-'], {maxBuffer: 1 << 30});
  const pcm = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.byteLength / 4));
  const n = Math.floor(pcm.length / HOP), loud = new Float32Array(n), flux = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let j = i * HOP; j < (i + 1) * HOP; j++) s += pcm[j] * pcm[j]; loud[i] = Math.log(1e-5 + Math.sqrt(s / HOP)); }
  for (let i = 1; i < n; i++) flux[i] = Math.max(0, loud[i] - loud[i - 1]);
  const fps = RATE / HOP, win = Math.round(fps), out = [];
  for (let i = 2; i < n - 2; i++) {
    if (flux[i] < flux[i - 1] || flux[i] < flux[i + 1] || flux[i] < flux[i - 2] || flux[i] < flux[i + 2] || loud[i] < -7) continue;
    let m = 0, c = 0;
    for (let j = Math.max(0, i - win); j < Math.min(n, i + win); j++) { m += flux[j]; c++; }
    if (flux[i] > 0.25 + 2.5 * (m / c) && (!out.length || i / fps - out[out.length - 1] > 0.12)) out.push(round(i / fps));
  }
  return out;
}

export function songSeconds(name) {
  const f = audioFile(name);
  if (!f) return 0;
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim()) || 0;
}

/**
 * When each part of the song plays: {duration, bpm, exact, parts: [{key, label, hits: [seconds…]}]}.
 * "beat" is always first. Kept in songs/<name>/parts.json until the song or its MIDI changes.
 */
export function songParts(name) {
  const audio = audioFile(name), midi = midiFile(name);
  const stampOf = (f) => (f ? `${path.basename(f)}:${fs.statSync(f).size}:${Math.round(fs.statSync(f).mtimeMs)}` : '-');
  const stamp = `2|${stampOf(audio)}|${stampOf(midi)}`;
  const cache = path.join(dirOf(name), 'parts.json');
  if (fs.existsSync(cache)) { try { const c = JSON.parse(fs.readFileSync(cache, 'utf8')); if (c.stamp === stamp) return c; } catch {} }
  const duration = round(songSeconds(name));
  const within = (a) => (duration ? a.filter((t) => t <= duration) : a);
  let out;
  if (midi) {
    const m = readMidi(midi);
    const used = new Set(['beat']);
    const parts = Object.entries(m.tracks).map(([label, hits]) => { let key = songSlug(label) || 'part'; while (used.has(key)) key += '-2'; used.add(key); return {key, label, hits: within(hits)}; }).filter((x) => x.hits.length);
    // Without the song's sound yet, the MIDI says how long it is.
    out = {stamp, duration: duration || round(Math.max(0, ...parts.flatMap((x) => x.hits)) + 2), bpm: m.bpm, exact: true, parts: [{key: 'beat', label: 'The beat', hits: within(m.beats)}, ...parts]};
  } else if (audio) {
    const b = detectBeats(audio);
    out = {stamp, duration, bpm: b.bpm, exact: false, parts: [
      {key: 'beat', label: 'The beat', hits: b.beats},
      {key: 'drums', label: 'Drums (a guess: sharp hits)', hits: onsets(audio, 'highpass=f=5000')},
      {key: 'bass', label: 'Bass (a guess: low sounds)', hits: onsets(audio, 'lowpass=f=160')},
      {key: 'melody', label: 'Melody (a guess: the middle)', hits: onsets(audio, 'highpass=f=400,lowpass=f=3000')},
    ]};
  } else out = {stamp, duration: 0, bpm: 0, exact: false, parts: [{key: 'beat', label: 'The beat', hits: []}]};
  fs.writeFileSync(cache, JSON.stringify(out));
  return out;
}

/** A drawing for the video (a sketch's pictures are copied where the video can load them). */
export function songArt(name, sprite) {
  const slug = songSlug(name);
  const art = publishSketch(loadSprite(sprite), path.join(ROOT, 'video', 'public', 'songs', slug), `songs/${slug}`);
  return {kind: art.kind === 'sketch' ? 'sketch' : undefined, width: art.width, height: art.height, fps: art.fps, palette: art.palette, frames: art.kind === 'comic' ? art.frames.slice(0, 1) : art.frames};
}

/** Everything the MusicVideo composition needs. The song's sound is copied where the video can load it. */
export function songProps(name) {
  const slug = songSlug(name);
  const song = loadSong(slug);
  const pub = path.join(ROOT, 'video', 'public', 'songs', slug);
  fs.mkdirSync(pub, {recursive: true});
  const src = audioFile(slug);
  let audio = null;
  if (src) {
    const dest = path.join(pub, path.basename(src));
    if (!fs.existsSync(dest) || fs.statSync(dest).size !== fs.statSync(src).size || fs.statSync(dest).mtimeMs < fs.statSync(src).mtimeMs) fs.copyFileSync(src, dest);
    audio = `songs/${slug}/${path.basename(src)}`;
  }
  const p = songParts(slug);
  const arts = {}, missing = [];
  const names = new Set(song.slides.flatMap((s) => [...(s.cast ?? []).map((c) => c.sprite), s.back?.sprite]).filter(Boolean));
  for (const n of names) { try { arts[n] = songArt(slug, n); } catch { missing.push(n); } }
  return {song, audio, duration: p.duration, parts: Object.fromEntries(p.parts.map((x) => [x.key, x.hits])), partNames: p.parts.map((x) => ({key: x.key, label: x.label, count: x.hits.length})), exact: p.exact, bpm: p.bpm, hasMidi: !!midiFile(slug), arts, missing};
}
