import {AbsoluteFill, Freeze, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {useBeat} from './beat';
import type {Layout} from './layout';
import {theme} from './theme';
import type {Segment} from './types';

/**
 * Where things go on a slide for each layout of her video (1920×1080). `side` is
 * which side her video is on (bubble, side by side, card); the rest mirrors.
 *   off     no video (the classic slide)
 *   bubble  her video in a circle at the bottom corner; the pictures keep clear of it
 *   card    two cards: her video on one side, the pictures on the other
 *   side    her video filling one half; the pictures on the other half
 *   lower   her video in a card across the top; the heading and pictures below it
 *   only    just her video, full screen
 * `video`: her video's box (card: rounded with a shadow).
 * `panel`: the pictures are drawn at vw×vh and shrunk into that box.
 * `heading`: the point heading's column; it starts large (big, bigScale) and settles small (settle).
 */
type Box = {x: number; y: number; w: number; h: number};
export type Geometry = {
  video?: Box & {card: boolean};
  panel?: Box & {vw: number; vh: number; card: boolean};
  heading: {x: number; w: number; big: number; settle: number; bigScale: number; settleScale: number; pill: boolean} | null;
  inset: {left: number; right: number};
  bubble?: {left: boolean};
};

export const BUBBLE = 330;
const W = 1920;

export const geometry = (layout: Layout, side?: 'left' | 'right'): Geometry => {
  const full = {x: 0, w: W, big: 464, settle: 64, bigScale: 1, settleScale: 0.55, pill: false};
  const none = {left: 0, right: 0};
  // Boxes are written for her video on the left; `flip` mirrors them for the right.
  const g = ((): Geometry => {
    switch (layout) {
      case 'bubble': return {heading: full, inset: {left: BUBBLE + 60, right: 0}, bubble: {left: true}};
      case 'card': return {video: {x: 70, y: 250, w: 860, h: 484, card: true},
        panel: {x: 990, y: 230, w: 860, h: 540, vw: 1600, vh: 1005, card: true},
        heading: {x: 990, w: 860, big: 380, settle: 96, bigScale: 0.55, settleScale: 0.42, pill: false}, inset: none};
      case 'side': return {video: {x: 0, y: 0, w: 960, h: 1080, card: false},
        panel: {x: 960, y: 230, w: 960, h: 780, vw: 1600, vh: 1300, card: false},
        heading: {x: 960, w: 960, big: 400, settle: 60, bigScale: 0.75, settleScale: 0.5, pill: false}, inset: none};
      case 'lower': return {video: {x: 480, y: 36, w: 960, h: 540, card: true},
        panel: {x: 360, y: 680, w: 1200, h: 300, vw: 2600, vh: 650, card: true},
        heading: {x: 0, w: W, big: 690, settle: 596, bigScale: 0.6, settleScale: 0.42, pill: false}, inset: none};
      case 'only': return {video: {x: 0, y: 0, w: W, h: 1080, card: false}, heading: null, inset: none};
      default: return {heading: full, inset: none};
    }
  })();
  // Default sides: the bubble on the right, everything else with her video on the left.
  const right = side ? side === 'right' : layout === 'bubble';
  if (!right || layout === 'lower' || layout === 'only' || layout === 'off') return g;
  const flip = <T extends Box>(b?: T) => b && {...b, x: W - b.x - b.w};
  return {...g, video: flip(g.video), panel: flip(g.panel),
    heading: g.heading && (g.heading.w < W ? {...g.heading, x: W - g.heading.x - g.heading.w} : g.heading),
    inset: {left: g.inset.right, right: g.inset.left}, bubble: g.bubble && {left: false}};
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

/** Her video for every layout but the bubble: full screen, a half, or a card. */
export const CameraBack: React.FC<{seg: Segment; box: NonNullable<Geometry['video']>}> = ({seg, box}) => {
  const full = box.w === W && box.h === 1080;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, overflow: 'hidden',
        ...(box.card ? {borderRadius: 36, boxShadow: '0 18px 50px rgba(0,0,0,0.28)', background: '#000'} : {})}}>
        <Clip seg={seg} style={cover} />
      </div>
      {/* Full screen: a soft shade at the bottom keeps the course name and progress bar readable. */}
      {full && <AbsoluteFill style={{background: 'linear-gradient(to top, rgba(0,0,0,0.45), rgba(0,0,0,0) 22%)'}} />}
    </AbsoluteFill>
  );
};

/** Bubble: her video in a circle at the bottom right, over the pictures. */
export const CameraBubble: React.FC<{seg: Segment; left?: boolean}> = ({seg, left}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const beat = useBeat();
  const appear = spring({frame, fps, config: {damping: 14, stiffness: 120}});
  const ring = beat.kids ? theme.palette[(seg.index + 2) % theme.palette.length] : theme.gold;
  const scale = (0.6 + 0.4 * appear) * (1 + (beat.dance ? beat.pulse * 0.015 : 0));
  return (
    <div style={{position: 'absolute', ...(left ? {left: 80} : {right: 80}), bottom: 110, width: BUBBLE, height: BUBBLE, borderRadius: '50%', overflow: 'hidden',
      background: theme.card, boxShadow: `0 0 0 ${beat.kids ? 10 : 6}px ${ring}, 0 14px 40px rgba(0,0,0,0.18)`,
      opacity: Math.min(1, appear * 1.5), transform: `scale(${scale.toFixed(4)})`, transformOrigin: 'center'}}>
      <Clip seg={seg} style={cover} />
    </div>
  );
};
