// Turns lesson.yml (+ your recordings in audio/) into the video's props, and
// writes a recording script. Run: npm run prepare-lesson -- <course>/<lesson>
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {ROOT, ffprobeDuration, lessonDir, loadLesson, outDir, words} from './lib.mjs';

const FPS = 30;
const HEADING_FRAMES = 66; // keep in sync with video/theme.ts
const WPS = 2.4; // ~145 words/minute, used until real audio exists
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
    const durationInFrames = Math.max(minFrames, Math.ceil(offset + seconds * FPS + 30));
    return {kind: s.kind, index: s.index, heading: s.heading, text: s.text, scenes: s.scenes, audio, durationInFrames, audioOffsetInFrames: offset};
  });

  const props = {
    courseTitle: course.title,
    number: lesson.number,
    title: lesson.title,
    headings: lesson.points.map((p) => p.heading),
    segments: out,
  };
  const dist = outDir(id);
  fs.writeFileSync(path.join(dist, 'props.json'), JSON.stringify(props, null, 2));
  fs.writeFileSync(path.join(dist, 'recording-script.md'), recordingScript(lesson, segments));

  const total = segments.reduce((n, s) => n + words(s.text), 0);
  const secs = out.reduce((n, s) => n + s.durationInFrames, 0) / FPS;
  console.log(`${id}: ${total} words, ${segments.length} segments (${recorded} recorded), video ${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, '0')}`);
  if (total > 650) console.warn(`  ! ${total} words; aim for ~600`);
  if (recorded < segments.length) console.log(`  missing audio: ${segments.filter((s, i) => !out[i].audio).map((s) => s.name).join(', ')} (timing estimated)`);
  return {props, dist, id};
}

function recordingScript(lesson, segments) {
  const lines = [`# Recording script: ${lesson.title}`, '',
    'Record one file per section and save it in this lesson\'s `audio/` folder with the name shown.',
    'Any of .wav .m4a .mp3 works. Pauses at the start/end are trimmed and volume is leveled for you.', ''];
  for (const s of segments) {
    lines.push(`## ${s.name}${s.heading ? ` (${s.heading})` : ''}`, '', s.text, '');
  }
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) prepare(process.argv[2]);
