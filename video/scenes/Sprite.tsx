import {Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {enter, ramp} from '../anim';
import {useBeat} from '../beat';
import {useStage} from '../layout';
import {theme} from '../theme';
import {Center} from './Center';
import type {SceneProps} from '.';

// One of her pixel animations (studio Pixel art tab → sprites/<name>.json, put in `art` by prepare.mjs).
//   move: stay (default) | hop (little jumps) | across (walks across the screen)
//   size: small | medium (default) | big | full (fills the slide, for a wide scene)
// A sketch (kind: 'sketch') has a picture per frame instead of pixel rows.
export type Art = {kind?: 'sketch'; width: number; height: number; fps: number; palette: string[]; frames: string[][] | string[]};
type SpriteScene = {sprite: string; art: Art; colors?: Colors; move?: 'stay' | 'hop' | 'across'; size?: 'small' | 'medium' | 'big' | 'full'; caption?: string};

const CODES = '0123456789abcdefghijklmnopqrstuvwxyz';

// Colors changed for one use of a drawing ({'#old': '#new'}), without saving a new drawing: a
// sprite or puppet scene's `colors:`, or a battle army's. Every pose follows, since only the palette changes.
export type Colors = Record<string, string>;
export function recolor<A extends {palette?: string[]}>(art: A, colors?: Colors | null): A {
  if (!colors || !art.palette || !Object.keys(colors).length) return art;
  const up = Object.fromEntries(Object.entries(colors).map(([k, v]) => [k.toUpperCase(), v]));
  return {...art, palette: art.palette.map((c) => up[c.toUpperCase()] ?? c)};
}
// Share of the room it takes (the slide, or the panel beside her video).
const SHARE = {small: 0.4, medium: 0.65, big: 0.85, full: 1};

/** The part of the drawing that has something in it (in any frame), so empty margins don't make it small. */
export function bounds(art: Art) {
  if (art.kind === 'sketch') return {x: 0, y: 0, w: art.width, h: art.height};
  let x0 = art.width, y0 = art.height, x1 = -1, y1 = -1;
  for (const rows of art.frames as string[][]) rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] !== '.') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  });
  return x1 < 0 ? {x: 0, y: 0, w: art.width, h: art.height} : {x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1};
}

/** One frame as SVG squares (crisp edges), each row's runs of one color merged. */
export const Frame: React.FC<{art: Art; rows: string[]}> = ({art, rows}) => (
  <>
    {rows.flatMap((row, y) => {
      const out: React.ReactNode[] = [];
      for (let x = 0; x < row.length;) {
        const c = row[x];
        let n = 1;
        while (row[x + n] === c) n++;
        if (c !== '.') out.push(<rect key={`${x},${y}`} x={x} y={y} width={n} height={1} fill={art.palette[CODES.indexOf(c)]} />);
        x += n;
      }
      return out;
    })}
  </>
);

export const Sprite: React.FC<SceneProps<SpriteScene>> = ({scene, duration}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const beat = useBeat();
  const art = scene.art;
  const n = art.frames.length;
  // Dance: one drawing per beat. Otherwise at the speed she set.
  const i = beat.dance ? Math.floor(beat.t) % n : Math.floor((f / fps) * art.fps) % n;
  const stage = useStage();
  const b = bounds(art);
  const share = SHARE[scene.size ?? 'medium'] ?? SHARE.medium;
  const fitW = (stage.w - 200) * share, fitH = (stage.h - 40 - (scene.caption ? 90 : 0)) * share;
  const px = Math.max(1, Math.floor(Math.min(fitW / b.w, fitH / b.h)));
  const scale = Math.min(fitW / art.width, fitH / art.height); // sketches scale smoothly
  const t = f / fps;
  let dx = 0, dy = 0;
  if (scene.move === 'hop') dy = -Math.abs(Math.sin(Math.PI * t * Math.max(1, art.fps / 2))) * px * 3;
  if (scene.move === 'across') dx = (ramp(f, 0, Math.max(1, duration)) - 0.5) * Math.max(0, stage.w - 320 - b.w * px);
  return (
    <Center style={{flexDirection: 'column', gap: 26}}>
      {art.kind === 'sketch' ? (
        // A sketch: its own picture for each frame, smooth (not blocky) when scaled.
        <Img src={staticFile(art.frames[i] as string)} style={{width: art.width * scale, height: art.height * scale, opacity: ramp(f, 0, 10),
          transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`}} />
      ) : (
      <svg width={b.w * px} height={b.h * px} viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} shapeRendering="crispEdges"
        style={{opacity: ramp(f, 0, 10), transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`, overflow: 'visible'}}>
        <Frame art={art} rows={art.frames[i] as string[]} />
      </svg>
      )}
      {scene.caption && (
        <div style={{...enter(f, 14), fontFamily: theme.serif, fontSize: 48, color: theme.ink, textAlign: 'center', maxWidth: 1400}}>{scene.caption}</div>
      )}
    </Center>
  );
};
