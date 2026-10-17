import {useCurrentFrame, useVideoConfig} from 'remotion';
import {draw, enter, pop, ramp} from '../anim';
import {theme} from '../theme';
import {Center} from './Center';
import type {SceneProps} from '.';

type UnionScene = {center?: string; items: string[]; caption?: string; cues?: Record<string, number>};

/**
 * One Church made of many: a center (the Catholic Church) with Churches around
 * it, joined by dashed lines. Each appears when named (cues by index), else in turn.
 */
export const Union: React.FC<SceneProps<UnionScene>> = ({scene, duration}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const W = 1500;
  const H = 700;
  const cx = W / 2;
  const cy = H / 2 - 10;
  const n = scene.items.length;
  const step = Math.max(12, Math.min(30, (duration * 0.5) / Math.max(1, n)));
  const at = (i: number) => scene.cues?.[i] ?? 24 + i * step;
  const rx = 560;
  const ry = 250;
  const pos = (i: number) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  };
  return (
    <Center>
      <div style={{position: 'relative', width: W, height: H}}>
        <svg width={W} height={H} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
          {scene.items.map((_, i) => {
            const [x, y] = pos(i);
            return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={theme.gold} strokeWidth={4} strokeDasharray="4 14" strokeLinecap="round"
              opacity={ramp(f, at(i), at(i) + 18)} />;
          })}
          {/* Dashed ring: they belong together, not only to the center */}
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={theme.rule} strokeWidth={3} strokeDasharray="2 12" strokeLinecap="round"
            pathLength={1} style={draw(ramp(f, at(n - 1) + 10, at(n - 1) + 50))} />
          <circle cx={cx} cy={cy} r={120 * pop(f, 2, fps)} fill={theme.card} stroke={theme.accent} strokeWidth={5} />
        </svg>
        <div style={{position: 'absolute', left: cx - 120, top: cy - 60, width: 240, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', fontFamily: theme.serif, fontSize: 42, lineHeight: 1.05, color: theme.accent, ...enter(f, 8, 8)}}>
          {scene.center ?? 'The Catholic Church'}
        </div>
        {scene.items.map((label, i) => {
          const [x, y] = pos(i);
          return (
            <div key={i} style={{position: 'absolute', left: x - 160, top: y - 34, width: 320, textAlign: 'center', ...enter(f, at(i), 12)}}>
              <span style={{display: 'inline-block', background: theme.card, border: `3px solid ${theme.gold}`, borderRadius: 999, padding: '10px 26px',
                fontFamily: theme.serif, fontSize: 40, color: theme.ink, transform: `scale(${pop(f, at(i), fps)})`}}>{label}</span>
            </div>
          );
        })}
        {scene.caption && (
          <div style={{...enter(f, at(n - 1) + 30), position: 'absolute', left: 0, right: 0, bottom: 4, textAlign: 'center',
            fontFamily: theme.serif, fontStyle: 'italic', fontSize: 40, color: theme.muted}}>{scene.caption}</div>
        )}
      </div>
    </Center>
  );
};
