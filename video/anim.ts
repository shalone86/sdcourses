import {Easing, interpolate, spring} from 'remotion';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** 0→1 between two frames, eased. */
export const ramp = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, end], [0, 1], {...clamp, easing: Easing.bezier(0.33, 0, 0.2, 1)});

/** Fade + rise for an element appearing at `start`. */
export const enter = (frame: number, start: number, distance = 24) => {
  const p = ramp(frame, start, start + 18);
  return {opacity: p, transform: `translateY(${(1 - p) * distance}px)`};
};

export const pop = (frame: number, start: number, fps: number) =>
  spring({frame: frame - start, fps, config: {damping: 14, stiffness: 120}});

/** stroke-dashoffset style for SVG elements with pathLength={1}. */
export const draw = (p: number) => ({strokeDasharray: 1, strokeDashoffset: 1 - p});
