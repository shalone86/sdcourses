// Turns lesson.yml (+ your recordings in audio/) into the video's props, and
// writes a recording script. Run: npm run prepare-lesson -- <course>/<lesson>
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {ROOT, ffprobeDuration, lessonDir, loadLesson, loadSite, outDir, smartScene, words} from './lib.mjs';

const FPS = 30;
const HEADING_FRAMES = 66; // keep in sync with video/theme.ts
const WPS = 2.4;
export const MUSIC_TAIL = 90; // keep in sync with video/Lesson.tsx // ~145 words/minute, used until real audio exists
const AUDIO_EXT = ['.wav', '.m4a', '.mp3', '.aac', '.flac', '.ogg'];

export function prepare(arg) {
  const dir = lessonDir(arg);
  const {lesson, course, segments, id} = loadLesson(dir);
  const publicDir = path.join(ROOT, 'video', 'public', id);
  fs.mkdirSync(publicDir, {recursive: true});

  let recorded = 0;
  const out = segments.map((s) => {
    const src = AUDIO_EXT.map((e) => path.join(dir, 'audio', s.name + e)).find((f) => fs.existsSync(f));
    let audio = null;
    let seconds = words(s.text) / WPS;
    if (src) {
      // Trim silence at both ends, level to -16 LUFS, mono. Your raw file is untouched.
      const dest = path.join(publicDir, `${s.name}.wav`);
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-af',
        'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5:LRA=11',
        '-ac', '1', '-ar', '48000', dest]);
      audio = path.posix.join(id, `${s.name}.wav`);
      seconds = ffprobeDuration(dest);
      recorded++;
    }
    // Points open on their heading; narration starts while it is still on screen.
    const offset = s.kind === 'point' ? 20 : s.kind === 'intro' ? 45 : 15;
    const minFrames = s.kind === 'point' ? HEADING_FRAMES + s.scenes.length * 150 : s.scenes.length * 120;
    // The outro gets ~3s more so the music can close the video after the last word;
    // the intro ~1.5s more so its last picture (the Sign of the Cross) can be seen.
    const tail = s.kind === 'outro' ? 30 + MUSIC_TAIL : s.kind === 'intro' ? 75 : 30;
    const durationInFrames = Math.max(minFrames, Math.ceil(offset + seconds * FPS + tail));
    const scenes = timeScenes(s, offset, seconds, durationInFrames);
    return {kind: s.kind, index: s.index, heading: s.heading, text: s.text, scenes, audio, durationInFrames, audioOffsetInFrames: offset};
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
    music = {src: path.posix.join(id, path.basename(dest)), underVoice: musicCfg.under_voice ?? 0.05, between: musicCfg.between ?? 0.16};
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
  const dist = outDir(id);
  fs.writeFileSync(path.join(dist, 'props.json'), JSON.stringify(props, null, 2));
  fs.writeFileSync(path.join(dist, 'recording-script.md'), recordingScript(lesson, segments));

  const total = segments.reduce((n, s) => n + words(s.text), 0);
  const secs = out.reduce((n, s) => n + s.durationInFrames, 0) / FPS;
  console.log(`${id}: ${total} words, ${segments.length} segments (${recorded} recorded), video ${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, '0')}`);
  if (total > 650) console.warn(`  ! ${total} words; aim for ~600`);
  for (const s of segments) if ((s.kind === 'intro' || s.kind === 'outro') && !s.text) console.log(`  ${s.name}: not written yet (Shalone writes this)`);
  if (recorded < segments.length) console.log(`  missing audio: ${segments.filter((s, i) => !out[i].audio).map((s) => s.name).join(', ')} (timing estimated)`);
  return {props, dist, id};
}

/**
 * Scene start frames. A scene with `at: <phrase>` starts when that phrase is
 * spoken, estimated from where it sits in the text (speech pace is even
 * enough for this, and it survives re-recording). `cues: {name: <phrase>}`
 * become frames relative to the scene's start. Scenes without `at` share the
 * time between their neighbors. Without any `at`, the video splits evenly.
 */
function timeScenes(s, offset, seconds, durationInFrames) {
  if (!s.scenes.some((sc) => sc.at)) return s.scenes.map(smartScene);
  const text = s.text.toLowerCase();
  const frameOf = (phrase) => {
    const i = text.indexOf(String(phrase).toLowerCase());
    if (i < 0) throw new Error(`${s.name}: the phrase "${phrase}" isn't in the text`);
    return Math.round(offset + (i / text.length) * seconds * FPS);
  };
  const starts = s.scenes.map((sc, i) => (sc.at ? frameOf(sc.at) : i === 0 ? (s.kind === 'point' ? HEADING_FRAMES : 0) : null));
  for (let i = 1; i < starts.length; i++) {
    if (starts[i] != null) continue;
    let j = i;
    while (j < starts.length && starts[j] == null) j++;
    const a = starts[i - 1];
    const b = j < starts.length ? starts[j] : durationInFrames;
    for (let k = i; k < j; k++) starts[k] = Math.round(a + ((k - i + 1) * (b - a)) / (j - i + 1));
  }
  return s.scenes.map(({at, cues, ...scene}, i) => ({
    ...smartScene(scene),
    from: starts[i],
    ...(cues ? {cues: Object.fromEntries(Object.entries(cues).map(([k, p]) => [k, Math.max(0, frameOf(p) - starts[i])]))} : {}),
  }));
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
