import {AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {float, ramp} from './anim';
import {SceneView} from './scenes';
import {HEADING_FRAMES, theme} from './theme';
import type {LessonProps, Segment} from './types';

const FADE = 12;
const MUSIC_TAIL = 90; // keep in sync with scripts/prepare.mjs

// Helper function to get timing data (either from props or default)
function getTimingData(seg: Segment) {
  // In a real implementation, this would load timing data from an external file
  // For now we'll use the default behavior
  return seg;
}

const SegmentView: React.FC<{seg: Segment; lesson: LessonProps}> = ({seg, lesson}) => {
  const frame = useCurrentFrame();
  const isPoint = seg.kind === 'point';
  const start = isPoint ? seg.headingFrames ?? HEADING_FRAMES : 0;

  // Use timing data from props or fallback to default calculation
  const timingSeg = getTimingData(seg);

  const per = Math.floor((seg.durationInFrames - start) / seg.scenes.length);
  // Scenes timed to the narration (`from`, see prepare.mjs), else evenly split.
  const starts = seg.scenes.map((s, i) => s.from ?? start + i * per);
  const lengthOf = (i: number) => (starts[i + 1] ?? seg.durationInFrames) - starts[i];
  const fadeOut = 1 - ramp(frame, seg.durationInFrames - FADE, seg.durationInFrames);

  return (
    <AbsoluteFill style={{opacity: fadeOut}}>
      {seg.audio && (
        <Sequence from={seg.audioOffsetInFrames}>
          <Audio src={staticFile(seg.audio)} />
        </Sequence>
      )}
      {isPoint && <PointHeading seg={seg} total={lesson.headings.length} settleAt={start} />}
      {seg.scenes.map((scene, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={i === seg.scenes.length - 1 ? undefined : lengthOf(i)}>
          <SceneShell last={i === seg.scenes.length - 1} duration={lengthOf(i)} top={isPoint ? 250 : 110} seed={i * 2.1 + seg.index}>
            <SceneView scene={scene} lesson={lesson} duration={lengthOf(i)} />
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
const PointHeading: React.FC<{seg: Segment; total: number; settleAt: number}> = ({seg, total, settleAt}) => {
  const frame = useCurrentFrame();
  const {height} = useVideoConfig();
  const settle = ramp(frame, settleAt - 22, settleAt);
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

/**
 * Music bed: louder ("between") before the first words and after the last,
 * ducked to "underVoice" while narration plays, fading in and out at the ends.
 */
const MusicBed: React.FC<{lesson: LessonProps}> = ({lesson}) => {
  const {fps, durationInFrames} = useVideoConfig();
  const m = lesson.music!;
  const first = lesson.segments[0];
  const voiceStart = first.audioOffsetInFrames;
  const voiceEnd = durationInFrames - 30 - MUSIC_TAIL; // see prepare.mjs
  const duck = Math.round(fps * 0.6);
  return (
    <Audio
      src={staticFile(m.src)}
      loop
      volume={(f) => {
        const intro = interpolate(f, [0, fps, voiceStart, voiceStart + duck], [0, m.between, m.between, m.underVoice], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        const outro = interpolate(f, [voiceEnd, voiceEnd + duck, durationInFrames - fps * 2, durationInFrames], [m.underVoice, m.between, m.between, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        return f < voiceEnd ? intro : outro;
      }}
    />
  );
};

export const Lesson: React.FC<LessonProps> = (lesson) => {
  let from = 0;
  return (
    <AbsoluteFill style={{background: theme.bg, color: theme.ink}}>
      {lesson.music && <MusicBed lesson={lesson} />}
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
