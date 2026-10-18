// Beats of a music track, for the kids style's "dancey" timing.
//   detectBeats(file) → {bpm, beats: [seconds…], duration}, cached as <track>.beats.json
// How: decode to mono, take the loudness rise ("onsets") every ~23 ms, find the
// tempo by autocorrelation (70–180 BPM, gently preferring ~110), then the beat
// phase that lines up best with the onsets. Good enough to land animations on
// the beat; it doesn't need to be a DJ.
// Run: node scripts/beats.mjs music/<track>.mp3
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const RATE = 11025;
const HOP = 256; // ~23 ms

export function detectBeats(file) {
  const cache = file.replace(/\.[^.]+$/, '.beats.json');
  const stat = fs.statSync(file);
  const stamp = `${stat.size}:${Math.round(stat.mtimeMs)}`;
  if (fs.existsSync(cache)) {
    const c = JSON.parse(fs.readFileSync(cache, 'utf8'));
    if (c.stamp === stamp) return c;
  }
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-'], {maxBuffer: 1 << 30});
  const pcm = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.byteLength / 4));
  const n = Math.floor(pcm.length / HOP);
  // Loudness per hop (log RMS), then onsets = positive change, lightly smoothed.
  const loud = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = i * HOP; j < (i + 1) * HOP; j++) s += pcm[j] * pcm[j];
    loud[i] = Math.log(1e-6 + Math.sqrt(s / HOP));
  }
  const onset = new Float32Array(n);
  for (let i = 1; i < n; i++) onset[i] = Math.max(0, loud[i] - loud[i - 1]);
  const mean = onset.reduce((a, b) => a + b, 0) / n;
  for (let i = 0; i < n; i++) onset[i] = Math.max(0, onset[i] - mean);

  // Tempo: autocorrelation over lags for 70–180 BPM, weighted toward ~110 BPM.
  const fps = RATE / HOP;
  let best = {lag: Math.round((60 / 110) * fps), score: -1};
  for (let lag = Math.round((60 / 180) * fps); lag <= Math.round((60 / 70) * fps); lag++) {
    let s = 0;
    for (let i = lag; i < n; i++) s += onset[i] * onset[i - lag];
    const bpm = (60 * fps) / lag;
    const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 110) / 0.6, 2));
    s *= prior;
    if (s > best.score) best = {lag, score: s};
  }
  // Phase: the offset whose beat grid collects the most onset energy.
  let phase = {off: 0, score: -1};
  for (let off = 0; off < best.lag; off++) {
    let s = 0;
    for (let i = off; i < n; i += best.lag) s += onset[i] + 0.5 * (onset[i - 1] ?? 0) + 0.5 * (onset[i + 1] ?? 0);
    if (s > phase.score) phase = {off, score: s};
  }
  const step = best.lag / fps;
  const duration = pcm.length / RATE;
  const beats = [];
  for (let t = phase.off / fps; t < duration; t += step) beats.push(Math.round(t * 1000) / 1000);
  const out = {stamp, bpm: Math.round((60 / step) * 10) / 10, duration: Math.round(duration * 1000) / 1000, beats};
  fs.writeFileSync(cache, JSON.stringify(out));
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = detectBeats(process.argv[2]);
  console.log(`${r.bpm} BPM, ${r.beats.length} beats over ${r.duration.toFixed(1)} s; first: ${r.beats.slice(0, 6).join(', ')}`);
}
