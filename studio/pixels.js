// Pixel art tab: draw a small picture in 1 to 8 frames, watch it move, save it to
// sprites/<name>.json (scripts/sprites.mjs). On the Timing tab, "+ Add a picture
// here → Pixel animation" puts one in a lesson.
//
// Tools: pencil, dither (every other pixel), eraser, fill, line, box, circle,
// select (drag a box; drag inside it to move), pick a color. Copy/cut/paste work
// across drawings (the copy is kept in this browser). Flip the selection, the
// frame, or every frame.
'use strict';

// Export a drawing (both modes use it): one frame as a PNG, or every frame as an animated GIF
// (made by the studio with ffmpeg). Goes to the browser's Downloads.
window.ArtExport = {
  async save(name, canvases, fps, gif) {
    const base = (String(name || 'drawing').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'drawing');
    let blob;
    if (!gif) blob = await new Promise((ok) => canvases[0].toBlob(ok, 'image/png'));
    else {
      const r = await fetch('/api/sprite/gif', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Studio': '1'},
        body: JSON.stringify({fps, frames: canvases.map((c) => c.toDataURL('image/png'))})});
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'HTTP ' + r.status);
      blob = await r.blob();
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = base + (gif ? '.gif' : '.png');
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  },
};
window.PixelTab = (() => {
  const CODES = '0123456789abcdefghijklmnopqrstuvwxyz';
  const MAX_FRAMES = 8;
  // Small palettes on purpose (a handheld-game look); "Any color" is still there.
  const PALETTES = {
    video: {label: 'Video colors (11)', colors: ['#2B2350', '#FFFFFF', '#FF4F6D', '#FF8A3D', '#FFB300', '#18B7A6', '#2F8CFF', '#7B5CFF', '#F2C6A0', '#A86B3C', '#5A3825']},
    gbc: {label: 'Game Boy Color (16)', colors: ['#000000', '#FFFFFF', '#888888', '#F8E8C8', '#E0A070', '#A05030', '#503018', '#F83838',
      '#F878B8', '#F8A800', '#F8F858', '#38B838', '#186818', '#58A8F8', '#2038A8', '#A858F8']},
    gb: {label: 'Game Boy (4 greens)', colors: ['#0F380F', '#306230', '#8BAC0F', '#9BBC0F']},
    pico8: {label: 'PICO-8 (16)', colors: ['#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8',
      '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA']},
    all: {label: 'All colors (24)', colors: ['#FF4F6D', '#18B7A6', '#FFB300', '#7B5CFF', '#2F8CFF', '#FF8A3D',
      '#000000', '#2B2350', '#6A6488', '#C9C3D9', '#FFFFFF',
      '#FBE3CF', '#F2C6A0', '#D9A066', '#A86B3C', '#8D5524', '#5A3825', '#2E1B10',
      '#FFD36B', '#B8860B', '#7ED957', '#2E7D32', '#9FDFF0', '#7A1F2B']},
  };
  const store = {get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* fine */ } }};
  // Square sizes for characters; the wide one for a scene with several characters in it.
  const SIZES = [[8, 8], [16, 16], [24, 24], [32, 32], [48, 48], [64, 64], [64, 36]];
  const TOOLS = [['pen', 'Pencil'], ['dither', 'Dither'], ['erase', 'Eraser'], ['fill', 'Fill'],
    ['line', 'Line'], ['box', 'Box'], ['circle', 'Circle'], ['select', 'Select & move'], ['pick', 'Pick a color']];
  const SHAPES = ['line', 'box', 'circle'];
  const CLIP_KEY = 'studio.pixelClip';

  function h(tag, attrs, kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'text') e.textContent = v;
      else if (k === 'class') e.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of [].concat(kids || [])) if (c !== null && c !== undefined && c !== false) e.append(c);
    return e;
  }

  const blank = (w, hgt) => new Array(w * hgt).fill(null);
  const fresh = (w, hgt = w) => ({name: '', width: w, height: hgt, fps: 4, frames: [blank(w, hgt), blank(w, hgt)]});

  /** Saved form (palette + one character per pixel) → editing form (a color or null per pixel). */
  function fromSaved(s) {
    return {name: s.name, slug: s.slug, width: s.width, height: s.height, fps: s.fps,
      frames: s.frames.map((rows) => rows.join('').split('').map((c) => (c === '.' ? null : s.palette[CODES.indexOf(c)])))};
  }
  function toSaved(a) {
    const palette = [...new Set(a.frames.flat().filter(Boolean).map((c) => c.toUpperCase()))].slice(0, CODES.length);
    const code = (c) => (c ? CODES[palette.indexOf(c.toUpperCase())] : '.');
    return {name: a.name.trim(), width: a.width, height: a.height, fps: a.fps, palette,
      frames: a.frames.map((px) => Array.from({length: a.height}, (_, y) => px.slice(y * a.width, (y + 1) * a.width).map(code).join('')))};
  }

  // Squares on a line, a box outline or a filled box, an ellipse inside a box.
  function linePts(x0, y0, x1, y1) {
    const out = [];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) out.push([Math.round(x0 + ((x1 - x0) * k) / (n || 1)), Math.round(y0 + ((y1 - y0) * k) / (n || 1))]);
    return out;
  }
  function boxPts(x0, y0, x1, y1, filled) {
    const [l, r, t, b] = [Math.min(x0, x1), Math.max(x0, x1), Math.min(y0, y1), Math.max(y0, y1)];
    const out = [];
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) if (filled || x === l || x === r || y === t || y === b) out.push([x, y]);
    return out;
  }
  function circlePts(x0, y0, x1, y1, filled) {
    const [l, r, t, b] = [Math.min(x0, x1), Math.max(x0, x1), Math.min(y0, y1), Math.max(y0, y1)];
    const cx = (l + r) / 2, cy = (t + b) / 2, rx = (r - l) / 2 + 0.5, ry = (b - t) / 2 + 0.5;
    const inside = (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
    const out = [];
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
      if (!inside(x, y)) continue;
      // Outline: inside, with a neighbour outside.
      if (filled || !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) out.push([x, y]);
    }
    return out;
  }

  function open(root, api, post, reference = window.DrawReference) {
    const pal = PALETTES[store.get('studio.pixelPalette')] ? store.get('studio.pixelPalette') : 'video';
    const P = {list: [], art: fresh(16), frame: 0, tool: 'pen', color: PALETTES[pal].colors[0], pal, mirror: false, onion: true, filled: false, every: false, gal: {open: false, q: ''},
      undo: [], saved: '', timer: null,
      bases: {open: false, list: [], versions: {}, cast: [], pick: null, name: ''},
      poses: {open: false, from: '', pose: '', drafts: [], skip: new Set(), busy: false, timer: null},
      version: null, // coloring a new character from a base: {base, name}
      sel: null,    // selected box {x, y, w, h}
      float: null,  // lifted pixels being moved or pasted {x, y, w, h, layers: [{frame, px}]} (one layer per frame)
      shape: null}; // a shape being dragged: its preview squares
    const snap = () => JSON.stringify({name: P.art.name, fps: P.art.fps, frames: P.art.frames});
    P.saved = snap();
    const dirty = () => snap() !== P.saved || !!P.float;

    const canvas = h('canvas', {class: 'px-canvas', width: 512, height: 512, 'aria-label': 'Drawing grid', tabindex: '0'});
    const preview = h('canvas', {class: 'px-preview', width: 192, height: 192, 'aria-label': 'Animation preview'});
    const body = h('div', {class: 'px-side'});
    root.replaceChildren(h('div', {class: 'px-wrap'}, [h('div', {class: 'px-left'}, [canvas, reference.controls(() => drawCanvas()),
      h('div', {class: 'small muted', text: 'Click or drag to draw. ⌘Z undo · ⌘C copy · ⌘X cut · ⌘V paste · arrows move a selection · Delete clears it · Esc lets go.'})]), body]));

    const W = () => P.art.width, H = () => P.art.height;
    const px = () => P.art.frames[P.frame];
    const inBounds = (x, y) => x >= 0 && y >= 0 && x < W() && y < H();

    // ---------- drawing on screen ----------
    function paint(cv, pixels, w, hgt, size, {grid, onion, ref} = {}) {
      const g = cv.getContext('2d');
      const c = size / Math.max(w, hgt);
      g.clearRect(0, 0, cv.width, cv.height);
      // See-through shows as a soft checkerboard.
      for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) {
        g.fillStyle = (x + y) % 2 ? '#EEE9DF' : '#F8F5EE';
        g.fillRect(x * c, y * c, c, c);
      }
      if (ref) reference.draw(g, w * c, hgt * c);
      if (onion) {
        g.globalAlpha = 0.28;
        onion.forEach((col, i) => { if (col) { g.fillStyle = col; g.fillRect((i % w) * c, Math.floor(i / w) * c, c, c); } });
        g.globalAlpha = 1;
      }
      pixels.forEach((col, i) => { if (col) { g.fillStyle = col; g.fillRect((i % w) * c, Math.floor(i / w) * c, c, c); } });
      if (grid) {
        g.strokeStyle = 'rgba(43,35,80,0.12)';
        g.lineWidth = 1;
        for (let i = 0; i <= w; i++) { g.beginPath(); g.moveTo(i * c + 0.5, 0); g.lineTo(i * c + 0.5, hgt * c); g.stroke(); }
        for (let i = 0; i <= hgt; i++) { g.beginPath(); g.moveTo(0, i * c + 0.5); g.lineTo(w * c, i * c + 0.5); g.stroke(); }
        if (P.mirror) { g.strokeStyle = 'rgba(255,79,109,0.6)'; g.beginPath(); g.moveTo((w * c) / 2, 0); g.lineTo((w * c) / 2, hgt * c); g.stroke(); }
      }
      return {g, c};
    }
    function drawCanvas() {
      const a = P.art;
      // Onion skin: the frame before (on the first frame, the last one, since it loops).
      const prev = P.onion && a.frames.length > 1 ? a.frames[(P.frame + a.frames.length - 1) % a.frames.length] : null;
      const {g, c} = paint(canvas, px(), a.width, a.height, canvas.width, {grid: true, onion: prev, ref: true});
      const layer = P.float && P.float.layers.find((l) => l.frame === P.frame);
      if (layer) {
        const f = P.float;
        for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
          const col = layer.px[y * f.w + x];
          if (col && inBounds(f.x + x, f.y + y)) { g.fillStyle = col; g.fillRect((f.x + x) * c, (f.y + y) * c, c, c); }
        }
      }
      if (P.shape) {
        g.fillStyle = P.color;
        for (const [x, y] of P.shape) if (inBounds(x, y)) g.fillRect(x * c, y * c, c, c);
      }
      const box = P.float || P.sel;
      if (box) {
        g.save();
        g.lineWidth = 2;
        g.setLineDash([6, 4]);
        g.strokeStyle = '#2B2350';
        g.strokeRect(box.x * c + 1, box.y * c + 1, box.w * c - 2, box.h * c - 2);
        g.strokeStyle = '#FFFFFF';
        g.lineDashOffset = 5;
        g.strokeRect(box.x * c + 1, box.y * c + 1, box.w * c - 2, box.h * c - 2);
        g.restore();
        // The resize handle in the bottom-right corner.
        const hs = Math.max(8, c * 0.55);
        g.fillStyle = '#FFFFFF'; g.strokeStyle = '#2B2350'; g.lineWidth = 2;
        g.fillRect((box.x + box.w) * c - hs, (box.y + box.h) * c - hs, hs, hs);
        g.strokeRect((box.x + box.w) * c - hs + 1, (box.y + box.h) * c - hs + 1, hs - 2, hs - 2);
      }
      body.querySelectorAll('canvas[data-thumb]').forEach((t) => paint(t, a.frames[+t.dataset.thumb], a.width, a.height, t.width));
    }
    function startPreview() {
      clearInterval(P.timer);
      let i = 0;
      const tick = () => { if (!preview.isConnected) return clearInterval(P.timer); const a = P.art; paint(preview, a.frames[i % a.frames.length], a.width, a.height, preview.width); i++; };
      tick();
      P.timer = setInterval(tick, 1000 / P.art.fps);
    }

    // ---------- changing pixels ----------
    function at(e, clamp) {
      const r = canvas.getBoundingClientRect();
      const c = (canvas.width / Math.max(W(), H())) * (r.width / canvas.width);
      let x = Math.floor((e.clientX - r.left) / c), y = Math.floor((e.clientY - r.top) / c);
      if (clamp) { x = Math.max(0, Math.min(W() - 1, x)); y = Math.max(0, Math.min(H() - 1, y)); }
      return inBounds(x, y) ? {x, y} : null;
    }
    function set(x, y, col) {
      if (!inBounds(x, y)) return;
      if (P.tool === 'dither' && (x + y) % 2) return;
      // (with "in every frame" on, every frame gets the same squares)
      for (const i of targets()) {
        const p = P.art.frames[i];
        p[y * W() + x] = col;
        if (P.mirror) { const mx = W() - 1 - x; if (P.tool !== 'dither' || (mx + y) % 2 === 0) p[y * W() + mx] = col; }
      }
    }
    function fill(x, y, col) { for (const i of targets()) fillFrame(P.art.frames[i], x, y, col); }
    function fillFrame(p, x, y, col) {
      const w = W(), hgt = H();
      const target = p[y * w + x];
      if (target === col) return;
      const stack = [[x, y]];
      while (stack.length) {
        const [cx, cy] = stack.pop();
        if (cx < 0 || cy < 0 || cx >= w || cy >= hgt || p[cy * w + cx] !== target) continue;
        p[cy * w + cx] = col;
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
    }
    const remember = () => { P.undo.push(JSON.stringify(P.art.frames)); if (P.undo.length > 80) P.undo.shift(); };
    function undo() {
      if (P.float) { P.float = null; P.sel = null; }
      const u = P.undo.pop();
      if (u) { P.art.frames = JSON.parse(u); P.frame = Math.min(P.frame, P.art.frames.length - 1); }
      draw();
    }

    // ---------- selection, copy and paste ----------
    // Which frames an action works on: every frame (the switch), or the one showing.
    const targets = () => (P.every ? P.art.frames.map((_, i) => i) : [P.frame]);

    /** Pick up the selected pixels so they can move (the spot they leave is see-through). */
    function lift() {
      if (P.float || !P.sel) return;
      remember();
      const s = P.sel;
      const layers = targets().map((frame) => {
        const p = P.art.frames[frame], out = [];
        for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const i = (s.y + y) * W() + s.x + x; out.push(p[i]); p[i] = null; }
        return {frame, px: out};
      });
      P.float = {...s, layers};
    }
    /** Put the lifted pixels down where they are now (adding frames if a pasted animation has more). */
    function commit() {
      const f = P.float;
      if (!f) return;
      for (const l of f.layers) {
        if (l.frame >= MAX_FRAMES) continue;
        while (P.art.frames.length <= l.frame) P.art.frames.push(blank(W(), H()));
        const p = P.art.frames[l.frame];
        for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
          const col = l.px[y * f.w + x];
          if (col && inBounds(f.x + x, f.y + y)) p[(f.y + y) * W() + f.x + x] = col;
        }
      }
      P.sel = {x: Math.max(0, f.x), y: Math.max(0, f.y), w: Math.min(W(), f.x + f.w) - Math.max(0, f.x), h: Math.min(H(), f.y + f.h) - Math.max(0, f.y)};
      if (P.sel.w < 1 || P.sel.h < 1) P.sel = null;
      P.float = null;
    }
    function letGo() { commit(); P.sel = null; }
    /** This frame (or all of them) enlarged with sharp pixels, about 512 across, to a PNG or GIF. */
    async function exportArt(gif) {
      letGo(); draw();
      const a = P.art, k = Math.max(1, Math.floor(512 / Math.max(a.width, a.height)));
      const cv = (pixels) => {
        const c = document.createElement('canvas'); c.width = a.width * k; c.height = a.height * k;
        const g = c.getContext('2d');
        pixels.forEach((col, i) => { if (col) { g.fillStyle = col; g.fillRect((i % a.width) * k, Math.floor(i / a.width) * k, k, k); } });
        return c;
      };
      try { await window.ArtExport.save(a.name, gif ? a.frames.map(cv) : [cv(a.frames[P.frame])], a.fps, gif); }
      catch (e) { alert('Couldn’t export it: ' + e.message); }
    }
    /** The selection (or the whole picture) from this frame, or from all of them: {x, y, w, h, frames: [px, …]}. */
    function grab(all) {
      const f = P.float;
      if (f) {
        const here = f.layers.find((l) => l.frame === P.frame) || f.layers[0];
        return {x: f.x, y: f.y, w: f.w, h: f.h, frames: all ? f.layers.map((l) => [...l.px]) : [[...here.px]]};
      }
      const s = P.sel || {x: 0, y: 0, w: W(), h: H()};
      const which = all ? P.art.frames.map((_, i) => i) : [P.frame];
      return {x: s.x, y: s.y, w: s.w, h: s.h, frames: which.map((frame) => {
        const out = [];
        for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) out.push(P.art.frames[frame][(s.y + y) * W() + s.x + x]);
        return out;
      })};
    }
    function copy(all) {
      const c = grab(all);
      store.set(CLIP_KEY, JSON.stringify(c));
      P.clip = c;
      note(c.frames.length > 1 ? `Copied ${c.w} × ${c.h}, all ${c.frames.length} frames. Paste puts them in this frame and the ones after it.`
        : `Copied ${c.w} × ${c.h} from frame ${P.frame + 1}. Click another frame (or drawing) and Paste.`);
    }
    function cut() {
      copy(P.every);
      if (P.float) { P.float = null; P.sel = null; }
      else { remember(); clearArea(); }
      draw(); markDirty();
    }
    /**
     * Paste into the frame showing, in the spot it was copied from (or the selected spot).
     * A copy of all frames fills this frame and the ones after it; `everywhere` repeats one frame in every frame.
     */
    function paste(everywhere) {
      let c = P.clip;
      try { c = JSON.parse(store.get(CLIP_KEY)) || c; } catch { /* use the one in memory */ }
      if (!c) { note('Nothing copied yet: select something (or nothing, for the whole picture) and press Copy.'); return; }
      const frames = c.frames || [c.px];
      commit();
      remember();
      const layers = everywhere ? P.art.frames.map((_, frame) => ({frame, px: [...frames[0]]}))
        : frames.map((px, i) => ({frame: P.frame + i, px: [...px]})).filter((l) => l.frame < MAX_FRAMES);
      const x = P.sel ? P.sel.x : Math.min(c.x ?? 0, Math.max(0, W() - c.w)), y = P.sel ? P.sel.y : Math.min(c.y ?? 0, Math.max(0, H() - c.h));
      P.float = {x, y, w: c.w, h: c.h, layers};
      P.sel = null;
      P.tool = 'select';
      draw(); markDirty();
      note(layers.length > 1 ? `Pasted into ${everywhere ? 'every frame' : `frames ${layers[0].frame + 1}–${layers[layers.length - 1].frame + 1}`}. Drag it into place; it moves in all of them.`
        : `Pasted into frame ${P.frame + 1}. Drag it into place, or drag the corner square to make it bigger or smaller.`);
    }

    // ---------- bigger and smaller ----------
    /** Resize what's lifted to w×h (blocky, from how it was when lifted, so shrinking and growing again loses nothing). */
    function scaleTo(w, hgt) {
      lift();
      const f = P.float;
      if (!f.src) f.src = {w: f.w, h: f.h, layers: f.layers.map((l) => [...l.px])};
      w = Math.max(1, Math.min(64, Math.round(w))); hgt = Math.max(1, Math.min(64, Math.round(hgt)));
      f.layers.forEach((l, i) => {
        const src = f.src.layers[i], out = new Array(w * hgt);
        for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) out[y * w + x] = src[Math.floor((y * f.src.h) / hgt) * f.src.w + Math.floor((x * f.src.w) / w)];
        l.px = out;
      });
      f.w = w; f.h = hgt;
    }
    function scaleBy(k) {
      if (!P.sel && !P.float) { note('Select something first (Select & move), then make it bigger or smaller.'); return; }
      lift();
      scaleTo(P.float.w * k, P.float.h * k);
      drawCanvas(); markDirty();
    }

    function clearArea() {
      const s = P.sel;
      for (const frame of targets()) {
        const p = P.art.frames[frame];
        if (!s) { p.fill(null); continue; }
        for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) p[(s.y + y) * W() + s.x + x] = null;
      }
    }
    function nudge(dx, dy) {
      if (!P.sel && !P.float) return;
      lift();
      P.float.x += dx; P.float.y += dy;
      drawCanvas(); markDirty();
    }

    // ---------- uploading pictures (e.g. from Procreate) ----------
    /**
     * Each picture becomes a frame, from the frame showing on (up to 8): shrunk to fit the grid,
     * each square matched to the nearest color in the chosen palette; see-through stays see-through.
     */
    async function upload(files) {
      const list = [...files].filter((f) => f.type.startsWith('image/'));
      if (!list.length) return;
      letGo();
      remember();
      const colors = PALETTES[P.pal].colors.map((c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), c]);
      const nearest = (r, g, b) => colors.reduce((best, c) => { const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2; return d < best[0] ? [d, c[3]] : best; }, [Infinity, null])[1];
      const w = W(), hgt = H();
      for (const [k, file] of list.slice(0, MAX_FRAMES - P.frame).entries()) {
        const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = URL.createObjectURL(file); });
        const c = document.createElement('canvas'); c.width = w; c.height = hgt;
        const g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        const s = Math.min(w / img.width, hgt / img.height);
        g.drawImage(img, (w - img.width * s) / 2, (hgt - img.height * s) / 2, img.width * s, img.height * s);
        const d = g.getImageData(0, 0, w, hgt).data;
        const out = [];
        for (let i = 0; i < w * hgt; i++) out.push(d[i * 4 + 3] < 128 ? null : nearest(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]));
        const at = P.frame + k;
        while (P.art.frames.length <= at) P.art.frames.push(blank(w, hgt));
        P.art.frames[at] = out;
      }
      draw(); markDirty();
      note(`Uploaded ${Math.min(list.length, MAX_FRAMES - P.frame)} picture${list.length > 1 ? 's' : ''} as frames, in the ${PALETTES[P.pal].label} colors.`);
    }

    // ---------- flips ----------
    function flipped(pixels, w, hgt, dir) {
      const out = new Array(pixels.length);
      for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) {
        const [sx, sy] = dir === 'h' ? [w - 1 - x, y] : [x, hgt - 1 - y];
        out[y * w + x] = pixels[sy * w + sx];
      }
      return out;
    }
    function flip(dir) {
      if (P.sel || P.float) {
        lift();
        for (const l of P.float.layers) l.px = flipped(l.px, P.float.w, P.float.h, dir);
      } else {
        remember();
        for (const i of targets()) P.art.frames[i] = flipped(P.art.frames[i], W(), H(), dir);
      }
      draw(); markDirty();
    }

    // ---------- pointer ----------
    canvas.addEventListener('pointerdown', (e) => {
      const c = at(e);
      if (!c) return;
      e.preventDefault();
      canvas.focus();
      try { canvas.setPointerCapture(e.pointerId); } catch { /* fine */ }
      const listen = (move, up) => {
        const end = (ev) => { canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', end); up(ev); };
        canvas.addEventListener('pointermove', move);
        canvas.addEventListener('pointerup', end);
      };
      if (P.tool === 'pick') { const layer = P.float && inside(P.float, c) && P.float.layers.find((l) => l.frame === P.frame);
        const col = (layer && layer.px[(c.y - P.float.y) * P.float.w + c.x - P.float.x]) || px()[c.y * W() + c.x]; if (col) { P.color = col; P.tool = 'pen'; draw(); } return; }

      if (P.tool === 'select') {
        const box = P.float || P.sel;
        // The corner square: drag to make it bigger or smaller (Shift: keep its shape).
        if (box && c.x === box.x + box.w - 1 && c.y === box.y + box.h - 1 && (box.w > 1 || box.h > 1) && nearCorner(e, box)) {
          lift();
          const f = P.float, x0 = f.x, y0 = f.y, ratio = f.h / f.w;
          listen((ev) => {
            const d = at(ev, true);
            if (!d) return;
            let w = d.x - x0 + 1, hgt = d.y - y0 + 1;
            if (ev.shiftKey) hgt = Math.round(w * ratio);
            scaleTo(w, hgt); drawCanvas();
          }, () => { draw(); markDirty(); });
          return;
        }
        if (box && inside(box, c)) {
          // Drag the selection.
          lift();
          const start = {x: c.x - P.float.x, y: c.y - P.float.y};
          listen((ev) => { const d = at(ev, true); if (d) { P.float.x = d.x - start.x; P.float.y = d.y - start.y; drawCanvas(); } }, () => markDirty());
          return;
        }
        // A new selection box.
        commit();
        const a0 = c;
        P.sel = {x: c.x, y: c.y, w: 1, h: 1};
        drawCanvas();
        let moved = false;
        listen((ev) => {
          const d = at(ev, true);
          if (!d) return;
          moved = moved || d.x !== a0.x || d.y !== a0.y;
          P.sel = {x: Math.min(a0.x, d.x), y: Math.min(a0.y, d.y), w: Math.abs(d.x - a0.x) + 1, h: Math.abs(d.y - a0.y) + 1};
          drawCanvas();
        }, () => { if (!moved) P.sel = null; draw(); });
        return;
      }

      // Any drawing tool puts down what was being moved.
      if (P.float || P.sel) { letGo(); }
      remember();
      if (P.tool === 'fill') { fill(c.x, c.y, P.color); draw(); markDirty(); return; }
      if (SHAPES.includes(P.tool)) {
        const make = (d) => P.tool === 'line' ? linePts(c.x, c.y, d.x, d.y) : P.tool === 'box' ? boxPts(c.x, c.y, d.x, d.y, P.filled) : circlePts(c.x, c.y, d.x, d.y, P.filled);
        P.shape = make(c);
        drawCanvas();
        listen((ev) => { const d = at(ev, true); if (d) { P.shape = make(d); drawCanvas(); } }, () => {
          for (const [x, y] of P.shape) set(x, y, P.color);
          P.shape = null; draw(); markDirty();
        });
        return;
      }
      const col = P.tool === 'erase' ? null : P.color;
      set(c.x, c.y, col); drawCanvas();
      // Fill in every square between two pointer positions, so a quick stroke has no gaps.
      let last = c;
      listen((ev) => {
        const d = at(ev);
        if (!d) return;
        for (const [x, y] of linePts(last.x, last.y, d.x, d.y)) set(x, y, col);
        last = d;
        drawCanvas();
      }, () => { draw(); markDirty(); });
    });
    const inside = (b, c) => c.x >= b.x && c.y >= b.y && c.x < b.x + b.w && c.y < b.y + b.h;
    /** Pointer in the bottom-right half of the corner square (where the handle is drawn). */
    function nearCorner(e, b) {
      const r = canvas.getBoundingClientRect();
      const c = (canvas.width / Math.max(W(), H())) * (r.width / canvas.width);
      const fx = (e.clientX - r.left) / c - (b.x + b.w - 1), fy = (e.clientY - r.top) / c - (b.y + b.h - 1);
      return fx >= 0.35 && fy >= 0.35;
    }

    const onKey = (e) => {
      if (!root.isConnected) return document.removeEventListener('keydown', onKey);
      // (typing in a box or using a list or slider keeps its keys; a checkbox or button doesn't)
      const f = document.activeElement;
      if (/TEXTAREA|SELECT/.test(f?.tagName) || (f?.tagName === 'INPUT' && /text|search|number|range/.test(f.type))) return;
      const cmd = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (cmd && k === 'z') { e.preventDefault(); undo(); }
      else if (cmd && k === 'c') { e.preventDefault(); copy(false); }
      else if (cmd && k === 'x') { e.preventDefault(); cut(); }
      else if (cmd && k === 'v') { e.preventDefault(); paste(false); }
      else if (cmd && k === 'a') { e.preventDefault(); commit(); P.sel = {x: 0, y: 0, w: W(), h: H()}; P.tool = 'select'; draw(); }
      else if ((k === 'delete' || k === 'backspace') && (P.sel || P.float)) { e.preventDefault(); if (P.float) P.float = null; else { remember(); clearArea(); } P.sel = null; draw(); markDirty(); }
      // Hotkeys: B pencil, E eraser, F fill, S cycles the shapes, C next color, X (or Shift+C) the color
      // before, I picks a color, M selects; . and , go to the next and previous frame.
      else if (!cmd && !e.altKey && (k === '.' || k === ',' || k === '>' || k === '<')) {
        e.preventDefault(); letGo();
        const n = P.art.frames.length;
        P.frame = (P.frame + (k === '.' || k === '>' ? 1 : n - 1)) % n;
        draw();
      }
      else if (!cmd && !e.altKey && ['b', 'e', 'f', 's', 'c', 'x', 'i', 'm'].includes(k)) {
        e.preventDefault();
        const next = (list) => list[(list.indexOf(P.tool) + 1) % list.length];
        if (k === 'c' || k === 'x') {
          const cols = PALETTES[P.pal].colors, at = cols.findIndex((x) => x.toUpperCase() === P.color.toUpperCase());
          P.color = cols[((at < 0 ? -1 : at) + (e.shiftKey || k === 'x' ? cols.length - 1 : 1)) % cols.length];
          if (['erase', 'pick', 'select'].includes(P.tool)) P.tool = 'pen';
        } else {
          const t = {b: 'pen', e: 'erase', f: 'fill', i: 'pick', m: 'select'}[k] ?? next(SHAPES);
          if (t !== 'select') letGo();
          P.tool = t;
        }
        draw();
      }
      else if (k === 'escape' || k === 'enter') { letGo(); draw(); markDirty(); }
      else if (k.startsWith('arrow') && (P.sel || P.float)) {
        e.preventDefault();
        nudge(k === 'arrowleft' ? -1 : k === 'arrowright' ? 1 : 0, k === 'arrowup' ? -1 : k === 'arrowdown' ? 1 : 0);
      }
    };
    document.addEventListener('keydown', onKey);

    function markDirty() {
      const b = body.querySelector('[data-save]');
      if (b) { b.disabled = !dirty(); b.textContent = dirty() ? (P.version ? 'Save and make all 5 poses' : 'Save') : 'Saved'; }
    }
    function note(text) { const n = body.querySelector('[data-note]'); if (n) n.textContent = text; }

    // ---------- the side panel ----------
    function draw() {
      const a = P.art;
      const btn = (text, onclick, attrs = {}) => h('button', {class: 'btn', text, onclick, ...attrs});
      const openSaved = async (s, copy) => {
        if (dirty() && !(await ask('Leave this drawing without saving?'))) return;
        // The copied pixels stay, so they can be pasted into the drawing opened now.
        P.art = fromSaved(s); P.frame = 0; P.undo = []; P.sel = null; P.float = null; P.saved = snap();
        // "Start from a copy": every frame of that one, as a new unsaved drawing.
        if (copy) { delete P.art.slug; P.art.name = s.name + ' copy'; P.saved = ''; }
        const v = !copy && /-idle$/.test(s.slug) && s.slug.slice(0, -5);
        P.version = v && P.bases.versions[v] && !P.bases.versions[v].isBase ? {base: P.bases.versions[v].base, name: v} : null;
        P.gal.open = false;
        draw();
      };
      const startNew = async () => {
        if (dirty() && !(await ask('Leave this drawing without saving?'))) return;
        P.art = fresh(16); P.frame = 0; P.undo = []; P.sel = null; P.float = null; P.saved = snap(); P.version = null; draw();
      };
      const pick = window.SpriteGallery.build({items: P.list, state: P.gal, current: a.slug, noun: 'drawing', onNew: startNew, onToggle: draw, onOpen: openSaved,
        onFavorite: async (slug, on) => {
          try { const d = await post('/api/sprite/favorite', {slug, on}); P.list = d.sprites.filter((x) => x.kind !== 'sketch'); draw(); } catch (e) { alert('Couldn’t change the favorite: ' + e.message); }
        }});
      const size = h('select', {'aria-label': 'Size', disabled: !!a.slug || a.frames.some((f) => f.some(Boolean)), onchange: (e) => {
        const [w, hgt] = e.target.value.split('x').map(Number); P.art = {...fresh(w, hgt), name: a.name, fps: a.fps}; P.frame = 0; draw();
      }}, SIZES.map(([w, hgt]) => h('option', {value: `${w}x${hgt}`, text: `${w} × ${hgt}${w !== hgt ? ' (wide scene)' : ''}`, selected: a.width === w && a.height === hgt})));
      const paletteSel = h('select', {'aria-label': 'Colors', onchange: (e) => { P.pal = e.target.value; store.set('studio.pixelPalette', P.pal); draw(); }},
        Object.entries(PALETTES).map(([k, v]) => h('option', {value: k, text: v.label, selected: k === P.pal})));
      const remove = async () => {
        if (!(await ask(`Delete "${a.name}"? It's kept in sprites/.deleted, so Claude can bring it back.`))) return;
        try {
          const d = await post('/api/sprite/delete', {slug: a.slug});
          P.list = d.sprites.filter((s) => s.kind !== 'sketch'); P.art = fresh(16); P.frame = 0; P.undo = []; P.sel = null; P.float = null; P.saved = snap(); draw();
        } catch (e) { alert('Couldn’t delete it: ' + e.message); }
      };
      const name = h('input', {type: 'text', value: a.name, placeholder: 'Name (e.g. Dancing Saint Nicholas)', 'aria-label': 'Name', oninput: (e) => { a.name = e.target.value; markDirty(); }});

      const tool = ([t, label]) => h('button', {'aria-pressed': P.tool === t ? 'true' : 'false', text: label, onclick: () => {
        if (t !== 'select') letGo();
        P.tool = t; draw();
      }});
      const swatch = (c) => h('button', {class: 'px-swatch' + (c.toUpperCase() === P.color.toUpperCase() ? ' on' : ''), style: {background: c}, title: c, 'aria-label': 'Color ' + c,
        onclick: () => { P.color = c; if (['erase', 'pick', 'select'].includes(P.tool)) P.tool = 'pen'; draw(); }});
      const colors = PALETTES[P.pal].colors;
      const used = [...new Set(a.frames.flat().filter(Boolean).map((c) => c.toUpperCase()))].filter((c) => !colors.includes(c));
      const custom = h('input', {type: 'color', value: P.color, 'aria-label': 'Any color', onchange: (e) => { P.color = e.target.value.toUpperCase(); if (['erase', 'pick', 'select'].includes(P.tool)) P.tool = 'pen'; draw(); }});

      // Reorder: drag a frame onto another, or Move left / right.
      const moveFrame = (from, to) => { if (to < 0 || to >= a.frames.length || to === from) return; letGo(); remember(); a.frames.splice(to, 0, a.frames.splice(from, 1)[0]); P.frame = to; draw(); markDirty(); };
      const frames = a.frames.map((_, i) => h('button', {class: 'px-frame' + (i === P.frame ? ' on' : ''), 'aria-label': 'Frame ' + (i + 1), draggable: 'true', title: 'Drag to move it',
        onclick: () => { letGo(); P.frame = i; draw(); },
        ondragstart: (e) => { e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move'; },
        ondragover: (e) => { e.preventDefault(); e.currentTarget.classList.add('drop'); },
        ondragleave: (e) => e.currentTarget.classList.remove('drop'),
        ondrop: (e) => { e.preventDefault(); moveFrame(+e.dataTransfer.getData('text/plain'), i); }},
        [h('canvas', {width: 64, height: 64, 'data-thumb': i}), h('span', {text: String(i + 1)})]));

      const save = async () => {
        if (P.version) return saveVersion();
        if (!a.name.trim()) { alert('Give it a name first.'); return; }
        letGo();
        try {
          const d = await post('/api/sprite', toSaved(a));
          P.list = d.sprites.filter((s) => s.kind !== 'sketch'); a.slug = d.slug; P.saved = snap(); draw();
        } catch (e) { alert('Couldn’t save it: ' + e.message); }
      };
      // A color version: her recolored idle, then the other four poses made from the base with the same swaps.
      const saveVersion = async () => {
        letGo();
        const req = {base: P.version.base, name: P.version.name, idle: toSaved(a)};
        try {
          const check = await post('/api/sprite/version', {...req, dry: true});
          const others = check.exists.filter((x) => x !== a.slug);
          if (others.length && !(await ask(`${check.slug} already has ${others.length} pose${others.length > 1 ? 's' : ''}. Replace them with new ones in these colors?`))) return;
          for (const sp of check.split) {
            if (!(await ask(`One color in ${P.version.base} (${sp.from}) became ${sp.to.length} colors here (${sp.to.join(', ')}). The other poses can only use one: ${sp.to[0]}. Go ahead?`))) return;
          }
          const d = await post('/api/sprite/version', req);
          P.list = d.sprites.filter((x) => x.kind !== 'sketch'); P.bases.list = d.bases; P.bases.versions = d.versions; P.bases.cast = d.cast ?? [];
          a.slug = `${d.slug}-idle`; a.name = a.slug; P.saved = snap(); draw();
          note(`Made ${d.made.join(', ')}.` + (d.shape ? ` ${d.shape} squares you added or erased stay in the idle only (the other poses get the colors, not shape changes).` : ''));
        } catch (e) { alert('Couldn’t make it: ' + e.message); }
      };
      // Every square of one color, in every frame, changed to another.
      const swapColor = (from, to) => {
        remember();
        for (const fr of a.frames) fr.forEach((c, i) => { if (c && c.toUpperCase() === from) fr[i] = to.toUpperCase(); });
        draw(); markDirty();
      };
      const baseThumb = (b) => {
        const cv = h('canvas', {width: 64, height: 64});
        const art = fromSaved(b.idle);
        requestAnimationFrame(() => paint(cv, art.frames[0], art.width, art.height, 64));
        return h('button', {class: 'px-frame px-base' + (P.bases.pick === b.name ? ' on' : ''), title: b.name, onclick: () => { P.bases.pick = b.name; draw(); }},
          [cv, h('span', {text: b.name})]);
      };
      const startVersion = async () => {
        const b = P.bases.list.find((x) => x.name === P.bases.pick);
        const slug = P.bases.name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (!b) { alert('Pick a base first.'); return; }
        if (!slug) { alert('Give the new character a name (e.g. St Joseph).'); return; }
        if (dirty() && !(await ask('Leave this drawing without saving?'))) return;
        P.art = fromSaved(b.idle); delete P.art.slug; P.art.name = `${slug}-idle`;
        P.frame = 0; P.undo = []; P.sel = null; P.float = null; P.saved = '';
        P.version = {base: b.name, name: slug}; P.bases.open = false; P.bases.name = '';
        draw();
      };
      const basesPanel = P.bases.open ? h('div', {class: 'px-bases', style: {display: 'grid', gap: '8px'}}, [
        h('div', {class: 'small muted', text: 'Pick the body to start from, name the new character, then change the colors on its idle. The other poses are made for you.'}),
        h('div', {class: 'px-frames'}, P.bases.list.length ? P.bases.list.map(baseThumb) : [h('span', {class: 'small muted', text: 'No bases yet: a base is a character with idle, point, look-up, walk and run drawings.'})]),
        h('div', {class: 'row', style: {gap: '8px'}}, [
          h('input', {type: 'text', value: P.bases.name, placeholder: 'New character’s name (e.g. St Joseph)', 'aria-label': 'New character’s name', oninput: (e) => { P.bases.name = e.target.value; }}),
          btn('Start coloring', startVersion, {class: 'btn primary'})]),
      ]) : null;
      // One box per area of the base (each of the base's colors), so two areas can share a color
      // and still be changed apart later.
      const baseArt = P.version && P.bases.list.find((b) => b.name === P.version.base);
      const basePx = baseArt ? fromSaved(baseArt.idle).frames : null;
      const areas = basePx && basePx[0].length === a.width * a.height ? [...new Set(basePx.flat().filter(Boolean).map((c) => c.toUpperCase()))] : [];
      const squares = (area) => basePx.flatMap((fr, f) => (a.frames[f] ? fr.map((c, i) => (c && c.toUpperCase() === area && a.frames[f][i] ? [f, i] : null)).filter(Boolean) : []));
      const nowColor = (area) => {
        const n = {};
        for (const [f, i] of squares(area)) { const c = a.frames[f][i].toUpperCase(); n[c] = (n[c] ?? 0) + 1; }
        return Object.entries(n).sort((x, y) => y[1] - x[1])[0]?.[0] ?? area;
      };
      const setArea = (area, to) => {
        remember();
        for (const [f, i] of squares(area)) a.frames[f][i] = to.toUpperCase();
        draw(); markDirty();
      };
      const current = areas.map(nowColor);
      const areaBox = (area, k) => h('div', {style: {display: 'flex', gap: '6px', alignItems: 'center', minWidth: '0'}}, [
        h('span', {title: 'This part was ' + area + ' in ' + P.version.base, style: {width: '16px', height: '16px', borderRadius: '4px', background: area, border: '1px solid var(--rule)', flex: 'none'}}),
        h('span', {class: 'small muted', text: '→'}),
        h('input', {type: 'color', value: current[k].toLowerCase(), 'aria-label': 'New color for the part that was ' + area, onchange: (e) => setArea(area, e.target.value)}),
        // (squares, not a list: the Mac can't color a list's options)
        h('span', {class: 'small muted', text: 'same as'}),
        h('span', {style: {display: 'flex', gap: '3px', flexWrap: 'wrap', minWidth: '0'}}, [...new Set(current)].filter((c) => c !== current[k]).map((c) =>
          h('button', {class: 'px-same', title: 'Same as ' + c, 'aria-label': 'Same color as ' + c, style: {background: c}, onclick: () => setArea(area, c)}))),
      ]);
      const versionBox = P.version ? h('div', {class: 'px-version', style: {display: 'grid', gap: '6px', padding: '8px 10px', borderRadius: '8px', background: 'var(--panel-2, rgba(127,127,127,.12))'}}, [
        h('div', {class: 'small'}, [h('b', {text: P.version.name}), ` from ${P.version.base}: change the colors on this idle drawing. Saving makes point, look up, walk and run in the same colors.`]),
        areas.length ? h('div', {class: 'small muted', text: 'Each part of the base (its old color on the left) and its color now. Click a square after “same as” to give a part the same color as another; they can still be changed apart later.'})
          : h('div', {class: 'small muted', text: 'Change a color everywhere (every square and frame):'}),
        areas.length ? h('div', {style: {display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '6px 12px'}}, areas.map(areaBox))
          : h('div', {class: 'px-palette'}, [...new Set(a.frames.flat().filter(Boolean).map((c) => c.toUpperCase()))].map((c) =>
            h('label', {class: 'px-any', title: 'Change ' + c}, [h('input', {type: 'color', value: c.toLowerCase(), onchange: (e) => swapColor(c, e.target.value)}), h('span', {text: c})]))),
      ]) : null;
      const selecting = !!(P.sel || P.float);

      // Copy a pose to other characters: drafts made from each one's own idle (copyPose in
      // scripts/sprites.mjs), shown moving; the ones that already have that pose are left alone.
      const Q = P.poses;
      clearInterval(Q.timer);
      const STANDARD = ['idle', 'point', 'look-up', 'walk', 'run'];
      const loadDrafts = async () => {
        Q.drafts = []; Q.skip = new Set();
        const c = P.bases.cast.find((x) => x.name === Q.from);
        if (!c || !c.actions.includes(Q.pose)) { draw(); return; }
        Q.busy = true; draw();
        try {
          const to = P.bases.cast.filter((x) => x.name !== Q.from && x.actions.includes('idle')).map((x) => x.name);
          Q.drafts = (await post('/api/sprite/copy-pose', {from: Q.from, pose: Q.pose, to})).drafts.filter((d) => d.art);
        } catch (e) { alert(e.message); }
        Q.busy = false; draw();
      };
      const openPoses = () => {
        Q.open = !Q.open;
        if (Q.open && !Q.from) {
          // Start from the drawing that's open if it is a pose (e.g. eastern-monk-blessing).
          const c = a.slug && P.bases.cast.find((x) => a.slug.startsWith(x.name + '-') && x.actions.includes(a.slug.slice(x.name.length + 1)));
          const first = P.bases.cast.find((x) => x.actions.some((y) => !STANDARD.includes(y)));
          Q.from = c ? c.name : first?.name ?? '';
          const own = c ? a.slug.slice(c.name.length + 1) : null;
          Q.pose = own ?? (first ? first.actions.find((x) => !STANDARD.includes(x)) : '');
        }
        if (Q.open) loadDrafts(); else draw();
      };
      const fromChar = P.bases.cast.find((x) => x.name === Q.from);
      const newOnes = Q.drafts.filter((d) => !d.exists);
      const draftCards = Q.drafts.map((d) => {
        const art = fromSaved(d.art);
        const cv = h('canvas', {width: 64, height: 64});
        const on = !d.exists && !Q.skip.has(d.character);
        const card = h('label', {class: 'px-frame px-base' + (on ? ' on' : ''), title: d.exists ? `${d.slug} already exists (kept as it is)` : d.slug, style: {opacity: d.exists ? '.45' : null}}, [cv,
          h('span', {text: d.character + (d.exists ? ' (has one)' : '')}),
          d.exists ? null : h('input', {type: 'checkbox', checked: on || null, style: {position: 'absolute', top: '3px', right: '3px'}, 'aria-label': 'Make ' + d.slug,
            onchange: (e) => { if (e.target.checked) Q.skip.delete(d.character); else Q.skip.add(d.character); draw(); }})]);
        card._art = art; card._cv = cv;
        return card;
      });
      const makeDrafts = async () => {
        const to = newOnes.filter((d) => !Q.skip.has(d.character)).map((d) => d.character);
        if (!to.length) return;
        try {
          const d = await post('/api/sprite/copy-pose', {from: Q.from, pose: Q.pose, to, save: true});
          P.list = d.sprites.filter((x) => x.kind !== 'sketch');
          const r = await api('/api/puppet-bases'); P.bases.cast = r.cast ?? [];
          alert(`Made ${d.drafts.filter((x) => x.saved).length} drafts (named like ${to[0]}-${Q.pose}). Open each one to touch it up.`);
        } catch (e) { alert(e.message); return; }
        loadDrafts();
      };
      const posesPanel = Q.open ? h('div', {class: 'px-bases', style: {display: 'grid', gap: '8px'}}, [
        h('div', {class: 'small muted', text: 'Draw a new pose once on one character; every other character gets a draft made from its own idle and colors. Drafts never replace a drawing you already have. Check each one and touch it up.'}),
        h('div', {class: 'row', style: {gap: '8px', flexWrap: 'wrap'}}, [
          h('select', {'aria-label': 'Character with the pose', onchange: (e) => { Q.from = e.target.value; const c = P.bases.cast.find((x) => x.name === Q.from); Q.pose = c?.actions.find((x) => !STANDARD.includes(x)) ?? c?.actions[0] ?? ''; loadDrafts(); }},
            P.bases.cast.map((c) => h('option', {value: c.name, text: c.name, selected: c.name === Q.from || null}))),
          h('select', {'aria-label': 'Pose', onchange: (e) => { Q.pose = e.target.value; loadDrafts(); }},
            (fromChar?.actions ?? []).filter((x) => x !== 'idle').map((x) => h('option', {value: x, text: x, selected: x === Q.pose || null})))]),
        Q.busy ? h('div', {class: 'small muted', text: 'Making drafts…'}) : null,
        h('div', {class: 'px-frames'}, draftCards),
        newOnes.length ? h('div', {class: 'row', style: {gap: '8px'}}, [
          btn('All', () => { Q.skip = new Set(); draw(); }), btn('None', () => { Q.skip = new Set(newOnes.map((d) => d.character)); draw(); }),
          btn(`Make ${newOnes.filter((d) => !Q.skip.has(d.character)).length} drafts`, makeDrafts, {class: 'btn primary'})]) : null,
      ]) : null;
      if (Q.open && draftCards.length) {
        let t = 0;
        const tick = () => { for (const c of draftCards) paint(c._cv, c._art.frames[t % c._art.frames.length], c._art.width, c._art.height, 64); t++; };
        requestAnimationFrame(tick);
        Q.timer = setInterval(tick, 1000 / Math.max(1, Q.drafts[0]?.art.fps ?? 4));
      }

      body.replaceChildren(...[
        pick,
        h('button', {class: 'btn', 'aria-expanded': P.bases.open ? 'true' : 'false', text: 'New character from a base…', onclick: async () => {
          P.bases.open = !P.bases.open;
          if (P.bases.open) { try { const d = await api('/api/puppet-bases'); P.bases.list = d.bases; P.bases.versions = d.versions; P.bases.cast = d.cast ?? []; } catch {} }
          draw();
        }}),
        basesPanel,
        h('button', {class: 'btn', 'aria-expanded': P.poses.open ? 'true' : 'false', text: 'Copy a pose to other characters…', onclick: openPoses}),
        posesPanel,
        versionBox,
        h('div', {class: 'row', style: {gap: '8px'}}, [size,
          h('label', {class: 'btn px-upload', title: 'Pictures from Procreate or anywhere: each becomes a frame (from this one on)'}, ['Upload pictures…',
            h('input', {type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: (e) => { upload(e.target.files); e.target.value = ''; }})])]),
        P.version ? null : name,
        h('div', {class: 'seg px-tools', role: 'group', 'aria-label': 'Tool'}, TOOLS.map(tool)),
        h('div', {class: 'small muted', text: 'Keys: B pencil · E eraser · F fill · S line → box → circle · C next color · X color before · I pick a color · M select (Delete clears it) · . next frame · , frame before'}),
        SHAPES.includes(P.tool) && P.tool !== 'line'
          ? h('label', {class: 'small'}, [h('input', {type: 'checkbox', checked: P.filled || null, onchange: (e) => { P.filled = e.target.checked; }}), ' Filled']) : null,
        h('div', {class: 'row', style: {gap: '8px', alignItems: 'center'}}, [h('span', {class: 'small muted', text: 'Colors:'}), paletteSel]),
        h('div', {class: 'px-palette'}, [...colors.map(swatch),
          used.length ? h('span', {class: 'small muted', text: 'In this drawing:'}) : null, ...used.map(swatch),
          h('label', {class: 'px-any', title: 'Any color'}, [custom, h('span', {text: 'Any color'})])]),
        h('div', {class: 'row', style: {gap: '8px', flexWrap: 'wrap'}}, [
          btn('Undo', undo),
          btn('Copy', () => copy(false), {title: 'From this frame: the selection, or the whole picture'}),
          btn('Copy all frames', () => copy(true), {title: 'The whole animation (or the selected spot in every frame)'}),
          btn('Cut', cut),
          btn('Paste', () => paste(false), {title: 'Into the frame showing (a copy of all frames: this frame and the ones after)'}),
          btn('Paste in every frame', () => paste(true)),
          btn('Bigger ×2', () => scaleBy(2), {title: 'Make the selection twice as big'}),
          btn('Smaller ÷2', () => scaleBy(0.5), {title: 'Make the selection half the size'}),
          btn('Flip ↔', () => flip('h'), {title: selecting ? 'Flip the selection left to right' : 'Flip left to right'}),
          btn('Flip ↕', () => flip('v'), {title: selecting ? 'Flip the selection upside down' : 'Flip upside down'}),
          h('label', {class: 'small', title: 'Drawing, erasing, shapes, fill, moving, cutting, flipping and clearing work on all the frames at once'}, [h('input', {type: 'checkbox', checked: P.every || null, disabled: !!P.float,
            onchange: (e) => { P.every = e.target.checked; }}), ' Draw in every frame (pencil, eraser, shapes, fill, move, cut, flip, clear)']),
          btn('Clear this frame', () => { letGo(); remember(); a.frames[P.frame] = blank(a.width, a.height); draw(); markDirty(); }),
          h('button', {class: 'btn primary', 'data-save': '', disabled: !dirty(), text: dirty() ? (P.version ? 'Save and make all 5 poses' : 'Save') : 'Saved', onclick: save}),
          a.slug ? btn('Delete this drawing', remove) : null,
          btn('Export frame (PNG)', () => exportArt(false), {title: 'This frame as a picture, enlarged with sharp pixels'}),
          a.frames.length > 1 ? btn('Export animation (GIF)', () => exportArt(true), {title: 'All the frames as an animated GIF, at the preview speed'}) : null,
          selecting ? btn('Done moving', () => { letGo(); draw(); markDirty(); }) : null,
        ]),
        h('div', {class: 'small muted', 'data-note': '', text: (selecting ? 'Drag inside the box to move it. Copy, Cut and Flip use the selection.' : 'Copy, Cut and Flip use the whole picture when nothing is selected.')
          + ' Copy all frames, then Paste in another drawing, brings a whole animation across.'}),
        h('div', {class: 'row', style: {gap: '14px'}}, [
          h('label', {class: 'small'}, [h('input', {type: 'checkbox', checked: P.mirror || null, onchange: (e) => { P.mirror = e.target.checked; drawCanvas(); }}), ' Mirror (draw both sides)']),
          h('label', {class: 'small'}, [h('input', {type: 'checkbox', checked: P.onion || null, onchange: (e) => { P.onion = e.target.checked; drawCanvas(); }}), ' Show the frame before, faintly']),
        ]),
        h('div', {class: 'small muted', text: 'Frames (2 to 8 make it move):'}),
        h('div', {class: 'px-frames'}, [...frames,
          a.frames.length < MAX_FRAMES ? btn('+ Copy this frame', () => { letGo(); remember(); a.frames.splice(P.frame + 1, 0, [...px()]); P.frame++; draw(); markDirty(); }) : null,
          a.frames.length < MAX_FRAMES ? btn('+ Empty frame', () => { letGo(); remember(); a.frames.splice(P.frame + 1, 0, blank(a.width, a.height)); P.frame++; draw(); markDirty(); }) : null,
          a.frames.length > 1 ? btn('◀ Move left', () => moveFrame(P.frame, P.frame - 1), {disabled: P.frame === 0 || null}) : null,
          a.frames.length > 1 ? btn('Move right ▶', () => moveFrame(P.frame, P.frame + 1), {disabled: P.frame === a.frames.length - 1 || null}) : null,
        ]),
        a.frames.length > 1 ? h('div', {class: 'row', style: {gap: '8px'}}, [btn('🗑 Delete frame ' + (P.frame + 1), async () => { if (!(await ask('Delete frame ' + (P.frame + 1) + '?'))) return; letGo(); remember(); a.frames.splice(P.frame, 1); P.frame = Math.max(0, P.frame - 1); draw(); markDirty(); }, {title: 'Delete the frame that’s showing'})]) : null,
        h('div', {class: 'row', style: {gap: '14px', alignItems: 'center'}}, [preview,
          h('label', {class: 'tl-field'}, [h('span', {text: 'Speed: ' + a.fps + ' frames a second'}),
            h('input', {type: 'range', min: 1, max: 12, value: a.fps, oninput: (e) => { a.fps = +e.target.value; e.target.previousSibling.textContent = 'Speed: ' + a.fps + ' frames a second'; startPreview(); markDirty(); }})])]),
        h('div', {class: 'small muted', text: 'Saved drawings can go in any lesson: on the Timing tab, + Add a picture here → Pixel animation.'}),
      ].filter(Boolean));
      drawCanvas();
      startPreview();
      markDirty();
    }

    // (sketches have their own mode)
    api('/api/sprites').then((list) => { P.list = list.filter((s) => s.kind !== 'sketch'); draw(); }, () => draw());
    api('/api/puppet-bases').then((d) => { P.bases.list = d.bases; P.bases.versions = d.versions; P.bases.cast = d.cast ?? []; }, () => {});
    return {dirty};
  }

  return {open};
})();
