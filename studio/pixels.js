// Pixel art tab: draw a small picture in 1 to 4 frames, watch it move, save it to
// sprites/<name>.json (scripts/sprites.mjs). On the Timing tab, "+ Add a picture
// here → Pixel animation" puts one in a lesson.
//
// Tools: pencil, dither (every other pixel), eraser, fill, line, box, circle,
// select (drag a box; drag inside it to move), pick a color. Copy/cut/paste work
// across drawings (the copy is kept in this browser). Flip the selection, the
// frame, or every frame.
'use strict';
window.PixelTab = (() => {
  const CODES = '0123456789abcdefghijklmnopqrstuvwxyz';
  const MAX_FRAMES = 4;
  // The kids palette first, then basics, skin and hair tones, nature.
  const PALETTE = ['#FF4F6D', '#18B7A6', '#FFB300', '#7B5CFF', '#2F8CFF', '#FF8A3D',
    '#000000', '#2B2350', '#6A6488', '#C9C3D9', '#FFFFFF',
    '#FBE3CF', '#F2C6A0', '#D9A066', '#A86B3C', '#8D5524', '#5A3825', '#2E1B10',
    '#FFD36B', '#B8860B', '#7ED957', '#2E7D32', '#9FDFF0', '#7A1F2B'];
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
  const fresh = (size) => ({name: '', width: size, height: size, fps: 4, frames: [blank(size, size), blank(size, size)]});

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

  function open(root, api, post) {
    const P = {list: [], art: fresh(16), frame: 0, tool: 'pen', color: PALETTE[7], mirror: false, onion: true, filled: false, allFrames: false,
      undo: [], saved: '', timer: null,
      sel: null,    // selected box {x, y, w, h}
      float: null,  // lifted pixels being moved or pasted {x, y, w, h, px}
      shape: null}; // a shape being dragged: its preview squares
    const snap = () => JSON.stringify({name: P.art.name, fps: P.art.fps, frames: P.art.frames});
    P.saved = snap();
    const dirty = () => snap() !== P.saved || !!P.float;

    const canvas = h('canvas', {class: 'px-canvas', width: 512, height: 512, 'aria-label': 'Drawing grid', tabindex: '0'});
    const preview = h('canvas', {class: 'px-preview', width: 192, height: 192, 'aria-label': 'Animation preview'});
    const body = h('div', {class: 'px-side'});
    root.replaceChildren(h('div', {class: 'px-wrap'}, [h('div', {class: 'px-left'}, [canvas,
      h('div', {class: 'small muted', text: 'Click or drag to draw. ⌘Z undo · ⌘C copy · ⌘X cut · ⌘V paste · arrows move a selection · Delete clears it · Esc lets go.'})]), body]));

    const W = () => P.art.width, H = () => P.art.height;
    const px = () => P.art.frames[P.frame];
    const inBounds = (x, y) => x >= 0 && y >= 0 && x < W() && y < H();

    // ---------- drawing on screen ----------
    function paint(cv, pixels, w, hgt, size, {grid, onion} = {}) {
      const g = cv.getContext('2d');
      const c = size / Math.max(w, hgt);
      g.clearRect(0, 0, cv.width, cv.height);
      // See-through shows as a soft checkerboard.
      for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) {
        g.fillStyle = (x + y) % 2 ? '#EEE9DF' : '#F8F5EE';
        g.fillRect(x * c, y * c, c, c);
      }
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
      const {g, c} = paint(canvas, px(), a.width, a.height, canvas.width, {grid: true, onion: prev});
      if (P.float) {
        const f = P.float;
        for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
          const col = f.px[y * f.w + x];
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
      px()[y * W() + x] = col;
      if (P.mirror) { const mx = W() - 1 - x; if (P.tool !== 'dither' || (mx + y) % 2 === 0) px()[y * W() + mx] = col; }
    }
    function fill(x, y, col) {
      const w = W(), hgt = H(), p = px();
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
    /** Pick up the selected pixels so they can move (the spot they leave is see-through). */
    function lift() {
      if (P.float || !P.sel) return;
      remember();
      const s = P.sel, p = px(), out = [];
      for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const i = (s.y + y) * W() + s.x + x; out.push(p[i]); p[i] = null; }
      P.float = {...s, px: out};
    }
    /** Put the lifted pixels down where they are now. */
    function commit() {
      const f = P.float;
      if (!f) return;
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
        const col = f.px[y * f.w + x];
        if (col && inBounds(f.x + x, f.y + y)) px()[(f.y + y) * W() + f.x + x] = col;
      }
      P.sel = {x: Math.max(0, f.x), y: Math.max(0, f.y), w: Math.min(W(), f.x + f.w) - Math.max(0, f.x), h: Math.min(H(), f.y + f.h) - Math.max(0, f.y)};
      if (P.sel.w < 1 || P.sel.h < 1) P.sel = null;
      P.float = null;
    }
    function letGo() { commit(); P.sel = null; }
    /** The selection (or the whole frame), as {w, h, px}. */
    function grab() {
      if (P.float) return {w: P.float.w, h: P.float.h, px: [...P.float.px]};
      const s = P.sel || {x: 0, y: 0, w: W(), h: H()};
      const out = [];
      for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) out.push(px()[(s.y + y) * W() + s.x + x]);
      return {w: s.w, h: s.h, px: out};
    }
    function copy() {
      const c = grab();
      try { localStorage.setItem(CLIP_KEY, JSON.stringify(c)); } catch { /* still kept below */ }
      P.clip = c;
      note(`Copied ${c.w} × ${c.h}. Paste it here or in another drawing.`);
    }
    function cut() {
      copy();
      if (P.float) { P.float = null; P.sel = null; }
      else { remember(); clearArea(); }
      draw(); markDirty();
    }
    function paste() {
      let c = P.clip;
      try { c = JSON.parse(localStorage.getItem(CLIP_KEY)) || c; } catch { /* use the one in memory */ }
      if (!c) { note('Nothing copied yet: select something (or nothing, for the whole frame) and press Copy.'); return; }
      commit();
      remember();
      // Paste where the selection is, else the top-left corner; then drag it into place.
      const x = P.sel ? P.sel.x : 0, y = P.sel ? P.sel.y : 0;
      P.float = {x, y, w: c.w, h: c.h, px: [...c.px]};
      P.sel = null;
      P.tool = 'select';
      draw(); markDirty();
    }
    function clearArea() {
      const s = P.sel;
      if (!s) { px().fill(null); return; }
      for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) px()[(s.y + y) * W() + s.x + x] = null;
    }
    function nudge(dx, dy) {
      if (!P.sel && !P.float) return;
      lift();
      P.float.x += dx; P.float.y += dy;
      drawCanvas(); markDirty();
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
        P.float.px = flipped(P.float.px, P.float.w, P.float.h, dir);
      } else {
        remember();
        const which = P.allFrames ? P.art.frames.map((_, i) => i) : [P.frame];
        for (const i of which) P.art.frames[i] = flipped(P.art.frames[i], W(), H(), dir);
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
      if (P.tool === 'pick') { const col = (P.float && inside(P.float, c) && P.float.px[(c.y - P.float.y) * P.float.w + c.x - P.float.x]) || px()[c.y * W() + c.x]; if (col) { P.color = col; P.tool = 'pen'; draw(); } return; }

      if (P.tool === 'select') {
        const box = P.float || P.sel;
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

    const onKey = (e) => {
      if (!root.isConnected) return document.removeEventListener('keydown', onKey);
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
      const cmd = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (cmd && k === 'z') { e.preventDefault(); undo(); }
      else if (cmd && k === 'c') { e.preventDefault(); copy(); }
      else if (cmd && k === 'x') { e.preventDefault(); cut(); }
      else if (cmd && k === 'v') { e.preventDefault(); paste(); }
      else if (cmd && k === 'a') { e.preventDefault(); commit(); P.sel = {x: 0, y: 0, w: W(), h: H()}; P.tool = 'select'; draw(); }
      else if ((k === 'delete' || k === 'backspace') && (P.sel || P.float)) { e.preventDefault(); if (P.float) P.float = null; else { remember(); clearArea(); } P.sel = null; draw(); markDirty(); }
      else if (k === 'escape' || k === 'enter') { letGo(); draw(); markDirty(); }
      else if (k.startsWith('arrow') && (P.sel || P.float)) {
        e.preventDefault();
        nudge(k === 'arrowleft' ? -1 : k === 'arrowright' ? 1 : 0, k === 'arrowup' ? -1 : k === 'arrowdown' ? 1 : 0);
      }
    };
    document.addEventListener('keydown', onKey);

    function markDirty() {
      const b = body.querySelector('[data-save]');
      if (b) { b.disabled = !dirty(); b.textContent = dirty() ? 'Save' : 'Saved'; }
    }
    function note(text) { const n = body.querySelector('[data-note]'); if (n) n.textContent = text; }

    // ---------- the side panel ----------
    function draw() {
      const a = P.art;
      const btn = (text, onclick, attrs = {}) => h('button', {class: 'btn', text, onclick, ...attrs});
      const pick = h('select', {'aria-label': 'Open a saved animation', onchange: (e) => {
        if (dirty() && !confirm('Leave this drawing without saving?')) { e.target.value = a.slug || ''; return; }
        const s = P.list.find((x) => x.slug === e.target.value);
        // The copied pixels stay, so they can be pasted into the drawing opened now.
        P.art = s ? fromSaved(s) : fresh(16); P.frame = 0; P.undo = []; P.sel = null; P.float = null; P.saved = snap(); draw();
      }}, [h('option', {value: '', text: 'New drawing'}), ...P.list.map((s) => h('option', {value: s.slug, text: s.name, selected: s.slug === a.slug}))]);
      const size = h('select', {'aria-label': 'Size', disabled: !!a.slug || a.frames.some((f) => f.some(Boolean)), onchange: (e) => {
        const n = +e.target.value; P.art = {...fresh(n), name: a.name, fps: a.fps}; P.frame = 0; draw();
      }}, [16, 24, 32].map((n) => h('option', {value: n, text: `${n} × ${n}`, selected: a.width === n})));
      const name = h('input', {type: 'text', value: a.name, placeholder: 'Name (e.g. Dancing Saint Nicholas)', 'aria-label': 'Name', oninput: (e) => { a.name = e.target.value; markDirty(); }});

      const tool = ([t, label]) => h('button', {'aria-pressed': P.tool === t ? 'true' : 'false', text: label, onclick: () => {
        if (t !== 'select') letGo();
        P.tool = t; draw();
      }});
      const swatch = (c) => h('button', {class: 'px-swatch' + (c.toUpperCase() === P.color.toUpperCase() ? ' on' : ''), style: {background: c}, title: c, 'aria-label': 'Color ' + c,
        onclick: () => { P.color = c; if (['erase', 'pick', 'select'].includes(P.tool)) P.tool = 'pen'; draw(); }});
      const used = [...new Set(a.frames.flat().filter(Boolean).map((c) => c.toUpperCase()))].filter((c) => !PALETTE.includes(c));
      const custom = h('input', {type: 'color', value: P.color, 'aria-label': 'Any color', onchange: (e) => { P.color = e.target.value.toUpperCase(); if (['erase', 'pick', 'select'].includes(P.tool)) P.tool = 'pen'; draw(); }});

      const frames = a.frames.map((_, i) => h('button', {class: 'px-frame' + (i === P.frame ? ' on' : ''), 'aria-label': 'Frame ' + (i + 1), onclick: () => { letGo(); P.frame = i; draw(); }},
        [h('canvas', {width: 64, height: 64, 'data-thumb': i}), h('span', {text: String(i + 1)})]));

      const save = async () => {
        if (!a.name.trim()) { alert('Give it a name first.'); return; }
        letGo();
        try {
          const d = await post('/api/sprite', toSaved(a));
          P.list = d.sprites; a.slug = d.slug; P.saved = snap(); draw();
        } catch (e) { alert('Couldn’t save it: ' + e.message); }
      };
      const selecting = !!(P.sel || P.float);

      body.replaceChildren(...[
        h('div', {class: 'row', style: {gap: '8px'}}, [pick, size]),
        name,
        h('div', {class: 'seg px-tools', role: 'group', 'aria-label': 'Tool'}, TOOLS.map(tool)),
        SHAPES.includes(P.tool) && P.tool !== 'line'
          ? h('label', {class: 'small'}, [h('input', {type: 'checkbox', checked: P.filled || null, onchange: (e) => { P.filled = e.target.checked; }}), ' Filled']) : null,
        h('div', {class: 'px-palette'}, [...PALETTE.map(swatch), ...used.map(swatch), h('label', {class: 'px-any', title: 'Any color'}, [custom, h('span', {text: 'Any color'})])]),
        h('div', {class: 'row', style: {gap: '8px', flexWrap: 'wrap'}}, [
          btn('Copy', copy, {title: selecting ? 'Copy the selection' : 'Copy the whole frame'}),
          btn('Cut', cut),
          btn('Paste', paste),
          btn('Flip ↔', () => flip('h'), {title: selecting ? 'Flip the selection left to right' : 'Flip left to right'}),
          btn('Flip ↕', () => flip('v'), {title: selecting ? 'Flip the selection upside down' : 'Flip upside down'}),
          selecting ? null : h('label', {class: 'small'}, [h('input', {type: 'checkbox', checked: P.allFrames || null, onchange: (e) => { P.allFrames = e.target.checked; }}), ' Flip every frame']),
          selecting ? btn('Done moving', () => { letGo(); draw(); markDirty(); }) : null,
        ]),
        h('div', {class: 'small muted', 'data-note': '', text: selecting ? 'Drag inside the box to move it. Copy, Cut and Flip use the selection.' : 'Copy, Cut and Flip use the whole frame when nothing is selected.'}),
        h('div', {class: 'row', style: {gap: '14px'}}, [
          h('label', {class: 'small'}, [h('input', {type: 'checkbox', checked: P.mirror || null, onchange: (e) => { P.mirror = e.target.checked; drawCanvas(); }}), ' Mirror (draw both sides)']),
          h('label', {class: 'small'}, [h('input', {type: 'checkbox', checked: P.onion || null, onchange: (e) => { P.onion = e.target.checked; drawCanvas(); }}), ' Show the frame before, faintly']),
        ]),
        h('div', {class: 'small muted', text: 'Frames (2 to 4 make it move):'}),
        h('div', {class: 'px-frames'}, [...frames,
          a.frames.length < MAX_FRAMES ? btn('+ Copy this frame', () => { letGo(); remember(); a.frames.splice(P.frame + 1, 0, [...px()]); P.frame++; draw(); markDirty(); }) : null,
          a.frames.length > 1 ? btn('Delete this frame', () => { if (!confirm('Delete frame ' + (P.frame + 1) + '?')) return; letGo(); remember(); a.frames.splice(P.frame, 1); P.frame = Math.max(0, P.frame - 1); draw(); markDirty(); }) : null]),
        h('div', {class: 'row', style: {gap: '14px', alignItems: 'center'}}, [preview,
          h('label', {class: 'tl-field'}, [h('span', {text: 'Speed: ' + a.fps + ' frames a second'}),
            h('input', {type: 'range', min: 1, max: 12, value: a.fps, oninput: (e) => { a.fps = +e.target.value; e.target.previousSibling.textContent = 'Speed: ' + a.fps + ' frames a second'; startPreview(); markDirty(); }})])]),
        h('div', {class: 'row', style: {gap: '8px'}}, [
          btn('Undo', undo),
          btn('Clear this frame', () => { letGo(); remember(); a.frames[P.frame] = blank(a.width, a.height); draw(); markDirty(); }),
          h('button', {class: 'btn primary', 'data-save': '', disabled: !dirty(), text: dirty() ? 'Save' : 'Saved', onclick: save}),
        ]),
        h('div', {class: 'small muted', text: 'Saved drawings can go in any lesson: on the Timing tab, + Add a picture here → Pixel animation.'}),
      ].filter(Boolean));
      drawCanvas();
      startPreview();
      markDirty();
    }

    api('/api/sprites').then((list) => { P.list = list; draw(); }, () => draw());
    return {dirty};
  }

  return {open};
})();
