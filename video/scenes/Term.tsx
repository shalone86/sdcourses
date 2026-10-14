import {useCurrentFrame} from 'remotion';
import {draw, enter, ramp} from '../anim';
import {theme} from '../theme';
import {Center} from './Center';
import type {SceneProps} from '.';

type TermScene = {term: string; origin: string; meaning: string; footer?: string};

/** A word, where it comes from, and what it means. Letters type in. */
export const Term: React.FC<SceneProps<TermScene>> = ({scene}) => {
  const f = useCurrentFrame();
  const shown = Math.round(ramp(f, 8, 8 + scene.term.length * 4) * scene.term.length);
  return (
    <Center>
      <div style={{fontFamily: theme.serif, fontStyle: 'italic', fontSize: 220, lineHeight: 1, color: theme.ink}}>
        {scene.term.slice(0, shown)}
        <span style={{opacity: shown < scene.term.length ? 1 : 0, color: theme.gold}}>|</span>
      </div>
      <svg width={700} height={20} style={{marginTop: 30}}>
        <line x1={0} y1={10} x2={700} y2={10} pathLength={1} stroke={theme.rule} strokeWidth={2} style={draw(ramp(f, 34, 54))} />
      </svg>
      <div style={{display: 'flex', gap: 80, marginTop: 36, fontSize: 52}}>
        <div style={{...enter(f, 44), textAlign: 'center'}}>
          <div style={{fontFamily: theme.sans, fontSize: 24, letterSpacing: 5, color: theme.muted}}>FROM</div>
          <div style={{fontFamily: theme.serif, marginTop: 6}}>{scene.origin}</div>
        </div>
        <div style={{...enter(f, 60), textAlign: 'center'}}>
          <div style={{fontFamily: theme.sans, fontSize: 24, letterSpacing: 5, color: theme.muted}}>MEANING</div>
          <div style={{fontFamily: theme.serif, marginTop: 6, color: theme.accent}}>“{scene.meaning}”</div>
        </div>
      </div>
      {scene.footer && (
        <div style={{...enter(f, 110), marginTop: 70, fontFamily: theme.serif, fontStyle: 'italic', fontSize: 46, color: theme.muted}}>
          {scene.footer}
        </div>
      )}
    </Center>
  );
};
