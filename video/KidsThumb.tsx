import {AbsoluteFill} from 'remotion';
import {bounds, Frame, type Art} from './scenes/Sprite';
import './theme'; // loads the fonts

// Thumbnail for kids.sdcason.com in the look of her kids thumbnails there: turquoise, soft
// blobs, chunky pale-yellow capitals with a shadow ("WHAT IS" small, the rest big), and one of
// her pixel drawings. 1280×720.
// fit: frame (a white-bordered card) or bleed (off the top-right corner) for a drawing that fills its canvas.
export type KidsThumbProps = {lead?: string; title: string; art?: Art | null; fit?: 'frame' | 'bleed'};

const INK = '#FFE58A', SHADOW = '#B8862B';
const Blob: React.FC<{x: number; y: number; w: number; color: string; turn?: number; ring?: boolean}> = ({x, y, w, color, turn = 0, ring}) => (
  <svg width={w} height={w} viewBox="0 0 100 100" style={{position: 'absolute', left: x, top: y, transform: `rotate(${turn}deg)`}}>
    <path d="M52 6c22 2 40 16 42 38 2 24-14 46-38 48C30 94 8 80 6 56 4 30 26 4 52 6z" fill={ring ? 'none' : color} stroke={ring ? color : 'none'} strokeWidth={ring ? 9 : 0} />
  </svg>
);

export const KidsThumb: React.FC<KidsThumbProps> = ({lead, title, art, fit = 'frame'}) => {
  const b = art ? bounds(art) : null;
  // A drawing that fills its canvas (a scene, like a church) touches the edges and would look
  // cut off: it goes in a white-bordered card instead, like a framed picture.
  const edges = b && art ? [b.x === 0, b.y === 0, b.x + b.w === art.width, b.y + b.h === art.height].filter(Boolean).length : 0;
  const framed = !!art && edges >= 2;
  const px = framed && art ? Math.floor(Math.min(500 / art.width, 520 / art.height)) : b ? Math.floor(Math.min(560 / b.w, 600 / b.h)) : 0;
  const big = title.length > 22 ? 96 : title.length > 14 ? 112 : 150;
  const text = (size: number): React.CSSProperties => ({fontFamily: 'Fredoka, sans-serif', fontWeight: 700, fontSize: size, lineHeight: 0.98, color: INK,
    letterSpacing: 2, textTransform: 'uppercase', textShadow: `0 ${size * 0.06}px 0 ${SHADOW}, 0 ${size * 0.09}px ${size * 0.08}px rgba(0,0,0,0.18)`});
  return (
    <AbsoluteFill style={{background: '#6CEBDE', overflow: 'hidden'}}>
      <Blob x={40} y={30} w={170} color="#22B8B0" turn={20} />
      <Blob x={760} y={-30} w={150} color="#F7DF8C" turn={-30} />
      <Blob x={1080} y={500} w={190} color="#F4B6C2" turn={60} />
      <Blob x={1120} y={120} w={90} color="#22B8B0" turn={10} ring />
      <Blob x={520} y={560} w={120} color="#F7DF8C" turn={140} />
      {framed && art && fit === 'bleed' && (
        // Off the top-right corner: the drawing's cut edges are the thumbnail's own edges.
        <svg width={art.width * 19} height={art.height * 19} viewBox={`0 0 ${art.width} ${art.height}`} shapeRendering="crispEdges"
          style={{position: 'absolute', right: 0, top: 0}}>
          <Frame art={art} rows={art.frames[0]} />
        </svg>
      )}
      {framed && art && fit === 'frame' && (
        <div style={{position: 'absolute', right: 80, top: (720 - art.height * px - 28) / 2, padding: 14, background: '#FFFFFF', borderRadius: 30,
          transform: 'rotate(4deg)', boxShadow: `0 16px 0 ${SHADOW}55, 0 22px 40px rgba(0,0,0,0.18)`}}>
          <svg width={art.width * px} height={art.height * px} viewBox={`0 0 ${art.width} ${art.height}`} shapeRendering="crispEdges" style={{display: 'block', borderRadius: 18}}>
            <Frame art={art} rows={art.frames[0]} />
          </svg>
        </div>
      )}
      {!framed && art && b && (
        <svg width={b.w * px} height={b.h * px} viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} shapeRendering="crispEdges"
          style={{position: 'absolute', right: 70, top: (720 - b.h * px) / 2}}>
          <Frame art={art} rows={art.frames[0]} />
        </svg>
      )}
      <div style={{position: 'absolute', left: 70, top: 0, bottom: 0, width: art ? 760 : 1140, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10}}>
        {lead && <div style={text(64)}>{lead}</div>}
        <div style={text(big)}>{title}</div>
      </div>
    </AbsoluteFill>
  );
};
