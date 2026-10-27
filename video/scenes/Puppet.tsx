import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ramp} from '../anim';
import {useStage} from '../layout';
import {puppetAt, type Action, type PuppetEvent} from '../puppet';
import {Frame, type Art} from './Sprite';
import type {SceneProps} from '.';

// The keyboard puppet (PUPPET.md): one of her characters (drawings `<character>-<action>`,
// put in `actions` by prepare.mjs) doing what she played on the Timing tab (`puppet`, frames
// from the scene's start). Items (`item-<name>`) appear beside it while it points.
//   character: guy | bishop | …   item: the first item it points to (`i` switches)
//   size: small | medium (default) | big     start: left | center (default) | right
type PuppetScene = {character: string; actions: Partial<Record<Action, Art>>; items?: {name: string; art: Art}[]; puppet?: PuppetEvent[];
  size?: 'small' | 'medium' | 'big'; start?: 'left' | 'center' | 'right'};

// How tall the character's grid is, as a share of the room.
const SHARE = {small: 0.38, medium: 0.55, big: 0.75};

export const Puppet: React.FC<SceneProps<PuppetScene>> = ({scene}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stage = useStage();
  const any = Object.values(scene.actions ?? {})[0];
  if (!any) {
    return <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', fontSize: 40, color: '#888'}}>No drawings for “{scene.character}” yet</AbsoluteFill>;
  }
  // Every drawing of a character shares one grid (32×32, feet on the same row), so one pixel size fits all.
  const gw = any.width, gh = any.height;
  const px = Math.max(1, Math.floor((stage.h * (SHARE[scene.size ?? 'medium'] ?? SHARE.medium)) / gh));
  const w = gw * px, hgt = gh * px;
  const margin = 60 + w / 2;
  const x0 = {left: 0.18, center: 0.5, right: 0.82}[scene.start ?? 'center'] * stage.w;
  const s = puppetAt(scene.puppet ?? [], f, fps, scene.actions, {x0: Math.max(margin, Math.min(stage.w - margin, x0)), minX: margin, maxX: stage.w - margin});
  const art = scene.actions[s.action]!;
  const rows = art.frames[s.frame] as string[];
  const items = scene.items ?? [];
  const item = items.length ? items[s.item % items.length] : null;
  const bottom = 40; // feet this far above the bottom of the room
  return (
    <AbsoluteFill style={{opacity: ramp(f, 0, 10)}}>
      <svg width={w} height={hgt} viewBox={`0 0 ${gw} ${gh}`} shapeRendering="crispEdges"
        style={{position: 'absolute', left: s.x - w / 2, top: stage.h - bottom - hgt, transform: s.flip ? 'scaleX(-1)' : undefined, overflow: 'visible'}}>
        <Frame art={art} rows={rows} />
      </svg>
      {s.showItem && item && (
        // While it points, the item appears beside the character on the side it faces (at 8 × 8 it can't
        // hold one), at the same pixel size, its middle level with the character's.
        <svg width={item.art.width * px} height={item.art.height * px} viewBox={`0 0 ${item.art.width} ${item.art.height}`} shapeRendering="crispEdges"
          style={{position: 'absolute', left: s.facing === 1 ? s.x + w / 2 + px : s.x - w / 2 - px - item.art.width * px,
            top: stage.h - bottom - hgt / 2 - (item.art.height * px) / 2, opacity: ramp(f - s.since, 0, 4)}}>
          <Frame art={item.art} rows={item.art.frames[Math.floor((f / fps) * item.art.fps) % item.art.frames.length] as string[]} />
        </svg>
      )}
    </AbsoluteFill>
  );
};

