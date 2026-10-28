import {AbsoluteFill, Img, staticFile} from 'remotion';
import {bounds, Frame, type Art} from './scenes/Sprite';
import './theme'; // loads the fonts

// Thumbnail for kids.sdcason.com in the look of her kids thumbnails there: turquoise, soft
// blobs, chunky pale-yellow capitals with a shadow ("WHAT IS" small, the rest big), and one of
// her pixel drawings. 1280×720.
// Everything stays inside the SAFE zone (x 175–1105): the kids site's home page crops
// thumbnails to about 4:3 from the middle (160px off each side), which cut the text off.
export type KidsThumbProps = {lead?: string; title: string; art?: Art | null; shapes?: ShapeFile[]; fit?: 'frame' | 'bleed'; strip?: boolean} // fit is kept for old props; every full-canvas drawing is framed now;

const SAFE_W = 930; // text width inside the 4:3 crop (x 175–1105)
const INK = '#FFE58A', SHADOW = '#B8862B';
// Decorations: her own shapes (thumb-shapes/*.png|svg), one in each corner so they never touch the
// title or the drawing. Which shape goes where is random but fixed by the title. Files named
// corner-<tl|tr|bl|br>-… are pieces that sit flush in a corner (flipped to fit any corner); the rest
// are free blobs placed partly off the corner, turned and flipped at random.
export type ShapeFile = {src: string; w: number; h: number; corner?: 'tl' | 'tr' | 'bl' | 'br'};
const seeded = (text: string) => {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822519) + 0x6d2b79f5 | 0; h ^= h >>> 13; return ((h >>> 0) % 100000) / 100000; };
};
const CORNERS = [{x: 125, y: 45, id: 'tl'}, {x: 1130, y: 60, id: 'tr'}, {x: 120, y: 650, id: 'bl'}, {x: 1160, y: 650, id: 'br'}] as const;
const Shapes: React.FC<{title: string; files: ShapeFile[]}> = ({title, files}) => {
  const rnd = seeded(title);
  const pool = [...files].sort(() => rnd() - 0.5);
  return (
    <>
      {CORNERS.map((c, i) => {
        const f = pool[i % Math.max(pool.length, 1)];
        if (!f) return null;
        if (f.corner) {
          const k = Math.min(215 / f.w, 250 / f.h) * (0.85 + rnd() * 0.15), w = f.w * k, h = f.h * k;
          const flipX = f.corner[1] !== c.id[1] ? -1 : 1, flipY = f.corner[0] !== c.id[0] ? -1 : 1;
          return <Img key={i} src={staticFile(f.src)} style={{position: 'absolute', width: w, height: h, [c.id[0] === 't' ? 'top' : 'bottom']: 0, [c.id[1] === 'l' ? 'left' : 'right']: 0, transform: `scale(${flipX}, ${flipY})`}} />;
        }
        const k = (150 + rnd() * 80) / Math.max(f.w, f.h), w = f.w * k, h = f.h * k;
        const cx = c.x + (rnd() - 0.5) * 40, cy = c.y + (rnd() - 0.5) * 30;
        return <Img key={i} src={staticFile(f.src)} style={{position: 'absolute', width: w, height: h, left: cx - w / 2, top: cy - h / 2,
          transform: `rotate(${Math.round(rnd() * 360)}deg) scaleX(${rnd() < 0.5 ? -1 : 1})`}} />;
      })}
    </>
  );
};

export const KidsThumb: React.FC<KidsThumbProps> = ({lead, title, art, shapes = [], strip}) => {
  const b = art ? bounds(art) : null;
  // A drawing that fills its canvas (a scene, like a church) touches the edges and would look
  // cut off: it goes in a white-bordered card instead, like a framed picture (unless it is mostly see-through).
  const edges = b && art && art.kind !== 'sketch' ? [b.x === 0, b.y === 0, b.x + b.w === art.width, b.y + b.h === art.height].filter(Boolean).length : 0;
  // A character that touches its canvas edges (a small 8×8 person) is mostly see-through: no card for it.
  const empty = art && art.kind !== 'sketch' ? (art.frames[0] as string[]).join('').split('.').length - 1 : 0;
  const total = art && art.kind !== 'sketch' ? (art.frames[0] as string[]).join('').length : 1;
  const framed = !!art && edges >= 3 && empty / total < 0.4;
  // strip: every frame side by side, left to right (like a comic strip), within the safe width.
  const stripPx = strip && b ? Math.floor(Math.min(SAFE_W / (art!.frames.length * b.w + (art!.frames.length - 1) * 2), 300 / b.h)) : 0;
  // The drawing is big and centered; the title sits over its lower part, centered, as big as fits in
  // the safe width on one or two lines (Fredoka caps ≈ 0.62em per letter, a space ≈ 0.3em).
  const px = framed && art ? Math.floor(Math.min(560 / art.width, 520 / art.height)) : b ? Math.floor(Math.min(640 / b.w, 560 / b.h)) : 0;
  const wrap = (size: number) => {
    const w = (t: string) => t.length * 0.62 * size;
    const lines: string[] = [];
    for (const word of title.split(/\s+/)) {
      const last = lines[lines.length - 1];
      if (last !== undefined && w(last + ' ' + word) <= SAFE_W) lines[lines.length - 1] = last + ' ' + word; else lines.push(word);
    }
    return lines;
  };
  let big = 125, lines = wrap(big);
  while (big > 60 && (lines.length > 2 || Math.max(...lines.map((l) => l.length)) * 0.62 * big > SAFE_W)) { big -= 4; lines = wrap(big); }
  // A narrow drawing (a person) goes to the left so the small "WHAT DOES" line beside the title stays readable.
  const narrow = !framed && !!b && b.w * px < 520;
  const text = (size: number): React.CSSProperties => ({fontFamily: 'Fredoka, sans-serif', fontWeight: 700, fontSize: size, lineHeight: 0.98, color: INK,
    letterSpacing: 2, textTransform: 'uppercase', textShadow: `0 ${size * 0.06}px 0 ${SHADOW}, 0 ${size * 0.09}px ${size * 0.08}px rgba(0,0,0,0.18)`});
  return (
    <AbsoluteFill style={{background: '#6CEBDE', overflow: 'hidden'}}>
      <Shapes title={title} files={shapes} />
      {art?.kind === 'sketch' && (
        <Img src={staticFile(art.frames[0] as string)} style={{position: 'absolute', left: 640 - 380, width: 760, top: 15, height: 640, objectFit: 'contain', objectPosition: 'center top'}} />
      )}
      {strip && art && b && art.kind !== 'sketch' && (
        <div style={{position: 'absolute', left: 640 - SAFE_W / 2, width: SAFE_W, top: 40, display: 'flex', justifyContent: 'center', gap: stripPx * 2}}>
          {(art.frames as string[][]).map((rows, i) => (
            <svg key={i} width={b.w * stripPx} height={b.h * stripPx} viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} shapeRendering="crispEdges">
              <Frame art={art} rows={rows} />
            </svg>
          ))}
        </div>
      )}
      {!strip && art?.kind !== 'sketch' && framed && art && (
        <div style={{position: 'absolute', left: 640 - (art.width * px + 28) / 2, top: 30, padding: 14, background: '#FFFFFF', borderRadius: 30,
          transform: 'rotate(4deg)', boxShadow: `0 16px 0 ${SHADOW}55, 0 22px 40px rgba(0,0,0,0.18)`}}>
          <svg width={art.width * px} height={art.height * px} viewBox={`0 0 ${art.width} ${art.height}`} shapeRendering="crispEdges" style={{display: 'block', borderRadius: 18}}>
            <Frame art={art} rows={art.frames[0] as string[]} />
          </svg>
        </div>
      )}
      {!strip && art?.kind !== 'sketch' && !framed && art && b && (
        <svg width={b.w * px} height={b.h * px} viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} shapeRendering="crispEdges"
          style={{position: 'absolute', left: narrow ? 215 : 640 - (b.w * px) / 2, top: 20}}>
          <Frame art={art} rows={art.frames[0] as string[]} />
        </svg>
      )}
      <div style={{position: 'absolute', left: 175, bottom: 30, width: SAFE_W, display: 'flex', justifyContent: 'center'}}>
        {/* The block is as wide as the longest title line: the small lead lines up with that line's
            right edge (or is centered over it), and shorter lines are centered under it. */}
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 6}}>
          {lead && <div style={{...text(Math.round(big * 0.4)), alignSelf: narrow ? 'flex-end' : 'center', whiteSpace: 'nowrap'}}>{lead}</div>}
          {lines.map((l) => <div key={l} style={{...text(big), whiteSpace: 'nowrap'}}>{l}</div>)}
        </div>
      </div>
    </AbsoluteFill>
  );
};
