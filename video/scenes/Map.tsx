import {geoArea, geoBounds, geoCentroid, geoMercator, geoPath} from 'd3-geo';
import {useId, useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {feature} from 'topojson-client';
import countries50 from 'world-atlas/countries-50m.json';
import land50 from 'world-atlas/land-50m.json';
import {EMPIRES} from '../data/empires';
import AREAS from '../data/areas.json';
import {draw, enter, pop, ramp} from '../anim';
import {theme} from '../theme';
import {Center} from './Center';
import {useStage} from '../layout';
import type {SceneProps} from '.';

// Coastlines: Natural Earth 1:50m (public domain), via world-atlas.
const LAND = feature(land50 as any, (land50 as any).objects.land) as any;
const COUNTRIES = (feature(countries50 as any, (countries50 as any).objects.countries) as any).features as any[];

type Area = {key: string; label: string; kind: string; aliases?: string[]; members?: string[]; rings?: [number, number][][]; approx?: boolean};
const LIST = (AREAS as any).areas as Area[];
const COUNTRY_ALIASES = (AREAS as any).countryAliases as Record<string, string>;
const low = (x: string) => x.trim().toLowerCase();

// d3 wants clockwise rings for "inside"; hand-drawn ones go either way, so normalise (and close them).
const fixRing = (r: [number, number][]) => {
  const ring = ringArea(r) > 0 ? [...r].reverse() : [...r];
  const [a, b] = [ring[0], ring[ring.length - 1]];
  return a[0] === b[0] && a[1] === b[1] ? ring : [...ring, a];
};
const polygonsOf = (geometry: any): any[] => (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []);
const country = (name: string) => {
  const n = low(COUNTRY_ALIASES[Object.keys(COUNTRY_ALIASES).find((k) => low(k) === low(name)) ?? ''] ?? name);
  return COUNTRIES.find((x) => low(x.properties.name) === n);
};

/**
 * An area to highlight: a country (Natural Earth name, or a common one like "United States"),
 * a continent, a group of countries (EU, NATO…), or an empire (video/data/areas.json and
 * empires.ts; empires are approximate). Returns one shape and where its label goes.
 */
function areaShape(name: string): {feature: any; label: string; approx: boolean; labelAt?: [number, number]} {
  const empire = EMPIRES[name] ?? Object.values(EMPIRES).find((e) => low(e.label) === low(name));
  if (empire) return {feature: {type: 'Feature', geometry: {type: 'MultiPolygon', coordinates: empire.rings.map((r) => [fixRing(r)])}}, label: empire.label, approx: true};
  // (by key, label, the label without its date — "Mongol Empire" — or another name)
  // A name written like "ASEAN (Association of Southeast Asian Nations)" is tried as either part.
  const tries = [name, name.replace(/\s*\(.*\)\s*$/, ''), /\(([^)]+)\)/.exec(name)?.[1] ?? ''].filter(Boolean).map(low);
  const area = LIST.find((a) => [a.key, a.label, a.label.replace(/,.*$/, ''), a.label.replace(/ members$/, ''), ...(a.aliases ?? [])].some((x) => tries.includes(low(x))));
  if (area) {
    const polys: any[] = [];
    for (const m of area.members ?? []) {
      if (m.startsWith('@all-but:')) { const skip = new Set(m.slice(9).split('|')); for (const c of COUNTRIES) if (!skip.has(c.properties.name)) polys.push(...polygonsOf(c.geometry)); }
      else if (m.startsWith('@empire:')) polys.push(...EMPIRES[m.slice(8)].rings.map((r) => [fixRing(r)]));
      else { const c = country(m); if (c) polys.push(...polygonsOf(c.geometry)); }
    }
    for (const r of area.rings ?? []) polys.push([fixRing(r)]);
    // The label sits on the biggest piece (a group's middle is often open sea).
    // (skipping pieces that cross the 180° line, whose middle d3 puts somewhere odd)
    const wraps = (p: any) => { const [[w], [e]] = geoBounds({type: 'Polygon', coordinates: p} as any); return e < w; };
    const biggest = polys.filter((p) => !wraps(p)).reduce((best, p) => { const a = geoArea({type: 'Polygon', coordinates: p} as any); return a > best[0] ? [a, p] : best; }, [0, null as any])[1];
    return {feature: {type: 'Feature', geometry: {type: 'MultiPolygon', coordinates: polys}}, label: area.label, approx: !!area.approx,
      labelAt: biggest ? (geoCentroid({type: 'Polygon', coordinates: biggest} as any) as [number, number]) : undefined};
  }
  const c = country(name);
  if (!c) throw new Error(`Map: unknown area "${name}". Use a country, continent, group (EU, NATO…) or empire; the full list is in video/data/areas.json`);
  return {feature: c, label: c.properties.name, approx: false};
}
/** Shoelace area (sign tells the winding). */
const ringArea = (r: [number, number][]) => r.reduce((a, [x1, y1], i) => { const [x2, y2] = r[(i + 1) % r.length]; return a + (x1 * y2 - x2 * y1); }, 0) / 2;

/** Places used in lessons ([longitude, latitude]); a scene can also give its own `at`. */
const GAZETTEER: Record<string, [number, number]> = {
  Jerusalem: [35.23, 31.78], Antioch: [36.16, 36.2], Alexandria: [29.92, 31.2], Rome: [12.5, 41.9],
  Constantinople: [28.98, 41.01], Byzantium: [28.98, 41.01], Kyiv: [30.52, 50.45], Athens: [23.73, 37.98],
  Corinth: [22.93, 37.94], Ephesus: [27.34, 37.94], Thessalonica: [22.94, 40.64], Damascus: [36.29, 33.51],
  Caesarea: [34.9, 32.5], Tarsus: [34.9, 36.92], Uzhhorod: [22.29, 48.62], Pittsburgh: [-79.99, 40.44],
};

/** Regions as [[west, south], [east, north]]. */
const REGIONS: Record<string, [[number, number], [number, number]]> = {
  world: [[-170, -56], [190, 76]],
  africa: [[-20, -36], [55, 38]],
  asia: [[25, -11], [150, 62]],
  'middle-east': [[25, 12], [65, 42]],
  'south-asia': [[60, 5], [100, 38]],
  'east-asia': [[95, 15], [150, 55]],
  americas: [[-170, -56], [-30, 72]],
  'north-america': [[-170, 7], [-50, 72]],
  'south-america': [[-85, -56], [-33, 13]],
  oceania: [[110, -48], [180, 0]],
  mediterranean: [[-2, 27], [44, 47]],
  europe: [[-12, 30], [50, 62]],
  east: [[10, 28], [42, 53]],
  holyland: [[28, 29], [40, 38.5]],
};

/** A box around the highlighted areas and places, with a margin (the world if it wraps around). */
function fitBounds(scene: {areas?: string[]; places?: Place[]}): [[number, number], [number, number]] {
  // Small far-off pieces (French Guiana with France, islands) don't stretch the map: fit the pieces
  // that make up most of each area.
  const boxes = (scene.areas ?? []).flatMap((a) => {
    const polys = polygonsOf(areaShape(a).feature.geometry).map((p) => ({p, size: geoArea({type: 'Polygon', coordinates: p} as any)}));
    const total = polys.reduce((n, x) => n + x.size, 0);
    return polys.filter((x) => x.size >= total * 0.02).map((x) => {
      const [[w, s], [e, n]] = geoBounds({type: 'Polygon', coordinates: x.p} as any);
      // A piece that crosses the 180° line (Russia's far east): measure it past 180 instead.
      return [[w, s], [e < w ? e + 360 : e, n]] as [[number, number], [number, number]];
    });
  });
  for (const p of scene.places ?? []) { const at = typeof p === 'string' ? GAZETTEER[p] : p.at ?? GAZETTEER[p.name]; if (at) boxes.push([at, at]); }
  if (!boxes.length) return REGIONS.mediterranean;
  let w = Math.min(...boxes.map((b) => b[0][0])), s = Math.min(...boxes.map((b) => b[0][1]));
  let e = Math.max(...boxes.map((b) => b[1][0])), n = Math.max(...boxes.map((b) => b[1][1]));
  const mx = Math.max(4, (e - w) * 0.12), my = Math.max(3, (n - s) * 0.12);
  return [[Math.max(-180, w - mx), Math.max(-58, s - my)], [Math.min(190, e + mx), Math.min(78, n + my)]];
}

type Place = string | {name: string; at?: [number, number]; label?: 'left' | 'right' | 'above' | 'below'};
// areas: countries ("Ukraine") or empires ("byzantine-empire-555"); cues "area-0", "area-1", …
type MapScene = {
  // region: one of REGIONS, or 'auto' (fit the highlighted areas and places; the default when there are areas)
  region?: keyof typeof REGIONS | 'auto'; bounds?: [[number, number], [number, number]];
  places?: Place[]; areas?: string[]; routes?: [string, string][]; highlight?: string; caption?: string;
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
  const clipId = `land-${useId().replace(/:/g, '')}`;
  const [[w, s], [e, n]] = scene.bounds ?? (scene.region && scene.region !== 'auto' ? REGIONS[scene.region] ?? REGIONS.mediterranean
    : scene.areas?.length || scene.region === 'auto' ? fitBounds(scene) : REGIONS.mediterranean);
  const {pathD, project, areas} = useMemo(() => {
    // Fit to the region's corners (a Polygon here would wind the wrong way and mean "the whole world").
    const box = {type: 'MultiPoint', coordinates: [[w, s], [e, s], [e, n], [w, n]]} as any;
    // Centred on the middle of the box, so maps wider than half the world (or past 180°) work.
    const projection = geoMercator().rotate([-(w + e) / 2, 0]).fitExtent([[0, 0], [W, H]], box);
    const gp = geoPath(projection);
    const areas = (scene.areas ?? []).map((a) => {
      const shape = areaShape(a);
      return {...shape, d: gp(shape.feature) ?? '', at: projection(shape.labelAt ?? geoCentroid(shape.feature)) ?? [0, 0]};
    });
    return {pathD: gp(LAND) ?? '', project: (p: [number, number]) => projection(p) ?? [0, 0], areas};
  }, [w, s, e, n, JSON.stringify(scene.areas ?? [])]);

  const places = (scene.places ?? []).map((p) => (typeof p === 'string' ? {name: p} : p)).map((p) => {
    const at = p.at ?? GAZETTEER[p.name];
    if (!at) throw new Error(`Map: unknown place "${p.name}"; give it an at: [longitude, latitude]`);
    return {...p, at, xy: project(at)};
  });
  // When each place appears: its cue, else spread over the first half of the scene.
  const step = Math.max(12, Math.min(40, (duration * 0.5) / Math.max(1, places.length)));
  const appear = (name: string, i: number) => scene.cues?.[name] ?? 14 + i * step;
  const byName = Object.fromEntries(places.map((p, i) => [p.name, {...p, t: appear(p.name, i)}]));

  // Map and caption together fit the room the slide has (the caption used to hang below it,
  // onto the progress bar).
  const stage = useStage();
  const room = scene.caption ? 74 : 0;
  const k = Math.min(1, (stage.h - 20 - room) / H, (stage.w - 120) / W);
  return (
    <Center>
      <div style={{position: 'relative', width: W * k, height: H * k + room}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `scale(${k})`, transformOrigin: 'top left'}}>
        <svg width={W} height={H} style={{position: 'absolute', inset: 0, borderRadius: 18, overflow: 'hidden', background: (theme.kids ? '#9FDFF0' : SEA), opacity: ramp(f, 0, 12)}}>
          <defs><clipPath id={clipId}><path d={pathD} /></clipPath></defs>
          <path d={pathD} fill={theme.card} stroke={theme.rule} strokeWidth={1.5} />
          {/* Highlighted areas, clipped to the land so coasts stay crisp */}
          <g clipPath={`url(#${clipId})`}>
            {areas.map((a, i) => {
              const t = scene.cues?.[`area-${i}`] ?? 10 + i * 14;
              // Countries get their real outline; hand-drawn empires only a soft fill.
              return <path key={i} d={a.d} fill={theme.accent} fillOpacity={(a.approx ? 0.24 : 0.28) * ramp(f, t, t + 16)} stroke={a.approx ? 'none' : theme.accent} strokeOpacity={0.7 * ramp(f, t, t + 16)} strokeWidth={2.5} />;
            })}
          </g>
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
        {areas.map((a, i) => {
          const t = scene.cues?.[`area-${i}`] ?? 10 + i * 14;
          return (
            <div key={`a${i}`} style={{position: 'absolute', left: a.at[0] - 220, top: a.at[1] - 24, width: 440, textAlign: 'center', ...enter(f, t + 8, 8),
              fontFamily: a.approx ? theme.serif : theme.sans, fontSize: a.approx ? 40 : 30, letterSpacing: a.approx ? 0 : 3, fontWeight: 600, fontStyle: a.approx ? 'italic' : 'normal',
              color: theme.accent, textShadow: `0 0 8px ${theme.card}, 0 0 4px ${theme.card}`}}>
              {a.approx ? a.label : a.label.toUpperCase()}
            </div>
          );
        })}
        {areas.some((a) => a.approx) && (
          <div style={{position: 'absolute', right: 18, bottom: 12, fontFamily: theme.sans, fontSize: 20, color: theme.muted, opacity: ramp(f, 20, 34)}}>Borders approximate</div>
        )}
      </div>
        {scene.caption && (
          <div style={{...enter(f, Math.max(30, ...Object.values(byName).map((p) => p.t)) + 20), position: 'absolute', left: 0, right: 0, bottom: 0,
            textAlign: 'center', fontFamily: theme.serif, fontStyle: 'italic', fontSize: 40, color: theme.muted}}>
            {scene.caption}
          </div>
        )}
      </div>
    </Center>
  );
};
