import {Img, staticFile, useCurrentFrame} from 'remotion';
import {draw, enter, ramp} from '../anim';
import {theme} from '../theme';
import {Center} from './Center';
import type {SceneProps} from '.';

type HostScene = {role?: string};

/** Shalone's photo in a gold ring, with her name (site.yml author, host_photo). */
export const Host: React.FC<SceneProps<HostScene>> = ({scene, lesson}) => {
  const f = useCurrentFrame();
  const name = lesson.author || 'Your host';
  const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2);
  const size = 420;
  return (
    <Center style={{flexDirection: 'row', gap: 110}}>
      <div style={{position: 'relative', width: size, height: size, opacity: ramp(f, 0, 14)}}>
        <div style={{position: 'absolute', inset: 16, borderRadius: '50%', overflow: 'hidden', background: theme.card}}>
          {lesson.hostPhoto ? (
            <Img src={staticFile(lesson.hostPhoto)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
          ) : (
            <div style={{width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.serif, fontSize: 150, color: theme.gold}}>{initials}</div>
          )}
        </div>
        <svg width={size} height={size} style={{position: 'absolute', inset: 0}}>
          <circle cx={size / 2} cy={size / 2} r={size / 2 - 6} fill="none" stroke={theme.gold} strokeWidth={5} pathLength={1}
            transform={`rotate(-90 ${size / 2} ${size / 2})`} style={draw(ramp(f, 4, 40))} />
        </svg>
      </div>
      <div>
        <div style={{...enter(f, 14), fontFamily: theme.sans, fontSize: 30, letterSpacing: 8, color: theme.accent, fontWeight: 600}}>
          {(scene.role ?? 'Your host').toUpperCase()}
        </div>
        <div style={{...enter(f, 22), fontFamily: theme.serif, fontSize: 120, lineHeight: 1.05, marginTop: 14}}>{name}</div>
      </div>
    </Center>
  );
};
