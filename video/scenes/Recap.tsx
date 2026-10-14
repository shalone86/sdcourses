import {useCurrentFrame, useVideoConfig} from 'remotion';
import {enter, pop} from '../anim';
import {theme} from '../theme';
import {Center} from './Center';
import {Check} from './Check';
import type {SceneProps} from '.';

/** The lesson's point headings, checked off in order. */
export const Recap: React.FC<SceneProps> = ({lesson, duration}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const gap = Math.floor((duration * 0.5) / lesson.headings.length);
  return (
    <Center style={{alignItems: 'flex-start', paddingLeft: 420}}>
      {lesson.headings.map((h, i) => (
        <div key={i} style={{...enter(f, 8 + i * gap, 0), display: 'flex', alignItems: 'center', gap: 36, margin: '22px 0'}}>
          <Check size={64} color={theme.card} bg={theme.accent} style={{transform: `scale(${pop(f, 8 + i * gap, fps)})`, flexShrink: 0}} />
          <div style={{fontFamily: theme.serif, fontSize: 72}}>{h}</div>
        </div>
      ))}
    </Center>
  );
};
