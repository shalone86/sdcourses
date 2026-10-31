// Colors for one use of a drawing ({'#OLD': '#new'}), without saving a new drawing: a sprite or
// puppet scene's `colors:` (Timing tab) and a battle army's or unit's (Battles tab). One box per color
// of the drawing (the "parts", as in New character from a base), with "same as" squares, and a
// small preview. "Save as a character…" makes it a real drawing for one she'll reuse.
'use strict';
window.ColorSwaps = (() => {
  const CODES = '0123456789abcdefghijklmnopqrstuvwxyz';
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
  const pixelArt = (a) => a && a.kind !== 'sketch' && Array.isArray(a.palette) && Array.isArray(a.frames);
  /** The colors the drawings really use (uppercase), most used first. */
  function partsOf(arts) {
    const n = {};
    for (const a of arts.filter(pixelArt)) for (const rows of a.frames) for (const row of rows) for (const ch of row) {
      if (ch === '.') continue;
      const c = String(a.palette[CODES.indexOf(ch)] || '').toUpperCase();
      if (c) n[c] = (n[c] || 0) + 1;
    }
    return Object.entries(n).sort((x, y) => y[1] - x[1]).map(([c]) => c);
  }
  function preview(a, colors, px = 4) {
    const cv = h('canvas', {width: a.width, height: a.height, style: {width: a.width * px + 'px', height: a.height * px + 'px', imageRendering: 'pixelated', background: 'repeating-conic-gradient(rgba(127,127,127,.18) 0 25%, transparent 0 50%) 0 0/8px 8px', borderRadius: '4px'}});
    const ctx = cv.getContext('2d');
    a.frames[0].forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== '.') {
      const c = String(a.palette[CODES.indexOf(row[x])] || '').toUpperCase();
      ctx.fillStyle = colors[c] || c; ctx.fillRect(x, y, 1, 1);
    } });
    return cv;
  }

  /**
   * The editor. arts: the drawings it applies to (e.g. each kind of soldier in an army); colors:
   * the swaps so far; onChange(colors) after every change (an empty object means as drawn).
   * saveAs (optional): {from, api post} for "Save as a character…".
   */
  function editor({arts, colors, onChange, saveAs, post}) {
    let c = {...(colors || {})};
    const box = h('div', {class: 'cs-box', style: {display: 'grid', gap: '8px', padding: '8px 10px', borderRadius: '8px', background: 'var(--panel-2, rgba(127,127,127,.12))'}});
    const set = (next) => { c = Object.fromEntries(Object.entries(next).filter(([k, v]) => v && v.toUpperCase() !== k)); onChange({...c}); render(); };
    function render() {
      const parts = partsOf(arts);
      const now = (p) => (c[p] || p).toUpperCase();
      const current = [...new Set(parts.map(now))];
      const row = (p) => h('div', {style: {display: 'flex', gap: '6px', alignItems: 'center', minWidth: '0'}}, [
        h('span', {title: 'As drawn: ' + p, style: {width: '16px', height: '16px', borderRadius: '4px', background: p, border: '1px solid var(--rule)', flex: 'none'}}),
        h('span', {class: 'small muted', text: '→'}),
        h('input', {type: 'color', value: now(p).toLowerCase(), 'aria-label': 'New color for the part drawn ' + p, onchange: (e) => set({...c, [p]: e.target.value.toUpperCase()})}),
        h('span', {class: 'small muted', style: {whiteSpace: 'nowrap'}, text: 'same as'}),
        h('span', {style: {display: 'flex', gap: '3px', flexWrap: 'wrap', minWidth: '0'}}, current.filter((x) => x !== now(p)).map((x) =>
          h('button', {class: 'px-same', type: 'button', title: 'Same as ' + x, 'aria-label': 'Same color as ' + x, style: {background: x}, onclick: () => set({...c, [p]: x})}))),
        c[p] ? h('button', {class: 'btn', type: 'button', text: '↺', title: 'Back to ' + p, 'aria-label': 'Back to the color as drawn', style: {padding: '0 6px'}, onclick: () => { const n = {...c}; delete n[p]; set(n); }}) : null,
      ]);
      const shown = arts.filter(pixelArt);
      box.replaceChildren(...[
        shown.length ? h('div', {style: {display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end'}}, shown.slice(0, 6).map((a) => preview(a, c))) : null,
        parts.length ? h('div', {style: {display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '6px 12px'}}, parts.map(row))
          : h('div', {class: 'small muted', text: 'Pick a pixel drawing first (sketches keep their own colors).'}),
        h('div', {class: 'row', style: {justifyContent: 'flex-start', gap: '8px'}}, [
          Object.keys(c).length ? h('button', {class: 'btn', type: 'button', text: 'All back to the drawing’s colors', onclick: () => set({})}) : null,
          saveAs && Object.keys(c).length ? h('button', {class: 'btn', type: 'button', text: 'Save as a character…', title: 'For one you’ll use again: makes real drawings of every pose in these colors', onclick: () => saveForm()}) : null,
          h('span', {class: 'small muted', text: 'Only here: the drawing itself doesn’t change.'}),
        ]),
      ].filter(Boolean));
    }
    function saveForm() {
      const name = h('input', {type: 'text', placeholder: 'Its name, e.g. Frankish spearman', 'aria-label': 'Name for the new character'});
      const msg = h('span', {class: 'small muted'});
      const go = async () => {
        try {
          const r = await post('/api/sprite/save-colors', {from: saveAs.from(), name: name.value, colors: c});
          msg.textContent = 'Saved: ' + r.made.join(', ') + '. Pick it from the list to use it.';
          if (saveAs.done) saveAs.done(r);
        } catch (e) { msg.textContent = 'Couldn’t save it: ' + e.message; }
      };
      name.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      box.append(h('div', {class: 'row', style: {justifyContent: 'flex-start', gap: '8px'}}, [name, h('button', {class: 'btn primary', type: 'button', text: 'Save', onclick: go}), msg]));
      name.focus();
    }
    render();
    box.refresh = (newArts) => { if (newArts) arts = newArts; render(); };
    return box;
  }
  return {editor, partsOf};
})();
