import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {draw, enter, pop, ramp} from '../anim';
import {theme} from '../theme';
import {Center} from './Center';
import type {SceneProps} from '.';

type TimelineScene = {items: {year: string; label: string}[]; counter?: {to: number; label: string}};

export const Timeline: React.FC<SceneProps<TimelineScene>> = ({scene, duration}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const W = 1560;
  const n = scene.items.length;
  const lineEnd = Math.min(duration * 0.55, 150);
  const at = (i: number) => (scene as any).cues?.[i] ?? 10 + (i / (n - 1)) * (lineEnd - 10); // when it's said, else spaced
  const countStart = lineEnd + 10;
  const count = Math.round(interpolate(f, [countStart, countStart + 60], [1, scene.counter?.to ?? 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));

  return (
    <Center>
      <div style={{position: 'relative', width: W, height: 300}}>
        <svg width={W} height={300} style={{position: 'absolute'}}>
          <line x1={20} y1={150} x2={W - 20} y2={150} pathLength={1} stroke={theme.rule} strokeWidth={4} style={draw(ramp(f, 4, lineEnd))} />
          {scene.items.map((_, i) => (
            <circle key={i} cx={20 + (i / (n - 1)) * (W - 40)} cy={150} r={14 * pop(f, at(i), fps)} fill={i === 0 || i === n - 1 ? theme.accent : theme.gold} />
          ))}
        </svg>
        {scene.items.map((it, i) => {
          const x = 20 + (i / (n - 1)) * (W - 40);
          const up = i % 2 === 0;
          return (
            <div
              key={i}
              style={{
                ...enter(f, at(i) + 4, up ? 16 : -16), position: 'absolute', left: x - 170, width: 340, textAlign: 'center',
                top: up ? 0 : 186,
              }}
            >
              <div style={{fontFamily: theme.sans, fontWeight: 600, fontSize: 34, color: theme.accent}}>{it.year}</div>
              <div style={{fontFamily: theme.serif, fontSize: 38, lineHeight: 1.15, marginTop: 4}}>{it.label}</div>
            </div>
          );
        })}
      </div>
      {scene.counter && (
        <div style={{...enter(f, countStart), marginTop: 70, display: 'flex', alignItems: 'baseline', gap: 28}}>
          <div style={{fontFamily: theme.serif, fontSize: 170, lineHeight: 1, color: theme.ink, fontVariantNumeric: 'tabular-nums'}}>{count}</div>
          <div style={{fontFamily: theme.serif, fontStyle: 'italic', fontSize: 50, color: theme.muted}}>{scene.counter.label}</div>
        </div>
      )}
    </Center>
  );
};
