import {useCurrentFrame} from 'remotion';
import {draw, enter, ramp} from '../anim';
import {theme} from '../theme';
import {Center} from './Center';
import type {SceneProps} from '.';

export const Title: React.FC<SceneProps> = ({lesson}) => {
  const f = useCurrentFrame();
  return (
    <Center>
      <div style={{...enter(f, 6), fontFamily: theme.sans, fontSize: 32, letterSpacing: 8, color: theme.accent, fontWeight: 600}}>
        LESSON {lesson.number}
      </div>
      <div style={{...enter(f, 16), fontFamily: theme.serif, fontSize: 150, lineHeight: 1.05, marginTop: 20, textAlign: 'center'}}>
        {lesson.title}
      </div>
      <svg width={520} height={40} style={{marginTop: 30}}>
        <line x1={0} y1={20} x2={520} y2={20} pathLength={1} stroke={theme.gold} strokeWidth={3} style={draw(ramp(f, 30, 60))} />
        <circle cx={260} cy={20} r={8} fill={theme.bg} stroke={theme.gold} strokeWidth={3} opacity={ramp(f, 50, 60)} />
      </svg>
      {lesson.courseTitle !== lesson.title && (
        <div style={{...enter(f, 40), fontFamily: theme.serif, fontStyle: 'italic', fontSize: 44, color: theme.muted, marginTop: 24}}>
          {lesson.courseTitle}
        </div>
      )}
    </Center>
  );
};
