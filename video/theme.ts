import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

// Fonts ship with the project (SIL OFL, see public/fonts) so renders never
// depend on the network.
loadFont({family: 'EB Garamond', url: staticFile('fonts/EBGaramond.woff2'), weight: '400 600'});
loadFont({family: 'EB Garamond', url: staticFile('fonts/EBGaramond-Italic.woff2'), style: 'italic', weight: '400'});
loadFont({family: 'Inter', url: staticFile('fonts/Inter.woff2'), weight: '400 600'});

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
};

export const FPS = 30;
// Frames a point spends on its heading before the scenes begin.
export const HEADING_FRAMES = 66;
