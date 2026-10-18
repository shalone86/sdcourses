import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

// Fonts ship with the project (SIL OFL, see public/fonts) so renders never
// depend on the network.
loadFont({family: 'EB Garamond', url: staticFile('fonts/EBGaramond.woff2'), weight: '400 600'});
loadFont({family: 'EB Garamond', url: staticFile('fonts/EBGaramond-Italic.woff2'), style: 'italic', weight: '400'});
loadFont({family: 'Inter', url: staticFile('fonts/Inter.woff2'), weight: '400 600'});
loadFont({family: 'Fredoka', url: staticFile('fonts/Fredoka.woff2'), weight: '300 700'});

// Flat colors on purpose: large uniform areas compress to tiny files.
export const theme = {
  bg: '#F5F0E6',
  card: '#FBF8F2',
  ink: '#1E2740',
  muted: '#6B6A6A',
  rule: '#D9CFBC',
  accent: '#7A1F2B',
  gold: '#A9842F',
  serif: '"EB Garamond", Georgia, serif',
  sans: 'Inter, Helvetica, Arial, sans-serif',
  kids: false,
  // Bright colors that take turns (kids style); the classic look uses its own two.
  palette: ['#7A1F2B', '#A9842F'],
};

export const CLASSIC = {...theme};

/** Kids style (`style: kids` in course.yml): bright, rounded, colorful. */
export const KIDS: typeof theme = {
  bg: '#FFF6E0',
  card: '#FFFFFF',
  ink: '#2B2350',
  muted: '#7B5CFF',
  rule: '#FFD36B',
  accent: '#FF4F6D',
  gold: '#FFB300',
  serif: 'Fredoka, "Arial Rounded MT Bold", Helvetica, sans-serif',
  sans: 'Fredoka, "Arial Rounded MT Bold", Helvetica, sans-serif',
  kids: true,
  palette: ['#FF4F6D', '#18B7A6', '#FFB300', '#7B5CFF', '#2F8CFF', '#FF8A3D'],
};

/**
 * Every scene reads `theme`, so the lesson swaps its values before drawing
 * (one style per video, set from its props).
 */
export const useStyle = (style?: string) => Object.assign(theme, style === 'kids' ? KIDS : CLASSIC);

export const FPS = 30;
// Frames a point spends on its heading before the scenes begin.
export const HEADING_FRAMES = 66;
