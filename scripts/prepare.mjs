// Turns lesson.yml (+ your recordings in audio/) into the video's props, and
// writes a recording script. Run: npm run prepare-lesson -- <course>/<lesson>
import fs from 'node:fs';
import YAML from 'yaml';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {ROOT, ffprobeDuration, lessonDir, loadLesson, loadSite, outDir, smartScene, words} from './lib.mjs';
import {phraseSpan, phraseTime, transcribe, trimVoice, whisperAvailable} from './voice.mjs';

const FPS = 30;
const HEADING_FRAMES = 66; // keep in sync with video/theme.ts
const WPS = 2.4;
export const MUSIC_TAIL = 90; // keep in sync with video/Lesson.tsx // ~145 words/minute, used until real audio exists
const AUDIO_EXT = ['.wav', '.m4a', '.mp3', '.aac', '.flac', '.ogg'];

let lessonHeadings = [];

export function prepare(arg) {
  const dir = lessonDir(arg);
  const {lesson, course, segments, id} = loadLesson(dir);
  const publicDir = path.join(ROOT, 'video', 'public', id);
  fs.mkdirSync(publicDir, {recursive: true});

  let recorded = 0;
  lessonHeadings = lesson.points.map((p) => p.heading);
  const useWhisper = whisperAvailable();
  const out = segments.map((s) => {
    const src = AUDIO_EXT.map((e) => path.join(dir, 'audio', s.name + e)).find((f) => fs.existsSync(f));
    let audio = null;
    let seconds = words(s.text) / WPS;
    let spoken = null;
    if (src) {
      // Trim silence at both ends (gently, keeping a little air after soft last
      // syllables), level to -16 LUFS, mono. Your raw file is untouched.
      const dest = trimVoice(src, path.join(publicDir, `${s.name}.wav`));
      audio = path.posix.join(id, `${s.name}.wav`);
      seconds = ffprobeDuration(dest);
      // Word timings (Whisper, cached) so scenes start on the words actually spoken.
      if (useWhisper) {
        try { spoken = transcribe(src, dest, s.text); } catch (e) { console.warn(`  ! ${s.name}: couldn't transcribe (${e.message}); timing estimated`); }
      }
      recorded++;
    }
    // Points open on their heading; narration starts while it is still on screen.
    const offset = s.kind === 'point' ? 20 : s.kind === 'intro' ? 45 : 15;
    const minFrames = s.kind === 'point' ? HEADING_FRAMES + s.scenes.length * 150 : s.scenes.length * 120;
    // The outro gets ~3s more so the music can close the video after the last word;
    // the intro ~1.5s more so its last picture (the Sign of the Cross) can be seen.
    const tail = s.kind === 'outro' ? 30 + MUSIC_TAIL : s.kind === 'intro' ? 75 : 30;
    const durationInFrames = Math.max(minFrames, Math.ceil(offset + seconds * FPS + tail));
    const scenes = timeScenes(s, offset, seconds, durationInFrames, spoken);
    return {name: s.name, kind: s.kind, index: s.index, heading: s.heading, text: s.text, scenes, audio, durationInFrames, audioOffsetInFrames: offset,
      ...(s.kind === 'point' ? {headingFrames: scenes[0]?.from ?? HEADING_FRAMES} : {})};
  });

  // The host scene's photo (site.yml host_photo); without one it shows initials.
  const site = loadSite();
  let hostPhoto = null;
  if (site.hostPhoto && fs.existsSync(path.resolve(ROOT, site.hostPhoto))) {
    const dest = path.join(publicDir, `host${path.extname(site.hostPhoto)}`);
    fs.copyFileSync(path.resolve(ROOT, site.hostPhoto), dest);
    hostPhoto = path.posix.join(id, path.basename(dest));
  } else if (out.some((s) => s.scenes.some((sc) => sc.type === 'host'))) {
    console.log(`  host photo not found (${site.hostPhoto || 'site.yml host_photo'}); showing initials`);
  }

  // Background music: lesson override, else the course's track, else site default. Copied into the
  // video's public folder; the composition loops it and keeps it low.
  const asCfg = (m) => (typeof m === 'string' ? {file: m} : m ?? {});
  const musicCfg = {...site.music, ...asCfg(course.music), ...asCfg(lesson.music)};
  let music = null;
  if (musicCfg.file) {
    const src = path.resolve(ROOT, musicCfg.file);
    if (!fs.existsSync(src)) throw new Error(`Music file not found: ${musicCfg.file}`);
    const dest = path.join(publicDir, `music${path.extname(src)}`);
    fs.copyFileSync(src, dest);
    music = {src: path.posix.join(id, path.basename(dest)), underVoice: musicCfg.under_voice ?? 0.05, between: musicCfg.between ?? 0.16, credit: musicCfg.credit ?? ''};
  }

  const props = {
    courseTitle: course.title,
    number: lesson.number,
    title: lesson.title,
    headings: lesson.points.map((p) => p.heading),
    credit: site.videoCredit,
    author: site.author,
    hostPhoto,
    music,
    segments: out,
  };
  // Hand-tuned timing from the studio's Timing tab wins over the automatic timing.
  const auto = structuredClone(props);
  applyTiming(props, loadTiming(dir));
  const dist = outDir(id);
  fs.writeFileSync(path.join(dist, 'props.json'), JSON.stringify(props, null, 2));
  fs.writeFileSync(path.join(dist, 'recording-script.md'), recordingScript(lesson, segments));

  const total = segments.reduce((n, s) => n + words(s.text), 0);
  const secs = out.reduce((n, s) => n + s.durationInFrames, 0) / FPS;
  console.log(`${id}: ${total} words, ${segments.length} segments (${recorded} recorded), video ${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, '0')}`);
  if (total > 650) console.warn(`  ! ${total} words; aim for ~600`);
  for (const s of segments) if ((s.kind === 'intro' || s.kind === 'outro') && !s.text) console.log(`  ${s.name}: not written yet (Shalone writes this)`);
  if (recorded < segments.length) console.log(`  missing audio: ${segments.filter((s, i) => !out[i].audio).map((s) => s.name).join(', ')} (timing estimated)`);
  return {props, auto, dist, id};
}

/**
 * Scene timing, in frames from the segment's start.
 * - A scene with `at: <phrase>` starts when that phrase is said (word timings
 *   from the recording when there are any, else its place in the script).
 * - In a point with a recording, the first visual starts when the quotation
 *   has been read, and later visuals when their first item is said.
 * - Items inside a scene (map places, titles, timeline and chain items,
 *   compare cards, recap lines) appear when they are said (`cues`), and a
 *   quotation reveals at the pace it was read. Explicit `cues:` phrases win.
 * Anything not found keeps the old even spacing.
 */
function timeScenes(s, offset, seconds, durationInFrames, spoken) {
  const text = s.text.toLowerCase();
  const sec = (t) => Math.round(offset + t * FPS);
  const at = (phrase, fromSec = 0) => {
    if (!phrase) return null;
    if (spoken) {
      const t = phraseTime(spoken, String(phrase), fromSec);
      if (t != null) return sec(t);
    }
    const i = text.indexOf(String(phrase).toLowerCase());
    return i < 0 ? null : Math.round(offset + (i / text.length) * seconds * FPS);
  };
  const quoteSpan = s.kind === 'point' && spoken ? phraseSpan(spoken, s.quote.text) : null;
  // The point's big heading stays while the lead-in is read; the quotation takes over when it begins.
  const first = s.kind === 'point' ? Math.max(HEADING_FRAMES, quoteSpan ? sec(quoteSpan.start) - 12 : 0) : 0;
  const items = (sc) => {
    switch (sc.type) {
      case 'map': return [...(sc.places ?? []).map((p) => (typeof p === 'string' ? p : p.name)).map((n) => [n, n]),
        // Areas cue on their name ("Byzantine Empire", "Ukraine"); empire ids are spoken by name.
        ...(sc.areas ?? []).map((a, i) => [`area-${i}`, a.includes('-') && /\d/.test(a) ? a.replace(/-\d+$/, '').replace(/-/g, ' ') : a])];
      case 'titles': return (sc.items ?? []).map((it, i) => [String(i), it.latin]);
      case 'timeline': return (sc.items ?? []).map((it, i) => [String(i), it.label]);
      case 'chain': return (sc.items ?? []).map((it, i) => [String(i), it]);
      case 'compare': return sc.emphasis === 'none' ? [] : [['decide', (sc.emphasis === 'left' ? sc.left : sc.right)?.title]];
      case 'union': return (sc.items ?? []).map((it, i) => [String(i), it]);
      case 'partners': return [...(sc.left?.items ?? []).map((it, i) => [`left-${i}`, it.label]), ...(sc.right?.items ?? []).map((it, i) => [`right-${i}`, it.label])];
      case 'recap': return (s.kind === 'outro' ? lessonHeadings : []).map((h, i) => [String(i), h]);
      default: return [];
    }
  };
  // When an item is said: the whole phrase, else its first or last few words,
  // else its most distinctive word (people rarely say a whole title). Spoken only.
  const said = (phrase, fromSec) => {
    if (!spoken || !phrase) return null;
    const w = String(phrase).replace(/[.,;:!?]/g, '').split(/\s+/).filter(Boolean);
    // The distinctive word: the longest one said only once in this recording ("Melkite", not "Catholic").
    const count = (x) => spoken.filter((sw) => sw.w.toLowerCase().replace(/[^a-z]/g, '') === x.toLowerCase().replace(/[^a-z]/g, '')).length;
    const rare = [...w].sort((a, b) => b.length - a.length).find((x) => x.length >= 6 && count(x) === 1) ?? '';
    for (const p of [w.join(' '), w.slice(0, 3).join(' '), w.slice(-3).join(' '), rare]) {
      const t = p ? phraseTime(spoken, p, fromSec) : null;
      if (t != null) return sec(t);
    }
    return null;
  };

  const starts = s.scenes.map((sc, i) => {
    if (sc.at) {
      const f = at(sc.at);
      if (f == null) console.warn(`  ! ${s.name}: "${sc.at}" isn't in the recording or the script; timing estimated`);
      return f;
    }
    if (i === 0) return first;
    if (i === 1 && quoteSpan) return sec(quoteSpan.end) + 10;
    return null;
  });
  // Later visuals: when their first item is said, if that's well after the scene before.
  for (let i = 2; i < starts.length; i++) {
    if (starts[i] != null || !spoken) continue;
    const prev = starts[i - 1] ?? first;
    const [, phrase] = items(s.scenes[i])[0] ?? [];
    const f = said(phrase, Math.max(0, (prev - offset) / FPS));
    if (f != null && f > prev + 60) starts[i] = f - 10;
  }
  for (let i = 1; i < starts.length; i++) {
    if (starts[i] != null) continue;
    let j = i;
    while (j < starts.length && starts[j] == null) j++;
    const a = starts[i - 1];
    const b = j < starts.length ? starts[j] : durationInFrames;
    for (let k = i; k < j; k++) starts[k] = Math.round(a + ((k - i + 1) * (b - a)) / (j - i + 1));
  }
  for (let i = 1; i < starts.length; i++) starts[i] = Math.max(starts[i], starts[i - 1] + 30);

  return s.scenes.map(({at: _at, cues, ...scene}, i) => {
    const from = starts[i];
    const rel = (f) => (f == null ? null : Math.max(4, f - from));
    const auto = {};
    if (spoken) {
      // Each item where it's first said in this scene (in any order); two items
      // never share one mention.
      const sceneSec = Math.max(0, (from - offset) / FPS - 1);
      const used = [];
      for (const [k, phrase] of items(scene)) {
        let abs = said(phrase, sceneSec);
        while (abs != null && used.includes(abs)) abs = said(phrase, (abs - offset) / FPS + 0.2);
        const f = rel(abs);
        if (f != null && f < (starts[i + 1] ?? durationInFrames) - from) { auto[k] = f; used.push(abs); }
      }
      if (scene.type === 'quote' && quoteSpan) Object.assign(auto, {start: rel(sec(quoteSpan.start)), end: rel(sec(quoteSpan.end))});
    }
    const explicit = Object.fromEntries(Object.entries(cues ?? {}).map(([k, p]) => [k, rel(at(p))]).filter(([, v]) => v != null));
    const all = {...auto, ...explicit};
    return {scene: {...smartScene(scene), from, ...(Object.keys(all).length ? {cues: all} : {})}, explicit: Object.keys(explicit).length > 0, at: !!_at};
  }).map(({scene, explicit, at: fixed}, i, list) => {
    // Nothing waits on an empty stage: if a visual's first item is said well after it would
    // start, it starts just before that, and the scene before it stays up meanwhile.
    const c = scene.cues;
    if (i === 0 || fixed || explicit || !c || ['compare', 'quote', 'iconostasis', 'trinity'].includes(scene.type)) return scene;
    const firstCue = Math.min(...Object.values(c));
    const next = list[i + 1]?.scene.from ?? durationInFrames;
    const shift = Math.min(firstCue - 20, next - scene.from - 60);
    if (shift < 25) return scene;
    return {...scene, from: scene.from + shift, cues: Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.max(4, v - shift)]))};
  });
}

/** timing.yml next to lesson.yml: {<section>: {scenes: {<i>: {start, cues: {<key>: seconds}}}}}, in seconds into the recording. */
export function loadTiming(dir) {
  const f = path.join(dir, 'timing.yml');
  return fs.existsSync(f) ? YAML.parse(fs.readFileSync(f, 'utf8')) ?? {} : {};
}

/** Apply hand-tuned timing (seconds into each section's voice) to the props, in place. */
export function applyTiming(props, timing) {
  for (const seg of props.segments) {
    const t = timing?.[seg.name]?.scenes;
    if (!t) continue;
    const toFrame = (sec) => Math.round(seg.audioOffsetInFrames + sec * FPS);
    seg.scenes.forEach((sc, i) => {
      const o = t[i] ?? t[String(i)];
      if (!o) return;
      const oldFrom = sc.from ?? 0;
      if (typeof o.start === 'number') sc.from = Math.max(0, toFrame(o.start));
      // Cues are relative to the scene's start: keep automatic ones in place on the timeline.
      const cues = {};
      for (const [k, v] of Object.entries(sc.cues ?? {})) cues[k] = Math.max(4, oldFrom + v - sc.from);
      for (const [k, v] of Object.entries(o.cues ?? {})) cues[k] = Math.max(4, toFrame(v) - sc.from);
      if (Object.keys(cues).length) sc.cues = cues;
    });
    // Scenes stay in order and at least a third of a second long.
    for (let i = 1; i < seg.scenes.length; i++) seg.scenes[i].from = Math.max(seg.scenes[i].from ?? 0, (seg.scenes[i - 1].from ?? 0) + 10);
    if (seg.kind === 'point') seg.headingFrames = seg.scenes[0]?.from ?? seg.headingFrames;
  }
  return props;
}

function recordingScript(lesson, segments) {
  const lines = [`# Recording script: ${lesson.title}`, '',
    'Record one file per section and save it with the name shown (.m4a, .mp3 or .wav).',
    'Pauses at the start and end are trimmed and the volume is leveled for you.',
    'Quotations are in **bold**: read them exactly as written.', ''];
  for (const s of segments) {
    lines.push(`## ${s.name}${s.heading ? ` (${s.heading})` : ''}`, '');
    if (s.kind === 'point') {
      if (s.quote.lead) lines.push(s.quote.lead, '');
      lines.push(`**${s.quote.text}**`, '', `(${s.quote.cite})`, '', s.explanation, '');
    } else {
      lines.push(s.text || '_Not written yet._', '');
    }
  }
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) prepare(process.argv[2]);
