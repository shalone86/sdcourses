import {interpolate, useCurrentFrame} from 'remotion';
import {draw, enter, ramp} from '../anim';
import {theme} from '../theme';
import {Center} from './Center';
import type {SceneProps} from '.';

type ChainScene = {items: string[]; caption?: string};

/** A row of links with a gold token (the faith) handed along it. */
export const Chain: React.FC<SceneProps<ChainScene>> = ({scene, duration}) => {
  const f = useCurrentFrame();
  const n = scene.items.length;
  const W = 1600, step = W / n;
  // Items appear when they're said (cues), and the token moves from one to the next as they are.
  const cues: (number | undefined)[] = scene.items.map((_, i) => (scene as any).cues?.[i]);
  const spoken = cues.every((c, i) => c != null && (i === 0 || (c as number) > (cues[i - 1] as number)));
  const appear = (i: number) => (spoken ? (cues[i] as number) : 8 + i * 8);
  const travelStart = spoken ? (cues[0] as number) : 10 + n * 8 + 10;
  const travelEnd = spoken ? (cues[n - 1] as number) : travelStart + Math.min(duration * 0.45, 160);
  const t = spoken
    ? interpolate(f, cues as number[], scene.items.map((_, i) => i), {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : ramp(f, travelStart, travelEnd) * (n - 1);
  const tokenX = step / 2 + t * step;

  return (
    <Center>
      <div style={{position: 'relative', width: W, height: 260}}>
        <svg width={W} height={260} style={{position: 'absolute'}}>
          {scene.items.slice(1).map((_, i) => (
            <line key={i} x1={step / 2 + i * step + 60} x2={step / 2 + (i + 1) * step - 60} y1={90} y2={90}
              stroke={theme.rule} strokeWidth={4} pathLength={1} style={draw(ramp(f, appear(i) + 6, appear(i) + 22))} />
          ))}
          {scene.items.map((_, i) => (
            <circle key={i} cx={step / 2 + i * step} cy={90} r={46} fill={theme.card}
              stroke={t >= i - 0.05 && f >= travelStart ? theme.gold : theme.rule} strokeWidth={5} opacity={ramp(f, appear(i) - 2, appear(i) + 8)} />
          ))}
          <circle cx={tokenX} cy={90} r={20} fill={theme.gold} opacity={ramp(f, travelStart - 10, travelStart)} />
        </svg>
        {scene.items.map((label, i) => (
          <div key={i} style={{...enter(f, appear(i)), position: 'absolute', top: 160, left: i * step, width: step, textAlign: 'center',
            fontFamily: theme.serif, fontSize: 42, color: i === n - 1 ? theme.accent : theme.ink}}>
            {label}
          </div>
        ))}
      </div>
      {scene.caption && (
        <div style={{...enter(f, travelEnd), fontFamily: theme.serif, fontStyle: 'italic', fontSize: 58, color: theme.muted, marginTop: 60}}>
          {scene.caption}
        </div>
      )}
    </Center>
  );
};
