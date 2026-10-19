import {AbsoluteFill, Audio, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {float, ramp} from './anim';
import {Backdrop} from './Backdrop';
import {CameraBack, CameraBubble, geometry, type Geometry} from './Camera';
import {LayoutContext, type Layout} from './layout';
import {BeatContext, beatAt, sway, useBeat} from './beat';
import {SceneView} from './scenes';
import {HEADING_FRAMES, theme, useStyle} from './theme';
import type {LessonProps, Segment} from './types';

const FADE = 12;
const MUSIC_TAIL = 90; // keep in sync with scripts/prepare.mjs

const SegmentView: React.FC<{seg: Segment; lesson: LessonProps}> = ({seg, lesson}) => {
  const frame = useCurrentFrame();
  const isPoint = seg.kind === 'point';
  const start = isPoint ? seg.headingFrames ?? HEADING_FRAMES : 0;

  const per = Math.floor((seg.durationInFrames - start) / seg.scenes.length);
  // Scenes timed to the narration (`from`, see prepare.mjs), else evenly split; `until` ends one early.
  const starts = seg.scenes.map((s, i) => s.from ?? start + i * per);
  const endOf = (i: number) => Math.min(starts[i + 1] ?? seg.durationInFrames, seg.scenes[i].until ?? Infinity);
  const lengthOf = (i: number) => Math.max(1, endOf(i) - starts[i]);
  const open = (i: number) => i === seg.scenes.length - 1 && seg.scenes[i].until == null; // runs to the slide's end
  const fadeOut = 1 - ramp(frame, seg.durationInFrames - FADE, seg.durationInFrames);

  const layout: Layout = seg.camera ? seg.camera.layout ?? 'bubble' : 'off';
  const geo = geometry(layout, seg.camera?.side);
  return (
    <LayoutContext.Provider value={layout}>
    <AbsoluteFill style={{opacity: fadeOut}}>
      {geo.video && <CameraBack seg={seg} box={geo.video} />}
      {seg.audio && (
        <Sequence from={seg.audioOffsetInFrames}>
          <Audio src={staticFile(seg.audio)} />
        </Sequence>
      )}
      {isPoint && geo.heading && <PointHeading seg={seg} total={lesson.headings.length} settleAt={start} area={geo.heading} />}
      {layout !== 'only' && seg.scenes.map((scene, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={open(i) ? undefined : lengthOf(i)}>
          <SceneShell last={open(i)} duration={lengthOf(i)} top={isPoint ? 250 : 110} seed={i * 2.1 + seg.index} geo={geo}>
            <SceneView scene={scene} lesson={lesson} duration={lengthOf(i)} />
          </SceneShell>
        </Sequence>
      ))}
      {layout === 'bubble' && <CameraBubble seg={seg} left={geo.bubble?.left} />}
    </AbsoluteFill>
    </LayoutContext.Provider>
  );
};

/** Crossfade between scenes inside a segment; the segment itself fades at its end. */
const SceneShell: React.FC<{children: React.ReactNode; last: boolean; duration: number; top: number; seed: number; geo: Geometry}> = ({children, last, duration, top, seed, geo}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const beat = useBeat();
  const opacity = ramp(frame, 0, FADE) * (last ? 1 : 1 - ramp(frame, duration - FADE, duration));
  let transform = float(frame, fps, duration, seed);
  if (beat.dance) {
    // Hop in, then a little bounce and sway on every beat.
    const hop = spring({frame, fps, config: {damping: 13, stiffness: 140}});
    const rot = sway(beat.t) * 0.35;
    transform += ` scale(${(0.88 + 0.12 * hop + beat.pulse * 0.008).toFixed(4)}) rotate(${rot.toFixed(3)}deg)`;
  }
  const p = geo.panel;
  if (p) {
    // With her video on screen, the pictures are drawn at p.vw×p.vh and shrunk into their box.
    const k = Math.min(p.w / p.vw, p.h / p.vh);
    return (
      <div style={{position: 'absolute', left: p.x, top: p.y, width: p.w, height: p.h, opacity, transform,
        ...(p.card ? {borderRadius: 36, overflow: 'hidden', background: theme.bg, boxShadow: '0 18px 50px rgba(0,0,0,0.28)'} : {})}}>
        <div style={{position: 'absolute', left: (p.w - p.vw * k) / 2, top: (p.h - p.vh * k) / 2, width: p.vw, height: p.vh, transform: `scale(${k})`, transformOrigin: 'top left'}}>{children}</div>
      </div>
    );
  }
  // Bubble: the scenes keep clear of her circle at the bottom right.
  return <AbsoluteFill style={{opacity, top, bottom: 110, left: geo.inset.left, right: geo.inset.right, width: 'auto', height: 'auto', transform}}>{children}</AbsoluteFill>;
};

/** Point number + heading: large in its area, then it settles small at the top. */
const PointHeading: React.FC<{seg: Segment; total: number; settleAt: number; area: NonNullable<Geometry['heading']>}> = ({seg, total, settleAt, area}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const beat = useBeat();
  const settle = ramp(frame, settleAt - 22, settleAt);
  // While it's the big heading, it floats gently like the scenes do (dance: bounces on the beat).
  const bounce = beat.dance ? beat.pulse : 0;
  const bob = (1 - settle) * (Math.sin((frame / fps) * ((2 * Math.PI) / 6) + seg.index) * 8 - bounce * 8);
  const scale = area.bigScale + (area.settleScale - area.bigScale) * settle;
  // Over her video the heading sits on a card so it stays readable.
  // (on one line: the area only sets where it's centered)
  const pill: React.CSSProperties = area.pill ? {background: theme.bg, borderRadius: 32, padding: '12px 44px 18px', boxShadow: '0 12px 36px rgba(0,0,0,0.25)', whiteSpace: 'nowrap'} : {};
  const box: React.CSSProperties = {position: 'absolute', left: area.x, width: area.w, transformOrigin: 'center top', display: 'flex', flexDirection: 'column', alignItems: 'center'};
  if (beat.kids) {
    const color = theme.palette[(seg.index - 1) % theme.palette.length];
    const appearK = beat.dance ? spring({frame, fps, config: {damping: 9, stiffness: 150}}) : ramp(frame, 0, 16);
    const yK = area.big - 34 + (area.settle - 14 - (area.big - 34)) * settle;
    return (
      <div style={{...box, top: yK, opacity: beat.dance ? 1 : appearK,
        transform: `translateY(${bob.toFixed(2)}px) scale(${(scale * (beat.dance ? 0.5 + 0.5 * appearK : 1)).toFixed(4)})`}}>
        <div style={{width: 92, height: 92, borderRadius: '50%', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: theme.sans, fontSize: 56, fontWeight: 700, boxShadow: `0 8px 0 rgba(43,35,80,0.15)`,
          transform: beat.dance ? `rotate(${(sway(beat.t) * 5).toFixed(2)}deg) scale(${(1 + beat.pulse * 0.05).toFixed(3)})` : undefined}}>{seg.index}</div>
        <div style={{fontFamily: theme.serif, fontSize: 100, fontWeight: 600, color: theme.ink, lineHeight: 1.1, marginTop: 14, textAlign: 'center', ...pill}}>
          {seg.heading}
        </div>
      </div>
    );
  }
  const y = area.big + (area.settle - area.big) * settle;
  return (
    <div style={{...box, top: y, opacity: ramp(frame, 0, 16), transform: `translateY(${bob.toFixed(2)}px) scale(${scale})`, textAlign: 'center'}}>
      <div style={{display: 'inline-block', ...pill}}>
        <div style={{fontFamily: theme.sans, fontSize: 30, letterSpacing: 6, color: theme.accent, fontWeight: 600}}>
          {seg.index} OF {total}
        </div>
        <div style={{fontFamily: theme.serif, fontSize: 96, color: theme.ink, lineHeight: 1.1, marginTop: 8}}>
          {seg.heading}
        </div>
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
          <div key={i} style={{flex: s.durationInFrames, height: theme.kids ? 10 : 4, background: theme.rule, borderRadius: 5}}>
            <div style={{width: `${p * 100}%`, height: '100%', background: theme.kids ? theme.palette[i % theme.palette.length] : theme.gold, borderRadius: 5}} />
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
  useStyle(lesson.style, lesson.motion);
  const frame = useCurrentFrame();
  const kids = lesson.style === 'kids';
  const beat = kids ? {...beatAt(lesson.music?.beats, frame), dance: lesson.motion === 'dance'} : {kids: false, pulse: 0, t: 0};
  let from = 0;
  return (
    <BeatContext.Provider value={beat}>
    <AbsoluteFill style={{background: theme.bg, color: theme.ink}}>
      {kids && <Backdrop />}
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
    </BeatContext.Provider>
  );
};
