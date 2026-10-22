import {useCurrentFrame, useVideoConfig} from 'remotion';
import {enter, pop, ramp} from '../anim';
import {useStage} from '../layout';
import {theme} from '../theme';
import {Center} from './Center';
import {Check} from './Check';
import type {SceneProps} from '.';

/** The lesson's point headings, checked off in order. */
export const Recap: React.FC<SceneProps> = ({scene, lesson, duration}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const gap = Math.floor((duration * 0.5) / lesson.headings.length);
  const at = (i: number) => (scene as any).cues?.[i] ?? 8 + i * gap; // when each is said, else spaced
  // Lines stack top to bottom in the order they're said.
  const rows = lesson.headings.map((h, i) => ({h, i})).sort((a, b) => at(a.i) - at(b.i));
  // Long headings (or a camera bubble taking space) shrink the list so every line stays in frame.
  const stage = useStage();
  const padLeft = Math.min(420, Math.round(stage.w * 0.14)), padRight = 160;
  const room = stage.w - padLeft - padRight - 100;
  const fits = (size: number) => {
    const lines = rows.reduce((n, {h}) => n + Math.max(1, Math.ceil((h.length * size * 0.5) / room)), 0);
    return lines * size * 1.2 + rows.length * 36 + 90 <= stage.h - 24;
  };
  let size = 72;
  while (size > 32 && !fits(size)) size -= 2;
  return (
    <Center style={{alignItems: 'flex-start', paddingLeft: padLeft}}>
      <div style={{...enter(f, 2), fontFamily: theme.sans, fontSize: 30, letterSpacing: 8, color: theme.accent, fontWeight: 600, marginBottom: 18}}>
        LESSON SUMMARY
      </div>
      {rows.map(({h, i}) => (
        <div key={i} style={{...enter(f, at(i), 0), display: 'flex', alignItems: 'center', gap: 36, margin: '18px 0', maxWidth: room + 100}}>
          <Check size={Math.round(size * 0.9)} color={theme.card} bg={theme.accent} style={{transform: `scale(${pop(f, at(i), fps)})`, flexShrink: 0}} />
          <div style={{fontFamily: theme.serif, fontSize: size, lineHeight: 1.2}}>{h}</div>
        </div>
      ))}
      {lesson.credit && (
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 56, textAlign: 'center', opacity: ramp(f, duration * 0.6, duration * 0.6 + 20),
          fontFamily: theme.sans, fontSize: 24, letterSpacing: 1, color: theme.muted}}>
          {lesson.credit}
        </div>
      )}
      {lesson.music?.credit && (
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 12, textAlign: 'center', opacity: ramp(f, duration * 0.6 + 15, duration * 0.6 + 35),
          fontFamily: theme.serif, fontStyle: 'italic', fontSize: 30, color: theme.gold}}>
          {lesson.music.credit}
        </div>
      )}
    </Center>
  );
};
