// A reference picture to draw over (Pixel art and Sketch): a picture from her Mac shown faintly
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
    const render = () => {
      const file = h('input', {type: 'file', accept: 'image/*', onchange: (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const img = new Image();
        img.onload = () => { R.img = img; R.name = f.name; R.show = true; render(); onChange(); };
        img.src = URL.createObjectURL(f);
      }});
      const slider = (label, key, min, max, step) => h('label', {class: 'tl-field'}, [h('span', {text: label}),
        h('input', {type: 'range', min, max, step, value: R[key], oninput: (e) => { R[key] = +e.target.value; onChange(); }})]);
      box.replaceChildren(
        h('summary', {text: R.img ? 'Reference picture: ' + R.name : 'Reference picture (to trace or copy from)'}),
        h('div', {class: 'stack', style: {gap: '8px', paddingTop: '8px'}}, [
          h('label', {class: 'small'}, [R.img ? 'Choose another: ' : 'Choose a picture from your Mac: ', file]),
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
