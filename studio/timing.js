// Timing tab: the lesson video beside a timeline of one section, where scenes
// and the moments things appear can be dragged to fit the narration.
// Times are saved as seconds into the section's recording (timing.yml), so they
// survive re-rendering; "Make the video" uses them.
'use strict';
(function () {
  const FPS = 30;
  const LABELS = {quote: 'Quotation', map: 'Map', titles: 'Titles', timeline: 'Timeline', chain: 'Chain', compare: 'Compare',
    recap: 'Lesson summary', union: 'Union', partners: 'Partners', title: 'Title card', host: 'Your photo', trinity: 'Trinity', term: 'Word', keys: 'Keys', college: 'College', iconostasis: 'Iconostasis'};

  function h(tag, attrs, kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'text') e.textContent = v;
      else if (k === 'class') e.className = v;
      else if (k === 'style') Object.assign(e.style, v);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of [].concat(kids || [])) if (c != null && c !== false) e.append(c);
    return e;
  }
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const fmt = (s) => { s = Math.max(0, s); return Math.floor(s / 60) + ':' + (s % 60).toFixed(1).padStart(4, '0'); };

  // Pictures she can add from the editor: a type and a few plain fields.
  // Lists are one item per line; "a | b" splits an item into two parts.
  const lines = (v) => String(v || '').split('\n').map((x) => x.trim()).filter(Boolean);
  const pair = (l) => l.split('|').map((x) => x.trim());
  const ADD = {
    map: {label: 'Map', fields: [['places', 'Places, one per line (e.g. Rome, Antioch, Constantinople, Kyiv, Jerusalem)', 'lines'], ['route', 'Draw a route through them in order', 'check'], ['caption', 'Caption', 'text']],
      make: (v) => { const p = lines(v.places); return {type: 'map', region: 'mediterranean', places: p, ...(v.route && p.length > 1 ? {routes: p.slice(1).map((x, i) => [p[i], x])} : {}), highlight: p[p.length - 1], ...(v.caption ? {caption: v.caption} : {})}; }},
    titles: {label: 'Titles', fields: [['items', 'One per line: Big text | small text under it', 'lines']],
      make: (v) => ({type: 'titles', items: lines(v.items).map((l) => { const [a, b] = pair(l); return {latin: a, english: b || ''}; })})},
    union: {label: 'Union (one and many)', fields: [['center', 'In the middle', 'text', 'The Catholic Church'], ['items', 'Around it, one per line', 'lines'], ['caption', 'Caption', 'text']],
      make: (v) => ({type: 'union', center: v.center || 'The Catholic Church', items: lines(v.items), ...(v.caption ? {caption: v.caption} : {})})},
    partners: {label: 'Partners (two sides together)', fields: [['ltitle', 'Left heading', 'text'], ['litems', 'Left items, one per line: icon | label (icons from lucide.dev)', 'lines'],
      ['rtitle', 'Right heading', 'text'], ['ritems', 'Right items, one per line: icon | label', 'lines'], ['link', 'Words under the arrow', 'text']],
      make: (v) => { const side = (t, l) => ({title: t, items: lines(l).map((x) => { const [a, b] = pair(x); return b ? {icon: a, label: b} : {label: a}; })});
        return {type: 'partners', left: side(v.ltitle, v.litems), right: side(v.rtitle, v.ritems), ...(v.link ? {link: v.link} : {})}; }},
    compare: {label: 'Compare (two cards)', fields: [['left', 'Left card: small | big | note | icon', 'text'], ['right', 'Right card: small | big | note | icon', 'text'], ['emphasis', 'Check mark on', 'select', ['right', 'left', 'none']]],
      make: (v) => { const card = (t) => { const [kicker, title, note, icon] = pair(t || ''); return {kicker: kicker || '', title: title || '', note: note || '', ...(icon ? {icon} : {})}; };
        return {type: 'compare', left: card(v.left), right: card(v.right), emphasis: v.emphasis || 'right'}; }},
    chain: {label: 'Chain (handed on)', fields: [['items', 'Steps, one per line', 'lines'], ['caption', 'Caption', 'text']],
      make: (v) => ({type: 'chain', items: lines(v.items), ...(v.caption ? {caption: v.caption} : {})})},
    timeline: {label: 'Timeline', fields: [['items', 'One per line: year | what happened', 'lines']],
      make: (v) => ({type: 'timeline', items: lines(v.items).map((l) => { const [a, b] = pair(l); return {year: a, label: b || ''}; })})},
    term: {label: 'A word', fields: [['term', 'The word', 'text'], ['origin', 'From (e.g. Greek …)', 'text'], ['meaning', 'Meaning', 'text']],
      make: (v) => ({type: 'term', term: v.term, origin: v.origin, meaning: v.meaning})},
  };
  const REMOVABLE = (s, i) => !(s.kind === 'point' && i === 0) && !['title', 'host', 'trinity', 'recap'].includes(s.scenes[i].type);

  /** Short name for an item cue ("Antioch", "Title 2", "Check"). */
  function cueLabel(scene, k) {
    if (scene.type === 'compare' && k === 'decide') return 'Check';
    if (scene.type === 'quote') return k === 'start' ? 'Quote starts' : 'Quote ends';
    if (scene.type === 'trinity') return k === 'son' ? 'Cross' : k === 'spirit' ? 'Dove' : k;
    const items = scene.items || scene.places;
    if (/^\d+$/.test(k) && items) {
      const it = items[+k];
      return typeof it === 'string' ? it : it ? (it.latin || it.label || it.name || 'Item ' + (+k + 1)) : 'Item ' + (+k + 1);
    }
    return k;
  }

  /** The props with hand timing applied to the automatic timing (same rules as scripts/prepare.mjs applyTiming). */
  function effective(base, data, timing) {
    const props = clone(base);
    props.segments.forEach((seg, si) => {
      const auto = data.segments[si].autoScenes;
      const t = (timing[seg.name] || {}).scenes || {};
      seg.scenes.forEach((sc, i) => {
        const a = auto[i] || {from: sc.from || 0, cues: {}};
        const o = t[i] || {};
        const from = typeof o.start === 'number' ? Math.max(0, Math.round(seg.audioOffsetInFrames + o.start * FPS)) : a.from;
        const cues = {};
        for (const [k, v] of Object.entries(a.cues || {})) cues[k] = Math.max(4, a.from + v - from);
        for (const [k, v] of Object.entries(o.cues || {})) cues[k] = Math.max(4, Math.round(seg.audioOffsetInFrames + v * FPS) - from);
        sc.from = from;
        if (Object.keys(cues).length) sc.cues = cues; else delete sc.cues;
      });
      for (let i = 1; i < seg.scenes.length; i++) seg.scenes[i].from = Math.max(seg.scenes[i].from || 0, (seg.scenes[i - 1].from || 0) + 10);
      if (seg.kind === 'point') seg.headingFrames = seg.scenes[0].from;
    });
    return props;
  }

  function open(root, id, api, post) {
    const T = {id, data: null, timing: {}, saved: '{}', seg: 0, zoom: 90, player: null, props: null, dirty: false};
    root.replaceChildren(h('div', {class: 'muted', text: 'Loading the timeline…'}));

    const segStart = (si) => T.props.segments.slice(0, si).reduce((n, s) => n + s.durationInFrames, 0);
    const seg = () => T.props.segments[T.seg];
    const secOf = (f) => (f - seg().audioOffsetInFrames) / FPS; // frame in section → seconds into recording

    function setDirty() {
      T.dirty = JSON.stringify(T.timing) !== T.saved;
      const b = root.querySelector('[data-save]');
      if (b) { b.disabled = !T.dirty; b.textContent = T.dirty ? 'Save timing' : 'Saved'; }
    }
    function updatePlayer() { T.props = effective(T.data.props, T.data, T.timing); T.player && T.player.setProps(T.props); }

    function setStart(i, frame) {
      const sc = ((T.timing[seg().name] ||= {}).scenes ||= {});
      (sc[i] ||= {}).start = Math.round(secOf(frame) * 100) / 100;
    }
    function setCue(i, k, frame) {
      const sc = ((T.timing[seg().name] ||= {}).scenes ||= {});
      ((sc[i] ||= {}).cues ||= {})[k] = Math.round(secOf(frame) * 100) / 100;
    }

    function timeline() {
      const s = seg();
      const px = T.zoom / FPS; // pixels per frame
      const W = Math.ceil(s.durationInFrames * px) + 40;
      const words = T.data.segments[T.seg].words;
      const x = (f) => 20 + f * px;
      const wrap = h('div', {class: 'tl', style: {width: W + 'px'}});

      // Ruler (click to jump)
      const ruler = h('div', {class: 'tl-ruler', onpointerdown: (e) => {
        const f = (e.clientX - ruler.getBoundingClientRect().left - 20) / px;
        T.player.seek(segStart(T.seg) + f);
      }});
      // Whole seconds of the recording (the voice starts a moment into the section).
      for (let t = 0; s.audioOffsetInFrames + t * FPS < s.durationInFrames; t++) {
        ruler.append(h('span', {class: 'tl-tick' + (t % 5 ? '' : ' major'), style: {left: x(s.audioOffsetInFrames + t * FPS) + 'px'}, text: t % 5 ? '' : fmt(t)}));
      }
      wrap.append(ruler);

      // What she said, on time
      const wr = h('div', {class: 'tl-words'});
      words.forEach((w, i) => wr.append(h('span', {class: 'tl-word', style: {left: x(s.audioOffsetInFrames + w.t * FPS) + 'px', top: (i % 2) * 18 + 'px'}, text: w.w,
        onpointerdown: () => T.player.seek(segStart(T.seg) + s.audioOffsetInFrames + w.t * FPS)})));
      wrap.append(wr);

      // Scenes (drag the block to move when it starts)
      const scenesRow = h('div', {class: 'tl-scenes'});
      const cuesRow = h('div', {class: 'tl-cues'});
      // A point opens on its big heading; it settles when the first scene (the quotation) starts.
      if (s.kind === 'point' && s.scenes[0].from > 0) {
        scenesRow.append(h('div', {class: 'tl-scene fixed', style: {left: x(0) + 'px', width: s.scenes[0].from * px + 'px'}}, [h('span', {text: 'Heading'})]));
      }
      s.scenes.forEach((sc, i) => {
        const end = i < s.scenes.length - 1 ? s.scenes[i + 1].from : s.durationInFrames;
        const touched = ((T.timing[s.name] || {}).scenes || {})[i];
        const label = LABELS[sc.type] || sc.type;
        const block = h('div', {class: 'tl-scene' + (touched && touched.start != null ? ' moved' : ''), style: {left: x(sc.from) + 'px', width: Math.max(24, (end - sc.from) * px) + 'px'},
          title: 'Drag to change when it starts'}, [h('span', {text: label})]);
        if (REMOVABLE(s, i)) {
          block.append(h('button', {class: 'tl-x', title: 'Remove this picture', 'aria-label': 'Remove ' + label,
            onpointerdown: (e) => e.stopPropagation(), onclick: (e) => { e.stopPropagation(); removeScene(i, label); }}, '×'));
        }
        drag(block, sc.from, (f) => { setStart(i, f); }, () => T.player.seek(segStart(T.seg) + Math.max(0, sc.from - 10)));
        scenesRow.append(block);
        for (const [k, v] of Object.entries(sc.cues || {})) {
          const at = sc.from + v;
          const moved = touched && touched.cues && touched.cues[k] != null;
          const m = h('div', {class: 'tl-cue' + (moved ? ' moved' : ''), style: {left: x(at) + 'px'}, title: 'Drag to change when it appears'},
            [h('i'), h('span', {text: cueLabel(sc, k)})]);
          drag(m, at, (f) => setCue(i, k, f), () => T.player.seek(segStart(T.seg) + Math.max(0, at - 10)));
          cuesRow.append(m);
        }
      });
      wrap.append(scenesRow, cuesRow, h('div', {class: 'tl-head', 'data-playhead': ''}));
      return wrap;

      // Drag horizontally; on release, apply and redraw.
      function drag(node, startFrame, set, after) {
        node.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          try { node.setPointerCapture(e.pointerId); } catch { /* still drags while the pointer stays on it */ }
          const x0 = e.clientX;
          const left0 = parseFloat(node.style.left);
          let f = startFrame;
          const move = (ev) => {
            f = Math.max(0, Math.min(s.durationInFrames - 5, startFrame + (ev.clientX - x0) / px));
            node.style.left = left0 + (f - startFrame) * px + 'px';
            T.player.seek(segStart(T.seg) + f);
          };
          const up = () => {
            node.removeEventListener('pointermove', move);
            node.removeEventListener('pointerup', up);
            if (Math.abs(f - startFrame) < 1) { after(); return; }
            set(Math.round(f));
            updatePlayer(); draw(); setDirty();
            T.player.seek(segStart(T.seg) + Math.max(0, Math.round(f) - 15));
          };
          node.addEventListener('pointermove', move);
          node.addEventListener('pointerup', up);
        });
      }
    }

    function draw() {
      const s = seg();
      const strip = h('nav', {class: 'strip', 'aria-label': 'Sections'}, T.props.segments.map((x, i) => h('button', {
        'aria-current': i === T.seg ? 'true' : 'false', text: x.kind === 'point' ? String(x.index) : x.kind === 'intro' ? 'Intro' : 'Outro',
        onclick: () => { T.seg = i; draw(); T.player.seek(segStart(i) + 20); },
      })));
      const touched = !!(T.timing[s.name] && Object.keys(T.timing[s.name].scenes || {}).length);
      const controls = h('div', {class: 'row'}, [
        h('span', {class: 'row', style: {gap: '8px'}}, [
          h('button', {class: 'btn', 'data-play': '', text: '▶ Play', onclick: () => T.player.toggle()}),
          h('button', {class: 'btn', text: 'From the start of this section', onclick: () => { T.player.seek(segStart(T.seg)); T.player.play(); }}),
          h('span', {class: 'small muted', 'data-time': ''}),
        ]),
        h('span', {class: 'row', style: {gap: '8px'}}, [
          h('button', {class: 'btn', text: '−', 'aria-label': 'Zoom out', onclick: () => { T.zoom = Math.max(30, T.zoom / 1.5); draw(); }}),
          h('button', {class: 'btn', text: '+', 'aria-label': 'Zoom in', onclick: () => { T.zoom = Math.min(300, T.zoom * 1.5); draw(); }}),
          touched ? h('button', {class: 'btn', text: 'Reset this section', onclick: () => { delete T.timing[s.name]; updatePlayer(); draw(); setDirty(); }}) : null,
          h('button', {class: 'btn', text: '+ Add a picture here', onclick: () => { T.adding = !T.adding; draw(); }}),
          h('button', {class: 'btn primary', 'data-save': '', disabled: !T.dirty, text: T.dirty ? 'Save timing' : 'Saved', onclick: save}),
        ]),
      ]);
      const adder = T.adding ? addForm() : null;
      const tl = timeline();
      const box = root.querySelector('.tl-scroll') || h('div', {class: 'tl-scroll'});
      const keep = box.scrollLeft;
      box.replaceChildren(tl);
      const kids = [strip, controls, adder, box,
        h('div', {class: 'small muted', text: 'Drag a scene block to change when it starts, or a diamond to change when an item appears. Click a word or the ruler to jump there. Then Save timing, and Make the video on the Video & Ghost tab.'})];
      // Only the part below the video is redrawn, so the page doesn't jump.
      const y = window.scrollY;
      T.body.replaceChildren(...kids.filter(Boolean));
      box.scrollLeft = keep;
      window.scrollTo(0, y);
    }

    function addForm() {
      const s = seg();
      const now = Math.max(0, secOf(T.player.frame() - segStart(T.seg)));
      const typeSel = h('select', {'aria-label': 'Kind of picture'}, Object.entries(ADD).map(([k, d]) => h('option', {value: k, text: d.label, selected: k === (T.addType || 'map')})));
      const fields = h('div', {class: 'stack', style: {gap: '8px'}});
      const vals = {};
      const fill = () => {
        T.addType = typeSel.value;
        fields.replaceChildren(...ADD[T.addType].fields.map(([name, label, kind, extra]) => {
          let input;
          if (kind === 'lines') input = h('textarea', {rows: 3});
          else if (kind === 'check') input = h('input', {type: 'checkbox', checked: true});
          else if (kind === 'select') input = h('select', {}, extra.map((o) => h('option', {value: o, text: o})));
          else input = h('input', {type: 'text', value: extra || ''});
          vals[name] = input;
          return h('label', {class: 'tl-field'}, [h('span', {text: label}), input]);
        }));
      };
      typeSel.addEventListener('change', fill);
      fill();
      const at = h('input', {type: 'number', step: '0.1', min: '0', value: now.toFixed(1), style: {width: '6em'}});
      const add = async () => {
        const v = Object.fromEntries(Object.entries(vals).map(([k, el]) => [k, el.type === 'checkbox' ? el.checked : el.value]));
        try {
          await persist();
          const d = await post('/api/scene?id=' + encodeURIComponent(T.id), {op: 'add', section: s.name, scene: ADD[T.addType].make(v), start: Number(at.value)});
          T.adding = false; reload(d);
        } catch (e) { alert('Couldn’t add it: ' + e.message); }
      };
      return h('div', {class: 'card', style: {gap: '10px'}}, [
        h('div', {class: 'row'}, [h('label', {class: 'tl-field', style: {flexDirection: 'row', alignItems: 'center', gap: '8px'}}, [h('span', {text: 'Kind'}), typeSel]),
          h('label', {class: 'tl-field', style: {flexDirection: 'row', alignItems: 'center', gap: '8px'}}, [h('span', {text: 'Starts at (seconds into the recording)'}), at])]),
        fields,
        h('div', {class: 'row'}, [h('span', {class: 'small muted', text: 'Items appear when you say them. You can drag it afterwards.'}),
          h('span', {}, [h('button', {class: 'btn', text: 'Cancel', onclick: () => { T.adding = false; draw(); }}), ' ', h('button', {class: 'btn primary', text: 'Add it', onclick: add})])]),
      ]);
    }

    async function removeScene(i, label) {
      if (!confirm('Remove the ' + label + ' picture from this section?')) return;
      try {
        await persist();
        reload(await post('/api/scene?id=' + encodeURIComponent(T.id), {op: 'remove', section: seg().name, index: i}));
      } catch (e) { alert('Couldn’t remove it: ' + e.message); }
    }

    // Unsaved drags are saved first, so adding or removing a picture never loses them.
    async function persist() { if (T.dirty) await post('/api/timing?id=' + encodeURIComponent(T.id), {timing: T.timing}); }
    function reload(d) {
      T.data = d; T.timing = clone(d.timing || {}); T.saved = JSON.stringify(T.timing);
      updatePlayer(); draw(); setDirty();
    }

    async function save() {
      try {
        const d = await post('/api/timing?id=' + encodeURIComponent(T.id), {timing: T.timing});
        T.data = d; T.timing = clone(d.timing || {}); T.saved = JSON.stringify(T.timing);
        updatePlayer(); draw(); setDirty();
      } catch (e) { alert('Couldn’t save the timing: ' + e.message); }
    }

    api('/api/timing?id=' + encodeURIComponent(id)).then((d) => {
      T.data = d; T.timing = clone(d.timing || {}); T.saved = JSON.stringify(T.timing);
      T.props = effective(d.props, d, T.timing);
      const top = h('div', {class: 'tl-top'}, [h('div', {class: 'tl-player'})]);
      T.body = h('div', {class: 'stack', style: {gap: '12px'}});
      root.replaceChildren(top, T.body);
      if (!window.StudioPlayer) { top.replaceChildren(h('div', {class: 'notice error', text: 'The video preview didn’t load. Restart the studio.'})); return; }
      T.player = window.StudioPlayer.mount(top.firstChild, T.props);
      T.player.onFrame((f) => {
        if (T.player.playing()) {
          let si = 0;
          while (si < T.props.segments.length - 1 && f >= segStart(si + 1)) si++;
          if (si !== T.seg) { T.seg = si; draw(); }
          const box = root.querySelector('.tl-scroll');
          const px = 20 + (f - segStart(T.seg)) * (T.zoom / FPS);
          if (box && (px < box.scrollLeft + 40 || px > box.scrollLeft + box.clientWidth - 80)) box.scrollLeft = Math.max(0, px - 120);
        }
        const s0 = segStart(T.seg);
        const head = root.querySelector('[data-playhead]');
        if (head) head.style.left = 20 + (f - s0) * (T.zoom / FPS) + 'px';
        const t = root.querySelector('[data-time]');
        if (t) t.textContent = f >= s0 && f < s0 + seg().durationInFrames ? fmt(secOf(f - s0)) + ' into the recording' : '';
        const p = root.querySelector('[data-play]');
        if (p) p.textContent = T.player.playing() ? '❚❚ Pause' : '▶ Play';
      });
      draw();
      T.player.seek(0);
    }, (e) => root.replaceChildren(h('div', {class: 'notice error', text: 'Couldn’t load the timeline: ' + e.message})));

    return {dirty: () => T.dirty, pause: () => T.player && T.player.pause()};
  }

  window.TimingTab = {open};
})();
