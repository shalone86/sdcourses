import {createContext, useContext} from 'react';

// How her camera clip shows on the current slide (see Camera.tsx), for scenes that care:
// the host card drops her photo when she's on screen herself.
export type Layout = 'off' | 'bubble' | 'card' | 'side' | 'lower' | 'only';
export const LayoutContext = createContext<Layout>('off');
export const useLayout = () => useContext(LayoutContext);

// The room a scene has, in its own pixels (the whole slide area, or the panel beside her video
// before it's shrunk), so pictures and pixel art can be as big as the space allows.
export type Stage = {w: number; h: number};
export const StageContext = createContext<Stage>({w: 1920, h: 720});
export const useStage = () => useContext(StageContext);
