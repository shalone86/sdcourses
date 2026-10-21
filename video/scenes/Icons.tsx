import {icons} from 'lucide-react';
import {useCurrentFrame} from 'remotion';
import {enter, ramp} from '../anim';
import {useStage} from '../layout';
import {theme} from '../theme';
import {Center} from './Center';
import type {SceneProps} from '.';

// One to four icons (lucide.dev names) that draw themselves in, line by line, each with an
// optional word under it. Each appears when its word is said (cues "0", "1", …), else in turn.
type Item = {icon: string; label?: string};
type IconsScene = {items: Item[]; caption?: string; cues?: Record<string, number>};

const pascal = (name: string) => name.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());

export const IconsView: React.FC<SceneProps<IconsScene>> = ({scene, duration}) => {
  const f = useCurrentFrame();
  const stage = useStage();
  const items = (scene.items ?? []).slice(0, 4);
  const n = Math.max(1, items.length);
  const size = Math.min(n === 1 ? 380 : 300, (stage.w - 320 - (n - 1) * 80) / n, stage.h - (items.some((i) => i.label) ? 200 : 80) - (scene.caption ? 90 : 0));
  const step = Math.max(14, Math.min(30, (duration * 0.4) / n));
  return (
    <Center style={{flexDirection: 'column', gap: 30}}>
      <div style={{display: 'flex', gap: 80, alignItems: 'flex-start', justifyContent: 'center'}}>
        {items.map((it, i) => {
          const t = scene.cues?.[String(i)] ?? 8 + i * step;
          const p = ramp(f, t, t + 34); // how much of its lines are drawn
          const C = (icons as Record<string, React.FC<any>>)[pascal(it.icon ?? '')] ?? icons.CircleHelp;
          const cls = `ic${i}`;
          return (
            <div key={i} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, width: size}}>
              {/* Every line of the icon is shorter than 100 units, so a dash of 100 reveals it as it moves. */}
              <style>{`.${cls} *{stroke-dasharray:100;stroke-dashoffset:${(100 * (1 - p)).toFixed(2)}}`}</style>
              <C className={cls} size={size} color={theme.accent} strokeWidth={1.4} style={{opacity: p > 0 ? 1 : 0}} />
              {it.label && <div style={{...enter(f, t + 18), fontFamily: theme.sans, fontSize: 40, fontWeight: 600, color: theme.ink, textAlign: 'center'}}>{it.label}</div>}
            </div>
          );
        })}
      </div>
      {scene.caption && <div style={{...enter(f, 8 + n * step), fontFamily: theme.serif, fontStyle: 'italic', fontSize: 44, color: theme.muted, textAlign: 'center'}}>{scene.caption}</div>}
    </Center>
  );
};
