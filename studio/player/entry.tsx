// The lesson video, live in the studio page (Timing tab), using Remotion's Player.
// Built by studio/server.mjs into studio/player/player.js on start.
import {Player, type PlayerRef} from '@remotion/player';
import {createRef} from 'react';
import {createRoot} from 'react-dom/client';
import {Lesson} from '../../video/Lesson';
import {FPS} from '../../video/theme';
import type {LessonProps} from '../../video/types';

type Api = {
  setProps(p: LessonProps): void;
  seek(frame: number): void;
  play(): void;
  pause(): void;
  toggle(): void;
  playing(): boolean;
  frame(): number;
  onFrame(cb: (f: number) => void): void;
};

function mount(el: HTMLElement, initial: LessonProps): Api {
  const root = createRoot(el);
  const ref = createRef<PlayerRef>();
  let props = initial;
  const listeners: ((f: number) => void)[] = [];
  const draw = () => {
    const total = props.segments.reduce((n, s) => n + s.durationInFrames, 0);
    root.render(
      <Player ref={ref} component={Lesson as any} inputProps={props} durationInFrames={Math.max(1, total)} fps={FPS}
        compositionWidth={1920} compositionHeight={1080} style={{width: '100%', aspectRatio: '16 / 9', borderRadius: 10, overflow: 'hidden'}}
        controls={false} clickToPlay={false} acknowledgeRemotionLicense />,
    );
  };
  draw();
  const attach = () => {
    const p = ref.current;
    if (!p) { requestAnimationFrame(attach); return; }
    p.addEventListener('frameupdate', (e: any) => listeners.forEach((cb) => cb(e.detail.frame)));
  };
  attach();
  return {
    setProps(p) { props = p; draw(); },
    seek(f) { ref.current?.seekTo(Math.max(0, Math.round(f))); },
    play() { ref.current?.play(); },
    pause() { ref.current?.pause(); },
    toggle() { ref.current?.toggle(); },
    playing() { return !!ref.current?.isPlaying(); },
    frame() { return ref.current?.getCurrentFrame() ?? 0; },
    onFrame(cb) { listeners.push(cb); },
  };
}

(window as any).StudioPlayer = {mount};
