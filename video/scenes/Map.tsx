import {geoMercator, geoPath} from 'd3-geo';
import {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {feature} from 'topojson-client';
import land50 from 'world-atlas/land-50m.json';
import {draw, enter, pop, ramp} from '../anim';
import {theme} from '../theme';
import {Center} from './Center';
import type {SceneProps} from '.';

// Coastlines: Natural Earth 1:50m (public domain), via world-atlas.
const LAND = feature(land50 as any, (land50 as any).objects.land) as any;

/** Places used in lessons ([longitude, latitude]); a scene can also give its own `at`. */
const GAZETTEER: Record<string, [number, number]> = {
  Jerusalem: [35.23, 31.78], Antioch: [36.16, 36.2], Alexandria: [29.92, 31.2], Rome: [12.5, 41.9],
  Constantinople: [28.98, 41.01], Byzantium: [28.98, 41.01], Kyiv: [30.52, 50.45], Athens: [23.73, 37.98],
  Corinth: [22.93, 37.94], Ephesus: [27.34, 37.94], Thessalonica: [22.94, 40.64], Damascus: [36.29, 33.51],
  Caesarea: [34.9, 32.5], Tarsus: [34.9, 36.92], Uzhhorod: [22.29, 48.62], Pittsburgh: [-79.99, 40.44],
};

/** Regions as [[west, south], [east, north]]. */
const REGIONS: Record<string, [[number, number], [number, number]]> = {
  mediterranean: [[-2, 27], [44, 47]],
  east: [[10, 28], [42, 53]],
  holyland: [[28, 29], [40, 38.5]],
};

type Place = string | {name: string; at?: [number, number]; label?: 'left' | 'right' | 'above' | 'below'};
type MapScene = {
  region?: keyof typeof REGIONS; bounds?: [[number, number], [number, number]];
  places: Place[]; routes?: [string, string][]; highlight?: string; caption?: string;
  cues?: Record<string, number>; // frames (from `cues:` phrases in lesson.yml) when each place appears
};

// Water: a soft blue-grey, so land (the cream card color) reads as land.
const SEA = '#DCE3E3';
const W = 1500;
const H = 660;

/** A map: coastlines, cities appearing (on cue, or one by one), routes drawn between them. */
export const MapView: React.FC<SceneProps<MapScene>> = ({scene, duration}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const [[w, s], [e, n]] = scene.bounds ?? REGIONS[scene.region ?? 'mediterranean'];
  const {pathD, project} = useMemo(() => {
    // Fit to the region's corners (a Polygon here would wind the wrong way and mean "the whole world").
    const box = {type: 'MultiPoint', coordinates: [[w, s], [e, s], [e, n], [w, n]]} as any;
    const projection = geoMercator().fitExtent([[0, 0], [W, H]], box);
    return {pathD: geoPath(projection)(LAND) ?? '', project: (p: [number, number]) => projection(p) ?? [0, 0]};
  }, [w, s, e, n]);

  const places = scene.places.map((p) => (typeof p === 'string' ? {name: p} : p)).map((p) => {
    const at = p.at ?? GAZETTEER[p.name];
    if (!at) throw new Error(`Map: unknown place "${p.name}"; give it an at: [longitude, latitude]`);
    return {...p, at, xy: project(at)};
  });
  // When each place appears: its cue, else spread over the first half of the scene.
  const step = Math.max(12, Math.min(40, (duration * 0.5) / Math.max(1, places.length)));
  const appear = (name: string, i: number) => scene.cues?.[name] ?? 14 + i * step;
  const byName = Object.fromEntries(places.map((p, i) => [p.name, {...p, t: appear(p.name, i)}]));

  return (
    <Center>
      <div style={{position: 'relative', width: W, height: H}}>
        <svg width={W} height={H} style={{position: 'absolute', inset: 0, borderRadius: 18, overflow: 'hidden', background: SEA, opacity: ramp(f, 0, 12)}}>
          <path d={pathD} fill={theme.card} stroke={theme.rule} strokeWidth={1.5} />
          {(scene.routes ?? []).map(([a, b], i) => {
            const A = byName[a];
            const B = byName[b];
            if (!A || !B) return null;
            const [x1, y1] = A.xy;
            const [x2, y2] = B.xy;
            // A gentle arc, bowed to one side.
            const mx = (x1 + x2) / 2 - (y2 - y1) * 0.18;
            const my = (y1 + y2) / 2 + (x2 - x1) * 0.18;
            const start = Math.max(A.t, B.t) - 6;
            return (
              <path key={i} d={`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`} fill="none" stroke={theme.gold} strokeWidth={5}
                strokeLinecap="round" strokeDasharray="1 0" pathLength={1} style={draw(ramp(f, start, start + 30))} />
            );
          })}
          {places.map((p) => {
            const t = byName[p.name].t;
            const hi = scene.highlight === p.name;
            const pulse = hi ? 1 + 0.25 * Math.sin(((f - t) / fps) * Math.PI * 1.2) : 1;
            return (
              <g key={p.name} transform={`translate(${p.xy[0]} ${p.xy[1]})`}>
                {hi && <circle r={30 * pulse} fill="none" stroke={theme.accent} strokeWidth={3} opacity={0.5 * ramp(f, t, t + 10)} />}
                <circle r={13 * pop(f, t, fps)} fill={hi ? theme.accent : theme.ink} stroke={theme.card} strokeWidth={4} />
              </g>
            );
          })}
        </svg>
        {places.map((p) => {
          const t = byName[p.name].t;
          const side = p.label ?? 'right';
          const [x, y] = p.xy;
          const pos: React.CSSProperties =
            side === 'left' ? {right: W - x + 24, top: y - 26, textAlign: 'right'}
            : side === 'above' ? {left: x - 200, width: 400, top: y - 76, textAlign: 'center'}
            : side === 'below' ? {left: x - 200, width: 400, top: y + 22, textAlign: 'center'}
            : {left: x + 24, top: y - 26};
          return (
            <div key={p.name} style={{position: 'absolute', ...pos, ...enter(f, t + 4, 10), fontFamily: theme.serif, fontSize: 44, lineHeight: 1,
              color: scene.highlight === p.name ? theme.accent : theme.ink, whiteSpace: 'nowrap', textShadow: `0 0 8px ${theme.card}, 0 0 4px ${theme.card}`}}>
              {p.name}
            </div>
          );
        })}
        {scene.caption && (
          <div style={{...enter(f, Math.max(...Object.values(byName).map((p) => p.t)) + 20), position: 'absolute', left: 0, right: 0, bottom: -64,
            textAlign: 'center', fontFamily: theme.serif, fontStyle: 'italic', fontSize: 40, color: theme.muted}}>
            {scene.caption}
          </div>
        )}
      </div>
    </Center>
  );
};
