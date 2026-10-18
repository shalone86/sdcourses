import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {useBeat} from './beat';
import {theme} from './theme';

// Kids style: bright shapes around the edges that drift, spin slowly and
// bounce on the beat. Positions are fixed (seeded), so it never looks random
// from one frame to the next. The middle stays clear for the scenes.
type Shape = {kind: 'circle' | 'star' | 'tri' | 'square' | 'squiggle' | 'plus'; x: number; y: number; size: number; color: number; spin: number; phase: number};

const SHAPES: Shape[] = [
  {kind: 'circle', x: 70, y: 120, size: 90, color: 0, spin: 0, phase: 0},
  {kind: 'star', x: 1810, y: 150, size: 110, color: 2, spin: 8, phase: 1},
  {kind: 'squiggle', x: 150, y: 880, size: 150, color: 1, spin: 0, phase: 2},
  {kind: 'tri', x: 1720, y: 900, size: 100, color: 3, spin: -6, phase: 3},
  {kind: 'plus', x: 330, y: 60, size: 56, color: 4, spin: 12, phase: 4},
  {kind: 'square', x: 1560, y: 70, size: 60, color: 5, spin: -10, phase: 5},
  {kind: 'circle', x: 1860, y: 560, size: 46, color: 1, spin: 0, phase: 6},
  {kind: 'star', x: 50, y: 600, size: 64, color: 3, spin: -7, phase: 7},
  {kind: 'plus', x: 1240, y: 965, size: 50, color: 0, spin: 9, phase: 8},
  {kind: 'circle', x: 720, y: 975, size: 36, color: 2, spin: 0, phase: 9},
  {kind: 'square', x: 120, y: 360, size: 40, color: 4, spin: 14, phase: 10},
  {kind: 'tri', x: 1840, y: 360, size: 54, color: 5, spin: 10, phase: 11},
];

const Glyph: React.FC<{s: Shape; fill: string}> = ({s, fill}) => {
  const r = s.size / 2;
  switch (s.kind) {
    case 'circle': return <circle cx={r} cy={r} r={r} fill={fill} />;
    case 'square': return <rect x={0} y={0} width={s.size} height={s.size} rx={s.size * 0.22} fill={fill} />;
    case 'tri': return <path d={`M${r} 0 L${s.size} ${s.size * 0.88} L0 ${s.size * 0.88} Z`} fill={fill} strokeLinejoin="round" stroke={fill} strokeWidth={s.size * 0.12} />;
    case 'plus': return <path d={`M${r} 0 V${s.size} M0 ${r} H${s.size}`} stroke={fill} strokeWidth={s.size * 0.3} strokeLinecap="round" />;
    case 'squiggle': return <path d={`M0 ${r} q${s.size / 8} ${-r * 0.7} ${s.size / 4} 0 t${s.size / 4} 0 t${s.size / 4} 0 t${s.size / 4} 0`} fill="none" stroke={fill} strokeWidth={s.size * 0.12} strokeLinecap="round" />;
    case 'star': {
      const pts = Array.from({length: 10}, (_, i) => {
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const rr = i % 2 ? r * 0.45 : r;
        return `${(r + rr * Math.cos(a)).toFixed(1)},${(r + rr * Math.sin(a)).toFixed(1)}`;
      });
      return <polygon points={pts.join(' ')} fill={fill} stroke={fill} strokeWidth={s.size * 0.08} strokeLinejoin="round" />;
    }
  }
};

export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {pulse, n} = useBeat();
  const t = frame / fps;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {SHAPES.map((s, i) => {
        // Every other shape answers each beat, so they take turns bouncing.
        const mine = (n + i) % 2 === 0 ? pulse : pulse * 0.3;
        const dx = Math.sin(t * 0.4 + s.phase) * 14;
        const dy = Math.cos(t * 0.33 + s.phase * 1.3) * 18 - mine * 14;
        const rot = t * s.spin + Math.sin(t + s.phase) * 6;
        const scale = 1 + mine * 0.16;
        return (
          <svg key={i} width={s.size} height={s.size} overflow="visible"
            style={{position: 'absolute', left: s.x - s.size / 2, top: s.y - s.size / 2, opacity: 0.85,
              transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) rotate(${rot.toFixed(1)}deg) scale(${scale.toFixed(3)})`}}>
            <Glyph s={s} fill={theme.palette[s.color % theme.palette.length]} />
          </svg>
        );
      })}
    </AbsoluteFill>
  );
};
