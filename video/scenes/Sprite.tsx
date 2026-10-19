import {useCurrentFrame, useVideoConfig} from 'remotion';
import {enter, ramp} from '../anim';
import {useBeat} from '../beat';
import {theme} from '../theme';
import {Center} from './Center';
import type {SceneProps} from '.';

// One of her pixel animations (studio Pixel art tab → sprites/<name>.json, put in `art` by prepare.mjs).
//   move: stay (default) | hop (little jumps) | across (walks across the screen)
//   size: small | medium (default) | big
type Art = {width: number; height: number; fps: number; palette: string[]; frames: string[][]};
type SpriteScene = {sprite: string; art: Art; move?: 'stay' | 'hop' | 'across'; size?: 'small' | 'medium' | 'big'; caption?: string};

const CODES = '0123456789abcdefghijklmnopqrstuvwxyz';
const BOX = {small: 320, medium: 480, big: 620};

/** One frame as SVG squares (crisp edges), each row's runs of one color merged. */
const Frame: React.FC<{art: Art; rows: string[]}> = ({art, rows}) => (
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
  const box = BOX[scene.size ?? 'medium'] - (scene.caption ? 60 : 0);
  const px = Math.max(1, Math.floor(box / Math.max(art.width, art.height)));
  const t = f / fps;
  let dx = 0, dy = 0;
  if (scene.move === 'hop') dy = -Math.abs(Math.sin(Math.PI * t * Math.max(1, art.fps / 2))) * px * 3;
  if (scene.move === 'across') dx = (ramp(f, 0, Math.max(1, duration)) - 0.5) * 1400;
  return (
    <Center style={{flexDirection: 'column', gap: 26}}>
      <svg width={art.width * px} height={art.height * px} viewBox={`0 0 ${art.width} ${art.height}`} shapeRendering="crispEdges"
        style={{opacity: ramp(f, 0, 10), transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`, overflow: 'visible'}}>
        <Frame art={art} rows={art.frames[i]} />
      </svg>
      {scene.caption && (
        <div style={{...enter(f, 14), fontFamily: theme.serif, fontSize: 48, color: theme.ink, textAlign: 'center', maxWidth: 1400}}>{scene.caption}</div>
      )}
    </Center>
  );
};
