// Sketch mode (Pixel art tab → Sketch): free drawing, not on a grid, with the same tools as
// the pixel editor plus brush sizes. 1 to 8 frames, saved as one picture per frame
// (sprites/<name>/<n>.png, scripts/sprites.mjs). Goes in a lesson the same way
// (Timing tab → + Add a picture here → Pixel animation).
'use strict';
window.SketchTab = (() => {
  const MAX_FRAMES = 8;
  const PALETTES = {
    video: {label: 'Video colors (12)', colors: ['#2B2350', '#FFFFFF', '#FFF6E0', '#FF4F6D', '#FF8A3D', '#FFB300', '#18B7A6', '#2F8CFF', '#7B5CFF', '#F2C6A0', '#A86B3C', '#5A3825']},
    gbc: {label: 'Game Boy Color (16)', colors: ['#000000', '#FFFFFF', '#888888', '#F8E8C8', '#E0A070', '#A05030', '#503018', '#F83838',
      '#F878B8', '#F8A800', '#F8F858', '#38B838', '#186818', '#58A8F8', '#2038A8', '#A858F8']},
    gb: {label: 'Game Boy (4 greens)', colors: ['#0F380F', '#306230', '#8BAC0F', '#9BBC0F']},
    all: {label: 'All colors (24)', colors: ['#FF4F6D', '#18B7A6', '#FFB300', '#7B5CFF', '#2F8CFF', '#FF8A3D', '#000000', '#2B2350', '#6A6488', '#C9C3D9', '#FFFFFF',
      '#FBE3CF', '#F2C6A0', '#D9A066', '#A86B3C', '#8D5524', '#5A3825', '#2E1B10', '#FFD36B', '#B8860B', '#7ED957', '#2E7D32', '#9FDFF0', '#7A1F2B']},
  };
  const TOOLS = [['pen', 'Brush'], ['erase', 'Eraser'], ['fill', 'Fill'], ['line', 'Line'], ['box', 'Box'], ['circle', 'Circle'], ['select', 'Select & move'], ['pick', 'Pick a color']];
  const SHAPES = ['line', 'box', 'circle'];
  const BRUSHES = [2, 4, 8, 14, 24, 40];
  const SIZES = [[512, 512, 'Square (512 × 512)'], [960, 540, 'Wide scene (960 × 540)']];
  const CLIP_KEY = 'studio.sketchClip';
  const store = {get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } }};

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
  const layer = (w, hgt) => { const c = document.createElement('canvas'); c.width = w; c.height = hgt; return c; };
  const copyOf = (c) => { const d = layer(c.width, c.height); d.getContext('2d').drawImage(c, 0, 0); return d; };
  const loadImage = (src) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });

  function open(root, api, post, reference) {
    const pal = PALETTES[store.get('studio.pixelPalette')] ? store.get('studio.pixelPalette') : 'video';
    const fresh = (w = 512, hgt = 512) => ({name: '', width: w, height: hgt, fps: 4, frames: [layer(w, hgt), layer(w, hgt)]});
    const P = {list: [], art: fresh(), frame: 0, tool: 'pen', brush: Number(store.get('studio.sketchBrush')) || 8, color: PALETTES[pal].colors[0], pal,
      mirror: false, onion: true, filled: false, every: false, gal: {open: false, q: ''}, undo: [], changed: false, timer: null, sel: null, float: null, shape: null};
    const dirty = () => P.changed || !!P.float;

    const canvas = h('canvas', {class: 'px-canvas sk-canvas', width: P.art.width, height: P.art.height, 'aria-label': 'Sketch', tabindex: '0'});
    const preview = h('canvas', {class: 'px-preview', width: 192, height: 192, 'aria-label': 'Animation preview'});
    const body = h('div', {class: 'px-side'});
    root.replaceChildren(h('div', {class: 'px-wrap'}, [h('div', {class: 'px-left'}, [canvas, reference.controls(() => drawCanvas()),
      h('div', {class: 'small muted', text: 'Draw with the mouse or a pen tablet. ⌘Z undo · ⌘C copy · ⌘X cut · ⌘V paste · arrows move a selection · Delete clears it · Esc lets go.'})]), body]));

    const W = () => P.art.width, H = () => P.art.height;
    const cur = () => P.art.frames[P.frame];
    const targets = () => (P.every ? P.art.frames.map((_, i) => i) : [P.frame]);

    // ---------- on screen ----------
    function drawCanvas() {
      if (canvas.width !== W() || canvas.height !== H()) { canvas.width = W(); canvas.height = H(); }
      const g = canvas.getContext('2d');
      g.clearRect(0, 0, W(), H());
      reference.draw(g, W(), H());
      const a = P.art;
      if (P.onion && a.frames.length > 1) { g.globalAlpha = 0.25; g.drawImage(a.frames[(P.frame + a.frames.length - 1) % a.frames.length], 0, 0); g.globalAlpha = 1; }
      g.drawImage(cur(), 0, 0);
      const f = P.float, layerHere = f && f.layers.find((l) => l.frame === P.frame);
      if (layerHere) g.drawImage(layerHere.img, f.x, f.y, f.w, f.h);
      if (P.shape) g.drawImage(P.shape, 0, 0);
      if (P.mirror) { g.save(); g.strokeStyle = 'rgba(255,79,109,0.6)'; g.setLineDash([8, 6]); g.beginPath(); g.moveTo(W() / 2, 0); g.lineTo(W() / 2, H()); g.stroke(); g.restore(); }
      const box = P.float || P.sel;
      if (box) {
        g.save(); g.lineWidth = 2; g.setLineDash([8, 5]); g.strokeStyle = '#2B2350'; g.strokeRect(box.x, box.y, box.w, box.h);
        g.strokeStyle = '#FFFFFF'; g.lineDashOffset = 6; g.strokeRect(box.x, box.y, box.w, box.h); g.restore();
        const hs = 14; g.fillStyle = '#FFFFFF'; g.strokeStyle = '#2B2350'; g.lineWidth = 2;
        g.fillRect(box.x + box.w - hs, box.y + box.h - hs, hs, hs); g.strokeRect(box.x + box.w - hs, box.y + box.h - hs, hs, hs);
      }
      body.querySelectorAll('canvas[data-thumb]').forEach((t) => {
        const tg = t.getContext('2d'); tg.clearRect(0, 0, t.width, t.height);
        const k = Math.min(t.width / W(), t.height / H());
        tg.drawImage(a.frames[+t.dataset.thumb], (t.width - W() * k) / 2, (t.height - H() * k) / 2, W() * k, H() * k);
      });
    }
    function startPreview() {
      clearInterval(P.timer);
      let i = 0;
      const tick = () => {
        if (!preview.isConnected) return clearInterval(P.timer);
        const a = P.art, g = preview.getContext('2d'), k = Math.min(preview.width / W(), preview.height / H());
        g.clearRect(0, 0, preview.width, preview.height);
        g.drawImage(a.frames[i % a.frames.length], (preview.width - W() * k) / 2, (preview.height - H() * k) / 2, W() * k, H() * k);
        i++;
      };
      tick();
      P.timer = setInterval(tick, 1000 / P.art.fps);
    }

    // ---------- changing the picture ----------
    function at(e) {
      const r = canvas.getBoundingClientRect();
      return {x: ((e.clientX - r.left) * W()) / r.width, y: ((e.clientY - r.top) * H()) / r.height};
    }
    function remember(frames = targets()) {
      P.undo.push(frames.map((i) => ({i, img: copyOf(P.art.frames[i])})).concat([{count: P.art.frames.length}]));
      if (P.undo.length > 25) P.undo.shift();
    }
    function undo() {
      P.float = null; P.sel = null;
      const u = P.undo.pop();
      if (u) {
        const count = u.pop().count;
        while (P.art.frames.length < count) P.art.frames.push(layer(W(), H()));
        P.art.frames.length = count;
        for (const {i, img} of u) P.art.frames[i] = img;
        P.frame = Math.min(P.frame, P.art.frames.length - 1);
        P.changed = true;
      }
      draw();
    }
    function stroke(g, a, b, color, erase, width = P.brush) {
      g.save();
      g.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
      g.strokeStyle = color; g.fillStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round';
      const seg = (p, q) => { g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x + 0.01, q.y); g.stroke(); };
      seg(a, b);
      if (P.mirror) seg({x: W() - a.x, y: a.y}, {x: W() - b.x, y: b.y});
      g.restore();
    }
    function shapeLayer(a, b) {
      const c = layer(W(), H()), g = c.getContext('2d');
      g.strokeStyle = P.color; g.fillStyle = P.color; g.lineWidth = P.brush; g.lineCap = 'round'; g.lineJoin = 'round';
      const one = (a, b) => {
        g.beginPath();
        if (P.tool === 'line') { g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); return; }
        if (P.tool === 'box') g.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
        else g.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
        P.filled ? g.fill() : g.stroke();
      };
      one(a, b);
      if (P.mirror) one({x: W() - a.x, y: a.y}, {x: W() - b.x, y: b.y});
      return c;
    }
    /** Paint-bucket fill: the touching area of (nearly) the same color. */
    function fill(x, y) { for (const i of targets()) fillFrame(P.art.frames[i], x, y); }
    function fillFrame(canvas, x, y) {
      const g = canvas.getContext('2d'), d = g.getImageData(0, 0, W(), H()), px = d.data;
      x = Math.floor(x); y = Math.floor(y);
      const at0 = (y * W() + x) * 4, t = [px[at0], px[at0 + 1], px[at0 + 2], px[at0 + 3]];
      const n = parseInt(P.color.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255, 255];
      if (t.every((v, k) => Math.abs(v - c[k]) < 4)) return;
      const near = (i) => Math.abs(px[i] - t[0]) + Math.abs(px[i + 1] - t[1]) + Math.abs(px[i + 2] - t[2]) + Math.abs(px[i + 3] - t[3]) < 96;
      const seen = new Uint8Array(W() * H()), stack = [x, y];
      while (stack.length) {
        const cy = stack.pop(), cx = stack.pop();
        if (cx < 0 || cy < 0 || cx >= W() || cy >= H()) continue;
        const k = cy * W() + cx;
        if (seen[k] || !near(k * 4)) continue;
        seen[k] = 1; px.set(c, k * 4);
        stack.push(cx + 1, cy, cx - 1, cy, cx, cy + 1, cx, cy - 1);
      }
      g.putImageData(d, 0, 0);
    }

    // ---------- selection, copy and paste ----------
    function lift() {
      if (P.float || !P.sel) return;
      const s = P.sel;
      remember();
      P.float = {...s, layers: targets().map((frame) => {
        const img = layer(s.w, s.h);
        img.getContext('2d').drawImage(P.art.frames[frame], s.x, s.y, s.w, s.h, 0, 0, s.w, s.h);
        P.art.frames[frame].getContext('2d').clearRect(s.x, s.y, s.w, s.h);
        return {frame, img};
      })};
    }
    function commit() {
      const f = P.float;
      if (!f) return;
      for (const l of f.layers) {
        if (l.frame >= MAX_FRAMES) continue;
        while (P.art.frames.length <= l.frame) P.art.frames.push(layer(W(), H()));
        P.art.frames[l.frame].getContext('2d').drawImage(l.img, f.x, f.y, f.w, f.h);
      }
      P.sel = {x: f.x, y: f.y, w: f.w, h: f.h};
      P.float = null; P.changed = true;
    }
    function letGo() { commit(); P.sel = null; }
    function grab(all) {
      const f = P.float;
      const s = f || P.sel || {x: 0, y: 0, w: W(), h: H()};
      const frames = f ? (all ? f.layers : [f.layers.find((l) => l.frame === P.frame) || f.layers[0]]).map((l) => l.img)
        : (all ? P.art.frames.map((_, i) => i) : [P.frame]).map((i) => { const c = layer(s.w, s.h); c.getContext('2d').drawImage(P.art.frames[i], s.x, s.y, s.w, s.h, 0, 0, s.w, s.h); return c; });
      return {x: s.x, y: s.y, w: s.w, h: s.h, frames: frames.map((c) => (c.width === s.w && c.height === s.h ? c : (() => { const d = layer(s.w, s.h); d.getContext('2d').drawImage(c, 0, 0, s.w, s.h); return d; })()).toDataURL('image/png'))};
    }
    function copy(all) {
      const c = grab(all);
      P.clip = c;
      const kept = store.set(CLIP_KEY, JSON.stringify(c));
      note((c.frames.length > 1 ? `Copied all ${c.frames.length} frames.` : `Copied from frame ${P.frame + 1}.`) + (kept ? ' Paste it here or in another sketch.' : ' (Too big to keep after a reload; paste it before you leave this tab.)'));
    }
    function cut() { copy(P.every); if (P.float) { P.float = null; P.sel = null; } else { remember(); clearArea(); } P.changed = true; draw(); }
    async function paste(everywhere) {
      let c = P.clip;
      try { c = JSON.parse(store.get(CLIP_KEY)) || c; } catch { /* the one in memory */ }
      if (!c) { note('Nothing copied yet: select something (or nothing, for the whole picture) and press Copy.'); return; }
      const imgs = await Promise.all(c.frames.map(loadImage));
      const pics = imgs.map((i) => { const cv = layer(c.w, c.h); cv.getContext('2d').drawImage(i, 0, 0); return cv; });
      commit();
      remember(P.art.frames.map((_, i) => i));
      const layers = everywhere ? P.art.frames.map((_, frame) => ({frame, img: copyOf(pics[0])}))
        : pics.map((img, i) => ({frame: P.frame + i, img})).filter((l) => l.frame < MAX_FRAMES);
      const x = P.sel ? P.sel.x : Math.min(c.x ?? 0, Math.max(0, W() - c.w)), y = P.sel ? P.sel.y : Math.min(c.y ?? 0, Math.max(0, H() - c.h));
      P.float = {x, y, w: c.w, h: c.h, layers};
      P.sel = null; P.tool = 'select'; P.changed = true;
      draw();
      note('Pasted. Drag it into place, or drag the corner square to make it bigger or smaller.');
    }
    function clearArea() {
      for (const i of targets()) { const g = P.art.frames[i].getContext('2d'); if (P.sel) g.clearRect(P.sel.x, P.sel.y, P.sel.w, P.sel.h); else g.clearRect(0, 0, W(), H()); }
    }
    function scaleBy(k) {
      if (!P.sel && !P.float) { note('Select something first (Select & move), then make it bigger or smaller.'); return; }
      lift(); P.float.w = Math.max(4, Math.round(P.float.w * k)); P.float.h = Math.max(4, Math.round(P.float.h * k)); drawCanvas();
    }
    function flip(dir) {
      const flipped = (c) => { const d = layer(c.width, c.height), g = d.getContext('2d'); g.translate(dir === 'h' ? c.width : 0, dir === 'v' ? c.height : 0); g.scale(dir === 'h' ? -1 : 1, dir === 'v' ? -1 : 1); g.drawImage(c, 0, 0); return d; };
      if (P.sel || P.float) { lift(); for (const l of P.float.layers) l.img = flipped(l.img); }
      else { remember(); for (const i of targets()) P.art.frames[i] = flipped(P.art.frames[i]); }
      P.changed = true; draw();
    }

    // ---------- uploading pictures (e.g. from Procreate) ----------
    /** Each picture becomes a frame, from the frame showing on (up to 8), fitted to the sketch's size. */
    async function upload(files) {
      const list = [...files].filter((f) => f.type.startsWith('image/'));
      if (!list.length) return;
      letGo();
      remember(P.art.frames.map((_, i) => i));
      for (const [k, file] of list.slice(0, MAX_FRAMES - P.frame).entries()) {
        const img = await loadImage(URL.createObjectURL(file));
        const c = layer(W(), H()), g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        const s = Math.min(W() / img.width, H() / img.height);
        g.drawImage(img, (W() - img.width * s) / 2, (H() - img.height * s) / 2, img.width * s, img.height * s);
        const at = P.frame + k;
        while (P.art.frames.length <= at) P.art.frames.push(layer(W(), H()));
        P.art.frames[at] = c;
      }
      P.changed = true;
      draw();
      note(`Uploaded ${Math.min(list.length, MAX_FRAMES - P.frame)} picture${list.length > 1 ? 's' : ''} as frames.`);
    }

    // ---------- pointer ----------
    const inside = (b, c) => c.x >= b.x && c.y >= b.y && c.x <= b.x + b.w && c.y <= b.y + b.h;
    canvas.addEventListener('pointerdown', (e) => {
      const c = at(e);
      e.preventDefault(); canvas.focus();
      try { canvas.setPointerCapture(e.pointerId); } catch { /* fine */ }
      const listen = (move, up) => {
        const end = (ev) => { canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', end); up(ev); };
        canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', end);
      };
      if (P.tool === 'pick') {
        const d = cur().getContext('2d').getImageData(Math.floor(c.x), Math.floor(c.y), 1, 1).data;
        if (d[3]) { P.color = '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase(); P.tool = 'pen'; draw(); }
        return;
      }
      if (P.tool === 'select') {
        const box = P.float || P.sel;
        if (box && c.x >= box.x + box.w - 18 && c.y >= box.y + box.h - 18 && inside(box, c)) {
          lift();
          const f = P.float, ratio = f.h / f.w;
          listen((ev) => { const d = at(ev); f.w = Math.max(4, d.x - f.x); f.h = ev.shiftKey ? f.w * ratio : Math.max(4, d.y - f.y); drawCanvas(); }, () => { P.changed = true; draw(); });
          return;
        }
        if (box && inside(box, c)) {
          lift();
          const off = {x: c.x - P.float.x, y: c.y - P.float.y};
          listen((ev) => { const d = at(ev); P.float.x = Math.round(d.x - off.x); P.float.y = Math.round(d.y - off.y); drawCanvas(); }, () => { P.changed = true; draw(); });
          return;
        }
        commit();
        P.sel = {x: Math.round(c.x), y: Math.round(c.y), w: 1, h: 1};
        listen((ev) => { const d = at(ev); P.sel = {x: Math.round(Math.min(c.x, d.x)), y: Math.round(Math.min(c.y, d.y)), w: Math.round(Math.abs(d.x - c.x)) || 1, h: Math.round(Math.abs(d.y - c.y)) || 1}; drawCanvas(); },
          () => { if (P.sel.w < 3 || P.sel.h < 3) P.sel = null; draw(); });
        return;
      }
      if (P.float || P.sel) letGo();
      remember(P.tool === 'fill' ? targets() : [P.frame]);
      P.changed = true;
      if (P.tool === 'fill') { fill(c.x, c.y); draw(); return; }
      if (SHAPES.includes(P.tool)) {
        P.shape = shapeLayer(c, c);
        listen((ev) => { P.shape = shapeLayer(c, at(ev)); drawCanvas(); }, () => { cur().getContext('2d').drawImage(P.shape, 0, 0); P.shape = null; draw(); });
        return;
      }
      const g = cur().getContext('2d'), erase = P.tool === 'erase';
      // Apple Pencil (or any pen): press harder for a thicker line.
      const width = (ev) => (ev.pointerType === 'pen' && ev.pressure > 0 ? P.brush * (0.3 + ev.pressure * 1.4) : P.brush);
      let last = c;
      stroke(g, c, c, P.color, erase, width(e)); drawCanvas();
      listen((ev) => {
        // Every point the Pencil reported since the last event, for smooth curves.
        const pts = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [];
        for (const pe of (pts.length ? pts : [ev])) { const d = at(pe); stroke(g, last, d, P.color, erase, width(pe)); last = d; }
        drawCanvas();
      }, () => draw());
    });

    const onKey = (e) => {
      if (!root.isConnected) return document.removeEventListener('keydown', onKey);
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
      const cmd = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
      if (cmd && k === 'z') { e.preventDefault(); undo(); }
      else if (cmd && k === 'c') { e.preventDefault(); copy(false); }
      else if (cmd && k === 'x') { e.preventDefault(); cut(); }
      else if (cmd && k === 'v') { e.preventDefault(); paste(false); }
      else if (cmd && k === 'a') { e.preventDefault(); commit(); P.sel = {x: 0, y: 0, w: W(), h: H()}; P.tool = 'select'; draw(); }
      else if ((k === 'delete' || k === 'backspace') && (P.sel || P.float)) { e.preventDefault(); if (P.float) P.float = null; else { remember(); clearArea(); } P.sel = null; P.changed = true; draw(); }
      else if (k === 'escape' || k === 'enter') { letGo(); draw(); }
      else if (k.startsWith('arrow') && (P.sel || P.float)) {
        e.preventDefault(); lift();
        const step = e.shiftKey ? 10 : 1;
        P.float.x += k === 'arrowleft' ? -step : k === 'arrowright' ? step : 0; P.float.y += k === 'arrowup' ? -step : k === 'arrowdown' ? step : 0;
        P.changed = true; drawCanvas();
      }
    };
    document.addEventListener('keydown', onKey);

    function note(text) { const n = body.querySelector('[data-note]'); if (n) n.textContent = text; }
    function markDirty() { const b = body.querySelector('[data-save]'); if (b) { b.disabled = !dirty(); b.textContent = dirty() ? 'Save' : 'Saved'; } }

    async function openSaved(s, asCopy) {
      const imgs = await Promise.all(s.urls.map(loadImage));
      P.art = {name: asCopy ? s.name + ' copy' : s.name, slug: asCopy ? undefined : s.slug, width: s.width, height: s.height, fps: s.fps,
        frames: imgs.map((i) => { const c = layer(s.width, s.height); c.getContext('2d').drawImage(i, 0, 0); return c; })};
      P.frame = 0; P.undo = []; P.sel = null; P.float = null; P.changed = !!asCopy;
      draw();
    }

    // ---------- the side panel ----------
    function draw() {
      const a = P.art;
      const btn = (text, onclick, attrs = {}) => h('button', {class: 'btn', text, onclick, ...attrs});
      const mine = P.list.filter((s) => s.kind === 'sketch');
      const startNew = () => {
        if (dirty() && !confirm('Leave this sketch without saving?')) return;
        P.art = fresh(a.width, a.height); P.frame = 0; P.undo = []; P.changed = false; draw();
      };
      const pick = window.SpriteGallery.build({items: mine, state: P.gal, current: a.slug, noun: 'sketch', onNew: startNew, onToggle: draw,
        onOpen: (s, copy) => { if (dirty() && !confirm('Leave this sketch without saving?')) return; P.gal.open = false; openSaved(s, copy); },
        onFavorite: async (slug, on) => {
          try { const d = await post('/api/sprite/favorite', {slug, on}); P.list = d.sprites; draw(); } catch (e) { alert('Couldn’t change the favorite: ' + e.message); }
        }});
      const size = h('select', {'aria-label': 'Size', disabled: !!a.slug || P.changed, onchange: (e) => { const [w, hgt] = e.target.value.split('x').map(Number); P.art = {...fresh(w, hgt), name: a.name, fps: a.fps}; P.frame = 0; draw(); }},
        SIZES.map(([w, hgt, label]) => h('option', {value: `${w}x${hgt}`, text: label, selected: a.width === w && a.height === hgt})));
      const name = h('input', {type: 'text', value: a.name, placeholder: 'Name (e.g. Saint Nicholas waving)', 'aria-label': 'Name', oninput: (e) => { a.name = e.target.value; P.changed = true; markDirty(); }});
      const tool = ([t, label]) => h('button', {'aria-pressed': P.tool === t ? 'true' : 'false', text: label, onclick: () => { if (t !== 'select') letGo(); P.tool = t; draw(); }});
      const colors = PALETTES[P.pal].colors;
      const swatch = (c) => h('button', {class: 'px-swatch' + (c.toUpperCase() === P.color.toUpperCase() ? ' on' : ''), style: {background: c}, 'aria-label': 'Color ' + c,
        onclick: () => { P.color = c; if (['erase', 'pick', 'select'].includes(P.tool)) P.tool = 'pen'; draw(); }});
      const paletteSel = h('select', {'aria-label': 'Colors', onchange: (e) => { P.pal = e.target.value; store.set('studio.pixelPalette', P.pal); draw(); }},
        Object.entries(PALETTES).map(([k, v]) => h('option', {value: k, text: v.label, selected: k === P.pal})));
      const custom = h('input', {type: 'color', value: P.color, 'aria-label': 'Any color', onchange: (e) => { P.color = e.target.value.toUpperCase(); if (['erase', 'pick', 'select'].includes(P.tool)) P.tool = 'pen'; draw(); }});
      const brushes = h('div', {class: 'seg', role: 'group', 'aria-label': 'Brush size'}, BRUSHES.map((b) => h('button', {'aria-pressed': P.brush === b ? 'true' : 'false', title: b + ' px', 'aria-label': 'Brush ' + b,
        onclick: () => { P.brush = b; store.set('studio.sketchBrush', String(b)); draw(); }}, [h('span', {class: 'sk-dot', style: {width: Math.min(24, Math.max(3, b * 0.6)) + 'px', height: Math.min(24, Math.max(3, b * 0.6)) + 'px'}})])));
      const frames = a.frames.map((_, i) => h('button', {class: 'px-frame' + (i === P.frame ? ' on' : ''), 'aria-label': 'Frame ' + (i + 1), onclick: () => { letGo(); P.frame = i; draw(); }},
        [h('canvas', {width: 64, height: 64, 'data-thumb': i}), h('span', {text: String(i + 1)})]));
      const save = async () => {
        if (!a.name.trim()) { alert('Give it a name first.'); return; }
        letGo();
        try {
          const d = await post('/api/sprite', {kind: 'sketch', name: a.name, width: a.width, height: a.height, fps: a.fps, frames: a.frames.map((c) => c.toDataURL('image/png'))});
          P.list = d.sprites; a.slug = d.slug; P.changed = false; draw();
        } catch (e) { alert('Couldn’t save it: ' + e.message); }
      };
      const remove = async () => {
        if (!confirm(`Delete "${a.name}"? It's kept in sprites/.deleted, so Claude can bring it back.`)) return;
        try { const d = await post('/api/sprite/delete', {slug: a.slug}); P.list = d.sprites; P.art = fresh(a.width, a.height); P.frame = 0; P.undo = []; P.changed = false; draw(); }
        catch (e) { alert('Couldn’t delete it: ' + e.message); }
      };
      const selecting = !!(P.sel || P.float);
      body.replaceChildren(...[
        pick,
        h('div', {class: 'row', style: {gap: '8px'}}, [size,
          h('label', {class: 'btn px-upload', title: 'Pictures from Procreate or anywhere: each becomes a frame (from this one on)'}, ['Upload pictures…',
            h('input', {type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: (e) => { upload(e.target.files); e.target.value = ''; }})])]),
        name,
        h('div', {class: 'seg px-tools', role: 'group', 'aria-label': 'Tool'}, TOOLS.map(tool)),
        h('div', {class: 'row', style: {gap: '8px', alignItems: 'center'}}, [h('span', {class: 'small muted', text: 'Brush size:'}), brushes]),
        SHAPES.includes(P.tool) && P.tool !== 'line' ? h('label', {class: 'small'}, [h('input', {type: 'checkbox', checked: P.filled || null, onchange: (e) => { P.filled = e.target.checked; }}), ' Filled']) : null,
        h('div', {class: 'row', style: {gap: '8px', alignItems: 'center'}}, [h('span', {class: 'small muted', text: 'Colors:'}), paletteSel]),
        h('div', {class: 'px-palette'}, [...colors.map(swatch), h('label', {class: 'px-any', title: 'Any color'}, [custom, h('span', {text: 'Any color'})])]),
        h('div', {class: 'row', style: {gap: '8px', flexWrap: 'wrap'}}, [
          btn('Undo', undo),
          btn('Copy', () => copy(false)), btn('Copy all frames', () => copy(true)), btn('Cut', cut),
          btn('Paste', () => paste(false)), btn('Paste in every frame', () => paste(true)),
          btn('Bigger ×2', () => scaleBy(2)), btn('Smaller ÷2', () => scaleBy(0.5)),
          btn('Flip ↔', () => flip('h')), btn('Flip ↕', () => flip('v')),
          h('label', {class: 'small'}, [h('input', {type: 'checkbox', checked: P.every || null, onchange: (e) => { P.every = e.target.checked; }}), ' Fill, move, cut, flip and clear in every frame']),
          btn('Clear this frame', () => { letGo(); remember([P.frame]); cur().getContext('2d').clearRect(0, 0, W(), H()); P.changed = true; draw(); }),
          h('button', {class: 'btn primary', 'data-save': '', disabled: !dirty(), text: dirty() ? 'Save' : 'Saved', onclick: save}),
          a.slug ? btn('Delete this sketch', remove) : null,
          selecting ? btn('Done moving', () => { letGo(); draw(); }) : null,
        ]),
        h('div', {class: 'small muted', 'data-note': '', text: selecting ? 'Drag inside the box to move it; drag its corner square to resize (Shift keeps the shape).' : 'Copy, Cut and Flip use the whole picture when nothing is selected.'}),
        h('div', {class: 'row', style: {gap: '14px'}}, [
          h('label', {class: 'small'}, [h('input', {type: 'checkbox', checked: P.mirror || null, onchange: (e) => { P.mirror = e.target.checked; drawCanvas(); }}), ' Mirror (draw both sides)']),
          h('label', {class: 'small'}, [h('input', {type: 'checkbox', checked: P.onion || null, onchange: (e) => { P.onion = e.target.checked; drawCanvas(); }}), ' Show the frame before, faintly']),
        ]),
        h('div', {class: 'small muted', text: 'Frames (2 to 8 make it move):'}),
        h('div', {class: 'px-frames'}, [...frames,
          a.frames.length < MAX_FRAMES ? btn('+ Copy this frame', () => { letGo(); remember(a.frames.map((_, i) => i)); a.frames.splice(P.frame + 1, 0, copyOf(cur())); P.frame++; P.changed = true; draw(); }) : null,
          a.frames.length > 1 ? btn('Delete this frame', () => { if (!confirm('Delete frame ' + (P.frame + 1) + '?')) return; letGo(); remember(a.frames.map((_, i) => i)); a.frames.splice(P.frame, 1); P.frame = Math.max(0, P.frame - 1); P.changed = true; draw(); }) : null]),
        h('div', {class: 'row', style: {gap: '14px', alignItems: 'center'}}, [preview,
          h('label', {class: 'tl-field'}, [h('span', {text: 'Speed: ' + a.fps + ' frames a second'}),
            h('input', {type: 'range', min: 1, max: 12, value: a.fps, oninput: (e) => { a.fps = +e.target.value; e.target.previousSibling.textContent = 'Speed: ' + a.fps + ' frames a second'; P.changed = true; startPreview(); markDirty(); }})])]),
        h('div', {class: 'small muted', text: 'Saved sketches go in a lesson like pixel art: Timing tab, + Add a picture here → Pixel animation.'}),
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
