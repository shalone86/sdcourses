import {Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {enter, ramp} from '../anim';
import {theme} from '../theme';
import {Center} from './Center';
import type {SceneProps} from '.';

// src: the lesson's images/<file>.jpg (copied into video/public by prepare.mjs)
// aspect: width / height (saved at import), so the frame fits the picture.
type ImageScene = {src: string; aspect?: number; caption?: string; credit?: string; fit?: 'contain' | 'cover'};

const frameSize = (scene: ImageScene) => {
  const maxW = 1500;
  const maxH = scene.caption ? 600 : 660;
  if (!scene.aspect || scene.fit === 'cover') return {width: maxW, height: maxH};
  return scene.aspect > maxW / maxH ? {width: maxW, height: Math.round(maxW / scene.aspect)} : {width: Math.round(maxH * scene.aspect), height: maxH};
};

/** A picture from the studio's image search: a slow push-in, a caption, and its credit. */
export const ImageView: React.FC<SceneProps<ImageScene>> = ({scene, duration}) => {
  const f = useCurrentFrame();
  const zoom = interpolate(f, [0, Math.max(1, duration)], [1, 1.06], {extrapolateRight: 'clamp'});
  const cover = scene.fit === 'cover';
  return (
    <Center style={{flexDirection: 'column', gap: 22}}>
      <div style={{position: 'relative', ...frameSize(scene), borderRadius: 18, overflow: 'hidden',
        background: theme.card, boxShadow: `0 0 0 1px ${theme.rule}`, opacity: ramp(f, 0, 12)}}>
        <Img src={staticFile(scene.src)} style={{width: '100%', height: '100%', objectFit: cover ? 'cover' : 'contain', transform: `scale(${zoom})`}} />
        {scene.credit && (
          <div style={{position: 'absolute', right: 12, bottom: 10, maxWidth: '80%', padding: '4px 10px', borderRadius: 6, background: 'rgba(30,39,64,0.62)',
            color: '#F5F0E6', fontFamily: theme.sans, fontSize: 18, lineHeight: 1.3, textAlign: 'right'}}>{scene.credit}</div>
        )}
      </div>
      {scene.caption && (
        <div style={{...enter(f, 14), fontFamily: theme.serif, fontStyle: 'italic', fontSize: 44, color: theme.muted, textAlign: 'center', maxWidth: 1500}}>{scene.caption}</div>
      )}
    </Center>
  );
};
