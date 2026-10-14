/** Filled check badge (drawn, so it never depends on a font having ✓). */
export const Check: React.FC<{size: number; color: string; bg: string; style?: React.CSSProperties}> = ({size, color, bg, style}) => (
  <svg width={size} height={size} viewBox="0 0 64 64" style={style}>
    <circle cx={32} cy={32} r={32} fill={bg} />
    <path d="M19 33 L28 42 L46 23" fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
