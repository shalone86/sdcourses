import {createContext, useContext} from 'react';

// How her camera clip shows on the current slide (see Camera.tsx), for scenes that care:
// the host card drops her photo when she's on screen herself.
export type Layout = 'off' | 'bubble' | 'card' | 'side' | 'lower' | 'only';
export const LayoutContext = createContext<Layout>('off');
export const useLayout = () => useContext(LayoutContext);
