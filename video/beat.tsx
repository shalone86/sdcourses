import {createContext, useContext} from 'react';

// Kids style: where the music's beat is right now. Computed once per frame by
// the lesson (absolute frame) and read by anything that dances.
//   pulse: 1 on a beat, easing to 0 before the next; n: which beat it is.
export type Beat = {kids: boolean; pulse: number; n: number};
export const BeatContext = createContext<Beat>({kids: false, pulse: 0, n: 0});
export const useBeat = () => useContext(BeatContext);

export const beatAt = (beats: number[] | undefined, frame: number): Beat => {
  if (!beats?.length) return {kids: true, pulse: 0, n: 0};
  let lo = 0, hi = beats.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (beats[m] <= frame) lo = m; else hi = m - 1; }
  if (beats[lo] > frame) return {kids: true, pulse: 0, n: 0};
  const since = frame - beats[lo];
  return {kids: true, pulse: Math.exp(-since / 4), n: lo};
};
