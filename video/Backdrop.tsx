import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {swell, useBeat} from './beat';
import {theme} from './theme';

// Kids style: bright shapes around the edges that drift, spin slowly and
// bounce on the beat. Positions are fixed (seeded), so it never looks random
// from one frame to the next. The middle stays clear for the scenes.
type Shape = {kind: 'circle' | 'star' | 'tri' | 'square' | 'squiggle' | 'plus'; x: number; y: number; size: number; color: number; spin: number; phase: number};

const SHAPES: Shape[] = [
  {kind: 'circle', x: 90, y: 130, size: 80, color: 0, spin: 0, phase: 0},
  {kind: 'star', x: 1800, y: 160, size: 96, color: 2, spin: 5, phase: 1},
  {kind: 'squiggle', x: 150, y: 880, size: 130, color: 1, spin: 0, phase: 2},
  {kind: 'tri', x: 1730, y: 890, size: 84, color: 3, spin: -4, phase: 3},
  {kind: 'plus', x: 1880, y: 540, size: 44, color: 4, spin: 8, phase: 4},
  {kind: 'square', x: 60, y: 520, size: 40, color: 5, spin: -6, phase: 5},
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
  const beat = useBeat();
  const t = frame / fps;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {SHAPES.map((s, i) => {
        // Half the shapes swell on even beats, half on odd ones, smoothly.
        const mine = beat.kids ? swell((beat.t + i) / 2) : 0;
        const dx = Math.sin(t * 0.4 + s.phase) * 12;
        const dy = Math.cos(t * 0.33 + s.phase * 1.3) * 14 - mine * 8;
        const rot = t * s.spin + Math.sin(t * 0.7 + s.phase) * 5;
        const scale = 1 + mine * 0.08;
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
