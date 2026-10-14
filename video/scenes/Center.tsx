import {AbsoluteFill} from 'remotion';

export const Center: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', padding: '0 160px', ...style}}>{children}</AbsoluteFill>
);
