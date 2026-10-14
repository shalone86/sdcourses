import {useCurrentFrame} from 'remotion';
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
  const travelStart = 10 + n * 8 + 10;
  const travelEnd = travelStart + Math.min(duration * 0.45, 160);
  const t = ramp(f, travelStart, travelEnd) * (n - 1);
  const tokenX = step / 2 + t * step;

  return (
    <Center>
      <div style={{position: 'relative', width: W, height: 260}}>
        <svg width={W} height={260} style={{position: 'absolute'}}>
          {scene.items.slice(1).map((_, i) => (
            <line key={i} x1={step / 2 + i * step + 60} x2={step / 2 + (i + 1) * step - 60} y1={90} y2={90}
              stroke={theme.rule} strokeWidth={4} pathLength={1} style={draw(ramp(f, 14 + i * 8, 30 + i * 8))} />
          ))}
          {scene.items.map((_, i) => (
            <circle key={i} cx={step / 2 + i * step} cy={90} r={46} fill={theme.card}
              stroke={t >= i - 0.05 && f >= travelStart ? theme.gold : theme.rule} strokeWidth={5} opacity={ramp(f, 6 + i * 8, 16 + i * 8)} />
          ))}
          <circle cx={tokenX} cy={90} r={20} fill={theme.gold} opacity={ramp(f, travelStart - 10, travelStart)} />
        </svg>
        {scene.items.map((label, i) => (
          <div key={i} style={{...enter(f, 8 + i * 8), position: 'absolute', top: 160, left: i * step, width: step, textAlign: 'center',
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
