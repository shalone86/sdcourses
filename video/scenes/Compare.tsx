import {useCurrentFrame, useVideoConfig} from 'remotion';
import {draw, enter, pop, ramp} from '../anim';
import {theme} from '../theme';
import {Center} from './Center';
import {Check} from './Check';
import type {SceneProps} from '.';

type Side = {kicker: string; title: string; note: string};
type CompareScene = {left: Side; right: Side; emphasis?: 'left' | 'right'};

/** Simple line-drawn church facades: a dome, and a columned front. */
const Dome: React.FC<{p: number; color: string}> = ({p, color}) => (
  <svg width={260} height={200} viewBox="0 0 260 200" fill="none" stroke={color} strokeWidth={4}>
    <path pathLength={1} style={draw(p)} d="M60 120 Q60 40 130 34 Q200 40 200 120" />
    <path pathLength={1} style={draw(p)} d="M130 34 V14 M122 20 H138" />
    <path pathLength={1} style={draw(p)} d="M40 120 H220 M40 190 H220 M60 120 V190 M100 120 V190 M160 120 V190 M200 120 V190" />
  </svg>
);
const Facade: React.FC<{p: number; color: string}> = ({p, color}) => (
  <svg width={260} height={200} viewBox="0 0 260 200" fill="none" stroke={color} strokeWidth={4}>
    <path pathLength={1} style={draw(p)} d="M20 70 L130 20 L240 70 Z" />
    <path pathLength={1} style={draw(p)} d="M20 70 H240 M20 190 H240" />
    <path pathLength={1} style={draw(p)} d="M45 80 V190 M85 80 V190 M125 80 V190 M165 80 V190 M205 80 V190" />
  </svg>
);

export const Compare: React.FC<SceneProps<CompareScene>> = ({scene, duration}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const emph = scene.emphasis ?? 'right';
  const decideAt = Math.min(110, Math.floor(duration * 0.45));
  const decided = ramp(f, decideAt, decideAt + 16);

  const card = (side: Side, which: 'left' | 'right', start: number) => {
    const on = which === emph;
    const dim = on ? 1 : 1 - decided * 0.55;
    const border = on ? decided : 0;
    return (
      <div
        style={{
          ...enter(f, start, 40), opacity: (enter(f, start).opacity as number) * dim,
          width: 640, padding: '48px 40px', background: theme.card, borderRadius: 18, textAlign: 'center',
          border: `3px solid ${on ? `rgba(122,31,43,${border})` : 'transparent'}`, position: 'relative',
        }}
      >
        {which === 'left' ? <Dome p={ramp(f, start + 6, start + 46)} color={theme.ink} /> : <Facade p={ramp(f, start + 6, start + 46)} color={theme.ink} />}
        <div style={{fontFamily: theme.sans, fontSize: 24, letterSpacing: 5, color: on ? theme.accent : theme.muted, marginTop: 24, fontWeight: 600}}>
          {side.kicker.toUpperCase()}
        </div>
        <div style={{fontFamily: theme.serif, fontSize: 64, marginTop: 8}}>{side.title}</div>
        <div style={{fontFamily: theme.serif, fontStyle: 'italic', fontSize: 38, color: theme.muted, marginTop: 10}}>{side.note}</div>
        {on && (
          <Check size={76} color={theme.card} bg={theme.accent}
            style={{position: 'absolute', top: -34, right: -34, transform: `scale(${pop(f, decideAt, fps)})`}} />
        )}
      </div>
    );
  };

  return (
    <Center style={{flexDirection: 'row', gap: 90}}>
      {card(scene.left, 'left', 4)}
      {card(scene.right, 'right', 22)}
    </Center>
  );
};
