// Town tab: she lays out a town for a PICO-8 game herself. Paint the ground with her 8 × 8 tiles,
// set down buildings, trees and other drawings (they snap to the squares), place people and write
// what they say, mark doors and where you can't walk, pick the start spot. Saved to
// towns/<name>.yml; "Make the game" writes it into a PICO-8 cart (scripts/town.mjs).
'use strict';
window.TownTab = (() => {
  const CELL = 8;
  const CODES = '0123456789abcdefghijklmnopqrstuvwxyz';
  const TILE_CHARS = 'gGtThrwfcabdeijklmnopqsuvxyzABCDEFHIJKLMNOPQRSUVWXYZ0123456789';
  const POSES = /-(idle|idle-front|walk|run|point|look-up|talk|pray|cross|bow|blessing|kneel|gallop|ride|attack|fall)$/;
  const NO_WALK = /river|water|sea|lake|tree|forest|wall|hill|rock|fence/;

  function h(tag, attrs, kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k.startsWith('aria-') && typeof v === 'boolean') { e.setAttribute(k, String(v)); continue; }
      if (v == null || v === false) continue;
      if (k === 'text') e.textContent = v;
      else if (k === 'class') e.className = v;
      else if (k === 'style') Object.assign(e.style, v);
      else if (k === 'value') e.value = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of [].concat(kids || [])) if (c != null && c !== false) e.append(c);
    return e;
  }

  function open(root, api, post) {
    const T = {
      names: [], name: null, town: null, sprites: {}, dirty: false, msg: '', error: '',
      tool: 'paint', tile: null, thing: null, person: null, sel: null, // sel: {type: 'thing' | 'person', i}
      zoom: Number(localStorage.getItem('townZoom')) || 2, showSolid: false, hover: null,
      check: null, undo: [], canvas: null, pickState: {q: ''}, peopleState: {q: ''}, made: '',
    };
    const Z = () => T.zoom;

    // ---------- drawings ----------
    const cache = new Map();
    const art = (name) => { const a = T.sprites[name]; return a && a.kind !== 'sketch' && Array.isArray(a.frames) && a.frames.length ? a : null; };
    function spriteCanvas(name) {
      const a = art(name);
      if (!a) return null;
      if (cache.has(name)) return cache.get(name);
      const c = document.createElement('canvas');
      c.width = a.width; c.height = a.height;
      const ctx = c.getContext('2d');
      a.frames[0].forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== '.') { ctx.fillStyle = a.palette[CODES.indexOf(row[x])]; ctx.fillRect(x, y, 1, 1); } });
      cache.set(name, c);
      return c;
    }
    const tileNames = () => Object.keys(T.sprites).filter((n) => n.startsWith('tile-') && art(n) && art(n).width === 8 && art(n).height === 8).sort();
    const isPose = (n) => POSES.test(n) && !!T.sprites[n.replace(POSES, '') + '-idle'];
    const thingItems = () => Object.values(T.sprites).filter((s) => art(s.slug) && s.kind !== 'comic' && !s.slug.startsWith('tile-') && !isPose(s.slug));
    const personItems = () => Object.values(T.sprites).filter((s) => art(s.slug) && s.slug.endsWith('-idle')).map((s) => ({...s, name: s.name.replace(/[- ]idle$/i, '')}));
    const cellsOf = (a) => [Math.ceil(a.width / 8), Math.ceil(a.height / 8)];
    const thingArt = (o) => art(o.sprite);
    const personArt = (p) => art(p.sprite + '-idle');

    // ---------- loading and saving ----------
    async function loadList() { T.names = await api('/api/towns'); }
    async function loadSprites() { const list = await api('/api/sprites'); T.sprites = Object.fromEntries(list.map((s) => [s.slug, s])); cache.clear(); }
    async function load(name) {
      T.name = name; T.error = ''; T.msg = ''; T.made = '';
      try { localStorage.setItem('townName', name); T.town = (await api('/api/town?name=' + encodeURIComponent(name))).town; }
      catch (e) { T.error = e.message; T.town = null; }
      T.sel = null; T.dirty = false; T.undo = []; T.tile = null; T.check = null;
      draw();
      checkSoon(0);
      requestAnimationFrame(() => { if (T.town && R.scroll) { R.scroll.scrollLeft = (T.town.start[0] + .5) * CELL * Z() - R.scroll.clientWidth / 2; R.scroll.scrollTop = (T.town.start[1] + .5) * CELL * Z() - R.scroll.clientHeight / 2; } });
    }
    async function save() {
      try {
        T.msg = 'Saving…'; renderNotice();
        await post('/api/town', {name: T.name, town: T.town});
        T.dirty = false; T.msg = 'Saved.'; T.error = '';
        await loadList();
      } catch (e) { T.error = e.message; T.msg = ''; }
      renderBar(); renderNotice(); renderMake();
      return !T.error;
    }
    /** Remember the town as it is, before a change (for Undo). */
    function snap() { T.undo.push(JSON.stringify(T.town)); if (T.undo.length > 60) T.undo.shift(); }
    function undo() {
      if (!T.undo.length) return;
      T.town = JSON.parse(T.undo.pop()); T.sel = null;
      touch(); draw();
    }
    function touch() { T.dirty = true; T.msg = ''; T.made = ''; checkSoon(); }
    let checkTimer = null;
    /** Ask the server what fits and where you can't walk (the same code that makes the game). */
    function checkSoon(ms = 300) {
      clearTimeout(checkTimer);
      checkTimer = setTimeout(async () => {
        if (!T.town) return;
        try { T.check = await post('/api/town/check', {town: T.town}); } catch (e) { T.check = {error: e.message}; }
        renderMake(); if (T.showSolid) drawMap();
      }, ms);
    }

    // ---------- the map ----------
    const mapW = () => T.town.size[0], mapH = () => T.town.size[1];
    function charOf(tileName) {
      const t = T.town.tiles;
      for (const [c, n] of Object.entries(t)) if (n === tileName) return c;
      const free = [...TILE_CHARS].find((c) => !t[c]);
      if (!free) return null;
      t[free] = tileName;
      if (NO_WALK.test(tileName)) T.town.blocked.push(free);
      return free;
    }
    function setCell(x, y, ch) {
      const rows = T.town.map;
      if (y < 0 || y >= mapH() || x < 0 || x >= mapW() || rows[y][x] === ch) return false;
      rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1);
      return true;
    }
    function fill(x, y, ch) {
      const rows = T.town.map.map((r) => [...r]);
      const from = rows[y]?.[x];
      if (from == null || from === ch) return false;
      const todo = [[x, y]];
      while (todo.length) {
        const [cx, cy] = todo.pop();
        if (cx < 0 || cy < 0 || cx >= mapW() || cy >= mapH() || rows[cy][cx] !== from) continue;
        rows[cy][cx] = ch;
        todo.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
      T.town.map = rows.map((r) => r.join(''));
      return true;
    }
    // Boxes in world pixels. A thing's place is its top-left square; a person stands on their square.
    const thingBox = (o) => { const a = thingArt(o); const [cw, ch] = a ? cellsOf(a) : [1, 1]; const w = a ? a.width : 8, hh = a ? a.height : 8; return {x: o.at[0] * CELL, y: (o.at[1] + ch) * CELL - hh, w, h: hh, cw, ch}; };
    const personBox = (p) => { const a = personArt(p); const w = a ? a.width : 8, hh = a ? a.height : 8; return {x: p.at[0] * CELL, y: (p.at[1] + 1) * CELL - hh, w, h: hh}; };
    const boxOf = (s) => (s.type === 'thing' ? thingBox(T.town.things[s.i]) : personBox(T.town.people[s.i]));
    const selected = () => (T.sel && T.town ? (T.sel.type === 'thing' ? T.town.things[T.sel.i] : T.town.people[T.sel.i]) : null);
    const inside = (b, x, y) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
    function hitAt(wx, wy) {
      // the one in front first: people, then the thing whose bottom is lowest
      const ps = T.town.people;
      for (let i = ps.length - 1; i >= 0; i--) if (inside(personBox(ps[i]), wx, wy)) return {type: 'person', i};
      let best = null, by = -1;
      T.town.things.forEach((o, i) => { const b = thingBox(o); if (inside(b, wx, wy) && b.y + b.h >= by) { by = b.y + b.h; best = {type: 'thing', i}; } });
      return best;
    }
    const clampAt = (x, y) => [Math.max(0, Math.min(mapW() - 1, x)), Math.max(0, Math.min(mapH() - 1, y))];
    /** Where a new thing goes: its bottom middle on the square under the pointer. */
    const thingAt = (name, cx, cy) => { const a = art(name); const [cw, ch] = a ? cellsOf(a) : [1, 1]; return clampAt(Math.min(cx - (cw >> 1), mapW() - cw), Math.min(cy - ch + 1, mapH() - ch)); };
    const defaultBlock = (name) => { const a = art(name); return /^tree/.test(name) ? 'trunk' : a && a.width <= 8 && a.height <= 8 && !/bush|rock|fence|wall|stone/.test(name) ? 'none' : 'all'; };

    function drawMap() {
      const cv = T.canvas, t = T.town;
      if (!cv || !t) return;
      const z = Z(), w = mapW(), hh = mapH();
      if (cv.width !== w * CELL * z || cv.height !== hh * CELL * z) { cv.width = w * CELL * z; cv.height = hh * CELL * z; cv.style.width = cv.width + 'px'; cv.style.height = cv.height + 'px'; }
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#008751';
      ctx.fillRect(0, 0, cv.width, cv.height);
      const put = (name, x, y, alpha) => {
        const c = spriteCanvas(name);
        if (alpha) ctx.globalAlpha = alpha;
        if (!c) { ctx.fillStyle = 'rgba(255,0,77,.7)'; ctx.fillRect(x * z, y * z, CELL * z, CELL * z); }
        else ctx.drawImage(c, x * z, y * z, c.width * z, c.height * z);
        ctx.globalAlpha = 1;
      };
      for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const n = t.tiles[t.map[y][x]]; if (n) put(n, x * CELL, y * CELL); }
      // faint grid
      ctx.strokeStyle = 'rgba(0,0,0,.1)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = 0; x <= w; x++) { ctx.moveTo(x * CELL * z + .5, 0); ctx.lineTo(x * CELL * z + .5, cv.height); }
      for (let y = 0; y <= hh; y++) { ctx.moveTo(0, y * CELL * z + .5); ctx.lineTo(cv.width, y * CELL * z + .5); }
      ctx.stroke();
      // everything standing up, the ones further back first (as the game draws them)
      const items = [...t.things.map((o) => ({b: thingBox(o), name: o.sprite})), ...t.people.map((p) => ({b: personBox(p), name: p.sprite + '-idle'}))];
      if (t.player) { const a = art(t.player + '-idle'); items.push({b: {x: t.start[0] * CELL, y: (t.start[1] + 1) * CELL - (a ? a.height : 8), h: a ? a.height : 8}, name: t.player + '-idle'}); }
      items.sort((a, b) => a.b.y + a.b.h - (b.b.y + b.b.h));
      for (const it of items) put(it.name, it.b.x, it.b.y);
      // where you can't walk
      const solid = T.showSolid && T.check && T.check.solid;
      if (solid) { ctx.fillStyle = 'rgba(255,0,77,.42)'; solid.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === '1') ctx.fillRect(x * CELL * z, y * CELL * z, CELL * z, CELL * z); }); }
      // doors: the door square, and an arrow on the square you stand on
      t.things.forEach((o) => {
        if (o.door == null) return;
        const b = thingBox(o), dx = (o.at[0] + Math.min(o.door, b.cw - 1)) * CELL * z, dy = (o.at[1] + b.ch - 1) * CELL * z;
        ctx.strokeStyle = '#ffec27'; ctx.lineWidth = 2; ctx.strokeRect(dx + 1, dy + 1, CELL * z - 2, CELL * z - 2);
        ctx.fillStyle = '#ffec27'; ctx.beginPath(); ctx.moveTo(dx + CELL * z / 2, dy + CELL * z + 2); ctx.lineTo(dx + CELL * z * .2, dy + CELL * z * 1.6); ctx.lineTo(dx + CELL * z * .8, dy + CELL * z * 1.6); ctx.fill();
      });
      // the start spot
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
      ctx.strokeRect(t.start[0] * CELL * z + 1, t.start[1] * CELL * z + 1, CELL * z - 2, CELL * z - 2);
      ctx.setLineDash([]);
      if (T.sel && selected()) { const b = boxOf(T.sel); ctx.strokeStyle = '#ff004d'; ctx.lineWidth = 3; ctx.strokeRect(b.x * z - 1, b.y * z - 1, b.w * z + 2, b.h * z + 2); }
      // what the next click will put down
      const hv = T.hover;
      if (hv && !drag) {
        if (T.tool === 'thing' && T.thing) { const at = thingAt(T.thing, hv.cx, hv.cy), b = thingBox({sprite: T.thing, at}); put(T.thing, b.x, b.y, .6); }
        else if (T.tool === 'person' && T.person) { const b = personBox({sprite: T.person, at: [hv.cx, hv.cy]}); put(T.person + '-idle', b.x, b.y, .6); }
        else if ((T.tool === 'paint' || T.tool === 'fill') && T.tile) put(T.tile, hv.cx * CELL, hv.cy * CELL, .7);
        else if (T.tool === 'start') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(hv.cx * CELL * z + 1, hv.cy * CELL * z + 1, CELL * z - 2, CELL * z - 2); }
      }
    }
    let queued = false;
    function mapSoon() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; drawMap(); }); }

    function worldAt(e) {
      const r = T.canvas.getBoundingClientRect();
      const wx = ((e.clientX - r.left) / r.width) * mapW() * CELL, wy = ((e.clientY - r.top) / r.height) * mapH() * CELL;
      return {wx, wy, cx: Math.max(0, Math.min(mapW() - 1, Math.floor(wx / CELL))), cy: Math.max(0, Math.min(mapH() - 1, Math.floor(wy / CELL)))};
    }
    let drag = null;
    function onDown(e) {
      const t = T.town;
      if (!t || e.button > 0) return;
      e.preventDefault();
      const p = worldAt(e);
      T.error = '';
      if (T.tool === 'paint' || T.tool === 'fill') {
        if (e.altKey) { const n = t.tiles[t.map[p.cy][p.cx]]; if (n) { T.tile = n; renderTools(); } return; } // Option-click: pick up the tile here
        if (!T.tile) { T.error = 'Pick a ground tile first.'; renderNotice(); return; }
        snap();
        const ch = charOf(T.tile);
        if (!ch) { T.undo.pop(); T.error = 'This town already uses as many different tiles as it can.'; renderNotice(); return; }
        if (T.tool === 'fill') { if (fill(p.cx, p.cy, ch)) touch(); else T.undo.pop(); }
        else { drag = {kind: 'paint', ch, changed: setCell(p.cx, p.cy, ch)}; if (drag.changed) touch(); }
        drawMap(); renderBar();
      } else if (T.tool === 'thing') {
        if (!T.thing) { T.error = 'Pick a drawing to put down first.'; renderNotice(); return; }
        snap();
        t.things.push({sprite: T.thing, at: thingAt(T.thing, p.cx, p.cy), block: defaultBlock(T.thing)});
        T.sel = {type: 'thing', i: t.things.length - 1};
        touch(); draw();
      } else if (T.tool === 'person') {
        if (!T.person) { T.error = 'Pick who to put down first.'; renderNotice(); return; }
        snap();
        t.people.push({sprite: T.person, at: [p.cx, p.cy], name: '', job: '', says: ''});
        T.sel = {type: 'person', i: t.people.length - 1};
        touch(); draw();
      } else if (T.tool === 'move') {
        const hit = hitAt(p.wx, p.wy);
        T.sel = hit;
        if (hit) { const o = selected(); drag = {kind: 'move', hit, dx: p.cx - o.at[0], dy: p.cy - o.at[1], snapped: false}; }
        draw();
      } else if (T.tool === 'start') {
        snap(); t.start = [p.cx, p.cy]; touch(); draw();
      }
      window.addEventListener('pointerup', onUp, {once: true});
    }
    function onMove(e) {
      if (!T.town) return;
      const p = worldAt(e);
      if (!T.hover || T.hover.cx !== p.cx || T.hover.cy !== p.cy) { T.hover = {cx: p.cx, cy: p.cy}; mapSoon(); if (R.where) R.where.textContent = 'Square ' + p.cx + ', ' + p.cy; }
      if (!drag) return;
      if (drag.kind === 'paint') { if (setCell(p.cx, p.cy, drag.ch)) { drag.changed = true; touch(); mapSoon(); } }
      else if (drag.kind === 'move') {
        const o = selected();
        const at = clampAt(p.cx - drag.dx, p.cy - drag.dy);
        if (o && (o.at[0] !== at[0] || o.at[1] !== at[1])) { if (!drag.snapped) { snap(); drag.snapped = true; } o.at = at; touch(); mapSoon(); }
      }
    }
    function onUp() {
      if (!drag) return;
      if (drag.kind === 'paint' && !drag.changed) T.undo.pop();
      const moved = drag.kind === 'move' && drag.snapped;
      drag = null;
      renderBar(); if (moved) renderSelection();
    }
    function removeSel() {
      if (!selected()) return;
      snap();
      (T.sel.type === 'thing' ? T.town.things : T.town.people).splice(T.sel.i, 1);
      T.sel = null;
      touch(); draw();
    }
    function onKey(e) {
      if (!root.isConnected || !T.town || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const o = selected();
      if (o && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); removeSel(); return; }
      const step = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[e.key];
      if (o && step) { e.preventDefault(); snap(); o.at = clampAt(o.at[0] + step[0], o.at[1] + step[1]); touch(); drawMap(); renderSelection(); renderBar(); }
    }

    // ---------- the page ----------
    const R = {};
    function skeleton() {
      const card = (title, kids) => h('section', {class: 'card'}, [title ? h('h2', {text: title}) : null, ...[].concat(kids)]);
      R.bar = h('div', {class: 'row', style: {justifyContent: 'flex-start', gap: '10px'}});
      R.notice = h('div');
      R.tools = h('div', {class: 'stack', style: {gap: '10px'}});
      T.canvas = h('canvas', {style: {imageRendering: 'pixelated', cursor: 'crosshair', touchAction: 'none', display: 'block'}});
      T.canvas.addEventListener('pointerdown', onDown);
      T.canvas.addEventListener('pointermove', onMove);
      T.canvas.addEventListener('pointerleave', () => { T.hover = null; mapSoon(); });
      R.scroll = h('div', {style: {overflow: 'auto', maxHeight: '72vh', borderRadius: '8px', border: '1px solid var(--rule)', background: '#1d2b53'}}, [T.canvas]);
      R.under = h('div', {class: 'row', style: {justifyContent: 'flex-start', gap: '10px'}});
      R.selection = h('div');
      R.make = h('div', {class: 'stack', style: {gap: '10px'}});
      R.body = h('div', {class: 'stack'}, [card('The town', [R.tools, R.scroll, R.under, R.selection]), card('Make the game', [R.make])]);
      root.replaceChildren(h('div', {class: 'stack'}, [R.bar, R.notice, R.body]));
      document.addEventListener('keydown', onKey);
    }
    function draw() {
      if (!R.bar) skeleton();
      R.body.style.display = T.town ? '' : 'none';
      renderBar(); renderNotice(); renderTools(); renderUnder(); renderSelection(); renderMake();
      drawMap();
    }
    function renderNotice() {
      R.notice.replaceChildren(...(T.error ? [h('div', {class: 'notice error', role: 'alert', text: T.error})] : T.msg ? [h('div', {class: 'notice', role: 'status', text: T.msg})]
        : !T.town ? [h('div', {class: 'notice', text: T.names.length ? 'Pick a town.' : 'No towns yet. Start one with + New town: you get 64 × 64 squares of grass to build on.'})] : []));
    }
    function renderBar() {
      const sel = T.names.length ? h('select', {'aria-label': 'Town', onchange: async (e) => {
        if (T.dirty && !(await window.ask('This town has changes that aren’t saved. Leave them?'))) { e.target.value = T.name; return; }
        load(e.target.value);
      }}, T.names.map((n) => h('option', {value: n.name, text: n.title, selected: n.name === T.name}))) : null;
      const title = T.town ? h('input', {type: 'text', value: T.town.title || '', placeholder: 'The town’s name', 'aria-label': 'The town’s name', style: {minWidth: '14em'},
        onchange: (e) => { snap(); T.town.title = e.target.value; touch(); renderBar(); }}) : null;
      const newBtn = h('button', {class: 'btn', text: '+ New town', onclick: async () => {
        if (T.dirty && !(await window.ask('This town has changes that aren’t saved. Leave them?'))) return;
        const nameIn = h('input', {type: 'text', placeholder: 'Its name, e.g. San Pico', 'aria-label': 'New town’s name'});
        const go = async () => {
          try { const r = await post('/api/town/new', {name: nameIn.value, title: nameIn.value}); await loadList(); await load(r.name); }
          catch (e) { T.error = e.message; renderNotice(); }
        };
        newBtn.replaceWith(nameIn, h('button', {class: 'btn primary', text: 'Create', onclick: go}));
        nameIn.focus();
        nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      }});
      R.bar.replaceChildren(...[sel, title, newBtn,
        T.town && h('button', {class: 'btn primary', text: 'Save', disabled: !T.dirty, onclick: save}),
        T.town && h('button', {class: 'btn', text: 'Undo', title: '⌘Z', disabled: !T.undo.length, onclick: undo}),
        h('button', {class: 'btn', text: 'Refresh drawings', title: 'After drawing on the Pixel art tab', onclick: async () => { await loadSprites(); draw(); checkSoon(0); }}),
        T.town && h('span', {class: 'small muted', text: T.dirty ? 'Not saved yet' : 'Saved'})].filter(Boolean));
    }

    const TOOLS = [['paint', 'Paint the ground'], ['fill', 'Fill'], ['thing', 'Put down a building or thing'], ['person', 'Put down a person'], ['move', 'Move / change'], ['start', 'Start spot']];
    function renderTools() {
      const t = T.town;
      if (!t) { R.tools.replaceChildren(); return; }
      const seg = h('div', {class: 'seg', role: 'group', 'aria-label': 'Tool'}, TOOLS.map(([k, label]) =>
        h('button', {text: label, 'aria-pressed': T.tool === k, onclick: () => { T.tool = k; renderTools(); drawMap(); }})));
      const hint = (text) => h('span', {class: 'small muted', text});
      let palette;
      if (T.tool === 'paint' || T.tool === 'fill') {
        const tiles = tileNames();
        if (!T.tile || !tiles.includes(T.tile)) T.tile = tiles.find((n) => Object.values(t.tiles).includes(n)) || tiles[0] || null;
        const chOf = (n) => Object.keys(t.tiles).find((c) => t.tiles[c] === n);
        const isBlocked = (n) => { const c = chOf(n); return c ? t.blocked.includes(c) : NO_WALK.test(n); };
        const row = h('div', {class: 'row', style: {justifyContent: 'flex-start', gap: '6px'}}, tiles.map((n) => {
          const c = spriteCanvas(n);
          const cv = h('canvas', {width: 8, height: 8, style: {width: '36px', height: '36px', imageRendering: 'pixelated', display: 'block'}});
          if (c) cv.getContext('2d').drawImage(c, 0, 0);
          return h('button', {class: 'btn', title: n.slice(5) + (isBlocked(n) ? ' (can’t walk on it)' : ''), 'aria-pressed': T.tile === n,
            style: {padding: '4px', outline: T.tile === n ? '3px solid var(--accent)' : 'none', position: 'relative'}, onclick: () => { T.tile = n; renderTools(); }},
          [cv, isBlocked(n) ? h('span', {text: '✕', style: {position: 'absolute', right: '1px', top: '-3px', fontSize: '11px', color: '#ff004d', fontWeight: '700'}}) : null]);
        }));
        const block = T.tile ? h('label', {class: 'small'}, [h('input', {type: 'checkbox', checked: isBlocked(T.tile), onchange: (e) => {
          snap();
          const c = charOf(T.tile);
          t.blocked = t.blocked.filter((x) => x !== c);
          if (e.target.checked) t.blocked.push(c);
          touch(); renderTools(); renderBar();
        }}), ' You can’t walk on ' + T.tile.slice(5) + ' (red ✕)']) : null;
        palette = tiles.length ? h('div', {class: 'stack', style: {gap: '6px'}}, [row, h('div', {class: 'row', style: {justifyContent: 'flex-start', gap: '14px'}}, [block,
          hint(T.tool === 'fill' ? 'Click a patch of ground to change all of it.' : 'Drag to paint. Option-click picks up the tile under the pointer.')])])
          : hint('No ground tiles yet: draw 8 × 8 drawings named tile-grass, tile-road… on the Pixel art tab.');
      } else if (T.tool === 'thing') {
        palette = h('div', {class: 'stack', style: {gap: '6px'}}, [
          hint(T.thing ? 'Putting down: ' + T.thing + '. Click the map (it snaps to the squares); click again for another.' : 'Pick a drawing, then click the map.'),
          h('details', {open: !T.thing || T.thingOpen ? true : null, ontoggle: (e) => { T.thingOpen = e.target.open; }}, [h('summary', {class: 'small', text: 'Your drawings'}),
            window.SpriteGallery.picker({items: thingItems(), state: T.pickState, onPick: (s) => { T.thing = s.slug; T.thingOpen = false; renderTools(); }})])]);
      } else if (T.tool === 'person') {
        palette = h('div', {class: 'stack', style: {gap: '6px'}}, [
          hint(T.person ? 'Putting down: ' + T.person + '. Click the map, then write their name and what they say underneath.' : 'Pick a character, then click the map.'),
          h('details', {open: !T.person || T.personOpen ? true : null, ontoggle: (e) => { T.personOpen = e.target.open; }}, [h('summary', {class: 'small', text: 'Your characters'}),
            window.SpriteGallery.picker({items: personItems(), noun: 'character', state: T.peopleState, onPick: (s) => { T.person = s.slug.slice(0, -5); T.personOpen = false; renderTools(); }})])]);
      } else if (T.tool === 'move') palette = hint('Click a building, thing or person to change it; drag to move it (or the arrow keys). Delete removes it.');
      else {
        const who = personItems().map((s) => s.slug.slice(0, -5)).sort();
        palette = h('div', {class: 'row', style: {justifyContent: 'flex-start', gap: '10px'}}, [
          h('label', {class: 'small'}, ['You play as ', h('select', {onchange: (e) => { snap(); t.player = e.target.value; touch(); draw(); }},
            [h('option', {value: '', text: 'Pick…', selected: !t.player}), ...who.map((k) => h('option', {value: k, text: k + (art(k + '-walk') ? '' : ' (no walk drawing)'), selected: k === t.player}))])]),
          hint('Click the square where the game begins (the dashed white box).')]);
      }
      R.tools.replaceChildren(seg, palette);
    }
    function renderUnder() {
      if (!T.town) { R.under.replaceChildren(); return; }
      R.where = h('span', {class: 'small muted', style: {minWidth: '8em', fontVariantNumeric: 'tabular-nums'}});
      R.under.replaceChildren(
        h('span', {class: 'small muted', text: 'Size'}),
        h('div', {class: 'seg', role: 'group', 'aria-label': 'Zoom'}, [1, 2, 3, 4].map((z) => h('button', {text: z + '×', 'aria-pressed': T.zoom === z, onclick: () => {
          const s = R.scroll, fx = (s.scrollLeft + s.clientWidth / 2) / T.zoom, fy = (s.scrollTop + s.clientHeight / 2) / T.zoom;
          T.zoom = z; localStorage.setItem('townZoom', z); drawMap(); renderUnder();
          s.scrollLeft = fx * z - s.clientWidth / 2; s.scrollTop = fy * z - s.clientHeight / 2;
        }}))),
        h('label', {class: 'small'}, [h('input', {type: 'checkbox', checked: T.showSolid, onchange: (e) => { T.showSolid = e.target.checked; drawMap(); }}), ' Show where you can’t walk (red)']),
        R.where,
        h('span', {class: 'small muted', text: T.town.things.length + ' buildings and things · ' + T.town.people.length + ' people · yellow marks a door'}));
    }

    function renderSelection() {
      const t = T.town, s = T.sel, o = selected();
      if (!t || !o) { R.selection.replaceChildren(); return; }
      const field = (label, input, grow) => h('label', {class: 'small muted', style: {display: 'flex', flexDirection: 'column', gap: '2px', flex: grow ? '1 1 20em' : null}}, [label, input]);
      const text = (key, max, placeholder, width) => h('input', {type: 'text', value: o[key] || '', maxlength: max, placeholder, style: {width},
        onchange: (e) => { snap(); const v = e.target.value.trim(); if (v || s.type === 'person') o[key] = v; else delete o[key]; touch(); renderBar(); }});
      let kids;
      if (s.type === 'thing') {
        const b = thingBox(o);
        kids = [
          h('strong', {text: o.sprite, style: {alignSelf: 'center'}}),
          field('You can’t walk through', h('select', {onchange: (e) => { snap(); o.block = e.target.value; touch(); renderBar(); }},
            [['all', 'Any of it'], ['base', 'Its bottom row (walk behind the top)'], ['trunk', 'The middle of its bottom (a tree trunk)'], ['none', 'Nothing: walk right over it']]
              .map(([v, label]) => h('option', {value: v, text: label, selected: o.block === v})))),
          field('Door', h('select', {onchange: (e) => { snap(); if (e.target.value === '') delete o.door; else o.door = Number(e.target.value); touch(); drawMap(); renderBar(); }},
            [h('option', {value: '', text: 'No door', selected: o.door == null}), ...Array.from({length: b.cw}, (_, i) => h('option', {value: i, text: 'Square ' + (i + 1) + ' from the left', selected: o.door === i}))])),
          field('Name of the place (shown at its door)', text('name', 30, 'e.g. St. Pico’s Church', '16em')),
        ];
      } else {
        const says = h('textarea', {rows: 3, maxlength: 600, placeholder: 'What they say when you talk to them (your words)', style: {width: '100%'},
          onchange: (e) => { snap(); o.says = e.target.value.trim(); touch(); renderBar(); }});
        says.value = o.says || '';
        kids = [
          h('strong', {text: o.sprite, style: {alignSelf: 'center'}}),
          field('Name', text('name', 24, 'e.g. Fr. Pico', '10em')),
          field('Job', text('job', 30, 'e.g. Pastor', '10em')),
          field('What they say (the game shows it in capitals, three lines at a time)', says, true),
        ];
      }
      kids.push(h('button', {class: 'btn', text: 'Remove', style: {alignSelf: 'flex-end'}, onclick: removeSel}));
      R.selection.replaceChildren(h('div', {class: 'row', style: {justifyContent: 'flex-start', gap: '12px', alignItems: 'flex-end', padding: '10px', border: '1px solid var(--rule)', borderRadius: '8px'}}, kids));
    }

    function renderMake() {
      const t = T.town, c = T.check;
      if (!t) { R.make.replaceChildren(); return; }
      const kids = [];
      if (c && c.error) kids.push(h('div', {class: 'notice error', text: c.error}));
      else if (c && c.budget) {
        const b = c.budget, extra = b.extra[0] + b.extra[1];
        const meter = (label, n, of, note) => h('div', {style: {flex: '1 1 16em'}}, [
          h('div', {class: 'small', text: label + ': ' + n.toLocaleString() + ' of ' + of.toLocaleString() + (note ? ' · ' + note : '')}),
          h('div', {style: {height: '8px', borderRadius: '4px', background: 'var(--rule)', overflow: 'hidden'}}, [h('div', {style: {height: '100%', width: Math.min(100, (n / of) * 100) + '%', background: n / of > .9 ? '#ff004d' : 'var(--accent)'}})])]);
        kids.push(h('div', {class: 'row', style: {justifyContent: 'flex-start', gap: '18px', alignItems: 'flex-start'}}, [
          meter('Room for drawings', b.slots, b.of, 'squares on the game’s sprite sheet'),
          meter('Overflow', extra, 512, extra ? 'big drawings that didn’t fit, kept another way' : 'nothing spilled over'),
          meter('The town’s words and data', b.letters, b.lettersOf, 'letters')]));
        for (const p of b.problems) kids.push(h('div', {class: 'notice error', role: 'alert', text: p}));
        if (b.warnings.length) kids.push(h('div', {class: 'small muted', text: b.warnings.slice(0, 4).join(' ') + (b.warnings.length > 4 ? ' (and ' + (b.warnings.length - 4) + ' more)' : '')}));
      } else kids.push(h('div', {class: 'small muted', text: 'Checking what fits…'}));
      const bad = !c || !!c.error || !!(c.budget && c.budget.problems.length);
      const run = async (url, doing) => {
        if (T.dirty && !(await save())) return;
        T.made = doing; renderMake();
        try { const r = await post(url, {name: T.name}); T.made = r.message; } catch (e) { T.made = ''; T.error = e.message; renderNotice(); }
        renderMake();
      };
      kids.push(h('div', {class: 'row', style: {justifyContent: 'flex-start', gap: '10px'}}, [
        h('button', {class: 'btn primary', text: 'Make the game', disabled: bad, onclick: () => run('/api/town/export', 'Making the game…')}),
        h('button', {class: 'btn', text: 'Make it and play it in PICO-8', disabled: bad, onclick: () => run('/api/town/play', 'Opening PICO-8…')}),
        h('span', {class: 'small muted', text: T.made || 'Saves the town first. In the game: arrows walk, ❎ (X) talks.'})]));
      R.make.replaceChildren(...kids);
    }

    (async () => {
      try {
        await Promise.all([loadList(), loadSprites()]);
        const last = localStorage.getItem('townName');
        const first = T.names.find((n) => n.name === last) || T.names[0];
        if (first) await load(first.name); else draw();
      } catch (e) { T.error = e.message; draw(); }
    })();

    return {dirty: () => T.dirty, pause() {}};
  }
  return {open};
})();
