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
      const more = h('button', {class: 'btn', type: 'button', text: 'Load more', hidden: true});
      let found = [], page = 0, term = '';
      const search = async (next) => {
        if (!next) { if (!q.value.trim()) return; term = q.value; page = 0; found = []; results.replaceChildren(); more.hidden = true; } else page++;
        status.textContent = next ? 'Loading more…' : 'Searching…';
        try {
          const d = await (await fetch('/api/images/search?q=' + encodeURIComponent(term) + '&source=all&page=' + page)).json();
          const have = new Set(found.map((r) => r.source + ':' + r.id));
          const fresh = d.results.filter((r) => !have.has(r.source + ':' + r.id));
          found = found.concat(fresh); more.hidden = !fresh.length;
          status.textContent = found.length ? 'Pick one' + (fresh.length ? ', or load more.' : '. That’s all there is.') : 'Nothing found; try other words.';
          results.replaceChildren(...found.map((r) => h('button', {class: 'ref-pick', type: 'button', title: r.title, onclick: () => {
            // A big-enough copy (Wikimedia originals can be huge).
            fromLink(r.source === 'wikimedia' && r.thumb ? r.thumb.replace(/\/\d+px-/, '/1280px-') : r.full || r.thumb);
          }}, [h('img', {src: r.thumb, alt: r.title, loading: 'lazy'})])));
        } catch (e) { status.textContent = 'Search failed: ' + e.message; }
      };
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); search(false); } });
      more.addEventListener('click', () => search(true));
      const slider = (label, key, min, max, step) => h('label', {class: 'tl-field'}, [h('span', {text: label}),
        h('input', {type: 'range', min, max, step, value: R[key], oninput: (e) => { R[key] = +e.target.value; onChange(); }})]);
      box.replaceChildren(
        h('summary', {text: R.img ? 'Reference picture: ' + R.name : 'Reference picture (to trace or copy from)'}),
        h('div', {class: 'stack', style: {gap: '8px', paddingTop: '8px'}}, [
          h('label', {class: 'small'}, [R.img ? 'Choose another from your Mac: ' : 'Choose a picture from your Mac: ', file]),
          paste,
          h('div', {class: 'small muted', text: 'From Google or DuckDuckGo: right-click a picture → Copy Image (or Copy Image Address), then paste it above.'}),
          h('div', {class: 'row', style: 'gap:8px;flex-wrap:nowrap'}, [q, h('button', {class: 'btn', type: 'button', text: 'Search', onclick: () => search(false)})]),
          results, more, status,
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

// Her saved drawings, for the Pixel art and Sketch tabs: a grid of small moving thumbnails,
// starred favorites first, then everything newest first, and a search by name.
window.SpriteGallery = (() => {
  const CODES = '0123456789abcdefghijklmnopqrstuvwxyz';
  const SIZE = 64;
  function h(tag, attrs, kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'text') e.textContent = v; else if (k === 'class') e.className = v;
      else if (k === 'style') Object.assign(e.style, v);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of [].concat(kids || [])) if (c !== null && c !== undefined && c !== false) e.append(c);
    return e;
  }
  // One frame of a saved pixel drawing (palette + rows), centered with sharp squares.
  function paintPixels(cv, s, i) {
    const g = cv.getContext('2d');
    const k = Math.max(1, Math.floor(SIZE / Math.max(s.width, s.height)));
    const ox = Math.floor((SIZE - s.width * k) / 2), oy = Math.floor((SIZE - s.height * k) / 2);
    g.clearRect(0, 0, SIZE, SIZE);
    (s.frames[i] || []).forEach((row, y) => { for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c !== '.') { g.fillStyle = s.palette[CODES.indexOf(c)]; g.fillRect(ox + x * k, oy + y * k, k, k); }
    } });
  }
  // A thumbnail that plays the drawing at its own speed while it's on the page.
  function thumb(s) {
    const n = (s.kind === 'sketch' ? s.urls : s.frames)?.length || 0;
    let el, show;
    if (s.kind === 'sketch') {
      el = h('img', {class: 'sg-thumb', alt: '', loading: 'lazy', src: s.urls?.[0] || ''});
      show = (i) => { el.src = s.urls[i]; };
    } else {
      el = h('canvas', {class: 'sg-thumb', width: SIZE, height: SIZE});
      show = (i) => paintPixels(el, s, i);
      show(0);
    }
    if (n > 1) el.sgPlay = {n, fps: Math.max(1, s.fps || 4), show, at: 0};
    return el;
  }
  let loop = null;
  function play(root) {
    cancelAnimationFrame(loop);
    const t0 = performance.now();
    const tick = (now) => {
      if (!root.isConnected) return;
      for (const el of root.querySelectorAll('.sg-thumb')) {
        const p = el.sgPlay;
        if (!p) continue;
        const i = Math.floor(((now - t0) / 1000) * p.fps) % p.n;
        if (i !== p.at) { p.at = i; p.show(i); }
      }
      loop = requestAnimationFrame(tick);
    };
    loop = requestAnimationFrame(tick);
  }
  /** items: saved drawings (name, slug, at, favorite, frames…). state: {open, q} kept by the tab between redraws. */
  function build({items, state, current, noun, onNew, onToggle, onOpen, onFavorite}) {
    const byNew = (a, b) => (b.at || 0) - (a.at || 0);
    const list = h('div', {class: 'stack', style: {gap: '6px'}});
    const tile = (s) => h('div', {class: 'sg-tile' + (s.slug === current ? ' on' : ''), title: s.name}, [
      h('button', {class: 'sg-open', 'aria-label': 'Open ' + s.name, onclick: () => onOpen(s, false)}, [thumb(s), h('span', {class: 'sg-name', text: s.name})]),
      h('div', {class: 'sg-foot'}, [h('button', {class: 'sg-star', title: s.favorite ? 'Remove from favorites' : 'Add to favorites', 'aria-label': (s.favorite ? 'Unfavorite ' : 'Favorite ') + s.name,
        'aria-pressed': s.favorite ? 'true' : 'false', text: s.favorite ? '★' : '☆', onclick: () => onFavorite(s.slug, !s.favorite)}),
      h('button', {class: 'sg-copy', title: 'Start a new one from a copy of this (all frames)', 'aria-label': 'Copy ' + s.name, text: 'Copy', onclick: () => onOpen(s, true)})]),
    ]);
    const grid = (xs) => h('div', {class: 'sg-grid'}, xs.map(tile));
    const heading = (t) => h('div', {class: 'small muted', text: t});
    const draw = () => {
      const q = state.q.trim().toLowerCase();
      const out = [];
      if (q) {
        const hits = items.filter((s) => q.split(/\s+/).every((w) => s.name.toLowerCase().includes(w))).sort(byNew);
        out.push(heading(hits.length ? `${hits.length} found` : 'Nothing matches.'), grid(hits));
      } else {
        const favs = items.filter((s) => s.favorite).sort((a, b) => a.name.localeCompare(b.name));
        if (favs.length) out.push(heading('★ Favorites'), grid(favs));
        if (items.length) out.push(heading(`All ${items.length}, newest first`), grid([...items].sort(byNew)));
        else out.push(heading(`No ${noun}s saved yet.`));
      }
      list.replaceChildren(...out);
      play(list);
    };
    const search = h('input', {type: 'search', value: state.q, placeholder: `Search your ${noun}s by name`, 'aria-label': `Search your ${noun}s`, oninput: (e) => { state.q = e.target.value; draw(); }});
    const panel = h('div', {class: 'stack', style: {gap: '6px', padding: '8px', border: '1px solid currentColor', borderRadius: '8px', maxHeight: '460px', overflowY: 'auto'}}, [search, list]);
    if (state.open) draw();
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
