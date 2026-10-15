import {useCurrentFrame} from 'remotion';
import {draw, enter, ramp} from '../anim';
import {theme} from '../theme';
import {Center} from './Center';
import type {SceneProps} from '.';

type TrinityScene = {cues?: {son?: number; spirit?: number}};

const stroke = {fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round'} as const;

/**
 * The Sign of the Cross: triangle for the Father (top), cross for the Son
 * (right), dove for the Holy Spirit (left), each drawn as it is named.
 * `cues` (frames, from prepare.mjs) say when "the Son" and "the Holy Spirit" are spoken.
 */
export const Trinity: React.FC<SceneProps<TrinityScene>> = ({scene}) => {
  const f = useCurrentFrame();
  const son = scene.cues?.son ?? 30;
  const spirit = scene.cues?.spirit ?? 60;
  const pFather = ramp(f, 4, 34);
  const pSon = ramp(f, son, son + 30);
  const pSpirit = ramp(f, spirit, spirit + 30);
  const pLinks = ramp(f, spirit + 24, spirit + 54);
  const label = (x: number, y: number, at: number, text: string) => (
    <text x={x} y={y} textAnchor="middle" fontFamily={theme.serif} fontSize={46} fill={theme.ink} style={enter(f, at + 8, 12)}>{text}</text>
  );
  return (
    <Center>
      <svg width={1200} height={760} viewBox="0 0 1200 760">
        {/* Faint links between the three, once all are there */}
        <g {...stroke} stroke={theme.rule} strokeWidth={3}>
          <path pathLength={1} style={draw(pLinks)} d="M520 300 L330 470" />
          <path pathLength={1} style={draw(pLinks)} d="M680 300 L870 470" />
          <path pathLength={1} style={draw(pLinks)} d="M420 610 H840" />
        </g>
        {/* Father: triangle */}
        <path {...stroke} stroke={theme.gold} strokeWidth={10} pathLength={1} style={draw(pFather)} d="M600 60 L695 225 L505 225 Z" />
        {label(600, 290, 4, 'Father')}
        {/* Son: cross */}
        <g {...stroke} stroke={theme.accent} strokeWidth={12}>
          <path pathLength={1} style={draw(pSon)} d="M960 440 V680" />
          <path pathLength={1} style={draw(pSon)} d="M905 500 H1015" />
        </g>
        {label(960, 740, son, 'Son')}
        {/* Holy Spirit: dove, wings raised */}
        <g {...stroke} stroke={theme.ink} strokeWidth={7} transform="translate(240 600)">
          <path pathLength={1} style={draw(pSpirit)} d="M-110 0 L-92 -6 C-80 -22 -55 -20 -45 -5 C-20 20 40 25 80 10 L120 -10 L110 15 C70 40 -40 45 -80 15 Z" />
          <path pathLength={1} style={draw(pSpirit)} d="M-30 5 C-20 -60 10 -100 60 -120 C40 -70 40 -30 20 10" />
          <path pathLength={1} style={draw(pSpirit)} opacity={0.5} d="M0 8 C20 -40 50 -70 95 -80 C75 -45 65 -15 40 14" />
          <circle cx={-80} cy={-8} r={3.5} fill={theme.ink} stroke="none" opacity={pSpirit} />
        </g>
        {label(240, 740, spirit, 'Holy Spirit')}
      </svg>
    </Center>
  );
};
