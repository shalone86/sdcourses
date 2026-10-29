// Battles tab: build a battle for videos (BATTLES.md) without touching YAML. Paint the map,
// place people and things, write the script as timed events (or play a unit with the keys and
// record it), and watch it in the same player the video uses. Saved to battles/<name>.yml.
// A lesson picks it up on the Timing tab: + Add a picture here → Battle.
'use strict';
window.BattleTab = (() => {
  const FPS = 30, CELL = 8, Z = 4; // Z: screen pixels per world pixel in the map editor
  const CODES = '0123456789abcdefghijklmnopqrstuvwxyz';
  const ACTIONS = ['idle', 'walk', 'gallop', 'ride', 'run', 'attack', 'point', 'fall'];
  const TILE_CHARS = 'gGtThrwfcabdeijklmnopqsuvxyzABCDEFHIJKLMNOPQRSUVWXYZ0123456789';

  function h(tag, attrs, kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
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
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const fmt = (s) => { s = Math.max(0, s); return Math.floor(s / 60) + ':' + (s % 60).toFixed(1).padStart(4, '0'); };
  const r3 = (v) => Math.round(v * 1000) / 1000;

  function open(root, api, post) {
    const B = {
      names: [], name: null, battle: null, sprites: {}, dirty: false, time: 0, msg: '', error: '',
      tool: 'paint', tile: null, kind: null, prop: null, sel: null, // sel: {type: 'unit'|'prop', i}
      pick: null,   // a function waiting for the next click on the map
      player: null, canvas: null, playerBox: null, rec: null, evOpen: null,
    };
    const E = () => window.StudioPlayer.engine;

    // ---------- drawings ----------
    const cache = new Map();
    const art = (name) => { const a = B.sprites[name]; return a && a.kind !== 'sketch' && Array.isArray(a.frames) ? a : null; };
    function spriteCanvas(name, frame) {
      const a = art(name);
      if (!a) return null;
      const key = name + '.' + (frame % a.frames.length);
      if (cache.has(key)) return cache.get(key);
      const c = document.createElement('canvas');
      c.width = a.width; c.height = a.height;
      const ctx = c.getContext('2d');
      a.frames[frame % a.frames.length].forEach((row, y) => {
        for (let x = 0; x < row.length; x++) if (row[x] !== '.') { ctx.fillStyle = a.palette[CODES.indexOf(row[x])]; ctx.fillRect(x, y, 1, 1); }
      });
      cache.set(key, c);
      return c;
    }
    const names = (prefix, suffix = '') => Object.keys(B.sprites).filter((n) => n.startsWith(prefix) && n.endsWith(suffix) && art(n)).sort();
    const tileNames = () => names('tile-');
    const propNames = () => names('prop-');
    const fxNames = () => names('fx-').map((n) => n.slice(3));
    const kindNames = () => Object.keys(B.sprites).filter((n) => n.endsWith('-idle') && art(n) && !/^(tile|prop|fx|item)-/.test(n)).map((n) => n.slice(0, -5)).sort();

    /** The drawings this battle can show, in the shape the engine wants. */
    function arts() {
      const b = B.battle, want = new Set(Object.values(b.tiles || {}));
      for (const p of b.props || []) want.add(p.sprite);
      for (const e of b.script || []) if (e.fx) want.add('fx-' + e.fx);
      for (const u of b.units || []) for (const a of ACTIONS) want.add(u.kind + '-' + a);
      const out = {};
      for (const n of want) { const a = art(n); if (a) out[n] = {width: a.width, height: a.height, fps: a.fps, palette: a.palette, frames: a.frames}; }
      return out;
    }
    const idleArt = (kind) => art(kind + '-idle');

    // ---------- loading and saving ----------
    async function loadList() { B.names = await api('/api/battles'); }
    async function loadSprites() {
      const list = await api('/api/sprites');
      B.sprites = Object.fromEntries(list.map((s) => [s.slug, s]));
      cache.clear();
    }
    async function load(name) {
      B.name = name; B.error = '';
      try {
        localStorage.setItem('battleName', name);
        const r = await api('/api/battle?name=' + encodeURIComponent(name));
        B.battle = r.battle;
      } catch (e) { B.error = e.message; B.battle = null; }
      B.sel = null; B.dirty = false; B.time = 0; B.rec = null; B.evOpen = null;
      B.tile = null; B.kind = null; B.prop = null;
      draw(true);
    }
    async function save() {
      try {
        B.msg = 'Saving…'; draw();
        await post('/api/battle', {name: B.name, battle: B.battle});
        B.dirty = false; B.msg = 'Saved.'; B.error = '';
        await loadList();
      } catch (e) { B.error = e.message; B.msg = ''; }
      draw();
    }
    const touch = () => { B.dirty = true; B.msg = ''; };
    /** Something in the battle changed: redraw the map and give the player the new battle. */
    function changed({keepPlayer = false} = {}) {
      touch();
      if (!keepPlayer) updatePlayer();
      drawMap();
    }
    function updatePlayer() {
      if (B.player && B.battle) B.player.setProps({battle: clone(B.battle), arts: arts(), palette: 'pico'});
    }

    // ---------- the map ----------
    const mapW = () => Math.max(1, ...B.battle.map.map((r) => r.length));
    const mapH = () => B.battle.map.length;
    function charOf(tileName) {
      const t = B.battle.tiles;
      for (const [c, n] of Object.entries(t)) if (n === tileName) return c;
      const free = [...TILE_CHARS].find((c) => !t[c]);
      t[free] = tileName;
      return free;
    }
    function setCell(x, y, ch) {
      const rows = B.battle.map;
      if (y < 0 || y >= rows.length || x < 0 || x >= mapW()) return false;
      const row = rows[y].padEnd(mapW(), Object.keys(B.battle.tiles)[0] || 'g');
      if (row[x] === ch) return false;
      rows[y] = row.slice(0, x) + ch + row.slice(x + 1);
      return true;
    }
    function resizeMap(dx, dy) {
      const b = B.battle, fill = Object.keys(b.tiles)[0] || 'g';
      if (dx) b.map = b.map.map((r) => (dx > 0 ? r.padEnd(mapW(), fill) + fill.repeat(dx) : r.slice(0, Math.max(b.view[0], r.length + dx))));
      if (dy > 0) for (let i = 0; i < dy; i++) b.map.push(fill.repeat(mapW()));
      if (dy < 0 && b.map.length + dy >= b.view[1]) b.map = b.map.slice(0, b.map.length + dy);
      changed();
    }
    const unitBox = (u) => { const a = idleArt(u.kind); const w = a ? a.width : CELL, hh = a ? a.height : CELL; return {x: u.at[0] * CELL, y: u.at[1] * CELL + CELL - hh, w, h: hh}; };
    const propBox = (p) => { const a = art(p.sprite); const w = a ? a.width : CELL, hh = a ? a.height : CELL; return {x: p.at[0] * CELL, y: p.at[1] * CELL + CELL - hh, w, h: hh}; };
    const inside = (b, x, y) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
    function hitAt(wx, wy) {
      const us = B.battle.units;
      for (let i = us.length - 1; i >= 0; i--) if (inside(unitBox(us[i]), wx, wy)) return {type: 'unit', i};
      const ps = B.battle.props || [];
      for (let i = ps.length - 1; i >= 0; i--) if (inside(propBox(ps[i]), wx, wy)) return {type: 'prop', i};
      return null;
    }

    function drawMap() {
      const cv = B.canvas, b = B.battle;
      if (!cv || !b) return;
      const w = mapW(), hh = mapH();
      if (cv.width !== w * CELL * Z || cv.height !== hh * CELL * Z) { cv.width = w * CELL * Z; cv.height = hh * CELL * Z; }
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = b.ground || '#00e436';
      ctx.fillRect(0, 0, cv.width, cv.height);
      const put = (name, frame, x, y, flip) => {
        const c = spriteCanvas(name, frame);
        if (!c) { ctx.fillStyle = 'rgba(255,0,77,.7)'; ctx.fillRect(x * Z, y * Z, CELL * Z, CELL * Z); return; }
        if (flip) { ctx.save(); ctx.translate((x + c.width) * Z, y * Z); ctx.scale(-1, 1); ctx.drawImage(c, 0, 0, c.width * Z, c.height * Z); ctx.restore(); }
        else ctx.drawImage(c, x * Z, y * Z, c.width * Z, c.height * Z);
      };
      for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const n = b.tiles[b.map[y][x]]; if (n) put(n, 0, x * CELL, y * CELL); }
      for (const p of b.props || []) { const bx = propBox(p); put(p.sprite, 0, bx.x, bx.y, p.face === 'right'); }
      b.units.forEach((u) => { const bx = unitBox(u); put(u.kind + '-idle', 0, bx.x, bx.y, u.face === 'right'); if (u.hidden) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(bx.x * Z, bx.y * Z, bx.w * Z, bx.h * Z); } });
      // faint grid
      ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1;
      for (let x = 0; x <= w; x++) { ctx.beginPath(); ctx.moveTo(x * CELL * Z + .5, 0); ctx.lineTo(x * CELL * Z + .5, cv.height); ctx.stroke(); }
      for (let y = 0; y <= hh; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL * Z + .5); ctx.lineTo(cv.width, y * CELL * Z + .5); ctx.stroke(); }
      // the part the camera shows right now
      try {
        const s = E().battleAt(b, arts(), B.time);
        ctx.strokeStyle = '#ffec27'; ctx.lineWidth = 3;
        ctx.strokeRect(s.camera.x * Z + 1.5, s.camera.y * Z + 1.5, b.view[0] * CELL * Z - 3, b.view[1] * CELL * Z - 3);
      } catch { /* a half-edited battle: no frame this time */ }
      // the selection
      if (B.sel) {
        const o = B.sel.type === 'unit' ? b.units[B.sel.i] : (b.props || [])[B.sel.i];
        if (o) { const bx = B.sel.type === 'unit' ? unitBox(o) : propBox(o); ctx.strokeStyle = '#ff004d'; ctx.lineWidth = 3; ctx.strokeRect(bx.x * Z - 1, bx.y * Z - 1, bx.w * Z + 2, bx.h * Z + 2); }
      }
    }

    function worldAt(e) {
      const r = B.canvas.getBoundingClientRect();
      const wx = ((e.clientX - r.left) / r.width) * (B.canvas.width / Z), wy = ((e.clientY - r.top) / r.height) * (B.canvas.height / Z);
      return {wx, wy, cx: Math.floor(wx / CELL), cy: Math.floor(wy / CELL)};
    }
    let drag = null;
    function onDown(e) {
      if (!B.battle) return;
      e.preventDefault();
      const p = worldAt(e);
      if (B.pick) { const f = B.pick; B.pick = null; f(p); return; }
      const b = B.battle;
      if (B.tool === 'paint') {
        if (!B.tile) { B.error = 'Pick a tile first.'; draw(); return; }
        const ch = charOf(B.tile);
        drag = {kind: 'paint', ch};
        if (setCell(p.cx, p.cy, ch)) { touch(); drawMap(); }
      } else if (B.tool === 'unit') {
        if (!B.kind) { B.error = 'Pick who to place first.'; draw(); return; }
        const id = uid(B.kind);
        b.units.push({id, kind: B.kind, at: [p.cx, p.cy]});
        B.sel = {type: 'unit', i: b.units.length - 1};
        changed(); draw();
      } else if (B.tool === 'prop') {
        if (!B.prop) { B.error = 'Pick a thing to place first.'; draw(); return; }
        (b.props ||= []).push({sprite: B.prop, at: [p.cx, p.cy]});
        B.sel = {type: 'prop', i: b.props.length - 1};
        changed(); draw();
      } else if (B.tool === 'move') {
        const hit = hitAt(p.wx, p.wy);
        B.sel = hit;
        if (hit) drag = {kind: 'move', hit};
        drawMap(); draw();
      } else if (B.tool === 'erase') {
        const hit = hitAt(p.wx, p.wy);
        if (hit) { removeSel(hit); }
      }
      window.addEventListener('pointerup', onUp, {once: true});
    }
    function onMove(e) {
      if (!drag || !B.battle) return;
      const p = worldAt(e);
      if (drag.kind === 'paint') { if (setCell(p.cx, p.cy, drag.ch)) { touch(); drawMap(); } }
      else if (drag.kind === 'move') {
        const o = drag.hit.type === 'unit' ? B.battle.units[drag.hit.i] : B.battle.props[drag.hit.i];
        if (o && (o.at[0] !== p.cx || o.at[1] !== p.cy)) { o.at = [p.cx, p.cy]; touch(); drawMap(); }
      }
    }
    function onUp() { if (drag) { const wasMove = drag.kind === 'move'; drag = null; updatePlayer(); if (wasMove) draw(); } }
    function removeSel(hit) {
      const b = B.battle;
      if (hit.type === 'unit') {
        const id = b.units[hit.i].id;
        const used = b.script.filter((e) => e.unit === id || e.follow === id).length;
        b.units.splice(hit.i, 1);
        if (used) b.script = b.script.filter((e) => e.unit !== id && e.follow !== id);
      } else b.props.splice(hit.i, 1);
      B.sel = null;
      changed(); draw();
    }
    function uid(kind) {
      const base = (kind.split('-').map((w) => w[0]).join('') || 'u').slice(0, 4);
      let n = 1;
      while (B.battle.units.some((u) => u.id === base + n)) n++;
      return base + n;
    }
    function renameUnit(i, to) {
      const b = B.battle, from = b.units[i].id;
      to = String(to || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (!to || to === from) return;
      if (b.units.some((u, j) => j !== i && u.id === to)) { B.error = 'Another unit already has that name.'; draw(); return; }
      b.units[i].id = to;
      for (const e of b.script) { if (e.unit === from) e.unit = to; if (e.follow === from) e.follow = to; }
      changed(); draw();
    }

    // ---------- the page ----------
    const R = {};
    function skeleton() {
      const card = (title, kids) => h('section', {class: 'card'}, [title ? h('h2', {text: title}) : null, ...[].concat(kids)]);
      R.bar = h('div', {class: 'row', style: {justifyContent: 'flex-start', gap: '10px'}});
      R.notice = h('div');
      R.playerBox = h('div', {style: {width: '100%', maxWidth: '760px', margin: '0 auto'}});
      R.transport = h('div', {class: 'row', style: {justifyContent: 'flex-start', gap: '10px'}});
      R.tools = h('div', {class: 'stack', style: {gap: '10px'}});
      B.canvas = h('canvas', {style: {width: '100%', imageRendering: 'pixelated', cursor: 'crosshair', touchAction: 'none', borderRadius: '8px', border: '1px solid var(--rule)'}});
      B.canvas.addEventListener('pointerdown', onDown);
      B.canvas.addEventListener('pointermove', onMove);
      R.selection = h('div');
      R.script = h('div', {class: 'stack', style: {gap: '10px'}});
      root.replaceChildren(h('div', {class: 'stack'}, [
        R.bar, R.notice,
        card('', [R.playerBox, R.transport]),
        card('Map and people', [R.tools, h('div', {style: {overflow: 'auto'}}, [B.canvas]), R.selection,
          h('div', {class: 'small muted', text: 'The yellow box is what the camera shows at the playhead. Units sit on the cell at their bottom-left.'})]),
        card('Script', [R.script]),
      ]));
    }
    function mountPlayer() {
      R.playerBox.replaceChildren();
      B.player = null;
      if (!B.battle) return;
      B.player = window.StudioPlayer.mountBattle(R.playerBox, {battle: clone(B.battle), arts: arts(), palette: 'pico'});
      B.player.onFrame((f) => { B.time = f / FPS; timeUI(); scheduleMap(); });
    }
    let mapQueued = false;
    function scheduleMap() { if (mapQueued) return; mapQueued = true; requestAnimationFrame(() => { mapQueued = false; drawMap(); }); }

    function draw(rebuild) {
      if (!R.bar) skeleton();
      if (rebuild) mountPlayer();
      renderBar(); renderNotice(); renderTransport(); renderTools(); renderSelection(); renderScript();
      drawMap();
    }
    function renderNotice() {
      R.notice.replaceChildren(...(B.error ? [h('div', {class: 'notice error', role: 'alert', text: B.error})] : B.msg ? [h('div', {class: 'notice', role: 'status', text: B.msg})] : []));
    }
    function renderBar() {
      const sel = h('select', {'aria-label': 'Battle', onchange: async (e) => {
        if (B.dirty && !(await window.ask('This battle has changes that aren’t saved. Leave them?'))) { e.target.value = B.name; return; }
        load(e.target.value);
      }}, B.names.map((n) => h('option', {value: n.name, text: n.title + (n.title !== n.name ? ' (' + n.name + ')' : ''), selected: n.name === B.name})));
      const title = B.battle ? h('input', {type: 'text', value: B.battle.title || '', placeholder: 'Title', 'aria-label': 'Title', style: {minWidth: '16em'},
        onchange: (e) => { B.battle.title = e.target.value; touch(); renderBar(); } }) : null;
      const newBtn = h('button', {class: 'btn', text: '+ New battle', onclick: () => {
        const nameIn = h('input', {type: 'text', placeholder: 'Name, e.g. lepanto', 'aria-label': 'New battle name'});
        const go = async () => {
          try { const r = await post('/api/battle/new', {name: nameIn.value, title: nameIn.value}); await loadList(); await load(r.name); }
          catch (e) { B.error = e.message; draw(); }
        };
        R.bar.append(nameIn, h('button', {class: 'btn primary', text: 'Create', onclick: go}));
        nameIn.focus();
        nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      }});
      R.bar.replaceChildren(sel, title, newBtn,
        h('button', {class: 'btn primary', text: 'Save', disabled: !B.dirty || !B.battle, onclick: save}),
        h('button', {class: 'btn', text: 'Refresh drawings', title: 'After drawing on the Pixel art tab', onclick: async () => { await loadSprites(); draw(true); }}),
        h('span', {class: 'small muted', text: B.dirty ? 'Not saved yet' : B.battle ? 'Saved' : ''}));
    }

    // ---------- the player's controls ----------
    function renderTransport() {
      const b = B.battle;
      if (!b) { R.transport.replaceChildren(h('span', {class: 'muted', text: B.names.length ? 'Pick a battle.' : 'No battles yet. Make one with + New battle.'})); return; }
      const total = E().battleSeconds(b);
      R.slider = h('input', {type: 'range', min: 0, max: Math.round(total * FPS), value: Math.round(B.time * FPS), 'aria-label': 'Playhead', style: {flex: '1', minWidth: '12em'},
        oninput: (e) => B.player && B.player.seek(Number(e.target.value))});
      R.timeText = h('span', {class: 'small', style: {fontVariantNumeric: 'tabular-nums', minWidth: '7.5em'}});
      R.playBtn = h('button', {class: 'btn', text: '▶ Play', onclick: () => { if (B.player) { B.player.toggle(); setTimeout(timeUI, 60); } }});
      const secs = h('input', {type: 'number', min: 1, max: 3600, step: 1, value: b.seconds || Math.ceil(total), 'aria-label': 'Length in seconds', style: {width: '5em'},
        onchange: (e) => { b.seconds = Math.max(1, Number(e.target.value) || 1); changed(); draw(); }});
      R.transport.replaceChildren(h('button', {class: 'btn', text: '⏮', title: 'To the start', onclick: () => B.player && B.player.seek(0)}), R.playBtn,
        h('button', {class: 'btn', text: '−1 s', onclick: () => B.player && B.player.seek(Math.max(0, B.player.frame() - FPS))}),
        h('button', {class: 'btn', text: '+1 s', onclick: () => B.player && B.player.seek(B.player.frame() + FPS)}),
        R.slider, R.timeText, h('label', {class: 'small muted'}, ['Length ', secs, ' s']));
      timeUI();
    }
    function timeUI() {
      if (!B.battle || !R.timeText) return;
      R.timeText.textContent = fmt(B.time) + ' / ' + fmt(E().battleSeconds(B.battle));
      if (R.slider && document.activeElement !== R.slider) R.slider.value = Math.round(B.time * FPS);
      if (R.playBtn && B.player) R.playBtn.textContent = B.player.playing() ? '⏸ Pause' : '▶ Play';
    }

    // ---------- tools ----------
    const TOOLS = [['paint', 'Paint the ground'], ['unit', 'Place a person'], ['prop', 'Place a thing'], ['move', 'Move / select'], ['erase', 'Erase']];
    function renderTools() {
      const b = B.battle;
      if (!b) { R.tools.replaceChildren(); return; }
      const seg = h('div', {class: 'seg', role: 'group', 'aria-label': 'Map tool'}, TOOLS.map(([k, label]) =>
        h('button', {text: label, 'aria-pressed': B.tool === k, onclick: () => { B.tool = k; renderTools(); }})));
      let palette = null;
      if (B.tool === 'paint') {
        const tiles = tileNames();
        if (!B.tile) B.tile = (b.tiles[Object.keys(b.tiles)[0]] || tiles[0]) || null;
        palette = tiles.length ? h('div', {class: 'row', style: {justifyContent: 'flex-start', gap: '6px'}}, tiles.map((n) => {
          const c = spriteCanvas(n, 0);
          const cv = h('canvas', {width: 8, height: 8, style: {width: '36px', height: '36px', imageRendering: 'pixelated', display: 'block'}});
          if (c) cv.getContext('2d').drawImage(c, 0, 0);
          return h('button', {class: 'btn', title: n.slice(5), 'aria-pressed': B.tile === n, style: {padding: '4px', outline: B.tile === n ? '3px solid var(--accent)' : 'none'}, onclick: () => { B.tile = n; renderTools(); }}, [cv]);
        })) : h('span', {class: 'muted small', text: 'No tile drawings yet: draw tile-grass etc. on the Pixel art tab.'});
      } else if (B.tool === 'unit') {
        const kinds = kindNames();
        if (!B.kind) B.kind = kinds[0] || null;
        palette = h('div', {class: 'row', style: {justifyContent: 'flex-start', gap: '8px'}}, [
          h('select', {'aria-label': 'Who to place', onchange: (e) => { B.kind = e.target.value; }}, kinds.map((k) => h('option', {value: k, text: k, selected: k === B.kind}))),
          h('span', {class: 'small muted', text: 'Then click the map. Anyone with an “-idle” drawing is here.'})]);
      } else if (B.tool === 'prop') {
        const props = propNames();
        if (!B.prop) B.prop = props[0] || null;
        palette = props.length ? h('div', {class: 'row', style: {justifyContent: 'flex-start', gap: '8px'}}, [
          h('select', {'aria-label': 'Which thing', onchange: (e) => { B.prop = e.target.value; }}, props.map((k) => h('option', {value: k, text: k.slice(5), selected: k === B.prop}))),
          h('span', {class: 'small muted', text: 'Then click the map.'})]) : h('span', {class: 'muted small', text: 'No scenery drawings yet: name them prop-<name>.'});
      } else if (B.tool === 'move') palette = h('span', {class: 'small muted', text: 'Click someone to select them; drag to move. Delete removes the selected one.'});
      else palette = h('span', {class: 'small muted', text: 'Click a person or thing to remove them (a person’s script lines go too).'});
      const num = (label, get, set, lo, hi) => h('label', {class: 'small muted'}, [label + ' ', h('input', {type: 'number', min: lo, max: hi, value: get(), style: {width: '4.5em'}, onchange: (e) => { set(Math.max(lo, Math.min(hi, Number(e.target.value) || lo))); }})]);
      const size = h('div', {class: 'row', style: {justifyContent: 'flex-start', gap: '8px'}}, [
        h('span', {class: 'small muted', text: 'Map ' + mapW() + ' × ' + mapH() + ' cells'}),
        h('button', {class: 'btn', text: '+ column', onclick: () => resizeMap(1, 0)}), h('button', {class: 'btn', text: '− column', onclick: () => resizeMap(-1, 0)}),
        h('button', {class: 'btn', text: '+ row', onclick: () => resizeMap(0, 1)}), h('button', {class: 'btn', text: '− row', onclick: () => resizeMap(0, -1)}),
        num('View', () => b.view[0], (v) => { b.view[0] = v; changed(); draw(); }, 4, 32), num('×', () => b.view[1], (v) => { b.view[1] = v; changed(); draw(); }, 4, 32),
        h('span', {class: 'small muted', text: '(16 × 9 is 16:9)'})]);
      R.tools.replaceChildren(seg, palette, size);
    }

    function renderSelection() {
      const b = B.battle;
      const s = B.sel;
      const o = b && s ? (s.type === 'unit' ? b.units[s.i] : (b.props || [])[s.i]) : null;
      if (!o) { R.selection.replaceChildren(h('div', {class: 'small muted', text: b ? b.units.length + ' people · ' + (b.props || []).length + ' things. Use “Move / select” to pick one.' : ''})); return; }
      const field = (label, input) => h('label', {class: 'small muted', style: {display: 'flex', flexDirection: 'column', gap: '2px'}}, [label, input]);
      const numIn = (v, set, step = 1) => h('input', {type: 'number', step, value: v, style: {width: '5.5em'}, onchange: (e) => { set(Number(e.target.value)); changed(); draw(); }});
      const kids = s.type === 'unit' ? [
        field('Name', h('input', {type: 'text', value: o.id, style: {width: '8em'}, onchange: (e) => renameUnit(s.i, e.target.value)})),
        field('Who', h('select', {onchange: (e) => { o.kind = e.target.value; changed(); draw(); }}, kindNames().map((k) => h('option', {value: k, text: k, selected: k === o.kind})))),
        field('Side', h('input', {type: 'text', value: o.side || '', style: {width: '6em'}, onchange: (e) => { if (e.target.value) o.side = e.target.value; else delete o.side; touch(); }})),
        field('Speed (px/s)', numIn(o.speed ?? '', (v) => { if (v > 0) o.speed = v; else delete o.speed; })),
        field('Faces', h('select', {onchange: (e) => { if (e.target.value === 'right') o.face = 'right'; else delete o.face; changed(); draw(); }}, ['left', 'right'].map((f) => h('option', {value: f, text: f, selected: (o.face || 'left') === f})))),
        field('Starts hidden', h('input', {type: 'checkbox', checked: !!o.hidden, onchange: (e) => { if (e.target.checked) o.hidden = true; else delete o.hidden; changed(); draw(); }})),
      ] : [
        field('Thing', h('select', {onchange: (e) => { o.sprite = e.target.value; changed(); draw(); }}, propNames().map((k) => h('option', {value: k, text: k.slice(5), selected: k === o.sprite})))),
        field('Faces', h('select', {onchange: (e) => { if (e.target.value === 'right') o.face = 'right'; else delete o.face; changed(); draw(); }}, ['left', 'right'].map((f) => h('option', {value: f, text: f, selected: (o.face || 'left') === f})))),
      ];
      kids.push(field('Cell x', numIn(o.at[0], (v) => { o.at[0] = v; }, 0.125)), field('Cell y', numIn(o.at[1], (v) => { o.at[1] = v; }, 0.125)),
        h('button', {class: 'btn', text: 'Remove', onclick: () => removeSel(s)}));
      R.selection.replaceChildren(h('div', {class: 'row', style: {justifyContent: 'flex-start', gap: '12px', alignItems: 'flex-end'}}, kids));
    }

    // ---------- the script ----------
    const typeOf = (e) => (e.move ? 'move' : e.act ? 'act' : e.fx ? 'fx' : e.camera || e.follow ? 'camera' : e.say != null ? 'say' : e.label != null ? 'label' : e.face ? 'face' : e.show != null ? 'show' : 'other');
    const at2 = (p) => '(' + p.join(', ') + ')';
    function describe(e) {
      switch (typeOf(e)) {
        case 'move': return e.unit + ' goes ' + (e.move.length ? e.move.map(at2).join(' → ') : '… (no points yet)') + (e.speed ? ' at ' + e.speed + ' px/s' : '');
        case 'act': return e.unit + ': ' + e.act + (e.dur ? ' for ' + e.dur + ' s' : '');
        case 'fx': return e.fx + ' effect ' + (e.unit ? 'on ' + e.unit : e.at ? 'at ' + at2(e.at) : '');
        case 'camera': return e.follow ? 'camera follows ' + e.follow : 'camera to ' + at2(e.camera) + (e.dur ? ' over ' + e.dur + ' s' : ' (jumps)');
        case 'say': return 'caption' + (e.who ? ' (' + e.who + ')' : '') + ': “' + (e.say || '') + '”';
        case 'label': return 'name tag “' + (e.label || '') + '” on ' + (e.unit || (e.at ? at2(e.at) : '?'));
        case 'face': return e.unit + ' faces ' + e.face;
        case 'show': return e.unit + (e.show ? ' appears' : ' disappears');
        default: return 'event';
      }
    }
    const unitIds = () => B.battle.units.map((u) => u.id);
    const ADD = [['move', 'Move'], ['act', 'Attack / point / fall'], ['face', 'Face a way'], ['show', 'Appear / disappear'], ['fx', 'Effect (spark, dust)'], ['camera', 'Camera'], ['say', 'Caption'], ['label', 'Name tag']];
    function newEvent(type) {
      const t = Math.round(B.time * 10) / 10, u = unitIds()[0] || '';
      return {
        move: {t, unit: u, move: []}, act: {t, unit: u, act: 'attack', dur: 0.8}, face: {t, unit: u, face: 'left'}, show: {t, unit: u, show: true},
        fx: {t, fx: fxNames()[0] || 'spark', at: [0, 0]}, camera: {t, camera: [0, 0], dur: 2}, say: {t, say: '', dur: 4}, label: {t, label: '', unit: u, dur: 4},
      }[type];
    }
    const sortScript = () => B.battle.script.sort((a, c) => a.t - c.t);

    /** Wait for clicks on the map: each click calls `take(p)`; for points, keep going until Done. */
    function pickPoints(ev, key, many, label) {
      const again = (p) => {
        if (many) { (ev[key] ||= []).push([p.cx, p.cy]); B.pick = again; B.pickNote = label; }
        else { ev[key] = key === 'camera' ? [Math.max(0, p.cx - Math.floor(B.battle.view[0] / 2)), Math.max(0, p.cy - Math.floor(B.battle.view[1] / 2))] : [p.cx, p.cy]; B.pick = null; B.pickNote = ''; }
        changed(); renderScript();
      };
      B.pick = again; B.pickNote = label;
      renderScript();
    }

    function eventForm(e) {
      const t = typeOf(e);
      const f = (label, input) => h('label', {class: 'small muted', style: {display: 'flex', flexDirection: 'column', gap: '2px'}}, [label, input]);
      const txt = (key, w = '10em', ph = '') => h('input', {type: 'text', value: e[key] || '', placeholder: ph, style: {width: w}, onchange: (ev) => { if (ev.target.value) e[key] = ev.target.value; else delete e[key]; changed(); renderScript(); }});
      const nm = (key, step = 0.1, w = '5em') => h('input', {type: 'number', step, value: e[key] ?? '', style: {width: w}, onchange: (ev) => { const v = Number(ev.target.value); if (ev.target.value !== '' && Number.isFinite(v)) e[key] = v; else delete e[key]; changed(); renderScript(); }});
      const sel = (key, opts, blank) => h('select', {onchange: (ev) => { if (ev.target.value) e[key] = ev.target.value; else delete e[key]; changed(); renderScript(); }},
        [...(blank ? [h('option', {value: '', text: blank})] : []), ...opts.map((o) => h('option', {value: o, text: o, selected: e[key] === o}))]);
      const pt = (key, label, many) => h('div', {class: 'row', style: {justifyContent: 'flex-start', gap: '6px'}}, [
        h('span', {class: 'small', text: many ? (e[key] || []).map(at2).join(' → ') || 'no points yet' : e[key] ? at2(e[key]) : 'not set'}),
        h('button', {class: 'btn', text: many ? 'Click points on the map' : (key === 'camera' ? 'Click the middle of the view' : 'Click the spot'), onclick: () => pickPoints(e, key, many, many ? 'Click each stop on the map, in order, then press Done.' : 'Click the map.')}),
        many && (e[key] || []).length ? h('button', {class: 'btn', text: 'Clear points', onclick: () => { e[key] = []; changed(); renderScript(); }}) : null]);
      const ids = unitIds();
      const fields = [f('At (s)', h('input', {type: 'number', step: 0.1, min: 0, value: e.t, style: {width: '5.5em'}, onchange: (ev) => { e.t = Math.max(0, Number(ev.target.value) || 0); sortScript(); changed(); renderScript(); }}))];
      if (t === 'move') fields.push(f('Who', sel('unit', ids)), f('Where to', pt('move', '', true)), f('Speed (px/s, optional)', nm('speed', 1)));
      if (t === 'act') fields.push(f('Who', sel('unit', ids)), f('Does', sel('act', ['attack', 'point', 'fall', 'idle'])), f('For (s)', nm('dur')));
      if (t === 'face') fields.push(f('Who', sel('unit', ids)), f('Faces', sel('face', ['left', 'right'])));
      if (t === 'show') fields.push(f('Who', sel('unit', ids)), f('Then', h('select', {onchange: (ev) => { e.show = ev.target.value === 'show'; changed(); renderScript(); }}, [h('option', {value: 'show', text: 'appears', selected: e.show}), h('option', {value: 'hide', text: 'disappears', selected: !e.show})])));
      if (t === 'fx') fields.push(f('Effect', sel('fx', fxNames())), f('On a person', sel('unit', ids, '(none: at a spot)')), e.unit ? null : f('At', pt('at', '', false)), f('Nudge x', nm('dx', 1, '4em')), f('Nudge y', nm('dy', 1, '4em')));
      if (t === 'camera') fields.push(f('Slides to', pt('camera', '', false)), f('Over (s)', nm('dur')), f('Or follows', sel('follow', ids, '(nobody)')));
      if (t === 'say') fields.push(f('Words', h('textarea', {rows: 2, style: {width: '28em', maxWidth: '100%'}, onchange: (ev) => { e.say = ev.target.value; changed(); renderScript(); }}, [e.say || ''])), f('Who says it (optional)', txt('who', '10em')), f('Shown for (s)', nm('dur')));
      if (t === 'label') fields.push(f('Words', txt('label', '14em', 'Charles Martel')), f('On a person', sel('unit', ids, '(none: at a place)')), e.unit ? null : f('At', pt('at', '', false)), f('Shown for (s)', nm('dur')));
      fields.push(f('Note (for you; never shown)', txt('note', '16em')));
      return h('div', {class: 'row', style: {justifyContent: 'flex-start', gap: '12px', alignItems: 'flex-end', padding: '10px', background: 'var(--bg)', borderRadius: '8px'}}, fields);
    }

    function renderScript() {
      const b = B.battle;
      if (!b) { R.script.replaceChildren(); return; }
      const rec = recorder();
      const addSel = h('select', {'aria-label': 'Kind of event'}, ADD.map(([k, l]) => h('option', {value: k, text: l})));
      const bar = h('div', {class: 'row', style: {justifyContent: 'flex-start', gap: '8px'}}, [addSel,
        h('button', {class: 'btn', text: 'Add at the playhead', disabled: !b.units.length && addSel.value !== 'camera', onclick: () => {
          const e = newEvent(addSel.value);
          b.script.push(e); sortScript(); B.evOpen = e; changed(); renderScript();
        }}),
        B.pick ? h('span', {class: 'small', style: {color: 'var(--accent)', fontWeight: 600}, text: B.pickNote || 'Click the map.'}) : null,
        B.pick ? h('button', {class: 'btn', text: 'Done', onclick: () => { B.pick = null; B.pickNote = ''; renderScript(); }}) : null]);
      const rows = b.script.map((e) => {
        const open = B.evOpen === e;
        const now = Math.abs(e.t - B.time) < 0.05;
        return h('li', {style: {display: 'block'}}, [
          h('div', {class: 'row', style: {justifyContent: 'flex-start', gap: '10px'}}, [
            h('button', {class: 'btn', text: fmt(e.t), title: 'Go to this moment', style: {minWidth: '4.6em', fontVariantNumeric: 'tabular-nums', fontWeight: now ? 800 : 600}, onclick: () => B.player && B.player.seek(Math.round(e.t * FPS))}),
            h('span', {text: describe(e), style: {flex: '1', minWidth: '12em', color: e.note ? 'var(--ink)' : undefined}}),
            h('button', {class: 'btn', text: open ? 'Close' : 'Edit', onclick: () => { B.evOpen = open ? null : e; B.pick = null; B.pickNote = ''; renderScript(); }}),
            h('button', {class: 'btn', text: '✕', 'aria-label': 'Delete this line', onclick: () => { b.script.splice(b.script.indexOf(e), 1); if (B.evOpen === e) B.evOpen = null; changed(); renderScript(); }})]),
          open ? eventForm(e) : null]);
      });
      R.script.replaceChildren(rec, bar, h('ul', {class: 'list', style: {maxHeight: '460px', overflow: 'auto'}}, rows),
        h('div', {class: 'small muted', text: b.script.length + ' lines · Save keeps them in battles/' + B.name + '.yml'}));
    }
    // ---------- play a person with the keys, and keep it ----------
    const DIRS = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
    const REC_HELP = '← → ↑ ↓ walk · A attack · P point · F fall · S spark · D dust · Esc stops';
    const nowSec = () => (B.player ? B.player.frame() / FPS : B.time);
    function recorder() {
      const b = B.battle, r = B.rec;
      if (!b.units.length) return h('div', {class: 'small muted', text: 'Place a person on the map to play them with the keys.'});
      const who = h('select', {'aria-label': 'Who to play', disabled: !!r}, b.units.map((u) => h('option', {value: u.id, text: u.id + ' (' + u.kind + ')', selected: (B.recWho || b.units[0].id) === u.id})));
      who.addEventListener('change', () => { B.recWho = who.value; });
      return h('div', {class: 'stack', style: {gap: '6px'}}, [
        h('div', {class: 'row', style: {justifyContent: 'flex-start', gap: '8px'}}, [
          h('b', {text: 'Play a person:'}), who,
          r ? h('button', {class: 'btn rec', text: '■ Stop (Esc)', onclick: stopRec}) : h('button', {class: 'btn primary', text: '● Record from the playhead', title: 'Plays the battle from here; your keys become moves for this person (their later moves are replaced)', onclick: () => startRec(B.recWho || b.units[0].id)}),
          !r && B.recUndo ? h('button', {class: 'btn', text: 'Undo that recording', onclick: () => { b.script = B.recUndo; B.recUndo = null; B.evOpen = null; changed(); renderScript(); }}) : null,
          h('span', {class: 'small muted', text: r ? 'Recording ' + r.id + '…' : 'Or write the lines yourself below.'})]),
        h('div', {class: 'small muted', text: REC_HELP})]);
    }
    function startRec(id) {
      const b = B.battle, u = b.units.find((x) => x.id === id);
      if (!u || !B.player || B.rec) return;
      const t0 = Math.round(nowSec() * 100) / 100;
      B.recUndo = clone(b.script);
      b.script = b.script.filter((e) => !((e.unit === id) && e.t >= t0));
      const p = E().unitPos(b, id, t0) || [u.at[0] * CELL, u.at[1] * CELL];
      B.rec = {id, speed: u.speed ?? 20, seg: null, pos: [p[0] / CELL, p[1] / CELL], held: new Set(), dead: false, timer: null};
      B.pick = null; B.evOpen = null;
      document.addEventListener('keydown', onRecKey, true);
      document.addEventListener('keyup', onRecKey, true);
      B.rec.timer = setInterval(recTick, 100);
      updatePlayer(); B.player.play(); renderScript();
    }
    // The moving part: a segment starts at a time and place with a direction; the sprite and this
    // bookkeeping both advance at the person's speed, so the line saved matches what was seen.
    const posNow = (r, t) => (r.seg ? [r.seg.p0[0] + r.seg.n[0] * r.seg.speed * (t - r.seg.t0) / CELL, r.seg.p0[1] + r.seg.n[1] * r.seg.speed * (t - r.seg.t0) / CELL] : r.pos);
    const snap8 = (v) => Math.round(v * 8) / 8;
    function endSeg(r, t) {
      if (!r.seg) return;
      const p = posNow(r, t);
      r.seg.ev.move = [[snap8(p[0]), snap8(p[1])]];
      r.pos = p; r.seg = null;
    }
    function setDir(t) {
      const r = B.rec;
      endSeg(r, t);
      if (r.dead || !r.held.size) return;
      let dx = 0, dy = 0;
      for (const k of r.held) { dx += DIRS[k][0]; dy += DIRS[k][1]; }
      if (!dx && !dy) return;
      const len = Math.hypot(dx, dy), n = [dx / len, dy / len];
      const ev = {t: Math.round(t * 100) / 100, unit: r.id, move: [[snap8(r.pos[0] + n[0] * 1.5), snap8(r.pos[1] + n[1] * 1.5)]]};
      if (r.speed !== undefined) ev.speed = undefined;
      delete ev.speed;
      B.battle.script.push(ev);
      r.seg = {ev, n, t0: t, p0: [r.pos[0], r.pos[1]], speed: r.speed};
    }
    function recTick() {
      const r = B.rec;
      if (!r) return;
      const t = nowSec();
      if (r.seg) { const p = posNow(r, t); r.seg.ev.move = [[snap8(p[0] + r.seg.n[0] * 1.5), snap8(p[1] + r.seg.n[1] * 1.5)]]; }
      updatePlayer();
      if (t >= E().battleSeconds(B.battle) - 0.05) stopRec();
    }
    function onRecKey(e) {
      const r = B.rec;
      if (!r) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (e.type === 'keydown') stopRec(); return; }
      const down = e.type === 'keydown';
      const t = nowSec();
      if (DIRS[e.key]) {
        e.preventDefault(); e.stopImmediatePropagation();
        if (down) { if (r.held.has(e.key)) return; r.held.add(e.key); } else r.held.delete(e.key);
        setDir(t);
        return;
      }
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!down || e.repeat || !'apfsd'.includes(k) || k.length !== 1) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const at = Math.round(t * 100) / 100;
      if (k === 'a') B.battle.script.push({t: at, unit: r.id, act: 'attack', dur: 0.8});
      if (k === 'p') B.battle.script.push({t: at, unit: r.id, act: 'point', dur: 1.2});
      if (k === 'f') { endSeg(r, t); r.dead = true; r.held.clear(); B.battle.script.push({t: at, unit: r.id, act: 'fall'}); }
      if (k === 's' || k === 'd') B.battle.script.push({t: at, fx: k === 's' ? 'spark' : 'dust', unit: r.id});
      updatePlayer();
    }
    function stopRec() {
      const r = B.rec;
      if (!r) return;
      endSeg(r, nowSec());
      clearInterval(r.timer);
      document.removeEventListener('keydown', onRecKey, true);
      document.removeEventListener('keyup', onRecKey, true);
      B.player && B.player.pause();
      B.rec = null;
      sortScript();
      changed(); draw();
    }

    // ---------- start ----------
    function onKey(e) {
      if (!B.battle || B.rec || e.target.closest?.('input, textarea, select')) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && B.sel && root.isConnected) { e.preventDefault(); removeSel(B.sel); }
    }
    document.addEventListener('keydown', onKey);
    (async () => {
      try {
        await Promise.all([loadList(), loadSprites()]);
        const last = localStorage.getItem('battleName');
        const first = B.names.find((n) => n.name === last) || B.names[0];
        draw(true);
        if (first) await load(first.name);
      } catch (e) { B.error = e.message; draw(true); }
    })();
    return {
      dirty: () => B.dirty,
      pause: () => { if (B.rec) stopRec(); if (B.player) B.player.pause(); },
    };
  }

  return {open};
})();
