import {useCurrentFrame, useVideoConfig} from 'remotion';
import {draw, enter, pop, ramp} from '../anim';
import {theme} from '../theme';
import {Center} from './Center';
import type {SceneProps} from '.';

type Part = 'wall' | 'doors' | 'icons' | 'supper' | 'feasts';
type IconostasisScene = {
  highlight?: Part[]; // parts that glow and get a label
  open?: boolean; // the Royal Doors open onto the Holy Table
  caption?: string;
  cues?: Partial<Record<Part | 'open', number>>; // frames when each highlight / the opening happens
};

const W = 1240;
const H = 640;
const FLOOR = 610;
const cx = W / 2;

/** An iconostasis, drawn flat: Royal and Deacons' Doors, Christ and the Mother of God, the feasts and the Mystical Supper. */
export const Iconostasis: React.FC<SceneProps<IconostasisScene>> = ({scene, duration}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const hi = new Set(scene.highlight ?? []);
  const cue = (k: Part | 'open', fallback: number) => scene.cues?.[k] ?? fallback;
  const glow = (k: Part) => (hi.has(k) ? ramp(f, cue(k, 50), cue(k, 50) + 16) : 0);
  const openP = scene.open ? ramp(f, cue('open', Math.min(90, duration * 0.4)), cue('open', Math.min(90, duration * 0.4)) + 30) : 0;
  const line = (k: Part) => (glow(k) > 0 ? theme.accent : theme.gold);

  // Geometry
  const rd = {w: 230, h: 360}; // Royal Doors
  const dd = {w: 110, h: 300}; // Deacons' Doors
  const icon = {w: 150, h: 250};
  const ddX = 420; // distance of each deacon door's centre from the middle
  const iconX = 225; // distance of Christ / Mother of God from the middle

  const iconBox = (x: number, label: string, k: Part, at: number) => (
    <g style={{opacity: ramp(f, at, at + 14)}}>
      <rect x={x - icon.w / 2} y={FLOOR - icon.h - 30} width={icon.w} height={icon.h} rx={10} fill={theme.card} stroke={line(k)} strokeWidth={4 + glow(k) * 2} />
      <circle cx={x} cy={FLOOR - icon.h + 40} r={34} fill="none" stroke={theme.gold} strokeWidth={4} />
      <circle cx={x} cy={FLOOR - icon.h + 40} r={18} fill={theme.rule} />
      <path d={`M${x - 46} ${FLOOR - 52} Q${x} ${FLOOR - icon.h + 70} ${x + 46} ${FLOOR - 52} Z`} fill={theme.rule} />
      <text x={x} y={FLOOR - 4} textAnchor="middle" fontFamily={theme.sans} fontSize={22} letterSpacing={2} fill={theme.muted}>{label.toUpperCase()}</text>
    </g>
  );
  const door = (x: number, w: number, h: number, k: Part, at: number, leaves = 1, open = 0) => {
    const top = FLOOR - h;
    const arch = `M${x - w / 2} ${FLOOR} V${top + w / 2} A${w / 2} ${w / 2} 0 0 1 ${x + w / 2} ${top + w / 2} V${FLOOR}`;
    return (
      <g>
        <path d={arch} fill={theme.ink} opacity={0.08 + open * 0.9} />
        {open > 0 && (
          <g opacity={open}>
            <rect x={x - 70} y={FLOOR - 120} width={140} height={90} rx={6} fill={theme.card} stroke={theme.gold} strokeWidth={3} />
            <path d={`M${x} ${FLOOR - 200} V${FLOOR - 140} M${x - 22} ${FLOOR - 180} H${x + 22}`} stroke={theme.gold} strokeWidth={6} strokeLinecap="round" />
          </g>
        )}
        {Array.from({length: leaves}, (_, i) => {
          const lw = w / leaves;
          const lx = x - w / 2 + i * lw;
          const shift = (i === 0 ? -1 : 1) * open * (lw * 0.5);
          return (
            <g key={i} transform={`translate(${shift} 0)`}>
              <path d={leaves === 2
                ? (i === 0 ? `M${lx} ${FLOOR} V${top + w / 2} A${w / 2} ${w / 2} 0 0 1 ${x} ${top} V${FLOOR} Z` : `M${x} ${FLOOR} V${top} A${w / 2} ${w / 2} 0 0 1 ${lx + lw} ${top + w / 2} V${FLOOR} Z`)
                : `${arch} Z`}
                fill={theme.card} stroke={line(k)} strokeWidth={4 + glow(k) * 2} pathLength={1} style={draw(ramp(f, at, at + 24))} />
              {leaves === 2 && [0, 1].map((r) => (
                <circle key={r} cx={lx + lw / 2} cy={top + 120 + r * 120} r={30} fill="none" stroke={theme.gold} strokeWidth={3} opacity={ramp(f, at + 18, at + 30)} />
              ))}
            </g>
          );
        })}
      </g>
    );
  };

  const labels: {k: Part; x: number; y: number; text: string}[] = [
    {k: 'doors', x: cx, y: FLOOR + 24, text: 'Royal Doors'},
    {k: 'supper', x: cx, y: 70, text: 'Mystical Supper'},
    {k: 'feasts', x: cx, y: 70, text: 'The great feasts'},
  ];

  return (
    <Center>
      <div style={{position: 'relative', width: W, height: H + 40}}>
        <svg width={W} height={H} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
          {/* The wall */}
          <rect x={40} y={110} width={W - 80} height={FLOOR - 110} rx={14} fill={theme.bg} stroke={line('wall')} strokeWidth={4 + glow('wall') * 2} pathLength={1} style={draw(ramp(f, 0, 30))} />
          {/* Feasts row */}
          {Array.from({length: 12}, (_, i) => {
            const fw = (W - 160) / 12;
            return <rect key={i} x={80 + i * fw + 6} y={126} width={fw - 12} height={62} rx={6} fill={theme.card} stroke={line('feasts')} strokeWidth={2 + glow('feasts') * 2} opacity={ramp(f, 20 + i * 2, 32 + i * 2)} />;
          })}
          {/* Mystical Supper above the Royal Doors */}
          <rect x={cx - 160} y={FLOOR - rd.h - 70} width={320} height={58} rx={8} fill={theme.card} stroke={line('supper')} strokeWidth={3 + glow('supper') * 2} opacity={ramp(f, 26, 40)} />
          {door(cx, rd.w, rd.h, 'doors', 14, 2, openP)}
          {door(cx - ddX, dd.w, dd.h, 'doors', 22)}
          {door(cx + ddX, dd.w, dd.h, 'doors', 22)}
          {iconBox(cx - iconX, 'Theotokos', 'icons', 30)}
          {iconBox(cx + iconX, 'Christ', 'icons', 30)}
        </svg>
        {labels.filter((l) => hi.has(l.k)).map((l, i) => (
          <div key={i} style={{position: 'absolute', left: l.x - 260, width: 520, top: l.y - 34, textAlign: 'center', ...enter(f, cue(l.k, 50) + 6, 10),
            fontFamily: theme.serif, fontSize: 40, color: theme.accent, transform: `${enter(f, cue(l.k, 50) + 6, 10).transform} scale(${pop(f, cue(l.k, 50), fps) * 0.1 + 0.9})`}}>
            {l.text}
          </div>
        ))}
        {scene.caption && (
          <div style={{...enter(f, Math.min(duration - 40, 70)), position: 'absolute', left: 0, right: 0, bottom: -40, textAlign: 'center',
            fontFamily: theme.serif, fontStyle: 'italic', fontSize: 40, color: theme.muted}}>{scene.caption}</div>
        )}
      </div>
    </Center>
  );
};
