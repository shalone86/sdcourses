import {AbsoluteFill, Audio, Img, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Backdrop} from './Backdrop';
import {BeatContext, swell} from './beat';
import {type Art, bounds, Frame} from './scenes/Sprite';
import {KIDS, theme, useStyle} from './theme';

// A music video (the studio's Music videos tool, songs/<name>/song.yml): the song plays, each slide
// shows a line of the words from its start time, and her characters dance, each to the beat or to
// one part of the song (`parts`: when each part plays, in seconds; from the MIDI or guessed).
export type Cast = {sprite: string; x: number; y: number; size: number; flip?: boolean; to?: string; move?: 'hop' | 'sway' | 'grow' | 'still'};
export type Back = {color?: string; sprite?: string};
export type Slide = {at: number | null; words?: string; times?: number[]; back?: Back; cast?: Cast[]};
export type Song = {title: string; color?: string; shapes?: boolean; words?: 'top' | 'middle' | 'bottom'; slides: Slide[]};
export type SongProps = {song: Song; audio: string | null; duration: number; parts: Record<string, number[]>; arts: Record<string, Art>};

export const songFrames = (p: SongProps, fps: number) => Math.max(1, Math.ceil((p.duration || 10) * fps));

/** The slides that have a time, in order, each with the background and characters it shows (its own, or the slide before's). */
export function timedSlides(song: Song) {
  let back: Back | undefined, cast: Cast[] = [];
  const out: {i: number; at: number; words: string; times?: number[]; back?: Back; cast: Cast[]}[] = [];
  song.slides.forEach((s, i) => {
    if (s.back) back = s.back;
    if (s.cast) cast = s.cast;
    if (s.at != null) out.push({i, at: s.at, words: s.words ?? '', times: s.times, back, cast});
  });
  return out.sort((a, b) => a.at - b.at);
}

/** How many of these moments have passed, and how long ago the last one was (seconds). */
function hit(hits: number[] | undefined, t: number) {
  if (!hits?.length || t < hits[0]) return {n: 0, age: Infinity};
  let lo = 0, hi = hits.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (hits[m] <= t) lo = m; else hi = m - 1; }
  return {n: lo + 1, age: t - hits[lo]};
}

const Dancer: React.FC<{c: Cast; art: Art; hits?: number[]; t: number}> = ({c, art, hits, t}) => {
  const n = art.frames.length;
  const still = !c.to || c.to === 'none';
  const {n: count, age} = still ? {n: 0, age: Infinity} : hit(hits, t);
  // Dancing: the next drawing on every hit. Not dancing: at the drawing's own speed.
  const i = still ? Math.floor(t * (art.fps || 4)) % n : count % n;
  const move = c.move ?? 'hop';
  let dy = 0, rot = 0, grow = 1, squash = 1;
  if (!still && age < 2) {
    if (move === 'hop') { const k = age < 0.32 ? Math.sin((Math.PI * age) / 0.32) : 0; dy = -k * c.size * 0.14; squash = 1 + 0.06 * Math.exp(-age * 14); }
    else if (move === 'sway') { const side = count % 2 ? 1 : -1, k = Math.min(1, age / 0.18), e = k * k * (3 - 2 * k); rot = 7 * (side * e - side * (1 - e)); }
    else if (move === 'grow') grow = 1 + 0.14 * Math.exp(-age * 7);
  }
  const b = bounds(art);
  const h = c.size, w = (c.size * b.w) / b.h;
  const style: React.CSSProperties = {position: 'absolute', left: c.x - w / 2, top: c.y - h / 2, width: w, height: h, transformOrigin: '50% 100%',
    transform: `translateY(${dy.toFixed(1)}px) rotate(${rot.toFixed(2)}deg) scale(${(grow * (c.flip ? -1 : 1) * (2 - squash)).toFixed(3)}, ${(grow * squash).toFixed(3)})`};
  return art.kind === 'sketch'
    ? <Img src={staticFile(art.frames[i] as string)} style={style} />
    : <svg viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} shapeRendering="crispEdges" style={{...style, overflow: 'visible'}}><Frame art={art} rows={art.frames[i] as string[]} /></svg>;
};

const Backing: React.FC<{art: Art}> = ({art}) => {
  // Her drawing as the whole background: as big as fits, in the middle.
  const k = Math.min(1920 / art.width, 1080 / art.height);
  const style: React.CSSProperties = {position: 'absolute', left: (1920 - art.width * k) / 2, top: (1080 - art.height * k) / 2, width: art.width * k, height: art.height * k};
  return art.kind === 'sketch'
    ? <Img src={staticFile(art.frames[0] as string)} style={style} />
    : <svg viewBox={`0 0 ${art.width} ${art.height}`} shapeRendering="crispEdges" style={style}><Frame art={art} rows={art.frames[0] as string[]} /></svg>;
};

const Words: React.FC<{words: string; times?: number[]; t: number; since: number; place: string}> = ({words, times, t, since, place}) => {
  const {fps} = useVideoConfig();
  if (!words) return null;
  const pop = spring({frame: Math.max(0, since * fps), fps, config: {damping: 11, stiffness: 170}});
  const list = words.split(' ');
  const size = words.length > 60 ? 76 : words.length > 34 ? 96 : 120;
  const where: React.CSSProperties = place === 'top' ? {top: 70} : place === 'middle' ? {top: 0, bottom: 0} : {bottom: 80};
  return (
    <div style={{position: 'absolute', left: 150, right: 150, ...where, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{fontFamily: KIDS.sans, fontWeight: 700, fontSize: size, lineHeight: 1.12, textAlign: 'center', color: KIDS.ink,
        WebkitTextStroke: `${Math.round(size * 0.16)}px #FFFFFF`, paintOrder: 'stroke fill', transform: `scale(${(0.6 + 0.4 * pop).toFixed(3)})`, opacity: Math.min(1, since * 12)}}>
        {list.map((w, i) => {
          // Sing-along: a word lights up (and jumps a little) when it is sung.
          const sung = times ? t >= times[i] : false;
          const age = times ? t - times[i] : 0;
          return <span key={i} style={{display: 'inline-block', margin: '0 0.14em', color: sung ? KIDS.accent : KIDS.ink,
            transform: sung ? `translateY(${(-18 * Math.exp(-age * 9)).toFixed(1)}px)` : undefined}}>{w}</span>;
        })}
      </div>
    </div>
  );
};

export const MusicVideo: React.FC<SongProps> = ({song, audio, parts, arts}) => {
  useStyle('kids', 'dance');
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const slides = timedSlides(song);
  let cur = null as (typeof slides)[number] | null;
  for (const s of slides) if (s.at <= t + 1e-6) cur = s; else break;
  // Before the first line: the first slide's background and characters, no words yet.
  const shown = cur ?? (slides[0] ? {...slides[0], words: '', times: undefined} : null);
  const b = hit(parts.beat, t);
  const gap = parts.beat?.length > 1 ? parts.beat[1] - parts.beat[0] : 1;
  const bt = b.n ? b.n - 1 + Math.min(1, b.age / gap) : 0;
  const backArt = shown?.back?.sprite ? arts[shown.back.sprite] : null;
  return (
    <AbsoluteFill style={{backgroundColor: shown?.back?.color ?? song.color ?? theme.bg}}>
      {audio && <Audio src={staticFile(audio)} />}
      {backArt && <Backing art={backArt} />}
      <BeatContext.Provider value={{kids: true, dance: true, t: bt, pulse: b.n ? swell(bt) : 0}}>
        {song.shapes !== false && !backArt && <Backdrop />}
      </BeatContext.Provider>
      {(shown?.cast ?? []).map((c, i) => (arts[c.sprite] ? <Dancer key={i} c={c} art={arts[c.sprite]} hits={parts[c.to ?? 'beat']} t={t} /> : null))}
      {cur && <Words key={cur.i} words={cur.words} times={cur.times} t={t} since={t - cur.at} place={song.words ?? 'bottom'} />}
    </AbsoluteFill>
  );
};
