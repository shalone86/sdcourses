import {icons} from 'lucide-react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {theme} from './theme';

// photo: a picture in video/public (e.g. covers/mounir.jpg) shown in the circle instead of an icon.
// tint: background, accent, ring colors (per category); watermark: the icon again, large and faint.
export type CoverProps = {title: string; eyebrow?: string; icon?: string; photo?: string;
  tint?: {bg?: string; accent?: string; ring?: string; card?: string}; watermark?: boolean};

/** Lucide icon by its kebab-case name ("key-round"), or a book if unknown. */
const iconFor = (name?: string) => {
  const pascal = (name ?? '').replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());
  return (icons as Record<string, React.FC<any>>)[pascal] ?? icons.BookOpen;
};

/** Course cover (Ghost tag image, 1200×675): an icon for the course's main idea, and its title. */
export const Cover: React.FC<CoverProps> = ({title, eyebrow = 'Free Catholic Course', icon, photo, tint, watermark}) => {
  const Icon = iconFor(icon);
  const size = 340;
  const bg = tint?.bg ?? theme.bg;
  const accent = tint?.accent ?? theme.accent;
  const ring = tint?.ring ?? theme.gold;
  const card = tint?.card ?? theme.card;
  return (
    <AbsoluteFill style={{background: bg, color: theme.ink, flexDirection: 'row', alignItems: 'center', padding: '0 90px', gap: 70, overflow: 'hidden'}}>
      {watermark && !photo && (
        <div style={{position: 'absolute', right: -90, bottom: -110, opacity: 0.08}}><Icon size={620} color={accent} strokeWidth={1.2} /></div>
      )}
      <div style={{position: 'relative', width: size, height: size, flexShrink: 0}}>
        <div style={{position: 'absolute', inset: 0, borderRadius: '50%', background: card, boxShadow: `0 0 0 4px ${ring}`}} />
        {photo ? (
          <Img src={staticFile(photo)} style={{position: 'absolute', inset: 12, width: size - 24, height: size - 24, borderRadius: '50%', objectFit: 'cover'}} />
        ) : (
          <>
            <div style={{position: 'absolute', inset: 26, borderRadius: '50%', boxShadow: `inset 0 0 0 1.5px ${theme.rule}`}} />
            <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <Icon size={170} color={accent} strokeWidth={1.4} absoluteStrokeWidth={false} />
            </div>
          </>
        )}
      </div>
      <div style={{minWidth: 0}}>
        <div style={{fontFamily: theme.sans, fontSize: 24, letterSpacing: 6, color: accent, fontWeight: 600}}>{eyebrow.toUpperCase()}</div>
        <div style={{fontFamily: theme.serif, fontSize: title.length > 28 ? 72 : 92, lineHeight: 1.05, marginTop: 18}}>{title}</div>
        <svg width={360} height={30} style={{marginTop: 26, display: 'block'}}>
          <line x1={0} y1={15} x2={360} y2={15} stroke={ring} strokeWidth={3} />
          <circle cx={180} cy={15} r={7} fill={bg} stroke={ring} strokeWidth={3} />
        </svg>
      </div>
    </AbsoluteFill>
  );
};
