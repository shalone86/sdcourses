import {useCurrentFrame} from 'remotion';
import {enter, ramp} from '../anim';
import {theme} from '../theme';
import {Center} from './Center';
import type {SceneProps} from '.';

type QuoteScene = {text: string; highlight?: string; cite: string};

/** Words fade in one by one; the highlighted phrase then gets a marker swipe. */
export const Quote: React.FC<SceneProps<QuoteScene>> = ({scene, duration}) => {
  const f = useCurrentFrame();
  const text = scene.text.trim();
  const words = text.split(/\s+/);
  // Spoken pace when known (cues from the recording), else a steady reveal.
  const c = (scene as any).cues as {start?: number; end?: number} | undefined;
  const begin = c?.start ?? 6;
  const perWord = c?.start != null && c?.end != null ? Math.max(1, (c.end - c.start) / words.length) : Math.max(2, Math.min(5, Math.floor((duration * 0.45) / words.length)));
  const doneAt = begin + words.length * perWord;

  // Find which words belong to the highlight phrase.
  const hl = scene.highlight?.split(/\s+/) ?? [];
  let hlStart = -1;
  for (let i = 0; hl.length && i <= words.length - hl.length; i++) {
    if (hl.every((w, j) => words[i + j].replace(/[^\w]/g, '') === w.replace(/[^\w]/g, ''))) { hlStart = i; break; }
  }
  const swipe = ramp(f, doneAt + 10, doneAt + 40);

  return (
    <Center>
      <div style={{fontFamily: theme.serif, fontSize: text.length > 160 ? 60 : 72, lineHeight: 1.35, maxWidth: 1500, textAlign: 'center'}}>
        {words.map((w, i) => {
          const inHl = hlStart >= 0 && i >= hlStart && i < hlStart + hl.length;
          return (
            <span key={i} style={{opacity: ramp(f, begin + i * perWord, begin + 8 + i * perWord), position: 'relative'}}>
              {inHl && (
                <span
                  style={{
                    position: 'absolute', left: -6, right: i < hlStart + hl.length - 1 ? -14 : -6, bottom: 6, height: 28,
                    background: 'rgba(169,132,47,0.35)', transformOrigin: 'left', transform: `scaleX(${swipe})`, zIndex: -1,
                  }}
                />
              )}
              <span style={{color: inHl && swipe > 0.5 ? theme.accent : undefined}}>{w}</span>{' '}
            </span>
          );
        })}
      </div>
      <div style={{...enter(f, doneAt), fontFamily: theme.sans, fontSize: 30, letterSpacing: 4, color: theme.accent, marginTop: 44, fontWeight: 600}}>
        {scene.cite.toUpperCase()}
      </div>
    </Center>
  );
};
