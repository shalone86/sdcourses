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
