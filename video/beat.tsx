import {createContext, useContext} from 'react';

// Kids style: where the music's beat is right now. Computed once per frame by
// the lesson (absolute frame) and read by anything that dances.
//   t: beats so far, fractional (3.5 = halfway between beats 3 and 4);
//   pulse: a smooth swell, 1 on each beat and 0 halfway between (no jumps).
// dance: scenes, headings and her video bounce too (music videos); otherwise only the background shapes do.
export type Beat = {kids: boolean; pulse: number; t: number; dance?: boolean};
export const BeatContext = createContext<Beat>({kids: false, pulse: 0, t: 0});
export const useBeat = () => useContext(BeatContext);

/** Smooth swell for any beat position: 1 on the beat, 0 between. */
export const swell = (t: number) => Math.pow((1 + Math.cos(2 * Math.PI * t)) / 2, 1.5);
/** Smooth side-to-side for any beat position: +1 on even beats, -1 on odd ones. */
export const sway = (t: number) => Math.cos(Math.PI * t);

export const beatAt = (beats: number[] | undefined, frame: number): Beat => {
  if (!beats?.length || frame < beats[0]) return {kids: true, pulse: 0, t: 0};
  let lo = 0, hi = beats.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (beats[m] <= frame) lo = m; else hi = m - 1; }
  const step = (beats[lo + 1] ?? beats[lo] + (beats[1] - beats[0])) - beats[lo];
  const t = lo + (frame - beats[lo]) / Math.max(1, step);
  return {kids: true, pulse: swell(t), t};
};
