// The kids thumbnail maker (Video & Ghost tab, kids lessons): the thumbnail live (video/KidsThumb.tsx
// in Remotion's Player) with a box over each drawing she can drag, and a corner to resize it. Up to
// 3 drawings, each with its own frame and flip. Saved to lesson.yml as `thumb.pics` (scripts/kids-thumb.mjs
// reads it when the lesson goes to Ghost); "Back to automatic" removes them. The title and corner
// shapes stay automatic.
(function () {
  'use strict';
  const W = 1280, H = 720, MAX = 3;
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

  function open(root, id, api, post) {
    const T = {data: null, pics: [], pick: 0, sprites: [], player: null, error: ''};
    const stage = h('div', {class: 'th-stage', tabindex: '0', 'aria-label': 'Thumbnail: drag a drawing to move it, its corner to resize it; arrow keys move the one picked'});
    const shot = h('div', {class: 'th-shot'});
    const over = h('div', {class: 'th-over'});
    stage.append(shot, over);
    const side = h('div', {class: 'stack', style: {gap: '8px'}});
    root.replaceChildren(
      h('h2', {text: 'Kids thumbnail'}),
      h('div', {class: 'small muted', text: 'Drag a drawing to move it and its corner to resize it. The dashed lines show what the kids site’s home page keeps (it cuts the sides off). The title and corner shapes stay as they are.'}),
      stage, side);

    // What the player draws: the last props from the server, with her moves on top.
    const props = () => ({...T.data.props, pics: T.data.props.pics.map((p, i) => ({...p, ...pick3(T.pics[i])}))});
    const pick3 = (p) => (p ? {x: p.x, y: p.y, size: p.size} : {});
    const redraw = () => { if (T.player) T.player.setProps(props()); boxes(); };

    async function load(d) {
      T.data = d;
      T.pics = (d.saved ?? []).map((p) => ({...p}));
      T.pick = Math.min(T.pick, Math.max(0, T.pics.length - 1));
      if (!T.player && window.StudioPlayer?.mountThumb) T.player = window.StudioPlayer.mountThumb(shot, props());
      redraw(); controls();
    }
    async function save(pics = T.pics) {
      try { await load(await post('/api/kids-thumb?id=' + encodeURIComponent(id), {pics, save: true})); T.error = ''; }
      catch (e) { T.error = 'Couldn’t save the thumbnail: ' + e.message; controls(); }
    }

    // ---------- the boxes over the drawings ----------
    function boxes() {
      over.replaceChildren(
        h('div', {class: 'th-crop', style: {left: (160 / W) * 100 + '%'}}), h('div', {class: 'th-crop', style: {left: (1120 / W) * 100 + '%'}}),
        ...T.pics.map((p, i) => {
          const w = p.size * (T.data.aspects[i] ?? 1);
          const box = h('div', {class: 'th-box' + (i === T.pick ? ' on' : ''), title: p.sprite,
            style: {left: ((p.x - w / 2) / W) * 100 + '%', top: ((p.y - p.size / 2) / H) * 100 + '%', width: (w / W) * 100 + '%', height: (p.size / H) * 100 + '%'}},
          [h('span', {class: 'th-num', text: String(i + 1)}), h('span', {class: 'th-grip', 'aria-label': 'Resize'})]);
          box.addEventListener('pointerdown', (e) => drag(e, i, e.target.classList.contains('th-grip')));
          return box;
        }));
    }
    function drag(e, i, resize) {
      e.preventDefault();
      if (T.pick !== i) { T.pick = i; controls(); }
      const r = over.getBoundingClientRect(), k = W / r.width;
      const p = T.pics[i], start = {x: e.clientX, y: e.clientY, px: p.x, py: p.y, size: p.size};
      const top = p.y - p.size / 2;
      const move = (ev) => {
        const dx = (ev.clientX - start.x) * k, dy = (ev.clientY - start.y) * k;
        if (resize) {
          // The top edge stays put; the drawing grows down and to the right from its middle.
          p.size = Math.max(40, Math.round(start.size + Math.max(dy, dx / (T.data.aspects[i] ?? 1))));
          p.y = Math.round(top + p.size / 2);
        } else { p.x = Math.round(start.px + dx); p.y = Math.round(start.py + dy); }
        redraw();
      };
      const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); save(); };
      addEventListener('pointermove', move); addEventListener('pointerup', up);
      stage.focus({preventScroll: true});
    }
    let keyT = null;
    stage.addEventListener('keydown', (e) => {
      const p = T.pics[T.pick];
      const d = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[e.key];
      if (!p || !d) return;
      e.preventDefault();
      const step = e.shiftKey ? 40 : 8;
      p.x += d[0] * step; p.y += d[1] * step;
      redraw();
      clearTimeout(keyT); keyT = setTimeout(() => save(), 500);
    });

    // ---------- the list beside it ----------
    function controls() {
      const btn = (text, onclick, attrs = {}) => h('button', {class: 'btn', text, onclick, ...attrs});
      const d = T.data;
      const sorted = [...T.sprites].sort((x, y) => (y.favorite ? 1 : 0) - (x.favorite ? 1 : 0) || (y.at || 0) - (x.at || 0));
      const row = (p, i) => {
        const frames = d.props.pics[i]?.art?.frames.length ?? 1;
        return h('div', {class: 'th-row' + (i === T.pick ? ' on' : ''), onclick: () => { if (T.pick !== i) { T.pick = i; boxes(); controls(); } }}, [
          h('b', {text: String(i + 1)}),
          h('select', {'aria-label': 'Drawing ' + (i + 1), onchange: (e) => { p.sprite = e.target.value; p.frame = 0; save(); }},
            sorted.map((s) => h('option', {value: s.slug, text: (s.favorite ? '★ ' : '') + s.name, selected: s.slug === p.sprite || null}))),
          frames > 1 ? h('select', {'aria-label': 'Which frame', onchange: (e) => { p.frame = +e.target.value; save(); }},
            Array.from({length: frames}, (_, f) => h('option', {value: f, text: 'Frame ' + (f + 1), selected: f === (p.frame ?? 0) || null}))) : null,
          h('label', {class: 'small'}, [h('input', {type: 'checkbox', checked: p.flip || null, onchange: (e) => { p.flip = e.target.checked; save(); }}), ' Flip']),
          btn('Remove', () => { T.pics.splice(i, 1); save(); }),
        ]);
      };
      const auto = d.auto ?? sorted[0]?.slug;
      side.replaceChildren(...[
        T.error ? h('div', {class: 'notice error', text: T.error}) : null,
        ...T.pics.map(row),
        h('div', {class: 'row', style: {gap: '8px', justifyContent: 'flex-start'}}, [
          T.pics.length < MAX && auto ? btn(T.pics.length ? '+ Add a drawing' : 'Place the drawing myself', () => {
            const w = d.autoAspect ?? 1;
            T.pics.push(T.pics.length ? {sprite: T.pics[T.pics.length - 1].sprite, x: 900, y: 300, size: 300}
              : {sprite: auto, x: w < 0.8 ? 420 : 640, y: 290, size: 520});
            T.pick = T.pics.length - 1; save();
          }, {class: 'btn' + (T.pics.length ? '' : ' primary')}) : null,
          T.pics.length ? btn('Back to automatic', () => { T.pics = []; save([]); }) : null,
        ]),
        T.pics.length ? null : h('div', {class: 'small muted', text: 'Now: made automatically from ' + (d.auto ?? 'the lesson’s first drawing') + '.'}),
      ].filter(Boolean));
    }

    Promise.all([api('/api/kids-thumb?id=' + encodeURIComponent(id)), api('/api/sprites').catch(() => [])])
      .then(([d, list]) => { T.sprites = list; load(d); }, (e) => { root.append(h('div', {class: 'notice error', text: 'The thumbnail didn’t load: ' + e.message})); });
  }

  window.ThumbMaker = {open};
})();
