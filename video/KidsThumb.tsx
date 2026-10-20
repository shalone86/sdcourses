import {AbsoluteFill} from 'remotion';
import {bounds, Frame, type Art} from './scenes/Sprite';
import './theme'; // loads the fonts

// Thumbnail for kids.sdcason.com in the look of her kids thumbnails there: turquoise, soft
// blobs, chunky pale-yellow capitals with a shadow ("WHAT IS" small, the rest big), and one of
// her pixel drawings. 1280×720.
export type KidsThumbProps = {lead?: string; title: string; art?: Art | null};

const INK = '#FFE58A', SHADOW = '#B8862B';
const Blob: React.FC<{x: number; y: number; w: number; color: string; turn?: number; ring?: boolean}> = ({x, y, w, color, turn = 0, ring}) => (
  <svg width={w} height={w} viewBox="0 0 100 100" style={{position: 'absolute', left: x, top: y, transform: `rotate(${turn}deg)`}}>
    <path d="M52 6c22 2 40 16 42 38 2 24-14 46-38 48C30 94 8 80 6 56 4 30 26 4 52 6z" fill={ring ? 'none' : color} stroke={ring ? color : 'none'} strokeWidth={ring ? 9 : 0} />
  </svg>
);

export const KidsThumb: React.FC<KidsThumbProps> = ({lead, title, art}) => {
  const b = art ? bounds(art) : null;
  const px = b ? Math.floor(Math.min(560 / b.w, 600 / b.h)) : 0;
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
      {art && b && (
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
