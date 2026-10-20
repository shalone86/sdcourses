import {Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {enter, ramp} from '../anim';
import {useStage, type Stage} from '../layout';
import {theme} from '../theme';
import {Center} from './Center';
import type {SceneProps} from '.';

// src: the lesson's images/<file>.jpg (copied into video/public by prepare.mjs)
// aspect: width / height (saved at import), so the frame fits the picture.
// fit: contain (the whole picture, as big as it fits), cover (fills the picture area, cropping),
//      screen (fills the whole slide behind the heading; beside her video, the whole panel)
// focus: which part stays when it's cropped: top | center (default) | bottom
type ImageScene = {src: string; aspect?: number; caption?: string; credit?: string; fit?: 'contain' | 'cover' | 'screen'; focus?: 'top' | 'center' | 'bottom'};
const FOCUS = {top: 'center 15%', center: 'center 40%', bottom: 'center 85%'};

// As big as the room allows (the slide, or the panel beside her video): a tall picture beside
// her gets tall, and "fill" crops to that whole space.
const frameSize = (scene: ImageScene, stage: Stage) => {
  const maxW = Math.max(400, stage.w - 320);
  const maxH = Math.max(300, stage.h - (scene.caption ? 130 : 50));
  if (!scene.aspect || scene.fit === 'cover') return {width: maxW, height: maxH};
  return scene.aspect > maxW / maxH ? {width: maxW, height: Math.round(maxW / scene.aspect)} : {width: Math.round(maxH * scene.aspect), height: maxH};
};

/** A picture from the studio's image search: a slow push-in, a caption, and its credit. */
export const ImageView: React.FC<SceneProps<ImageScene>> = ({scene, duration}) => {
  const f = useCurrentFrame();
  const zoom = interpolate(f, [0, Math.max(1, duration)], [1, 1.06], {extrapolateRight: 'clamp'});
  const cover = scene.fit === 'cover' || scene.fit === 'screen';
  const stage = useStage();
  const position = FOCUS[scene.focus ?? 'center'] ?? FOCUS.center;
  if (scene.fit === 'screen') {
    // The whole slide: out to the video's edges, with a soft fade top and bottom so the heading,
    // course name and progress bar stay readable.
    const b = stage.bleed ?? {left: 0, top: 0, right: 0, bottom: 0};
    const boxW = stage.w + b.left + b.right, boxH = stage.h + b.top + b.bottom;
    const tall = (scene.aspect ?? 1.5) < (boxW / boxH) * 0.8;
    return (
      <div style={{position: 'absolute', left: -b.left, top: -b.top, right: -b.right, bottom: -b.bottom, overflow: 'hidden', opacity: ramp(f, 0, 12)}}>
        {tall ? (
          // A tall picture would lose most of itself to a wide crop: show all of it, full height,
          // over a soft blurred copy of itself that fills the rest of the screen.
          <>
            <Img src={staticFile(scene.src)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(36px) saturate(1.1) brightness(1.05)', transform: 'scale(1.2)'}} />
            <Img src={staticFile(scene.src)} style={{position: 'absolute', left: 0, right: 0, top: b.top ? 150 : 0, bottom: 0, width: '100%', height: b.top ? 'calc(100% - 150px)' : '100%',
              objectFit: 'contain', objectPosition: 'center bottom', transform: `scale(${zoom})`, transformOrigin: 'center bottom'}} />
          </>
        ) : (
          <Img src={staticFile(scene.src)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: position, transform: `scale(${zoom})`}} />
        )}
        <div style={{position: 'absolute', inset: 0, background: `linear-gradient(to bottom, ${theme.bg}EE 0, ${theme.bg}00 ${b.top ? 26 : 0}%, ${theme.bg}00 78%, ${theme.bg}DD 100%)`}} />
        {scene.credit && (
          <div style={{position: 'absolute', right: 24 + b.right, bottom: b.bottom + 12, maxWidth: '60%', padding: '4px 10px', borderRadius: 6, background: 'rgba(30,39,64,0.62)',
            color: '#F5F0E6', fontFamily: theme.sans, fontSize: 18, lineHeight: 1.3, textAlign: 'right'}}>{scene.credit}</div>
        )}
        {scene.caption && (
          <div style={{...enter(f, 14), position: 'absolute', left: 0, right: 0, bottom: b.bottom + 56, textAlign: 'center'}}>
            <span style={{fontFamily: theme.serif, fontStyle: 'italic', fontSize: 44, color: theme.ink, background: theme.bg + 'E6', padding: '6px 22px', borderRadius: 14}}>{scene.caption}</span>
          </div>
        )}
      </div>
    );
  }
  return (
    <Center style={{flexDirection: 'column', gap: 22}}>
      <div style={{position: 'relative', ...frameSize(scene, stage), borderRadius: 18, overflow: 'hidden',
        background: theme.card, boxShadow: `0 0 0 1px ${theme.rule}`, opacity: ramp(f, 0, 12)}}>
        <Img src={staticFile(scene.src)} style={{width: '100%', height: '100%', objectFit: cover ? 'cover' : 'contain', objectPosition: position, transform: `scale(${zoom})`}} />
        {scene.credit && (
          <div style={{position: 'absolute', right: 12, bottom: 10, maxWidth: '80%', padding: '4px 10px', borderRadius: 6, background: 'rgba(30,39,64,0.62)',
            color: '#F5F0E6', fontFamily: theme.sans, fontSize: 18, lineHeight: 1.3, textAlign: 'right'}}>{scene.credit}</div>
        )}
      </div>
      {scene.caption && (
        <div style={{...enter(f, 14), fontFamily: theme.serif, fontStyle: 'italic', fontSize: 44, color: theme.muted, textAlign: 'center', maxWidth: stage.w - 320}}>{scene.caption}</div>
      )}
    </Center>
  );
};
