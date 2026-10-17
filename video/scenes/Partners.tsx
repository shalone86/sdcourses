import {icons} from 'lucide-react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {draw, enter, pop, ramp} from '../anim';
import {theme} from '../theme';
import {Center} from './Center';
import type {SceneProps} from '.';

type Item = {icon?: string; label: string};
type Side = {title: string; items: Item[]};
type PartnersScene = {left: Side; right: Side; link?: string; cues?: Record<string, number>};

const Icon: React.FC<{name?: string; size: number; color: string}> = ({name, size, color}) => {
  const C = (icons as Record<string, React.FC<any>>)[(name ?? 'circle').replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase())] ?? icons.Circle;
  return <C size={size} color={color} strokeWidth={1.5} />;
};

/**
 * Two sides that work together: e.g. "Byzantine" (prayers, icons, customs) and
 * "The Pope", with a two-way arrow between them. Items appear when said
 * (cues "left-0", "right-0", …), else in turn; the arrow comes last.
 */
export const Partners: React.FC<SceneProps<PartnersScene>> = ({scene, duration}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const order = [...scene.left.items.map((_, i) => `left-${i}`), ...scene.right.items.map((_, i) => `right-${i}`)];
  const step = Math.max(10, Math.min(24, (duration * 0.45) / order.length));
  const at = (k: string) => scene.cues?.[k] ?? 16 + order.indexOf(k) * step;
  const arrowAt = Math.max(...order.map(at)) + 16;

  const column = (side: Side, which: 'left' | 'right', start: number) => (
    <div style={{width: 560, ...enter(f, start, 20)}}>
      <div style={{fontFamily: theme.sans, fontSize: 30, letterSpacing: 6, color: theme.accent, fontWeight: 600, textAlign: 'center', marginBottom: 26}}>
        {side.title.toUpperCase()}
      </div>
      <div style={{display: 'flex', flexDirection: side.items.length > 1 ? 'column' : 'row', gap: 22, alignItems: 'center'}}>
        {side.items.map((it, i) => {
          const t = at(`${which}-${i}`);
          return (
            <div key={i} style={{display: 'flex', alignItems: 'center', gap: 26, width: 460, padding: '16px 24px', background: theme.card,
              border: `2px solid ${theme.rule}`, borderRadius: 18, opacity: ramp(f, t, t + 10), transform: `scale(${0.9 + 0.1 * pop(f, t, fps)})`,
              flexDirection: side.items.length > 1 ? 'row' : 'column', justifyContent: 'center'}}>
              <Icon name={it.icon} size={side.items.length > 1 ? 64 : 150} color={theme.ink} />
              <div style={{fontFamily: theme.serif, fontSize: side.items.length > 1 ? 50 : 56, color: theme.ink}}>{it.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <Center style={{flexDirection: 'row', gap: 40}}>
      {column(scene.left, 'left', 4)}
      <div style={{width: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18}}>
        <svg width={240} height={60} viewBox="0 0 240 60" fill="none" stroke={theme.gold} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">
          <path pathLength={1} style={draw(ramp(f, arrowAt, arrowAt + 24))} d="M20 30 H220 M40 12 L20 30 L40 48 M200 12 L220 30 L200 48" />
        </svg>
        {scene.link && <div style={{...enter(f, arrowAt + 16, 10), fontFamily: theme.serif, fontStyle: 'italic', fontSize: 38, color: theme.muted, textAlign: 'center'}}>{scene.link}</div>}
      </div>
      {column(scene.right, 'right', 10)}
    </Center>
  );
};
