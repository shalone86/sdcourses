import {Easing, interpolate, spring} from 'remotion';
import {theme} from './theme';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** 0→1 between two frames, eased. */
export const ramp = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, end], [0, 1], {...clamp, easing: Easing.bezier(0.33, 0, 0.2, 1)});

/** Fade + rise for an element appearing at `start`. */
export const enter = (frame: number, start: number, distance = 24) => {
  if (theme.kids) {
    // Kids style: a springy hop in, overshooting a little.
    const p = spring({frame: frame - start, fps: 30, config: {damping: 9, stiffness: 160}});
    return {opacity: Math.min(1, p * 1.6), transform: `translateY(${(1 - p) * distance * 2}px) scale(${0.6 + 0.4 * p})`,
      transformBox: 'fill-box', transformOrigin: 'center'} as const;
  }
  const p = ramp(frame, start, start + 18);
  return {opacity: p, transform: `translateY(${(1 - p) * distance}px)`};
};

export const pop = (frame: number, start: number, fps: number) =>
  spring({frame: frame - start, fps, config: theme.kids ? {damping: 8, stiffness: 170} : {damping: 14, stiffness: 120}});

/** stroke-dashoffset style for SVG elements with pathLength={1}. */
export const draw = (p: number) => ({strokeDasharray: 1, strokeDashoffset: 1 - p});

/**
 * Gentle idle motion so held frames never look frozen: a slow bob plus a
 * very slight drift-zoom across the scene. `seed` varies the phase per scene.
 */
export const float = (frame: number, fps: number, duration: number, seed = 0) => {
  const t = frame / fps;
  const y = Math.sin(t * ((2 * Math.PI) / 6) + seed) * 6; // ±6px, 6s period
  const s = 1 + 0.015 * Math.min(1, frame / Math.max(1, duration)); // +1.5% over the scene
  return `translateY(${y.toFixed(2)}px) scale(${s.toFixed(4)})`;
};
