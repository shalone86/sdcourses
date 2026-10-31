import {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ramp} from '../anim';
import {battleAt, battleSeconds, CELL, mapSize, viewPx, type ArtMap, type Battle} from '../battle';
import {StageContext, useStage} from '../layout';
import {theme} from '../theme';
import {Frame, type Art} from './Sprite';
import type {SceneProps} from '.';

// A battle (BATTLES.md): the PICO-8-style world in battle.ts, drawn at whole pixels and scaled by a
// whole number so the pixels stay square. `battle` is the battle file (battles/<name>.yml) and
// `arts` its drawings, both put in the scene by prepare.mjs (or scripts/battle.mjs).
//   palette: pico (default; colors snap to PICO-8's 16) | own (her colors as drawn)
//   clip: [from, to] seconds of the battle this picture plays (a lesson can use one battle across several
//   slides); it starts at `from` when the picture starts and holds on its last moment at `to`
type BattleScene = {battle: Battle; arts: ArtMap; palette?: 'pico' | 'own'; clip?: [number, number]};

const PICO = ['000000', '1d2b53', '7e2553', '008751', 'ab5236', '5f574f', 'c2c3c7', 'fff1e8',
  'ff004d', 'ffa300', 'ffec27', '00e436', '29adff', '83769c', 'ff77a8', 'ffccaa'];
const rgb = (h: string) => [0, 2, 4].map((i) => parseInt(h.replace('#', '').slice(i, i + 2), 16));
const snap = (hex: string) => {
  const c = rgb(hex);
  let best = PICO[0], bd = Infinity;
  for (const p of PICO) {
    const q = rgb(p);
    const d = (c[0] - q[0]) ** 2 * 2 + (c[1] - q[1]) ** 2 * 4 + (c[2] - q[2]) ** 2 * 3;
    if (d < bd) { bd = d; best = p; }
  }
  return '#' + best;
};

export const BattleView: React.FC<{battle: Battle; arts: ArtMap; palette?: 'pico' | 'own'; time?: number}> = ({battle, arts, palette = 'pico', time}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stage = useStage();
  const T = time ?? f / fps;

  const art = useMemo<ArtMap>(() => {
    if (palette === 'own') return arts;
    return Object.fromEntries(Object.entries(arts).map(([k, a]) => [k, {...a, palette: a.palette.map(snap)} as Art]));
  }, [arts, palette]);

  const view = viewPx(battle), map = mapSize(battle);
  const scale = Math.max(1, Math.floor(Math.min(stage.w / view.w, stage.h / view.h)));
  const s = battleAt(battle, art, T);
  const ground = battle.ground ?? '#' + PICO[3];

  // Every drawing frame is defined once and placed with <use>.
  const defs = Object.entries(art).flatMap(([name, a]) =>
    (a.frames as string[][]).map((rows, i) => <g key={`${name}.${i}`} id={`${name}.${i}`}><Frame art={a} rows={rows} /></g>));
  const ref = (sprite: string, frame: number) => `#${sprite}.${frame}`;

  // Only the cells the camera can see.
  const x0 = Math.max(0, Math.floor(s.camera.x / CELL)), x1 = Math.min(map.w - 1, Math.floor((s.camera.x + view.w - 1) / CELL));
  const y0 = Math.max(0, Math.floor(s.camera.y / CELL)), y1 = Math.min(map.h - 1, Math.floor((s.camera.y + view.h - 1) / CELL));
  const tiles: React.ReactNode[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const name = battle.tiles[battle.map[y]?.[x] ?? ''];
    const a = name ? art[name] : null;
    if (!a) continue;
    const i = Math.floor(T * a.fps) % a.frames.length;
    tiles.push(<use key={`${x},${y}`} href={ref(name, i)} x={x * CELL} y={y * CELL} />);
  }

  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div style={{position: 'relative', width: view.w * scale, height: view.h * scale}}>
        <svg width={view.w * scale} height={view.h * scale} viewBox={`${s.camera.x} ${s.camera.y} ${view.w} ${view.h}`} shapeRendering="crispEdges" style={{display: 'block'}}>
          <defs>{defs}</defs>
          <rect x={s.camera.x} y={s.camera.y} width={view.w} height={view.h} fill={ground} />
          {tiles}
          {s.props.map((p, i) => <Placed key={`p${i}`} href={ref(p.sprite, p.frame)} x={p.x} y={p.y} w={art[p.sprite].width} flip={p.flip} />)}
          {s.units.map((u) => <Placed key={u.id} href={ref(u.sprite, u.frame)} x={u.x} y={u.y} w={u.w} flip={u.flip} />)}
          {s.fx.map((e, i) => <use key={`f${i}`} href={ref(e.sprite, e.frame)} x={e.x} y={e.y} />)}
        </svg>
        {s.labels.map((l, i) => {
          // A name tag centered over its person or place, in screen pixels (clipped to the picture).
          const lx = (l.x - s.camera.x) * scale, ly = (l.y - s.camera.y) * scale - scale * 2;
          if (lx < 0 || lx > view.w * scale || ly < 0 || ly > view.h * scale) return null;
          return <div key={`l${i}`} style={{position: 'absolute', left: lx, top: ly, transform: 'translate(-50%, -100%)', whiteSpace: 'nowrap',
            background: 'rgba(29,43,83,0.92)', color: '#fff1e8', border: `${scale / 3}px solid #ffec27`, padding: `${scale * 0.6}px ${scale * 1.6}px`,
            fontFamily: theme.sans, fontSize: scale * 3, fontWeight: 600}}>{l.text}</div>;
        })}
        {s.say && (
          <div style={{position: 'absolute', left: view.w * scale * 0.06, right: view.w * scale * 0.06, bottom: view.h * scale * 0.04,
            background: 'rgba(29,43,83,0.92)', border: `${scale / 2}px solid #fff1e8`, color: '#fff1e8', padding: `${scale * 1.2}px ${scale * 2.5}px`,
            fontFamily: theme.sans, fontSize: scale * 3.4, fontWeight: 600, lineHeight: 1.25, opacity: 1}}>
            {s.say.who && <div style={{color: '#ffec27', fontSize: scale * 2.8, marginBottom: scale * 0.5}}>{s.say.who}</div>}
            {s.say.text}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

const Placed: React.FC<{href: string; x: number; y: number; w: number; flip: boolean}> = ({href, x, y, w, flip}) =>
  flip ? <use href={href} transform={`translate(${x + w},${y}) scale(-1,1)`} /> : <use href={href} x={x} y={y} />;

/** The scene inside a lesson (`type: battle`). */
export const BattleScene: React.FC<SceneProps<BattleScene>> = ({scene}) => {
  const f = useCurrentFrame();
  if (!scene.battle || !scene.arts) {
    return <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', fontSize: 40, color: '#888'}}>No battle file for “{String((scene as any).name ?? '')}” yet</AbsoluteFill>;
  }
  const {fps} = useVideoConfig();
  const [from, to] = scene.clip ?? [0, battleSeconds(scene.battle)];
  const time = Math.min(to, from + f / fps);
  return <AbsoluteFill style={{opacity: ramp(f, 0, 8)}}><BattleView battle={scene.battle} arts={scene.arts} palette={scene.palette} time={time} /></AbsoluteFill>;
};

/** The battle on its own, full 1920 × 1080 (npm run battle -- <name>). */
export type BattleClipProps = {battle: Battle; arts: ArtMap; palette?: 'pico' | 'own'};
export const BattleClip: React.FC<BattleClipProps> = (p) => (
  <StageContext.Provider value={{w: 1920, h: 1080}}>
    <AbsoluteFill style={{background: '#000'}}><BattleView {...p} /></AbsoluteFill>
  </StageContext.Provider>
);
export const battleClipFrames = (p: BattleClipProps, fps: number) => Math.max(1, Math.ceil(battleSeconds(p.battle) * fps));
