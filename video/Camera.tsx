import {AbsoluteFill, Freeze, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {useBeat} from './beat';
import {theme} from './theme';
import type {Segment} from './types';

/** Her clip, in step with her voice: still on its first frame before she speaks, and on its last after. */
const Clip: React.FC<{seg: Segment; style: React.CSSProperties}> = ({seg, style}) => {
  const cam = seg.camera!;
  const v = <OffthreadVideo muted src={staticFile(cam.src)} style={style} />;
  return (
    <>
      {seg.audioOffsetInFrames > 0 && <Sequence durationInFrames={seg.audioOffsetInFrames}><Freeze frame={0}>{v}</Freeze></Sequence>}
      <Sequence from={seg.audioOffsetInFrames} durationInFrames={cam.frames}>{v}</Sequence>
      <Sequence from={seg.audioOffsetInFrames + cam.frames}><Freeze frame={Math.max(0, cam.frames - 1)}>{v}</Freeze></Sequence>
    </>
  );
};

export const BUBBLE = 330; // her circle, bottom right; scenes keep clear of it

/** Full screen: her video behind everything in the section (the pictures float over in a card). */
export const CameraFull: React.FC<{seg: Segment}> = ({seg}) => (
  <AbsoluteFill>
    <Clip seg={seg} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
    {/* A soft shade at the bottom keeps the course name and progress bar readable. */}
    <AbsoluteFill style={{background: 'linear-gradient(to top, rgba(0,0,0,0.45), rgba(0,0,0,0) 22%)'}} />
  </AbsoluteFill>
);

/** Bubble: her video in a circle at the bottom right, over the pictures. */
export const CameraBubble: React.FC<{seg: Segment}> = ({seg}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const beat = useBeat();
  const appear = spring({frame, fps, config: {damping: 14, stiffness: 120}});
  const ring = beat.kids ? theme.palette[(seg.index + 2) % theme.palette.length] : theme.gold;
  const scale = (0.6 + 0.4 * appear) * (1 + beat.pulse * 0.015);
  return (
    <div style={{position: 'absolute', right: 80, bottom: 110, width: BUBBLE, height: BUBBLE, borderRadius: '50%', overflow: 'hidden',
      background: theme.card, boxShadow: `0 0 0 ${beat.kids ? 10 : 6}px ${ring}, 0 14px 40px rgba(0,0,0,0.18)`,
      opacity: Math.min(1, appear * 1.5), transform: `scale(${scale.toFixed(4)})`, transformOrigin: 'center'}}>
      <Clip seg={seg} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
    </div>
  );
};
