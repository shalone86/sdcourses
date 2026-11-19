import {useLayoutEffect, useRef} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {enter, ramp} from '../anim';
import {useBeat} from '../beat';
import {useStage} from '../layout';
import {theme} from '../theme';
import {drawVoxels, voxelBounds} from '../voxel-draw.js';
import {Center} from './Center';
import type {SceneProps} from '.';

// One of her voxel characters (MagicaVoxel, uploaded on angelio.org/studio/draw/; scripts/voxels.mjs puts the model
// in `art`). Like a pixel animation, but she can turn it to face any way.
//   voxel: the model (one pose: priest-walk-slow)   view: front (default) | front-right | right | back-right | back | back-left | left | front-left
//   move: stay | hop | across | across-left (walking across, it turns to face the way it goes unless she picked a view)
//   size: small | medium (default) | big | full
export type VoxelArt = {kind: 'voxel'; fps: number; size: number[]; palette: (string | null)[]; frames: number[][][]};
type VoxelScene = {voxel: string; art: VoxelArt; view?: string; move?: 'stay' | 'hop' | 'across' | 'across-left'; size?: 'small' | 'medium' | 'big' | 'full'; caption?: string; nudge?: {flip?: boolean}};

const SHARE = {small: 0.4, medium: 0.65, big: 0.85, full: 1};

export const Voxel: React.FC<SceneProps<VoxelScene>> = ({scene, duration}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const beat = useBeat();
  const stage = useStage();
  const art = scene.art;
  const ref = useRef<HTMLCanvasElement>(null);
  const across = scene.move === 'across' || scene.move === 'across-left';
  // Walking across with no view picked: turned three-quarters the way it goes, so the face still shows.
  const view = scene.view && scene.view !== 'front' ? scene.view : across ? (scene.move === 'across' ? 'front-right' : 'front-left') : 'front';
  const n = art.frames.length;
  const i = beat.dance ? Math.floor(beat.t) % n : Math.floor((f / fps) * art.fps) % n;
  const share = SHARE[scene.size ?? 'medium'] ?? SHARE.medium;
  const fitW = (stage.w - 200) * share, fitH = (stage.h - 40 - (scene.caption ? 90 : 0)) * share;
  const b = voxelBounds(art, view);
  const s = Math.min(fitW / b.w, fitH / b.h);
  const w = Math.ceil(b.w * s), h = Math.ceil(b.h * s);
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    drawVoxels(g, art, i, {x: 0, y: 0, w: c.width, h: c.height}, view);
  }, [art, i, view, w, h]);
  const t = f / fps;
  let dx = 0, dy = 0;
  if (scene.move === 'hop') dy = -Math.abs(Math.sin(Math.PI * t * Math.max(1, art.fps / 2))) * s * 1.5;
  if (across) dx = (ramp(f, 0, Math.max(1, duration)) - 0.5) * Math.max(0, stage.w - 320 - w) * (scene.move === 'across-left' ? -1 : 1);
  const mirror = scene.nudge?.flip ? ' scaleX(-1)' : '';
  return (
    <Center style={{flexDirection: 'column', gap: 26}}>
      <canvas ref={ref} width={w} height={h} style={{width: w, height: h, opacity: ramp(f, 0, 10), transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)${mirror}`}} />
      {scene.caption && (
        <div style={{...enter(f, 14), fontFamily: theme.serif, fontSize: 48, color: theme.ink, textAlign: 'center', maxWidth: 1400}}>{scene.caption}</div>
      )}
    </Center>
  );
};
