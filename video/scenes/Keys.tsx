import {useCurrentFrame} from 'remotion';
import {draw, enter, ramp} from '../anim';
import {theme} from '../theme';
import {Center} from './Center';
import type {SceneProps} from '.';

type KeysScene = {quote: string; cite: string};

/** One key, drawn pointing down; rotated to make the crossed keys of Peter. */
const Key: React.FC<{p: number; color: string; angle: number}> = ({p, color, angle}) => (
  <g transform={`translate(200 210) rotate(${angle})`} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round">
    <circle pathLength={1} style={draw(p)} cx={0} cy={-120} r={38} />
    <circle pathLength={1} style={draw(p)} cx={0} cy={-120} r={14} />
    <path pathLength={1} style={draw(p)} d="M0 -82 V150" />
    <path pathLength={1} style={draw(p)} d="M0 100 H34 V118 H18 V132 H34 V150 H0" />
  </g>
);

export const Keys: React.FC<SceneProps<KeysScene>> = ({scene}) => {
  const f = useCurrentFrame();
  return (
    <Center style={{flexDirection: 'row', gap: 100}}>
      <svg width={400} height={440} viewBox="0 0 400 440">
        <Key p={ramp(f, 4, 50)} color={theme.gold} angle={-38} />
        <Key p={ramp(f, 20, 66)} color={theme.ink} angle={38} />
      </svg>
      <div style={{maxWidth: 900}}>
        <div style={{...enter(f, 50), fontFamily: theme.serif, fontSize: 78, lineHeight: 1.2}}>“{scene.quote}”</div>
        <div style={{...enter(f, 72), fontFamily: theme.sans, fontSize: 30, letterSpacing: 4, color: theme.accent, marginTop: 30, fontWeight: 600}}>
          {scene.cite.toUpperCase()}
        </div>
      </div>
    </Center>
  );
};
