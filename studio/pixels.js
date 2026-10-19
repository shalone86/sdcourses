// Pixel art tab: draw a small picture in 1 to 4 frames, watch it move, save it to
// sprites/<name>.json (scripts/sprites.mjs). On the Timing tab, "+ Add a picture
// here → Pixel animation" puts one in a lesson.
'use strict';
window.PixelTab = (() => {
  const CODES = '0123456789abcdefghijklmnopqrstuvwxyz';
  const MAX_FRAMES = 4;
  // The kids palette first, then basics, skin and hair tones, nature.
  const PALETTE = ['#FF4F6D', '#18B7A6', '#FFB300', '#7B5CFF', '#2F8CFF', '#FF8A3D',
    '#000000', '#2B2350', '#6A6488', '#C9C3D9', '#FFFFFF',
    '#FBE3CF', '#F2C6A0', '#D9A066', '#A86B3C', '#8D5524', '#5A3825', '#2E1B10',
    '#FFD36B', '#B8860B', '#7ED957', '#2E7D32', '#9FDFF0', '#7A1F2B'];

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

  function open(root, api, post) {
    const P = {list: [], art: fresh(16), frame: 0, tool: 'pen', color: PALETTE[7], mirror: false, onion: true, undo: [], saved: '', mine: [], timer: null};
    const snap = () => JSON.stringify({name: P.art.name, fps: P.art.fps, frames: P.art.frames});
    P.saved = snap();
    const dirty = () => snap() !== P.saved;

    const canvas = h('canvas', {class: 'px-canvas', width: 512, height: 512, 'aria-label': 'Drawing grid'});
    const preview = h('canvas', {class: 'px-preview', width: 192, height: 192, 'aria-label': 'Animation preview'});
    const body = h('div', {class: 'px-side'});
    root.replaceChildren(h('div', {class: 'px-wrap'}, [h('div', {class: 'px-left'}, [canvas, h('div', {class: 'small muted', text: 'Click or drag to draw. Ctrl/⌘-Z undoes.'})]), body]));

    // ---------- drawing ----------
    const cell = () => canvas.width / Math.max(P.art.width, P.art.height);
    const px = () => P.art.frames[P.frame];

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
    }
    function drawCanvas() {
      const a = P.art;
      // Onion skin: the frame before (on the first frame, the last one, since it loops).
      const prev = P.onion && a.frames.length > 1 ? a.frames[(P.frame + a.frames.length - 1) % a.frames.length] : null;
      paint(canvas, px(), a.width, a.height, canvas.width, {grid: true, onion: prev});
      body.querySelectorAll('canvas[data-thumb]').forEach((t) => paint(t, a.frames[+t.dataset.thumb], a.width, a.height, t.width));
    }
    function startPreview() {
      clearInterval(P.timer);
      let i = 0;
      const tick = () => { if (!preview.isConnected) return clearInterval(P.timer); const a = P.art; paint(preview, a.frames[i % a.frames.length], a.width, a.height, preview.width); i++; };
      tick();
      P.timer = setInterval(tick, 1000 / P.art.fps);
    }

    function at(e) {
      const r = canvas.getBoundingClientRect();
      const c = cell() * (r.width / canvas.width);
      const x = Math.floor((e.clientX - r.left) / c), y = Math.floor((e.clientY - r.top) / c);
      return x >= 0 && y >= 0 && x < P.art.width && y < P.art.height ? {x, y} : null;
    }
    function set(x, y, col) {
      const w = P.art.width;
      px()[y * w + x] = col;
      if (P.mirror) px()[y * w + (w - 1 - x)] = col;
    }
    function fill(x, y, col) {
      const w = P.art.width, hgt = P.art.height, p = px();
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
    const remember = () => { P.undo.push(JSON.stringify(P.art.frames)); if (P.undo.length > 60) P.undo.shift(); };
    function undo() { const u = P.undo.pop(); if (u) { P.art.frames = JSON.parse(u); P.frame = Math.min(P.frame, P.art.frames.length - 1); draw(); } }

    canvas.addEventListener('pointerdown', (e) => {
      const c = at(e);
      if (!c) return;
      e.preventDefault();
      if (P.tool === 'pick') { const col = px()[c.y * P.art.width + c.x]; if (col) { P.color = col; draw(); } return; }
      remember();
      if (P.tool === 'fill') { fill(c.x, c.y, P.color); drawCanvas(); markDirty(); return; }
      try { canvas.setPointerCapture(e.pointerId); } catch { /* fine */ }
      const col = P.tool === 'erase' ? null : P.color;
      set(c.x, c.y, col); drawCanvas();
      // Fill in every square between two pointer positions, so a quick stroke has no gaps.
      let last = c;
      const move = (ev) => {
        const d = at(ev);
        if (!d) return;
        const steps = Math.max(Math.abs(d.x - last.x), Math.abs(d.y - last.y));
        for (let k = 1; k <= steps; k++) set(Math.round(last.x + ((d.x - last.x) * k) / steps), Math.round(last.y + ((d.y - last.y) * k) / steps), col);
        last = d;
        drawCanvas();
      };
      const up = () => { canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); markDirty(); };
      canvas.addEventListener('pointermove', move);
      canvas.addEventListener('pointerup', up);
    });
    const onKey = (e) => {
      if (!root.isConnected) return document.removeEventListener('keydown', onKey);
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) { e.preventDefault(); undo(); }
    };
    document.addEventListener('keydown', onKey);

    function markDirty() {
      const b = body.querySelector('[data-save]');
      if (b) { b.disabled = !dirty(); b.textContent = dirty() ? 'Save' : 'Saved'; }
    }

    // ---------- the side panel ----------
    function draw() {
      const a = P.art;
      const btn = (text, onclick, attrs = {}) => h('button', {class: 'btn', text, onclick, ...attrs});
      const pick = h('select', {'aria-label': 'Open a saved animation', onchange: (e) => {
        if (dirty() && !confirm('Leave this drawing without saving?')) { e.target.value = a.slug || ''; return; }
        const s = P.list.find((x) => x.slug === e.target.value);
        P.art = s ? fromSaved(s) : fresh(16); P.frame = 0; P.undo = []; P.saved = snap(); draw();
      }}, [h('option', {value: '', text: 'New drawing'}), ...P.list.map((s) => h('option', {value: s.slug, text: s.name, selected: s.slug === a.slug}))]);
      const size = h('select', {'aria-label': 'Size', disabled: !!a.slug || a.frames.some((f) => f.some(Boolean)), onchange: (e) => {
        const n = +e.target.value; P.art = {...fresh(n), name: a.name, fps: a.fps}; P.frame = 0; draw();
      }}, [16, 24, 32].map((n) => h('option', {value: n, text: `${n} × ${n}`, selected: a.width === n})));
      const name = h('input', {type: 'text', value: a.name, placeholder: 'Name (e.g. Dancing Saint Nicholas)', 'aria-label': 'Name', oninput: (e) => { a.name = e.target.value; markDirty(); }});

      const tool = (t, label) => h('button', {'aria-pressed': P.tool === t ? 'true' : 'false', text: label, onclick: () => { P.tool = t; draw(); }});
      const swatch = (c) => h('button', {class: 'px-swatch' + (c.toUpperCase() === P.color.toUpperCase() ? ' on' : ''), style: {background: c}, title: c, 'aria-label': 'Color ' + c,
        onclick: () => { P.color = c; if (P.tool === 'erase' || P.tool === 'pick') P.tool = 'pen'; draw(); }});
      const used = [...new Set(a.frames.flat().filter(Boolean).map((c) => c.toUpperCase()))].filter((c) => !PALETTE.includes(c));
      const custom = h('input', {type: 'color', value: P.color, 'aria-label': 'Any color', onchange: (e) => { P.color = e.target.value.toUpperCase(); P.tool = 'pen'; draw(); }});

      const frames = a.frames.map((_, i) => h('button', {class: 'px-frame' + (i === P.frame ? ' on' : ''), 'aria-label': 'Frame ' + (i + 1), onclick: () => { P.frame = i; draw(); }},
        [h('canvas', {width: 64, height: 64, 'data-thumb': i}), h('span', {text: String(i + 1)})]));

      const save = async () => {
        if (!a.name.trim()) { alert('Give it a name first.'); return; }
        try {
          const d = await post('/api/sprite', toSaved(a));
          P.list = d.sprites; a.slug = d.slug; P.saved = snap(); draw();
        } catch (e) { alert('Couldn’t save it: ' + e.message); }
      };

      body.replaceChildren(
        h('div', {class: 'row', style: {gap: '8px'}}, [pick, size]),
        name,
        h('div', {class: 'seg', role: 'group', 'aria-label': 'Tool'}, [tool('pen', 'Pencil'), tool('erase', 'Eraser'), tool('fill', 'Fill'), tool('pick', 'Pick a color')]),
        h('div', {class: 'px-palette'}, [...PALETTE.map(swatch), ...used.map(swatch), h('label', {class: 'px-any', title: 'Any color'}, [custom, h('span', {text: 'Any color'})])]),
        h('div', {class: 'row', style: {gap: '14px'}}, [
          h('label', {class: 'small'}, [h('input', {type: 'checkbox', checked: P.mirror || null, onchange: (e) => { P.mirror = e.target.checked; drawCanvas(); }}), ' Mirror (draw both sides)']),
          h('label', {class: 'small'}, [h('input', {type: 'checkbox', checked: P.onion || null, onchange: (e) => { P.onion = e.target.checked; drawCanvas(); }}), ' Show the frame before, faintly']),
        ]),
        h('div', {class: 'small muted', text: 'Frames (2 to 4 make it move):'}),
        h('div', {class: 'px-frames'}, [...frames,
          a.frames.length < MAX_FRAMES ? btn('+ Copy this frame', () => { remember(); a.frames.splice(P.frame + 1, 0, [...px()]); P.frame++; draw(); markDirty(); }) : null,
          a.frames.length > 1 ? btn('Delete this frame', () => { if (!confirm('Delete frame ' + (P.frame + 1) + '?')) return; remember(); a.frames.splice(P.frame, 1); P.frame = Math.max(0, P.frame - 1); draw(); markDirty(); }) : null]),
        h('div', {class: 'row', style: {gap: '14px', alignItems: 'center'}}, [preview,
          h('label', {class: 'tl-field'}, [h('span', {text: 'Speed: ' + a.fps + ' frames a second'}),
            h('input', {type: 'range', min: 1, max: 12, value: a.fps, oninput: (e) => { a.fps = +e.target.value; e.target.previousSibling.textContent = 'Speed: ' + a.fps + ' frames a second'; startPreview(); markDirty(); }})])]),
        h('div', {class: 'row', style: {gap: '8px'}}, [
          btn('Undo', undo),
          btn('Clear this frame', () => { remember(); a.frames[P.frame] = blank(a.width, a.height); draw(); markDirty(); }),
          h('button', {class: 'btn primary', 'data-save': '', disabled: !dirty(), text: dirty() ? 'Save' : 'Saved', onclick: save}),
        ]),
        h('div', {class: 'small muted', text: 'Saved drawings can go in any lesson: on the Timing tab, + Add a picture here → Pixel animation.'}),
      );
      drawCanvas();
      startPreview();
      markDirty();
    }

    api('/api/sprites').then((list) => { P.list = list; draw(); }, () => draw());
    return {dirty};
  }

  return {open};
})();
