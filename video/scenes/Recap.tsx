import {useCurrentFrame, useVideoConfig} from 'remotion';
import {enter, pop, ramp} from '../anim';
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
  return (
    <Center style={{alignItems: 'flex-start', paddingLeft: 420}}>
      <div style={{...enter(f, 2), fontFamily: theme.sans, fontSize: 30, letterSpacing: 8, color: theme.accent, fontWeight: 600, marginBottom: 18}}>
        LESSON SUMMARY
      </div>
      {rows.map(({h, i}) => (
        <div key={i} style={{...enter(f, at(i), 0), display: 'flex', alignItems: 'center', gap: 36, margin: '18px 0'}}>
          <Check size={64} color={theme.card} bg={theme.accent} style={{transform: `scale(${pop(f, at(i), fps)})`, flexShrink: 0}} />
          <div style={{fontFamily: theme.serif, fontSize: 72}}>{h}</div>
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
