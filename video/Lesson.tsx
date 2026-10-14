import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {float, ramp} from './anim';
import {SceneView} from './scenes';
import {HEADING_FRAMES, theme} from './theme';
import type {LessonProps, Segment} from './types';

const FADE = 12;

const SegmentView: React.FC<{seg: Segment; lesson: LessonProps}> = ({seg, lesson}) => {
  const frame = useCurrentFrame();
  const isPoint = seg.kind === 'point';
  const start = isPoint ? HEADING_FRAMES : 0;
  const per = Math.floor((seg.durationInFrames - start) / seg.scenes.length);
  const fadeOut = 1 - ramp(frame, seg.durationInFrames - FADE, seg.durationInFrames);

  return (
    <AbsoluteFill style={{opacity: fadeOut}}>
      {seg.audio && (
        <Sequence from={seg.audioOffsetInFrames}>
          <Audio src={staticFile(seg.audio)} />
        </Sequence>
      )}
      {isPoint && <PointHeading seg={seg} total={lesson.headings.length} />}
      {seg.scenes.map((scene, i) => (
        <Sequence key={i} from={start + i * per} durationInFrames={i === seg.scenes.length - 1 ? undefined : per}>
          <SceneShell last={i === seg.scenes.length - 1} duration={per} top={isPoint ? 250 : 110} seed={i * 2.1 + seg.index}>
            <SceneView scene={scene} lesson={lesson} duration={per} />
          </SceneShell>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

/** Crossfade between scenes inside a segment; the segment itself fades at its end. */
const SceneShell: React.FC<{children: React.ReactNode; last: boolean; duration: number; top: number; seed: number}> = ({children, last, duration, top, seed}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const opacity = ramp(frame, 0, FADE) * (last ? 1 : 1 - ramp(frame, duration - FADE, duration));
  return <AbsoluteFill style={{opacity, top, bottom: 110, height: 'auto', transform: float(frame, fps, duration, seed)}}>{children}</AbsoluteFill>;
};

/** Point number + heading: large and centered, then settles into the top bar. */
const PointHeading: React.FC<{seg: Segment; total: number}> = ({seg, total}) => {
  const frame = useCurrentFrame();
  const {height} = useVideoConfig();
  const settle = ramp(frame, HEADING_FRAMES - 22, HEADING_FRAMES);
  const appear = ramp(frame, 0, 16);
  const y = (1 - settle) * (height / 2 - 140) + 64;
  const scale = 1 - settle * 0.45;
  return (
    <div
      style={{
        position: 'absolute', left: 0, right: 0, top: y, opacity: appear,
        transform: `scale(${scale})`, transformOrigin: 'center top', textAlign: 'center',
      }}
    >
      <div style={{fontFamily: theme.sans, fontSize: 30, letterSpacing: 6, color: theme.accent, fontWeight: 600}}>
        {seg.index} OF {total}
      </div>
      <div style={{fontFamily: theme.serif, fontSize: 96, color: theme.ink, lineHeight: 1.1, marginTop: 8}}>
        {seg.heading}
      </div>
    </div>
  );
};

/** Thin progress rail at the bottom: one tick per segment. */
const Progress: React.FC<{lesson: LessonProps}> = ({lesson}) => {
  const frame = useCurrentFrame();
  let acc = 0;
  return (
    <div style={{position: 'absolute', left: 120, right: 120, bottom: 52, display: 'flex', gap: 12}}>
      {lesson.segments.map((s, i) => {
        const p = Math.min(1, Math.max(0, (frame - acc) / s.durationInFrames));
        acc += s.durationInFrames;
        return (
          <div key={i} style={{flex: s.durationInFrames, height: 4, background: theme.rule, borderRadius: 2}}>
            <div style={{width: `${p * 100}%`, height: '100%', background: theme.gold, borderRadius: 2}} />
          </div>
        );
      })}
    </div>
  );
};

export const Lesson: React.FC<LessonProps> = (lesson) => {
  let from = 0;
  return (
    <AbsoluteFill style={{background: theme.bg, color: theme.ink}}>
      {lesson.segments.map((seg, i) => {
        const at = from;
        from += seg.durationInFrames;
        return (
          <Sequence key={i} from={at} durationInFrames={seg.durationInFrames}>
            <SegmentView seg={seg} lesson={lesson} />
          </Sequence>
        );
      })}
      <div style={{position: 'absolute', left: 120, bottom: 76, fontFamily: theme.sans, fontSize: 18, letterSpacing: 4, color: theme.muted}}>
        {lesson.courseTitle.toUpperCase()} · LESSON {lesson.number}
      </div>
      <Progress lesson={lesson} />
    </AbsoluteFill>
  );
};
