// A reference picture to draw over (Pixel art and Sketch): a picture from her Mac, one copied
// from any web page or search (Google, DuckDuckGo: Copy Image / Copy Image Address, then paste),
// or one from the studio's free picture search, shown faintly
// under the drawing, with how faint, how big and where. It's only a guide: never saved into the
// drawing, and it stays while she switches drawings (until the page reloads).
'use strict';
window.DrawReference = (() => {
  const R = {img: null, name: '', opacity: 0.35, size: 1, x: 0, y: 0, show: true};
  function h(tag, attrs, kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'text') e.textContent = v; else if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of [].concat(kids || [])) if (c !== null && c !== undefined && c !== false) e.append(c);
    return e;
  }
  /** Paint it (fitted to the drawing area w×h, then sized and moved) at its faintness. */
  function draw(g, w, hgt) {
    if (!R.img || !R.show) return;
    const k = Math.min(w / R.img.width, hgt / R.img.height) * R.size;
    const iw = R.img.width * k, ih = R.img.height * k;
    g.save();
    g.globalAlpha = R.opacity;
    g.imageSmoothingEnabled = true;
    g.drawImage(R.img, (w - iw) / 2 + R.x * w, (hgt - ih) / 2 + R.y * hgt, iw, ih);
    g.restore();
  }
  /** The controls; onChange redraws the canvas. */
  function controls(onChange) {
    const box = h('details', {class: 'ref-box', open: R.img ? true : null});
    const status = h('div', {class: 'small muted'});
    // Pictures from the web come through the studio (/api/fetch-image), so the page can draw them.
    const use = (src, name) => {
      const img = new Image();
      status.textContent = 'Loading the picture…';
      img.onload = () => { R.img = img; R.name = name; R.show = true; status.textContent = ''; render(); onChange(); };
      img.onerror = () => { status.textContent = 'Couldn’t load that picture.'; };
      img.src = src;
    };
    const fromLink = async (link) => {
      status.textContent = 'Getting the picture…';
      const r = await fetch('/api/fetch-image?url=' + encodeURIComponent(link));
      if (!r.ok) { const j = await r.json().catch(() => ({})); status.textContent = j.error || 'Couldn’t get that picture.'; return; }
      use(URL.createObjectURL(await r.blob()), new URL(link).hostname);
    };
    const render = () => {
      const file = h('input', {type: 'file', accept: 'image/*', onchange: (e) => {
        const f = e.target.files[0];
        if (f) use(URL.createObjectURL(f), f.name);
      }});
      // Paste here: a copied picture, or a picture's link.
      const paste = h('input', {type: 'text', class: 'read-line ref-paste', placeholder: 'Click here, then ⌘V a copied picture or its link', onpaste: (e) => {
        const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
        if (item) { e.preventDefault(); use(URL.createObjectURL(item.getAsFile()), 'pasted picture'); return; }
        const text = e.clipboardData?.getData('text') || '';
        if (/^https?:\/\//.test(text.trim())) { e.preventDefault(); fromLink(text.trim()); }
      }, onkeydown: (e) => { if (e.key === 'Enter' && /^https?:\/\//.test(e.target.value.trim())) fromLink(e.target.value.trim()); }});
      // The studio's free picture search (her gallery, Wikimedia Commons, museums).
      const q = h('input', {type: 'search', class: 'read-line', placeholder: 'Or search free pictures, e.g. Hagia Sophia', style: 'flex:1'});
      const results = h('div', {class: 'ref-results'});
      const search = async () => {
        if (!q.value.trim()) return;
        status.textContent = 'Searching…'; results.replaceChildren();
        try {
          const d = await (await fetch('/api/images/search?q=' + encodeURIComponent(q.value) + '&source=all')).json();
          status.textContent = d.results.length ? 'Pick one.' : 'Nothing found; try other words.';
          results.replaceChildren(...d.results.slice(0, 18).map((r) => h('button', {class: 'ref-pick', type: 'button', title: r.title, onclick: () => {
            // A big-enough copy (Wikimedia originals can be huge).
            fromLink(r.source === 'wikimedia' && r.thumb ? r.thumb.replace(/\/\d+px-/, '/1280px-') : r.full || r.thumb);
          }}, [h('img', {src: r.thumb, alt: r.title, loading: 'lazy'})])));
        } catch (e) { status.textContent = 'Search failed: ' + e.message; }
      };
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } });
      const slider = (label, key, min, max, step) => h('label', {class: 'tl-field'}, [h('span', {text: label}),
        h('input', {type: 'range', min, max, step, value: R[key], oninput: (e) => { R[key] = +e.target.value; onChange(); }})]);
      box.replaceChildren(
        h('summary', {text: R.img ? 'Reference picture: ' + R.name : 'Reference picture (to trace or copy from)'}),
        h('div', {class: 'stack', style: {gap: '8px', paddingTop: '8px'}}, [
          h('label', {class: 'small'}, [R.img ? 'Choose another from your Mac: ' : 'Choose a picture from your Mac: ', file]),
          paste,
          h('div', {class: 'small muted', text: 'From Google or DuckDuckGo: right-click a picture → Copy Image (or Copy Image Address), then paste it above.'}),
          h('div', {class: 'row', style: 'gap:8px;flex-wrap:nowrap'}, [q, h('button', {class: 'btn', type: 'button', text: 'Search', onclick: search})]),
          results, status,
          R.img ? h('div', {class: 'row', style: {gap: '10px', flexWrap: 'wrap'}}, [
            slider('How faint', 'opacity', 0.05, 1, 0.05), slider('Size', 'size', 0.2, 3, 0.05),
            slider('Left ↔ right', 'x', -0.6, 0.6, 0.01), slider('Up ↕ down', 'y', -0.6, 0.6, 0.01)]) : null,
          R.img ? h('div', {class: 'row', style: {gap: '8px'}}, [
            h('label', {class: 'small'}, [h('input', {type: 'checkbox', checked: R.show || null, onchange: (e) => { R.show = e.target.checked; onChange(); }}), ' Show it']),
            h('button', {class: 'btn', text: 'Remove it', onclick: () => { R.img = null; R.name = ''; render(); onChange(); }})]) : null,
          h('div', {class: 'small muted', text: 'Only a guide: it isn’t saved in the drawing.'}),
        ]),
      );
    };
    render();
    return box;
  }
  return {draw, controls};
})();

// Her saved drawings, for the Pixel art and Sketch tabs: starred favorites, the 10 most
// recent, and a search for everything else (there will be a lot of them).
window.SpriteGallery = (() => {
  const RECENT = 10;
  function h(tag, attrs, kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'text') e.textContent = v; else if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of [].concat(kids || [])) if (c !== null && c !== undefined && c !== false) e.append(c);
    return e;
  }
  /** items: saved drawings (name, slug, at, favorite). state: {open, q} kept by the tab between redraws. */
  function build({items, state, current, noun, onNew, onToggle, onOpen, onFavorite}) {
    const byNew = (a, b) => (b.at || 0) - (a.at || 0);
    const list = h('div', {class: 'stack', style: {gap: '4px'}});
    const row = (s) => h('div', {class: 'row', style: {gap: '6px', flexWrap: 'nowrap'}}, [
      h('button', {class: 'btn', title: s.favorite ? 'Remove from favorites' : 'Add to favorites', 'aria-label': (s.favorite ? 'Unfavorite ' : 'Favorite ') + s.name, 'aria-pressed': s.favorite ? 'true' : 'false',
        text: s.favorite ? '★' : '☆', onclick: () => onFavorite(s.slug, !s.favorite)}),
      h('span', {style: {flex: '1', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: s.slug === current ? '700' : '400'}, text: s.name}),
      h('button', {class: 'btn', text: 'Open', onclick: () => onOpen(s, false)}),
      h('button', {class: 'btn', title: 'Start a new one from a copy of this (all frames)', text: 'Copy', onclick: () => onOpen(s, true)}),
    ]);
    const heading = (t) => h('div', {class: 'small muted', text: t});
    const draw = () => {
      const q = state.q.trim().toLowerCase();
      const out = [];
      if (q) {
        const hits = items.filter((s) => q.split(/\s+/).every((w) => s.name.toLowerCase().includes(w))).sort(byNew);
        out.push(heading(hits.length ? `${hits.length} found` : 'Nothing matches.'), ...hits.map(row));
      } else {
        const favs = items.filter((s) => s.favorite).sort((a, b) => a.name.localeCompare(b.name));
        if (favs.length) out.push(heading('★ Favorites'), ...favs.map(row));
        const recent = [...items].sort(byNew).slice(0, RECENT);
        out.push(heading(items.length > RECENT ? `Last ${RECENT} (search for the other ${items.length - RECENT})` : 'Your drawings'), ...recent.map(row));
        if (!items.length) out.push(heading(`No ${noun}s saved yet.`));
      }
      list.replaceChildren(...out);
    };
    const search = h('input', {type: 'search', value: state.q, placeholder: `Search your ${noun}s by name`, 'aria-label': `Search your ${noun}s`, oninput: (e) => { state.q = e.target.value; draw(); }});
    draw();
    const panel = h('div', {class: 'stack', style: {gap: '6px', padding: '8px', border: '1px solid currentColor', borderRadius: '8px', maxHeight: '320px', overflowY: 'auto'}}, [search, list]);
    return h('div', {class: 'stack', style: {gap: '6px'}}, [
      h('div', {class: 'row', style: {gap: '8px', justifyContent: 'flex-start'}}, [
        h('button', {class: 'btn', text: 'New ' + noun, onclick: onNew}),
        h('button', {class: 'btn', 'aria-expanded': state.open ? 'true' : 'false', text: (state.open ? 'Hide' : 'Open a saved ' + noun) + (items.length ? ` (${items.length})` : ''), onclick: () => { state.open = !state.open; onToggle(); }}),
      ]),
      state.open ? panel : null,
    ]);
  }
  return {build};
})();
