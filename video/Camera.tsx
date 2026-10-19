import {AbsoluteFill, Freeze, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {useBeat} from './beat';
import type {Layout} from './layout';
import {theme} from './theme';
import type {Segment} from './types';

/**
 * Where things go on a slide for each layout of her video (1920×1080):
 *   off     no video (the classic slide)
 *   bubble  her video in a circle at the bottom right; the pictures keep clear of it
 *   card    her video full screen; the pictures in a floating card on the right
 *   side    her video on the left half; the pictures on the right half
 *   lower   her video full screen; the pictures in a card along the bottom (a lower third)
 *   only    just her video
 * `panel`: the pictures are drawn at vw×vh and shrunk into that box.
 * `heading`: the point heading's area; it starts large (big, bigScale) and settles small at the top (settle).
 */
export type Geometry = {
  panel?: {x: number; y: number; w: number; h: number; vw: number; vh: number; card: boolean};
  heading: {x: number; w: number; big: number; settle: number; bigScale: number; settleScale: number; pill: boolean} | null;
  rightInset: number;
};

export const BUBBLE = 330;

export const geometry = (layout: Layout): Geometry => {
  const full = {x: 0, w: 1920, big: 464, settle: 64, bigScale: 1, settleScale: 0.55, pill: false};
  switch (layout) {
    case 'bubble': return {heading: full, rightInset: BUBBLE + 60};
    case 'card': return {panel: {x: 1018, y: 250, w: 832, h: 520, vw: 1600, vh: 1000, card: true},
      heading: {x: 818, w: 1232, big: 330, settle: 64, bigScale: 0.5, settleScale: 0.42, pill: true}, rightInset: 0};
    case 'side': return {panel: {x: 960, y: 230, w: 960, h: 780, vw: 1600, vh: 1300, card: false},
      heading: {x: 960, w: 960, big: 400, settle: 60, bigScale: 0.75, settleScale: 0.5, pill: false}, rightInset: 0};
    case 'lower': return {panel: {x: 540, y: 660, w: 840, h: 320, vw: 1920, vh: 731, card: true},
      heading: {x: 340, w: 1240, big: 700, settle: 556, bigScale: 0.6, settleScale: 0.42, pill: true}, rightInset: 0};
    case 'only': return {heading: null, rightInset: 0};
    default: return {heading: full, rightInset: 0};
  }
};

/** Her clip, in step with her voice; held on its first frame only if the recording started late, and on its last after it ends. */
const Clip: React.FC<{seg: Segment; style: React.CSSProperties}> = ({seg, style}) => {
  const cam = seg.camera!;
  const from = cam.from ?? seg.audioOffsetInFrames;
  const v = <OffthreadVideo muted src={staticFile(cam.src)} style={style} />;
  return (
    <>
      {from > 0 && <Sequence durationInFrames={from}><Freeze frame={0}>{v}</Freeze></Sequence>}
      <Sequence from={from} durationInFrames={cam.frames}>{v}</Sequence>
      <Sequence from={from + cam.frames}><Freeze frame={Math.max(0, cam.frames - 1)}>{v}</Freeze></Sequence>
    </>
  );
};

const cover: React.CSSProperties = {width: '100%', height: '100%', objectFit: 'cover'};

/** Her video behind the slide, for every layout but the bubble. */
export const CameraBack: React.FC<{seg: Segment; layout: Layout}> = ({seg, layout}) => {
  if (layout === 'side') {
    return (
      <AbsoluteFill>
        <div style={{position: 'absolute', left: 0, top: 0, width: 960, height: 1080, overflow: 'hidden'}}><Clip seg={seg} style={cover} /></div>
        <div style={{position: 'absolute', left: 960, top: 0, width: 960, height: 1080, background: theme.bg}} />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      <Clip seg={seg} style={cover} />
      {/* A soft shade at the bottom keeps the course name and progress bar readable. */}
      <AbsoluteFill style={{background: 'linear-gradient(to top, rgba(0,0,0,0.45), rgba(0,0,0,0) 22%)'}} />
    </AbsoluteFill>
  );
};

/** Bubble: her video in a circle at the bottom right, over the pictures. */
export const CameraBubble: React.FC<{seg: Segment}> = ({seg}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const beat = useBeat();
  const appear = spring({frame, fps, config: {damping: 14, stiffness: 120}});
  const ring = beat.kids ? theme.palette[(seg.index + 2) % theme.palette.length] : theme.gold;
  const scale = (0.6 + 0.4 * appear) * (1 + (beat.dance ? beat.pulse * 0.015 : 0));
  return (
    <div style={{position: 'absolute', right: 80, bottom: 110, width: BUBBLE, height: BUBBLE, borderRadius: '50%', overflow: 'hidden',
      background: theme.card, boxShadow: `0 0 0 ${beat.kids ? 10 : 6}px ${ring}, 0 14px 40px rgba(0,0,0,0.18)`,
      opacity: Math.min(1, appear * 1.5), transform: `scale(${scale.toFixed(4)})`, transformOrigin: 'center'}}>
      <Clip seg={seg} style={cover} />
    </div>
  );
};
