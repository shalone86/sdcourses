import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {draw, pop, ramp} from '../anim';
import {theme} from '../theme';
import {Center} from './Center';
import type {SceneProps} from '.';

type CollegeScene = {center: string; ring: string; centerAfter?: string; ringAfter?: string; caption?: string};

/** Peter among the Twelve, which then grows into the Pope among the bishops. */
export const College: React.FC<SceneProps<CollegeScene>> = ({scene, duration}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const S = 620, c = S / 2;
  const morphAt = Math.floor(duration * 0.5);
  const m = scene.centerAfter ? ramp(f, morphAt, morphAt + 30) : 0;
  const count = Math.round(interpolate(m, [0, 1], [12, 36]));
  const R = interpolate(m, [0, 1], [220, 250]);

  const nodes = Array.from({length: count}, (_, i) => {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    return {x: c + Math.cos(a) * R, y: c + Math.sin(a) * R, i};
  });
  const label = (a: string, b: string | undefined, size: number, color: string) => (
    <div style={{position: 'relative', fontFamily: theme.serif, fontSize: size, color, height: size * 1.2}}>
      <div style={{opacity: 1 - m}}>{a}</div>
      {b && <div style={{position: 'absolute', top: 0, left: 0, opacity: m, whiteSpace: 'nowrap'}}>{b}</div>}
    </div>
  );

  return (
    <Center style={{flexDirection: 'row', gap: 120}}>
      <svg width={S} height={S}>
        {nodes.map((n) => {
          const show = n.i < 12 ? pop(f, 10 + n.i * 3, fps) : ramp(f, morphAt + 10 + (n.i - 12), morphAt + 20 + (n.i - 12));
          return <line key={`l${n.i}`} x1={c} y1={c} x2={n.x} y2={n.y} stroke={theme.rule} strokeWidth={2} pathLength={1} style={draw(Math.min(1, show) * ramp(f, 50, 80))} />;
        })}
        {nodes.map((n) => {
          const show = n.i < 12 ? pop(f, 10 + n.i * 3, fps) : ramp(f, morphAt + 10 + (n.i - 12), morphAt + 20 + (n.i - 12));
          return <circle key={n.i} cx={n.x} cy={n.y} r={interpolate(m, [0, 1], [22, 13]) * show} fill={theme.ink} />;
        })}
        <circle cx={c} cy={c} r={58 * pop(f, 2, fps)} fill={theme.accent} />
        <circle cx={c} cy={c} r={72 * ramp(f, 60, 90)} fill="none" stroke={theme.gold} strokeWidth={3} />
      </svg>
      <div>
        <div style={{fontFamily: theme.sans, fontSize: 24, letterSpacing: 5, color: theme.muted}}>HEAD</div>
        {label(scene.center, scene.centerAfter, 80, theme.accent)}
        <div style={{fontFamily: theme.sans, fontSize: 24, letterSpacing: 5, color: theme.muted, marginTop: 40}}>WITH</div>
        {label(scene.ring, scene.ringAfter, 80, theme.ink)}
        {scene.caption && (
          <div style={{opacity: ramp(f, morphAt + 40, morphAt + 60), fontFamily: theme.serif, fontStyle: 'italic', fontSize: 48, color: theme.muted, marginTop: 60}}>
            {scene.caption}
          </div>
        )}
      </div>
    </Center>
  );
};
