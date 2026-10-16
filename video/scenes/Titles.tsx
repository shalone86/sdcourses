import {useCurrentFrame} from 'remotion';
import {enter, ramp} from '../anim';
import {theme} from '../theme';
import {Center} from './Center';
import type {SceneProps} from '.';

type TitlesScene = {items: {latin: string; english: string}[]};

/** Formal titles: the Latin, then its English, each in turn. */
export const Titles: React.FC<SceneProps<TitlesScene>> = ({scene, duration}) => {
  const f = useCurrentFrame();
  const gap = Math.floor((duration * 0.6) / scene.items.length);
  return (
    <Center style={{gap: 70}}>
      {scene.items.map((t, i) => {
        const cue = (k: number) => (scene as any).cues?.[k] ?? 6 + k * gap; // when it's said, else spaced
        const s = cue(i);
        const later = i < scene.items.length - 1 ? 1 - ramp(f, cue(i + 1), cue(i + 1) + 20) * 0.4 : 1;
        return (
          <div key={i} style={{textAlign: 'center', opacity: later}}>
            <div style={{...enter(f, s), fontFamily: theme.serif, fontStyle: 'italic', fontSize: 110, lineHeight: 1.1, color: i === scene.items.length - 1 ? theme.accent : theme.ink}}>
              {t.latin}
            </div>
            <div style={{...enter(f, s + 22), fontFamily: theme.sans, fontSize: 34, letterSpacing: 5, color: theme.muted, marginTop: 10}}>
              {t.english.toUpperCase()}
            </div>
          </div>
        );
      })}
    </Center>
  );
};
