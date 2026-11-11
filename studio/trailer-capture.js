// Records a PICO-8 game's screen for a trailer GIF: its 128 × 128 canvas, 30 times a second,
// keeping only the last `seconds`. Used by the Pico Parish tab's "Record a trailer" (she plays)
// and by scripts/trailer.mjs (a bot plays in a hidden browser). The frames come out as one block
// of RGBA pixels that the server turns into a GIF (framesToGif in scripts/trailer.mjs).
'use strict';
window.TrailerRecorder = function (getCanvas, opts) {
  const seconds = (opts && opts.seconds) || 10, fps = (opts && opts.fps) || 30, size = 128;
  const max = seconds * fps, frames = [];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d', {willReadFrequently: true});
  let next = 0, on = true;
  function tick(t) {
    if (!on) return;
    requestAnimationFrame(tick);
    if (t < next) return;
    next = Math.max(next + 1000 / fps, t - 1000 / fps);
    const src = getCanvas();
    if (!src || !src.width) return;
    g.drawImage(src, 0, 0, size, size);
    frames.push(g.getImageData(0, 0, size, size).data);
    if (frames.length > max) frames.shift();
  }
  requestAnimationFrame(tick);
  return {
    fps, size,
    count: () => frames.length,
    clear: () => { frames.length = 0; },
    stop: () => { on = false; },
    /** All kept frames, one after another (size × size × 4 bytes each). */
    pixels() {
      const one = size * size * 4, out = new Uint8Array(frames.length * one);
      frames.forEach((d, i) => out.set(d, i * one));
      return out;
    },
  };
};
