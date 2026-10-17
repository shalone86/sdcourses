import {icons} from 'lucide-react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {draw, enter, pop, ramp} from '../anim';
import {theme} from '../theme';
import {Center} from './Center';
import {Check} from './Check';
import type {SceneProps} from '.';

// icon: 'dome' | 'facade' (line-drawn churches) or any https://lucide.dev icon name.
type Side = {kicker: string; title: string; note: string; icon?: string};
// emphasis 'none': two equals side by side (no check, no dimming).
type CompareScene = {left: Side; right: Side; emphasis?: 'left' | 'right' | 'none'};

/** Simple line-drawn church facades: a dome, and a columned front. */
const Dome: React.FC<{p: number; color: string}> = ({p, color}) => (
  <svg width={260} height={200} viewBox="0 0 260 200" fill="none" stroke={color} strokeWidth={4}>
    <path pathLength={1} style={draw(p)} d="M60 120 Q60 40 130 34 Q200 40 200 120" />
    <path pathLength={1} style={draw(p)} d="M130 34 V14 M122 20 H138" />
    <path pathLength={1} style={draw(p)} d="M40 120 H220 M40 190 H220 M60 120 V190 M100 120 V190 M160 120 V190 M200 120 V190" />
  </svg>
);
const Facade: React.FC<{p: number; color: string}> = ({p, color}) => (
  <svg width={260} height={200} viewBox="0 0 260 200" fill="none" stroke={color} strokeWidth={4}>
    <path pathLength={1} style={draw(p)} d="M20 70 L130 20 L240 70 Z" />
    <path pathLength={1} style={draw(p)} d="M20 70 H240 M20 190 H240" />
    <path pathLength={1} style={draw(p)} d="M45 80 V190 M85 80 V190 M125 80 V190 M165 80 V190 M205 80 V190" />
  </svg>
);

/** A chalice (cup, knop, foot), drawn in line. */
const chalice = 'M80 40 H180 Q178 112 130 124 Q82 112 80 40 Z M130 124 V160 M116 140 H144 M96 190 Q130 168 164 190 Z';
/** Eastern Eucharist: chalice and spoon. */
const ChaliceSpoon: React.FC<{p: number; color: string}> = ({p, color}) => (
  <svg width={260} height={200} viewBox="0 0 260 200" fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
    <path pathLength={1} style={draw(p)} d={chalice} />
    <path pathLength={1} style={draw(p)} d="M196 22 L226 182 M190 16 Q196 4 204 14 Q206 26 198 30 Q190 28 190 16 Z" />
  </svg>
);
/** Western Eucharist: chalice and host (a circle with a cross). */
const ChaliceHost: React.FC<{p: number; color: string}> = ({p, color}) => (
  <svg width={260} height={200} viewBox="0 0 260 200" fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
    <path pathLength={1} style={draw(p)} d={chalice} />
    <circle pathLength={1} style={draw(p)} cx={130} cy={20} r={18} />
    <path pathLength={1} style={draw(p)} d="M130 8 V32 M118 20 H142" />
  </svg>
);

const SideIcon: React.FC<{name: string; p: number}> = ({name, p}) => {
  if (name === 'chalice-spoon') return <ChaliceSpoon p={p} color={theme.ink} />;
  if (name === 'chalice-host') return <ChaliceHost p={p} color={theme.ink} />;
  if (name === 'dome') return <Dome p={p} color={theme.ink} />;
  if (name === 'facade') return <Facade p={p} color={theme.ink} />;
  const Icon = (icons as Record<string, React.FC<any>>)[name.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase())] ?? icons.Circle;
  return <div style={{height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: p}}><Icon size={150} color={theme.ink} strokeWidth={1.3} /></div>;
};

export const Compare: React.FC<SceneProps<CompareScene>> = ({scene, duration}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const emph = scene.emphasis ?? 'right';
  // Both cards from the start; the check comes when the chosen one is named (cue), else partway.
  const cues = (scene as any).cues as {decide?: number} | undefined;
  const decideAt = cues?.decide != null ? Math.max(40, cues.decide + 12) : Math.min(110, Math.floor(duration * 0.45));
  const decided = ramp(f, decideAt, decideAt + 16);

  const card = (side: Side, which: 'left' | 'right', start: number) => {
    const equal = emph === 'none';
    const on = which === emph;
    const dim = on || equal ? 1 : 1 - decided * 0.55;
    const border = on ? decided : 0;
    return (
      <div
        style={{
          ...enter(f, start, 40), opacity: (enter(f, start).opacity as number) * dim,
          width: 640, padding: '48px 40px', background: theme.card, borderRadius: 18, textAlign: 'center',
          border: `3px solid ${on ? `rgba(122,31,43,${border})` : 'transparent'}`, position: 'relative',
        }}
      >
        <SideIcon name={side.icon ?? (which === 'left' ? 'dome' : 'facade')} p={ramp(f, start + 6, start + 46)} />
        <div style={{fontFamily: theme.sans, fontSize: 24, letterSpacing: 5, color: on ? theme.accent : theme.muted, marginTop: 24, fontWeight: 600}}>
          {side.kicker.toUpperCase()}
        </div>
        <div style={{fontFamily: theme.serif, fontSize: 64, marginTop: 8}}>{side.title}</div>
        <div style={{fontFamily: theme.serif, fontStyle: 'italic', fontSize: 38, color: theme.muted, marginTop: 10}}>{side.note}</div>
        {on && (
          <Check size={76} color={theme.card} bg={theme.accent}
            style={{position: 'absolute', top: -34, right: -34, transform: `scale(${pop(f, decideAt, fps)})`}} />
        )}
      </div>
    );
  };

  return (
    <Center style={{flexDirection: 'row', gap: 90}}>
      {card(scene.left, 'left', 4)}
      {card(scene.right, 'right', 22)}
    </Center>
  );
};
