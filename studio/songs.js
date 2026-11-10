// Music videos tab: she makes the song in Logic; here she makes its video. One slide per line of
// the words, timed by tapping along with the song; her drawings dropped in as characters that
// dance to the beat or to one of the song's parts (from its MIDI when there is one, else guessed
// from the sound). Saved to songs/<name>/song.yml; "Make the video" runs scripts/song.mjs.
'use strict';
window.SongsTab = (() => {
  const FPS = 30, W = 1920, H = 1080;
  function h(tag, attrs, kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k.startsWith('aria-') && typeof v === 'boolean') { e.setAttribute(k, String(v)); continue; }
      if (v == null || v === false) continue;
      if (k === 'text') e.textContent = v;
      else if (k === 'class') e.className = v;
      else if (k === 'style') Object.assign(e.style, v);
      else if (k === 'value') e.value = v;
      else if (k === 'checked') e.checked = !!v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of [].concat(kids || [])) if (c != null && c !== false) e.append(c);
    return e;
  }
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const clock = (s) => { s = Math.max(0, s); return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60).toFixed(1); };
  const readClock = (v) => { const m = /^\s*(?:(\d+):)?(\d+(?:\.\d+)?)\s*$/.exec(String(v)); return m ? Number(m[1] || 0) * 60 + Number(m[2]) : null; };
  const round2 = (v) => Math.round(v * 100) / 100;
  const wordsOf = (s) => String(s.words || '').trim().split(/\s+/).filter(Boolean);
  const MOVES = [['hop', 'Hops'], ['sway', 'Sways'], ['grow', 'Grows'], ['still', 'Only changes frame']];

  if (!document.getElementById('songs-css')) document.head.append(h('style', {id: 'songs-css', text: `
.sv-grid{display:grid;grid-template-columns:minmax(0,3fr) minmax(280px,2fr);gap:16px;align-items:start}
@media(max-width:900px){.sv-grid{grid-template-columns:1fr}}
.sv-stage{position:relative}
.sv-over{position:absolute;inset:0;border-radius:10px;overflow:hidden}
.sv-box{position:absolute;border:2px dashed rgba(0,0,0,.55);box-shadow:0 0 0 1px rgba(255,255,255,.8);cursor:grab;touch-action:none}
.sv-box.on{border-style:solid;border-color:var(--accent)}
.sv-grip{position:absolute;right:-9px;bottom:-9px;width:18px;height:18px;border-radius:4px;background:var(--accent);border:2px solid #fff;cursor:nwse-resize;touch-action:none}
.sv-marks{position:relative;height:14px;margin:0 8px}
.sv-mark{position:absolute;top:0;width:4px;height:14px;margin-left:-2px;border-radius:2px;background:var(--muted);border:0;padding:0;cursor:pointer}
.sv-mark.on{background:var(--accent)}
.sv-seek{width:100%;margin:0}
.sv-list{display:flex;flex-direction:column;gap:6px;max-height:70vh;overflow-y:auto;padding:2px}
.sv-row{display:flex;gap:8px;align-items:center;border:2px solid var(--rule);border-radius:9px;padding:6px 8px;background:var(--paper)}
.sv-row.on{border-color:var(--accent)}
.sv-row.now{background:var(--bg)}
.sv-row .t{flex:0 0 74px;font:600 13px/1.2 var(--sans);color:var(--muted);background:none;border:0;padding:4px 0;text-align:left;cursor:pointer}
.sv-row .t.none{color:var(--accent)}
.sv-row input{flex:1;min-width:0;font:inherit;color:inherit;background:transparent;border:1px solid transparent;border-radius:6px;padding:5px 6px}
.sv-row input:hover,.sv-row input:focus{border-color:var(--rule);background:var(--bg);outline:none}
.sv-in{font:inherit;color:inherit;background:var(--paper);border:1px solid var(--rule);border-radius:8px;padding:6px 10px}
.sv-cast{border:2px solid var(--rule);border-radius:9px;padding:8px 10px;display:flex;flex-direction:column;gap:8px}
.sv-cast.on{border-color:var(--accent)}
.sv-tap{font:600 20px/1.3 var(--sans);text-align:center;padding:14px;border-radius:10px;background:var(--ink);color:var(--bg)}
.sv-tap .w{opacity:.45}.sv-tap .w.next{opacity:1;text-decoration:underline}.sv-tap .w.done{opacity:1;color:var(--gold,#e0b040)}
.sv-bar{height:8px;border-radius:4px;background:var(--rule);overflow:hidden}.sv-bar i{display:block;height:100%;background:var(--accent)}
`}));

  function open(root, api, post) {
    const G = {
      names: [], name: null, data: null, song: null, sprites: [], arts: {}, dirty: false, msg: '', error: '',
      sel: 0, cast: -1, time: 0, tap: null, player: null, adding: false, pasting: false, creating: false,
      pick: {q: ''}, backPick: {q: ''}, job: null, video: null, busy: '',
    };
    const R = {}; // the parts of the page that are kept between redraws

    // ---------- the song ----------
    const slides = () => G.song.slides;
    const props = () => ({song: clone(G.song), audio: G.data.audio, duration: G.data.duration, parts: G.data.parts, arts: G.arts});
    const updatePlayer = () => { if (G.player) G.player.setProps(props()); };
    const touch = () => { G.dirty = true; G.msg = ''; statusUI(); };
    /** The slide whose characters (or background) slide i shows: its own, else the nearest one before that has some. */
    const owner = (i, key) => { for (let j = i; j >= 0; j--) if (slides()[j][key]) return j; return -1; };
    /** The slide on screen at a time (the last timed one that has started). */
    const slideAt = (t) => { let best = -1, at = -1; slides().forEach((s, i) => { if (s.at != null && s.at <= t + 0.001 && s.at >= at) { best = i; at = s.at; } }); return best; };
    async function needArt(sprite) {
      if (!sprite || G.arts[sprite]) return;
      try { G.arts[sprite] = await api('/api/song/art?name=' + encodeURIComponent(G.name) + '&sprite=' + encodeURIComponent(sprite)); } catch (e) { G.error = 'That drawing could not be loaded: ' + e.message; }
    }

    async function loadList() { G.names = await api('/api/songs'); }
    async function load(name) {
      stopTap(); if (G.player) G.player.pause();
      G.name = name; G.error = ''; G.msg = ''; G.data = null; G.song = null; G.player = null; R.playerBox = null;
      try {
        localStorage.setItem('songName', name);
        const d = await api('/api/song?name=' + encodeURIComponent(name));
        G.data = d; G.song = d.song; G.arts = d.arts || {}; G.video = d.video || null;
        if (d.missing && d.missing.length) G.error = 'These drawings were not found: ' + d.missing.join(', ');
      } catch (e) { G.error = e.message; }
      G.sel = 0; G.cast = -1; G.time = 0; G.dirty = false; G.adding = false; G.pasting = false;
      draw();
    }
    async function save() {
      try {
        G.msg = 'Saving…'; statusUI();
        await post('/api/song', {name: G.name, song: G.song});
        G.dirty = false; G.msg = 'Saved.'; G.error = '';
        await loadList();
      } catch (e) { G.error = e.message; G.msg = ''; }
      statusUI();
      return !G.dirty;
    }
    async function sendFile(name, kind, file) {
      const ext = (/\.([a-z0-9]+)$/i.exec(file.name) || [])[1] || '';
      const r = await fetch('/api/song/file?name=' + encodeURIComponent(name) + '&kind=' + kind + '&ext=' + encodeURIComponent(ext.toLowerCase()), {method: 'POST', headers: {'X-Studio': '1', 'Content-Type': 'application/octet-stream'}, body: file});
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'That file could not be saved');
    }

    // ---------- playing ----------
    function mountPlayer() {
      R.playerBox = h('div');
      R.over = h('div', {class: 'sv-over'});
      R.stage = h('div', {class: 'sv-stage'}, [R.playerBox, R.over]);
      G.player = window.StudioPlayer.mountSong(R.playerBox, props());
      G.player.onFrame((f) => { G.time = f / FPS; timeUI(); });
    }
    const playing = () => !!(G.player && G.player.playing());
    function seek(t, pick = true) {
      G.time = Math.max(0, Math.min(G.data.duration, t));
      if (G.player) G.player.seek(G.time * FPS);
      if (pick) { const i = slideAt(G.time); if (i >= 0 && i !== G.sel) { G.sel = i; G.cast = -1; drawSide(); } }
      timeUI();
    }
    function toggle() { if (!G.player) return; G.player.toggle(); setTimeout(timeUI, 60); }
    /** The time, the seek bar, which slide is sounding now, and the boxes over the video. */
    function timeUI() {
      if (!G.song) return;
      if (R.time) R.time.textContent = clock(G.time) + ' / ' + clock(G.data.duration);
      if (R.seek && document.activeElement !== R.seek) R.seek.value = G.time;
      if (R.play) R.play.textContent = playing() ? 'Pause' : 'Play';
      const now = slideAt(G.time);
      (R.rows || []).forEach((r, i) => r.classList.toggle('now', i === now));
      if (playing() && !G.tap && now >= 0 && now !== G.sel && !root.contains(document.activeElement?.closest?.('.sv-row') || null)) { G.sel = now; G.cast = -1; drawSide(); }
      drawOver();
    }

    // ---------- tapping the times ----------
    function startTap(kind) {
      if (!G.player) return;
      let i = G.sel;
      if (kind === 'words') { while (i < slides().length && !wordsOf(slides()[i]).length) i++; if (i >= slides().length) { G.error = 'Type some words first.'; statusUI(); return; } }
      G.tap = {kind, i, w: 0, times: []};
      G.sel = i; G.cast = -1; G.error = '';
      if (kind === 'words' && slides()[i].at != null) seek(Math.max(0, slides()[i].at - 3), false);
      drawSide(); drawTap();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      G.player.play();
    }
    function stopTap() {
      if (!G.tap) return;
      G.tap = null;
      if (G.player) { G.player.pause(); G.time = G.player.frame() / FPS; }
      const now = G.song ? slideAt(G.time) : -1;
      if (now >= 0) { G.sel = now; G.cast = -1; } // back to the slide on screen, so its characters can be moved
      updatePlayer(); drawSide(); drawTap(); timeUI();
    }
    function tap() {
      const T = G.tap, t = round2(G.player.frame() / FPS);
      const s = slides()[T.i];
      if (T.kind === 'lines') {
        if (s.times && s.at != null) s.times = s.times.map((x) => round2(x + t - s.at)); // its word times move with it
        s.at = t; T.i++;
      } else {
        T.times.push(t);
        if (T.w === 0) s.at = t;
        T.w++;
        if (T.w >= wordsOf(s).length) {
          s.times = T.times; T.times = []; T.w = 0; T.i++;
          while (T.i < slides().length && !wordsOf(slides()[T.i]).length) T.i++;
        }
      }
      touch(); updatePlayer();
      if (T.i >= slides().length) { stopTap(); G.msg = 'That was the last slide.'; statusUI(); return; }
      G.sel = T.i; drawSide(); drawTap();
    }
    function drawTap() {
      if (!R.tap) return;
      const T = G.tap;
      if (!T) { R.tap.replaceChildren(); R.tap.style.display = 'none'; return; }
      R.tap.style.display = '';
      const s = slides()[T.i], ws = wordsOf(s);
      R.tap.replaceChildren(
        h('div', {class: 'small', style: {opacity: '.7', marginBottom: '6px'}, text: T.kind === 'lines' ? 'Press Space when this line starts  ·  Esc when you’re done' : 'Press Space on each word as it’s sung  ·  Esc when you’re done'}),
        T.kind === 'lines' ? h('div', {text: s.words || '(no words on slide ' + (T.i + 1) + ')'})
          : h('div', null, ws.map((w, k) => h('span', {class: 'w' + (k < T.w ? ' done' : k === T.w ? ' next' : ''), text: w + ' '}))),
      );
    }
    function onKey(e) {
      if (!root.isConnected || !G.song || !G.player) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (G.tap) {
        if (e.key === 'Escape') { e.preventDefault(); stopTap(); }
        else if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); if (!e.repeat) tap(); }
        return;
      }
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); toggle(); }
      else if ((e.key === 'Backspace' || e.key === 'Delete') && G.cast >= 0) { e.preventDefault(); removeCast(G.cast); }
    }
    document.addEventListener('keydown', onKey);

    // ---------- characters ----------
    /** The list of characters slide G.sel shows, ready to change (made on the slide they belong to). */
    function castList(make) {
      const o = owner(G.sel, 'cast');
      if (o >= 0) return slides()[o].cast;
      if (!make) return [];
      return (slides()[G.sel].cast = []);
    }
    async function addCast(s) {
      await needArt(s.slug);
      if (!G.arts[s.slug]) { statusUI(); return; }
      const list = castList(true);
      const a = G.arts[s.slug], size = 420;
      list.push({sprite: s.slug, x: Math.round(Math.min(W - 200, 360 + list.length * 300)), y: 640, size, to: 'beat'});
      G.cast = list.length - 1; G.adding = false;
      touch(); updatePlayer(); drawSide(); drawOver();
    }
    function removeCast(k) { castList().splice(k, 1); G.cast = -1; touch(); updatePlayer(); drawSide(); drawOver(); }
    function boxStyle(c) {
      const a = G.arts[c.sprite]; if (!a) return null;
      const w = c.size * a.width / a.height;
      return {left: (c.x - w / 2) / W * 100 + '%', top: (c.y - c.size / 2) / H * 100 + '%', width: w / W * 100 + '%', height: c.size / H * 100 + '%'};
    }
    /** The boxes over the video: drag a character to move it, its corner to resize it. Only while paused on its slide. */
    function drawOver() {
      if (!R.over) return;
      const show = !playing() && !G.tap && slides()[G.sel] && slideAt(G.time) === G.sel || (!playing() && !G.tap && slideAt(G.time) < 0 && G.sel === firstTimed());
      const key = show ? G.sel + ':' + G.cast + ':' + JSON.stringify(castList()) : '';
      if (R.overKey === key) return;
      R.overKey = key;
      R.over.style.pointerEvents = show ? '' : 'none';
      R.over.replaceChildren(...(show ? castList().map((c, k) => {
        const st = boxStyle(c); if (!st) return null;
        const box = h('div', {class: 'sv-box' + (k === G.cast ? ' on' : ''), style: st, title: c.sprite});
        const grip = h('div', {class: 'sv-grip'});
        box.append(grip);
        const drag = (el, resize) => el.addEventListener('pointerdown', (e) => {
          e.preventDefault(); e.stopPropagation();
          el.setPointerCapture(e.pointerId);
          const r = R.over.getBoundingClientRect(), k2 = W / r.width, x0 = e.clientX, y0 = e.clientY, start = {...c};
          if (G.cast !== k) { G.cast = k; drawSide(); for (const b of R.over.children) b.classList.toggle('on', b === box); }
          let moved = false;
          const move = (ev) => {
            const dx = (ev.clientX - x0) * k2, dy = (ev.clientY - y0) * k2;
            if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
            moved = true;
            if (resize) c.size = Math.round(Math.max(24, Math.min(1400, start.size + 2 * Math.max(dx * (G.arts[c.sprite].height / G.arts[c.sprite].width), dy))));
            else { c.x = Math.round(start.x + dx); c.y = Math.round(start.y + dy); }
            Object.assign(box.style, boxStyle(c));
            R.overKey = null; // it changed under us; the next redraw rebuilds
            updatePlayer();
          };
          const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); if (moved) { touch(); drawSide(); } R.overKey = null; drawOver(); };
          el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
        });
        drag(box, false); drag(grip, true);
        return box;
      }).filter(Boolean) : []));
    }
    const firstTimed = () => { let best = -1; slides().forEach((s, i) => { if (s.at != null && (best < 0 || s.at < slides()[best].at)) best = i; }); return best; };

    // ---------- drawing the page ----------
    function statusUI() {
      if (!R.status) return;
      R.status.replaceChildren(
        G.error ? h('span', {style: {color: 'var(--accent)'}, text: G.error}) : h('span', {class: 'muted', text: G.msg || (G.dirty ? 'Not saved yet.' : '')}),
      );
      if (R.save) R.save.disabled = !G.dirty;
    }
    function select(i, andSeek = true) {
      G.sel = i; G.cast = -1; G.adding = false;
      const s = slides()[i];
      if (andSeek && s.at != null) seek(s.at + 0.02, false);
      drawSide(); drawOver();
    }
    function setAt(i, t) {
      const s = slides()[i];
      if (t != null && s.times && s.at != null) s.times = s.times.map((x) => round2(x + t - s.at));
      if (t == null) delete s.times;
      s.at = t == null ? null : round2(t);
      touch(); updatePlayer(); drawSide();
    }
    function wordsChanged(s, v) {
      s.words = v;
      if (s.times && s.times.length !== wordsOf(s).length) delete s.times; // the sing-along times no longer fit
      touch(); updatePlayer(); drawMarks();
    }
    function drawMarks() {
      if (!R.marks) return;
      R.marks.replaceChildren(...slides().map((s, i) => s.at == null ? null : h('button', {class: 'sv-mark' + (i === G.sel ? ' on' : ''), type: 'button', title: (s.words || 'Slide ' + (i + 1)) + ' · ' + clock(s.at),
        style: {left: s.at / G.data.duration * 100 + '%'}, onclick: () => select(i)})).filter(Boolean));
    }

    /** The slide list and the picked slide's boxes. */
    function drawSide() {
      if (!R.side || !G.song) return;
      drawMarks();
      const ss = slides();
      if (G.sel >= ss.length) G.sel = ss.length - 1;
      R.rows = ss.map((s, i) => h('div', {class: 'sv-row' + (i === G.sel ? ' on' : ''), onclick: (e) => { if (i !== G.sel && e.target.tagName !== 'INPUT') select(i); }}, [
        h('button', {class: 't' + (s.at == null ? ' none' : ''), type: 'button', title: 'Go to this slide', text: s.at == null ? 'no time yet' : clock(s.at) + (s.times ? ' ♪' : ''), onclick: (e) => { e.stopPropagation(); select(i); }}),
        h('input', {type: 'text', value: s.words, placeholder: i === 0 ? 'The words of this slide (or leave it empty)' : 'The words of this slide', 'aria-label': 'Words of slide ' + (i + 1),
          onfocus: () => { if (i !== G.sel) { G.sel = i; G.cast = -1; R.rows.forEach((r, k) => r.classList.toggle('on', k === i)); drawSlide(); drawMarks(); if (s.at != null && !playing()) seek(s.at + 0.02, false); } },
          oninput: (e) => wordsChanged(s, e.target.value),
          onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); addSlide(i); } }}),
      ]));
      R.list.replaceChildren(...R.rows);
      drawSlide();
      timeUIRows();
    }
    const timeUIRows = () => { const now = slideAt(G.time); (R.rows || []).forEach((r, i) => r.classList.toggle('now', i === now)); };
    function addSlide(after) {
      ss_insert(after + 1, {at: null, words: ''});
      G.sel = after + 1; G.cast = -1; touch(); updatePlayer(); drawSide();
      const inp = R.rows[G.sel] && R.rows[G.sel].querySelector('input'); if (inp) inp.focus();
    }
    const ss_insert = (i, s) => slides().splice(i, 0, s);
    async function removeSlide(i) {
      const s = slides()[i];
      if ((s.words || s.cast || s.back) && !(await window.ask('Remove this slide?'))) return;
      const next = slides()[i + 1];
      // What it set for the slides after it stays with them.
      if (next) { if (s.cast && !next.cast) next.cast = s.cast; if (s.back && !next.back) next.back = s.back; }
      slides().splice(i, 1);
      if (!slides().length) slides().push({at: 0, words: ''});
      G.sel = Math.min(i, slides().length - 1); G.cast = -1; touch(); updatePlayer(); drawSide(); drawOver();
    }

    /** The boxes for the picked slide: its time, background and characters. */
    function drawSlide() {
      if (!R.slide) return;
      const i = G.sel, s = slides()[i];
      const kids = [];
      const timeBox = h('input', {class: 'sv-in', type: 'text', value: s.at == null ? '' : clock(s.at), placeholder: 'no time yet', 'aria-label': 'Starts at', style: {width: '110px'},
        onchange: (e) => { const v = e.target.value.trim() === '' ? null : readClock(e.target.value); if (v == null && e.target.value.trim() !== '') { e.target.value = s.at == null ? '' : clock(s.at); return; } setAt(i, v == null ? null : Math.min(v, G.data.duration)); }});
      kids.push(h('div', {class: 'row', style: {justifyContent: 'flex-start'}}, [
        h('b', {text: 'Slide ' + (i + 1)}),
        h('label', {class: 'small'}, ['Starts at ', timeBox]),
        h('button', {class: 'btn', type: 'button', text: 'Starts now (' + clock(G.time) + ')', onclick: () => setAt(i, G.time)}),
        s.times ? h('button', {class: 'btn', type: 'button', text: 'Forget its word times', onclick: () => { delete s.times; touch(); updatePlayer(); drawSide(); }}) : null,
      ]));

      // Background
      const bo = owner(i, 'back'), own = !!s.back, eff = bo >= 0 ? slides()[bo].back : null;
      const mode = own ? (s.back.sprite ? 'sprite' : 'color') : 'same';
      const backSel = h('select', {'aria-label': 'Background', onchange: async (e) => {
        const v = e.target.value;
        if (v === 'same') delete s.back;
        else if (v === 'color') s.back = {color: (eff && eff.color) || G.song.color};
        else { s.back = {sprite: '', ...(eff && eff.color ? {color: eff.color} : {})}; }
        touch(); updatePlayer(); drawSlide();
      }}, [['same', i === 0 ? 'The song’s color' : 'Same as the slide before'], ['color', 'A color just from here on'], ['sprite', 'One of my drawings']].map(([v, t]) => h('option', {value: v, selected: v === mode, text: t})));
      const backRow = [h('label', {class: 'small'}, ['Background ', backSel])];
      if (own) backRow.push(h('label', {class: 'small'}, [s.back.sprite !== undefined && mode === 'sprite' ? 'Color behind it ' : 'Color ', h('input', {type: 'color', value: s.back.color || G.song.color, oninput: (e) => { s.back.color = e.target.value.toUpperCase(); touch(); updatePlayer(); }})]));
      kids.push(h('div', {class: 'row', style: {justifyContent: 'flex-start'}}, backRow));
      if (mode === 'sprite') {
        kids.push(s.back.sprite ? h('div', {class: 'row', style: {justifyContent: 'flex-start'}}, [h('span', {class: 'small', text: 'Drawing: ' + s.back.sprite}), h('button', {class: 'btn', type: 'button', text: 'Change…', onclick: () => { s.back.sprite = ''; drawSlide(); }})])
          : window.SpriteGallery.picker({items: G.sprites, state: G.backPick, onPick: async (sp) => { await needArt(sp.slug); if (!G.arts[sp.slug]) { statusUI(); return; } s.back.sprite = sp.slug; touch(); updatePlayer(); drawSlide(); }}));
      }

      // Characters
      const co = owner(i, 'cast'), ownCast = !!s.cast, list = castList();
      const head = [h('b', {text: 'Characters'})];
      if (i > 0) head.push(h('label', {class: 'small'}, [h('input', {type: 'checkbox', checked: !ownCast, onchange: async (e) => {
        if (e.target.checked) { if (s.cast.length && !(await window.ask('Take this slide’s own characters away and show the ones from the slide before?'))) { e.target.checked = false; return; } delete s.cast; }
        else s.cast = clone(list);
        G.cast = -1; touch(); updatePlayer(); drawSlide(); R.overKey = null; drawOver();
      }}), ' Same as the slide before']));
      kids.push(h('div', {class: 'row', style: {justifyContent: 'flex-start'}}, head));
      if (!ownCast && co >= 0 && co !== i && list.length) kids.push(h('div', {class: 'small muted', text: 'These come from slide ' + (co + 1) + ': changing them here changes them there too.'}));
      const parts = [...G.data.partNames.map((p) => [p.key, p.label + (p.key === 'beat' ? '' : ' (' + p.count + ')')]), ['none', 'Nothing: plays on its own']];
      list.forEach((c, k) => {
        const set = (key, v) => { if (v === undefined) delete c[key]; else c[key] = v; touch(); updatePlayer(); R.overKey = null; drawOver(); };
        kids.push(h('div', {class: 'sv-cast' + (k === G.cast ? ' on' : ''), onclick: () => { if (G.cast !== k) { G.cast = k; drawSlide(); R.overKey = null; drawOver(); } }}, [
          h('div', {class: 'row'}, [h('b', {class: 'small', text: c.sprite}), h('button', {class: 'btn', type: 'button', text: 'Remove', onclick: (e) => { e.stopPropagation(); removeCast(k); }})]),
          h('div', {class: 'row', style: {justifyContent: 'flex-start'}}, [
            h('label', {class: 'small'}, ['Dances to ', h('select', {onchange: (e) => set('to', e.target.value)}, parts.map(([v, t]) => h('option', {value: v, selected: v === c.to, text: t})))]),
            h('label', {class: 'small'}, ['Move ', h('select', {onchange: (e) => set('move', e.target.value === 'hop' ? undefined : e.target.value)}, MOVES.map(([v, t]) => h('option', {value: v, selected: v === (c.move || 'hop'), text: t})))]),
            h('label', {class: 'small'}, [h('input', {type: 'checkbox', checked: !!c.flip, onchange: (e) => set('flip', e.target.checked ? true : undefined)}), ' Flip']),
          ]),
        ]));
      });
      if (G.adding) kids.push(window.SpriteGallery.picker({items: G.sprites, state: G.pick, onPick: addCast}), h('button', {class: 'btn', type: 'button', text: 'Cancel', style: {alignSelf: 'flex-start'}, onclick: () => { G.adding = false; drawSlide(); }}));
      else kids.push(h('button', {class: 'btn', type: 'button', text: '+ Add a character', style: {alignSelf: 'flex-start'}, disabled: list.length >= 12, onclick: () => { G.adding = true; drawSlide(); }}));
      if (list.length) kids.push(h('div', {class: 'small muted', text: s.at == null ? 'Give this slide a time to move its characters on the video.' : 'Pause on this slide, then drag a character on the video; drag its corner to resize.'}));

      kids.push(h('div', {class: 'row', style: {justifyContent: 'flex-start', borderTop: '1px solid var(--rule)', paddingTop: '10px'}}, [
        h('button', {class: 'btn', type: 'button', text: '+ Add a slide after this', onclick: () => addSlide(i)}),
        h('button', {class: 'btn', type: 'button', text: 'Remove this slide', onclick: () => removeSlide(i)}),
      ]));
      R.slide.replaceChildren(...kids);
    }

    function pasteBox() {
      const ta = h('textarea', {class: 'sv-in', rows: '8', placeholder: 'One line of the song per line here. Each line becomes a slide.', style: {width: '100%'}});
      return h('div', {class: 'stack', style: {gap: '8px'}}, [ta, h('div', {class: 'row', style: {justifyContent: 'flex-start'}}, [
        h('button', {class: 'btn primary', type: 'button', text: 'Make the slides', onclick: () => {
          const lines = ta.value.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
          if (!lines.length) return;
          // Added after the slides already here: the empty first slide stays as the part before the singing.
          slides().push(...lines.map((w) => ({at: null, words: w})));
          G.pasting = false; touch(); updatePlayer(); draw();
        }}),
        h('button', {class: 'btn', type: 'button', text: 'Cancel', onclick: () => { G.pasting = false; draw(); }}),
      ])]);
    }

    function newBox() {
      const name = h('input', {class: 'sv-in', type: 'text', placeholder: 'The song’s name', 'aria-label': 'The song’s name', style: {flex: '1', minWidth: '180px'}});
      const audio = h('input', {type: 'file', accept: 'audio/*,.mp3,.wav,.m4a,.aif,.aiff'}), midi = h('input', {type: 'file', accept: '.mid,.midi,audio/midi'});
      const note = h('div', {class: 'small', style: {color: 'var(--accent)'}});
      return h('div', {class: 'card'}, [
        h('h2', {text: 'New song'}),
        h('div', {class: 'row', style: {justifyContent: 'flex-start'}}, [name]),
        h('label', {class: 'small'}, ['The finished song (mp3 or wav from Logic) ', audio]),
        h('label', {class: 'small'}, ['Its MIDI, if you have it (File → Export → All Tracks as MIDI File): characters can then dance to each instrument exactly ', midi]),
        note,
        h('div', {class: 'row', style: {justifyContent: 'flex-start'}}, [
          h('button', {class: 'btn primary', type: 'button', text: 'Make it', onclick: async (e) => {
            if (!name.value.trim()) { note.textContent = 'Give the song a name.'; return; }
            if (!audio.files[0]) { note.textContent = 'Pick the song’s sound file.'; return; }
            e.target.disabled = true; note.textContent = 'Listening to the song… (a minute for a long one)';
            try {
              const r = await post('/api/song/new', {name: name.value.trim(), title: name.value.trim()});
              await sendFile(r.name, 'audio', audio.files[0]);
              if (midi.files[0]) await sendFile(r.name, 'midi', midi.files[0]);
              G.creating = false; await loadList(); await load(r.name);
            } catch (err) { note.textContent = err.message; e.target.disabled = false; }
          }}),
          h('button', {class: 'btn', type: 'button', text: 'Cancel', onclick: () => { G.creating = false; draw(); }}),
        ]),
      ]);
    }
    function replaceFile(kind, label, accept) {
      const inp = h('input', {type: 'file', accept, style: {display: 'none'}, onchange: async () => {
        if (!inp.files[0]) return;
        if (G.dirty && !(await save())) return;
        G.msg = 'Listening to the song…'; statusUI();
        try { await sendFile(G.name, kind, inp.files[0]); await load(G.name); G.msg = 'Done.'; } catch (e) { G.error = e.message; }
        statusUI();
      }});
      return h('span', null, [inp, h('button', {class: 'btn', type: 'button', text: label, onclick: () => inp.click()})]);
    }

    // ---------- making the video ----------
    async function makeVideo() {
      if (G.dirty && !(await save())) return;
      if (!slides().some((s) => s.at != null)) { G.error = 'No slide has a time yet.'; statusUI(); return; }
      try { G.job = await post('/api/song/render', {name: G.name}); } catch (e) { G.error = e.message; statusUI(); return; }
      drawJob(); pollJob();
    }
    async function pollJob() {
      clearTimeout(R.poll);
      let j; try { j = await api('/api/job'); } catch { j = null; }
      if (j && j.kind === 'song' && j.id === G.name) {
        G.job = j;
        if (!j.running) { if (j.ok) { try { G.video = (await api('/api/song?name=' + encodeURIComponent(G.name))).video; } catch {} } drawJob(); return; }
        drawJob();
      }
      if (G.job && G.job.running) R.poll = setTimeout(pollJob, 1000);
    }
    function drawJob() {
      if (!R.job) return;
      const j = G.job, kids = [];
      if (j && j.running) kids.push(h('div', {class: 'small', text: j.step + (j.progress != null ? ' ' + Math.round(j.progress * 100) + '%' : '')}), h('div', {class: 'sv-bar'}, [h('i', {style: {width: Math.round((j.progress || 0) * 100) + '%'}})]));
      else if (j && j.error) kids.push(h('div', {class: 'notice error', text: 'The video could not be made: ' + j.error}));
      if ((!j || !j.running) && G.video) kids.push(h('div', {class: 'row', style: {justifyContent: 'flex-start'}}, [
        h('span', {class: 'small', text: 'Video made ' + new Date(G.video.at).toLocaleString([], {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'}) + ' (' + G.video.mb + ' MB)'}),
        h('a', {class: 'btn', href: '/song-video/' + G.name + '.mp4?v=' + G.video.at, target: '_blank', text: 'Watch it'}),
        h('button', {class: 'btn', type: 'button', text: 'Show it in Finder', onclick: () => post('/api/song/reveal', {name: G.name}).catch((e) => { G.error = e.message; statusUI(); })}),
      ]));
      R.job.replaceChildren(...kids);
      if (R.make) R.make.disabled = !!(j && j.running);
    }

    function draw() {
      const kids = [];
      R.status = h('span', {class: 'small'});
      R.save = h('button', {class: 'btn primary', type: 'button', text: 'Save', onclick: save});
      R.make = h('button', {class: 'btn', type: 'button', text: 'Make the video', onclick: makeVideo});
      kids.push(h('div', {class: 'row'}, [
        h('div', {class: 'row', style: {justifyContent: 'flex-start'}}, [
          G.names.length ? h('select', {'aria-label': 'Song', onchange: async (e) => { const v = e.target.value; if (G.dirty && !(await window.ask('Your changes to this song aren’t saved. Leave them?'))) { e.target.value = G.name; return; } load(v); }},
            G.names.map((n) => h('option', {value: n.name, selected: n.name === G.name, text: n.title}))) : null,
          h('button', {class: 'btn', type: 'button', text: '+ New song', onclick: () => { G.creating = !G.creating; draw(); }}),
        ]),
        G.song ? h('div', {class: 'row', style: {justifyContent: 'flex-end'}}, [R.status, R.save, R.make]) : R.status,
      ]));
      if (G.creating) kids.push(newBox());
      if (!G.song) {
        if (!G.creating) kids.push(h('div', {class: 'card'}, [h('h2', {text: 'Music videos'}), h('p', {class: 'muted', text: G.names.length ? 'Pick a song above.' : 'Make the song in Logic, then bring it here: + New song.'})]));
        root.replaceChildren(...kids); statusUI(); return;
      }
      R.job = h('div', {class: 'stack', style: {gap: '6px'}});
      kids.push(R.job);
      if (!G.data.audio) {
        kids.push(h('div', {class: 'notice error'}, ['This song has no sound file yet. ', replaceFile('audio', 'Pick the song’s sound file…', 'audio/*,.mp3,.wav,.m4a,.aif,.aiff')]));
        root.replaceChildren(...kids); statusUI(); return;
      }
      if (!R.playerBox) mountPlayer();
      R.time = h('span', {class: 'small muted', style: {minWidth: '110px'}});
      R.play = h('button', {class: 'btn primary', type: 'button', text: 'Play', style: {minWidth: '84px'}, onclick: toggle});
      R.seek = h('input', {class: 'sv-seek', type: 'range', min: '0', max: String(G.data.duration), step: '0.01', value: String(G.time), 'aria-label': 'Place in the song', oninput: (e) => seek(Number(e.target.value))});
      R.marks = h('div', {class: 'sv-marks'});
      R.tap = h('div', {class: 'sv-tap', style: {display: 'none'}});
      R.list = h('div', {class: 'sv-list'});
      R.slide = h('div', {class: 'card'});
      const S2 = G.song;
      const settings = h('div', {class: 'card'}, [
        h('div', {class: 'row', style: {justifyContent: 'flex-start'}}, [
          h('label', {class: 'small'}, ['Title ', h('input', {class: 'sv-in', type: 'text', value: S2.title, oninput: (e) => { S2.title = e.target.value; touch(); }})]),
          h('label', {class: 'small'}, ['Background color ', h('input', {type: 'color', value: S2.color, oninput: (e) => { S2.color = e.target.value.toUpperCase(); touch(); updatePlayer(); }})]),
          h('label', {class: 'small'}, [h('input', {type: 'checkbox', checked: S2.shapes !== false, onchange: (e) => { S2.shapes = e.target.checked; touch(); updatePlayer(); }}), ' Bouncing shapes']),
          h('label', {class: 'small'}, ['Words ', h('select', {onchange: (e) => { S2.words = e.target.value; touch(); updatePlayer(); }}, [['top', 'at the top'], ['middle', 'in the middle'], ['bottom', 'at the bottom']].map(([v, t]) => h('option', {value: v, selected: v === S2.words, text: t})))]),
        ]),
        h('div', {class: 'row', style: {justifyContent: 'flex-start'}}, [
          h('span', {class: 'small muted', text: G.data.hasMidi ? 'Dancing follows your MIDI: ' + G.data.partNames.filter((p) => p.key !== 'beat').map((p) => p.label).join(', ') + '.' : 'No MIDI yet: the beat, drums, bass and melody are guessed from the sound.'}),
          replaceFile('midi', G.data.hasMidi ? 'Change the MIDI…' : 'Add its MIDI…', '.mid,.midi,audio/midi'),
          replaceFile('audio', 'Change the song file…', 'audio/*,.mp3,.wav,.m4a,.aif,.aiff'),
        ]),
      ]);
      const left = h('div', {class: 'stack', style: {gap: '10px'}}, [
        R.stage, R.marks, R.seek,
        h('div', {class: 'row', style: {justifyContent: 'flex-start'}}, [R.play, R.time,
          h('button', {class: 'btn', type: 'button', text: 'Tap the lines', title: 'Play, and press Space as each line starts', onclick: () => startTap('lines')}),
          h('button', {class: 'btn', type: 'button', text: 'Tap the words', title: 'Sing-along: press Space on every word', onclick: () => startTap('words')}),
        ]),
        R.tap, R.slide,
      ]);
      const right = h('div', {class: 'stack', style: {gap: '10px'}}, [
        h('div', {class: 'row'}, [h('b', {text: 'Slides'}), h('button', {class: 'btn', type: 'button', text: 'Paste all the words…', onclick: () => { G.pasting = !G.pasting; draw(); }})]),
        G.pasting ? pasteBox() : null,
        R.list,
        h('div', {class: 'small muted', text: 'Tap the lines starts at the picked slide. ♪ marks a slide with sing-along word times. A slide with no words is fine: use one for a part with no singing.'}),
      ]);
      R.side = right;
      kids.push(h('div', {class: 'sv-grid'}, [left, right]), settings);
      root.replaceChildren(...kids);
      R.overKey = null;
      statusUI(); drawSide(); drawTap(); drawJob(); timeUI();
    }

    (async () => {
      root.replaceChildren(h('p', {class: 'muted', text: 'Loading…'}));
      try {
        const [, sprites] = await Promise.all([loadList(), api('/api/sprites')]);
        G.sprites = sprites.filter((s) => s.kind !== 'comic');
        const last = localStorage.getItem('songName');
        const first = G.names.find((n) => n.name === last) || G.names[0];
        if (first) await load(first.name); else draw();
        pollJob();
      } catch (e) { root.replaceChildren(h('div', {class: 'notice error', text: e.message})); }
    })();

    return {
      dirty: () => G.dirty,
      pause() { stopTap(); if (G.player) G.player.pause(); },
      /** Her drawings may have changed on the Pixel art tab. */
      async refresh() { try { G.sprites = (await api('/api/sprites')).filter((s) => s.kind !== 'comic'); } catch {} },
    };
  }
  return {open};
})();
