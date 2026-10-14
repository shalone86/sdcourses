// Splits one continuous recording of a whole lesson into its sections
// (intro, point-1 … outro) at the pauses Shalone leaves before tapping Next.
// Run: npm run split -- <course>/<lesson> <recording>
//
// How: find every pause, then pick one pause per section boundary, in order,
// preferring long pauses that sit near where the boundary should fall given
// each section's word count. Writes audio/<section>.wav and prints the cuts
// so they can be checked by ear.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {ffprobeDuration, lessonDir, loadLesson, words} from './lib.mjs';

const [arg, input] = process.argv.slice(2);
if (!input || !fs.existsSync(input)) throw new Error('Usage: npm run split -- <course>/<lesson> <recording-file>');
const dir = lessonDir(arg);
const {segments} = loadLesson(dir);
const total = ffprobeDuration(input);

// 1. Pauses (≥ 0.5 s below -38 dB).
const out = execFileSync('sh', ['-c', `ffmpeg -hide_banner -i "$1" -af silencedetect=noise=-38dB:d=0.5 -f null - 2>&1`, 'sh', input], {encoding: 'utf8'});
const starts = [...out.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
const ends = [...out.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
const pauses = starts.map((s, i) => ({start: s, end: ends[i] ?? total})).filter((p) => p.start > 0.3 && p.end < total - 0.3)
  .map((p) => ({...p, mid: (p.start + p.end) / 2, dur: p.end - p.start}));

// 2. Where boundaries "should" be, from word counts.
const counts = segments.map((s) => Math.max(1, words(s.text)));
const sum = counts.reduce((a, b) => a + b, 0);
const expected = [];
let acc = 0;
for (let i = 0; i < counts.length - 1; i++) { acc += counts[i]; expected.push((acc / sum) * total); }
const need = expected.length;
if (pauses.length < need) throw new Error(`Found ${pauses.length} pauses but need ${need}. Was there a clear pause before each Next?`);

// 3. Choose `need` pauses in time order minimizing (distance from expected) − (pause length bonus).
const cost = (p, i) => Math.abs(p.mid - expected[i]) / total * 20 - Math.min(p.dur, 3);
const C = pauses.length;
const best = Array.from({length: need}, () => new Array(C).fill(Infinity));
const from = Array.from({length: need}, () => new Array(C).fill(-1));
for (let c = 0; c < C; c++) best[0][c] = cost(pauses[c], 0);
for (let i = 1; i < need; i++) {
  for (let c = i; c < C; c++) {
    for (let p = i - 1; p < c; p++) {
      const v = best[i - 1][p] + cost(pauses[c], i);
      if (v < best[i][c]) { best[i][c] = v; from[i][c] = p; }
    }
  }
}
let c = best[need - 1].indexOf(Math.min(...best[need - 1]));
const chosen = [];
for (let i = need - 1; i >= 0; i--) { chosen.unshift(pauses[c]); c = from[i][c]; }

// 4. Cut at the middle of each chosen pause.
const cuts = [0, ...chosen.map((p) => p.mid), total];
const audioDir = path.join(dir, 'audio');
fs.mkdirSync(audioDir, {recursive: true});
const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
segments.forEach((s, i) => {
  const outFile = path.join(audioDir, `${s.name}.wav`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', input, '-ss', String(cuts[i]), '-to', String(cuts[i + 1]), '-ac', '1', '-ar', '48000', outFile]);
  console.log(`${s.name.padEnd(8)} ${fmt(cuts[i])} – ${fmt(cuts[i + 1])}  (${(cuts[i + 1] - cuts[i]).toFixed(1)} s, ${counts[i]} words)`);
});
