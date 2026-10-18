// What Shalone actually said, from her recordings:
//   trimVoice   the silence trim used in the video (prepare.mjs) and the studio
//   transcribe  Whisper (whisper-cli, on this Mac) with word timings, cached as
//               audio/<section>.words.json next to the recording
//   compare     script vs. what she said: word differences, the script
//               rewritten to her words, and whether a quotation was misread
//   phraseTime  when a phrase is spoken (for timing scenes)
// Times are seconds into the trimmed voice, which is what the video plays.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {ROOT, ffprobeDuration, loadSite} from './lib.mjs';

const LEAD = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.1';
const TRIM = `${LEAD},areverse,silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.35,areverse,loudnorm=I=-16:TP=-1.5:LRA=11`;
const VERSION = 2; // bump if TRIM or the hint changes, so cached word timings are redone

/** Trim silence at both ends and level the voice (raw file untouched). Skips work if dest is current. */
export function trimVoice(src, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).mtimeMs >= fs.statSync(src).mtimeMs) return dest;
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-af', TRIM, '-ac', '1', '-ar', '48000', dest]);
  return dest;
}

/** Seconds the trim removes from the start of a recording (so a camera clip can be cut to match). */
export function trimLead(src) {
  const tmp = path.join(os.tmpdir(), `sdcourses-lead-${process.pid}.wav`);
  try {
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-af', LEAD, '-ac', '1', '-ar', '48000', tmp]);
    return Math.max(0, ffprobeDuration(src) - ffprobeDuration(tmp));
  } finally { fs.rmSync(tmp, {force: true}); }
}

const modelPath = () => process.env.WHISPER_MODEL
  || loadSite().whisperModel
  || path.join(os.homedir(), 'Library/Application Support/LyricsTranscriber/models/ggml-small.bin');

export function whisperAvailable() {
  try { execFileSync('whisper-cli', ['--help'], {stdio: 'ignore'}); } catch { return false; }
  return fs.existsSync(modelPath());
}

const wordsFile = (src) => src.replace(/\.[^.]+$/, '.words.json');
const stamp = (src) => { const s = fs.statSync(src); return `${VERSION}:${s.size}:${Math.round(s.mtimeMs)}`; };

/** Cached transcript for a recording, or null if it hasn't been made (or is out of date). */
export function cachedWords(src) {
  const f = wordsFile(src);
  if (!fs.existsSync(f)) return null;
  const c = JSON.parse(fs.readFileSync(f, 'utf8'));
  return c.stamp === stamp(src) ? c.words : null;
}

/**
 * A short hint for Whisper: the names and unusual words in the script, not the
 * script itself (a long hint makes Whisper skip and repeat passages).
 */
function vocabulary(text) {
  const author = loadSite().author;
  const words = String(text).match(/\b[A-Z][a-zA-Z’'-]{2,}\b/g) ?? [];
  const common = new Set(['The', 'This', 'That', 'There', 'These', 'They', 'Then', 'When', 'What', 'Why', 'How', 'And', 'But', 'From', 'With', 'For', 'Its', 'His', 'Her', 'Our', 'Your', 'Let', 'Well', 'Even', 'Thanks', 'Until', 'Before', 'After', 'Each', 'Every', 'Like', 'Just', 'Both', 'Among', 'Over', 'Most', 'Other']);
  const names = [...new Set(words.filter((w) => !common.has(w)))].slice(0, 30);
  return [author, ...names].filter(Boolean).join(', ') + '.';
}

/**
 * Transcribe a recording (its trimmed version, so times match the video).
 * `hint` is the script text: it helps Whisper with names and spellings.
 */
export function transcribe(src, trimmed, hint = '') {
  const have = cachedWords(src);
  if (have) return have;
  trimVoice(src, trimmed);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-'));
  try {
    const wav16 = path.join(tmp, 'v.wav');
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', trimmed, '-ar', '16000', '-ac', '1', wav16]);
    execFileSync('whisper-cli', ['-m', modelPath(), '-f', wav16, '-l', 'en', '-ml', '1', '-sow', '-dtw', 'small', '-oj', '-of', path.join(tmp, 'out'),
      ...(hint ? ['--prompt', vocabulary(hint)] : [])], {stdio: 'ignore'});
    const out = JSON.parse(fs.readFileSync(path.join(tmp, 'out.json'), 'utf8'));
    const words = out.transcription
      .map((t) => ({w: t.text.trim(), start: t.offsets.from / 1000, end: t.offsets.to / 1000}))
      .filter((t) => t.w && !/^\[.*\]$/.test(t.w));
    fs.writeFileSync(wordsFile(src), JSON.stringify({stamp: stamp(src), words}, null, 1));
    return words;
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
}

// ---------- comparing ----------

const norm = (t) => t.normalize('NFKD').toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9']+/g, '').replace(/^'+|'+$/g, '');
// Same word, different spelling: numbers as digits or words, common abbreviations.
const NUM = {one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', twelve: '12', st: 'saint', sts: 'saints', mt: 'mount'};
const key = (t) => { const n = norm(t); return NUM[n] ?? n; };

/** Longest common subsequence of two token lists (by key), as index pairs. */
function lcs(a, b) {
  const n = a.length, m = b.length;
  const L = Array.from({length: n + 1}, () => new Int16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i].k === b[j].k ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const pairs = [];
  for (let i = 0, j = 0; i < n && j < m;) {
    if (a[i].k === b[j].k) { pairs.push([i, j]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  return pairs;
}

const tokens = (text, part) => String(text ?? '').split(/\s+/).filter(Boolean).map((t) => ({t, k: key(t), part})).filter((x) => x.k);

/**
 * Compare a section's script with what was said.
 * parts: {lead?, quote?, text} (a point has all three; intro/outro only text).
 * Returns the word diff, the script rewritten to her words (quotations kept
 * exactly), and any quotation words that were missed or added.
 */
export function compare(parts, words) {
  const script = [...tokens(parts.lead, 'lead'), ...tokens(parts.quote, 'quote'), ...tokens(parts.text, 'text')];
  const said = words.map((x) => ({t: x.w, k: key(x.w)})).filter((x) => x.k);
  const pairs = lcs(script, said);
  const diff = [];
  const out = {lead: [], text: []};
  const quoteMissing = [];
  const quoteAdded = [];
  let i = 0, j = 0;
  let part = script[0]?.part ?? 'text';
  const put = (p, t) => { if (p !== 'quote') out[p].push(t); };
  for (const [pi, pj] of [...pairs, [script.length, said.length]]) {
    for (; i < pi; i++) { diff.push({t: script[i].t, kind: 'removed'}); part = script[i].part; if (part === 'quote') quoteMissing.push(script[i].t); }
    // Words she added go with the part they follow (before the first word: the part that starts).
    const nextPart = script[pi]?.part ?? part;
    for (; j < pj; j++) {
      diff.push({t: said[j].t, kind: 'added'});
      const p = i === 0 ? nextPart : part;
      if (p === 'quote' && nextPart === 'quote') quoteAdded.push(said[j].t);
      else put(p === 'quote' ? 'text' : p, said[j].t);
    }
    if (pi < script.length) { diff.push({t: script[pi].t, kind: 'same'}); part = script[pi].part; put(part, script[pi].t); i++; j++; }
  }
  const changed = diff.some((d) => d.kind !== 'same');
  const join = (a) => a.join(' ').replace(/\s+([,.;:!?])/g, '$1');
  return {
    changed, diff,
    proposed: parts.quote !== undefined ? {lead: join(out.lead), text: join(out.text)} : {text: join(out.text)},
    quote: parts.quote === undefined ? null : {ok: !quoteMissing.length && !quoteAdded.length, missing: quoteMissing, added: quoteAdded},
  };
}

/** Start and end (seconds) of a long passage, e.g. a quotation: found by its first and last few words. */
export function phraseSpan(words, phrase, from = 0) {
  const t = tokens(phrase).map((x) => x.t);
  if (!t.length) return null;
  const n = Math.min(4, t.length);
  const start = phraseTime(words, t.slice(0, n).join(' '), from);
  if (start == null) return null;
  const endAt = phraseTime(words, t.slice(-n).join(' '), start);
  if (endAt == null) return null;
  // The end: the last matched word's end time.
  const w = words.filter((x) => key(x.w));
  const i = w.findIndex((x) => x.start >= endAt);
  const last = w[Math.min(w.length - 1, i + n - 1)];
  return {start, end: last ? last.end : endAt};
}

/** Seconds into the trimmed voice when `phrase` begins (at or after `from` seconds), or null. */
export function phraseTime(words, phrase, from = 0) {
  const p = tokens(phrase).map((x) => x.k);
  const w = words.map((x) => ({...x, k: key(x.w)})).filter((x) => x.k && x.start >= from);
  if (!p.length) return null;
  // Exact run first, then (for phrases of 4+ words) allow one word to differ.
  for (const slack of p.length >= 4 ? [0, 1] : [0]) {
    for (let s = 0; s + p.length <= w.length; s++) {
      let miss = 0;
      for (let q = 0; q < p.length && miss <= slack; q++) if (w[s + q].k !== p[q]) miss++;
      if (miss <= slack) return w[s].start;
    }
  }
  return null;
}

// Used by the studio to transcribe in a separate process (so the page stays responsive):
//   node scripts/voice.mjs <recording> <trimmed.wav>   (script text in VOICE_HINT)
if (import.meta.url === `file://${process.argv[1]}`) {
  const [src, trimmed] = process.argv.slice(2);
  transcribe(src, trimmed, process.env.VOICE_HINT ?? '');
}
