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
    image: {label: 'Picture (search)', fields: [], search: true},
    map: {label: 'Map', fields: [['region', 'Show', 'select', ['mediterranean', 'east', 'europe', 'holyland']],
      ['places', 'Cities, one per line (e.g. Rome, Antioch, Constantinople, Kyiv, Jerusalem)', 'lines'], ['route', 'Draw a route through the cities in order', 'check'],
      ['areas', 'Highlight countries or empires, one per line: a country name (Ukraine, Greece…) or roman-empire-117, byzantine-empire-555, byzantine-empire-1025, kyivan-rus-1050', 'lines'],
      ['caption', 'Caption', 'text']],
      make: (v) => { const p = lines(v.places); const a = lines(v.areas);
        return {type: 'map', region: v.region || 'mediterranean', ...(p.length ? {places: p} : {}), ...(a.length ? {areas: a} : {}),
          ...(v.route && p.length > 1 ? {routes: p.slice(1).map((x, i) => [p[i], x])} : {}), ...(p.length ? {highlight: p[p.length - 1]} : {}), ...(v.caption ? {caption: v.caption} : {})}; }},
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

  // Her video's layouts on a slide (see video/Camera.tsx).
  const LAYOUTS = [['bubble', 'Bubble'], ['card', 'Two cards'], ['side', 'Side by side'], ['lower', 'Lower third'], ['only', 'Just me'], ['off', 'Off']];
  const SIDED = ['bubble', 'card', 'side']; // layouts where she picks which side her video is on

  /** The props with hand timing applied to the automatic timing (same rules as scripts/prepare.mjs applyTiming). */
  function effective(base, data, timing) {
    const props = clone(base);
    props.segments.forEach((seg, si) => {
      const auto = data.segments[si].autoScenes;
      const t = (timing[seg.name] || {}).scenes || {};
      const layout = {full: 'card'}[(timing[seg.name] || {}).camera] || (timing[seg.name] || {}).camera;
      if (seg.camera && LAYOUTS.some(([v]) => v === layout)) seg.camera.layout = layout;
      const side = (timing[seg.name] || {}).side;
      if (seg.camera && (side === 'left' || side === 'right')) seg.camera.side = side;
      // Trimmed shorter: the slide ends at `end` (seconds into the recording).
      const end = (timing[seg.name] || {}).end;
      if (typeof end === 'number') seg.durationInFrames = Math.max(seg.audioOffsetInFrames + 30, Math.round(seg.audioOffsetInFrames + end * FPS));
      else seg.durationInFrames = data.segments[si].autoDuration ?? seg.durationInFrames;
      seg.scenes.forEach((sc, i) => {
        const a = auto[i] || {from: sc.from || 0, cues: {}};
        const o = t[i] || {};
        const from = typeof o.start === 'number' ? Math.max(0, Math.round(seg.audioOffsetInFrames + o.start * FPS)) : a.from;
        const cues = {};
        for (const [k, v] of Object.entries(a.cues || {})) cues[k] = Math.max(4, a.from + v - from);
        for (const [k, v] of Object.entries(o.cues || {})) cues[k] = Math.max(4, Math.round(seg.audioOffsetInFrames + v * FPS) - from);
        sc.from = from;
        if (typeof o.end === 'number') sc.until = Math.round(seg.audioOffsetInFrames + o.end * FPS); else delete sc.until;
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
    function setEnd(i, frame) {
      const sc = ((T.timing[seg().name] ||= {}).scenes ||= {});
      (sc[i] ||= {}).end = Math.round(secOf(frame) * 100) / 100;
    }
    function setSlideEnd(frame) {
      (T.timing[seg().name] ||= {}).end = Math.round(secOf(frame) * 100) / 100;
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
      // Ruler and playhead: press and drag to scrub (playback pauses so nothing snaps back).
      const ruler = h('div', {class: 'tl-ruler'});
      const scrubFrom = (node) => node.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        T.player.pause();
        try { node.setPointerCapture(e.pointerId); } catch { /* fine */ }
        const left = wrap.getBoundingClientRect().left;
        const go = (ev) => T.player.seek(segStart(T.seg) + Math.max(0, Math.min(s.durationInFrames - 1, (ev.clientX - left - 20) / px)));
        go(e);
        const up = () => { node.removeEventListener('pointermove', go); node.removeEventListener('pointerup', up); };
        node.addEventListener('pointermove', go);
        node.addEventListener('pointerup', up);
      });
      scrubFrom(ruler);
      // Whole seconds of the recording (the voice starts a moment into the section).
      for (let t = 0; s.audioOffsetInFrames + t * FPS < s.durationInFrames; t++) {
        ruler.append(h('span', {class: 'tl-tick' + (t % 5 ? '' : ' major'), style: {left: x(s.audioOffsetInFrames + t * FPS) + 'px'}, text: t % 5 ? '' : fmt(t)}));
      }
      // Kids style, dance motion: the music's beats as dots; dragged items snap to them.
      const beats = (T.props.style === 'kids' && T.props.motion === 'dance' && T.props.music?.beats || []).map((b) => b - segStart(T.seg)).filter((b) => b >= 0 && b < s.durationInFrames);
      for (const b of beats) ruler.append(h('span', {class: 'tl-beat', style: {left: x(b) + 'px'}}));
      wrap.append(ruler);
      const snap = (f) => {
        const b = beats.reduce((a, c) => (a == null || Math.abs(c - f) < Math.abs(a - f) ? c : a), null);
        return b != null && Math.abs(b - f) <= 5 ? b : f;
      };

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
        const end = Math.min(i < s.scenes.length - 1 ? s.scenes[i + 1].from : s.durationInFrames, sc.until ?? Infinity);
        const touched = ((T.timing[s.name] || {}).scenes || {})[i];
        const label = LABELS[sc.type] || sc.type;
        const block = h('div', {class: 'tl-scene' + (touched && touched.start != null ? ' moved' : ''), style: {left: x(sc.from) + 'px', width: Math.max(24, (end - sc.from) * px) + 'px'},
          title: 'Drag to change when it starts'}, [h('span', {text: label})]);
        if (REMOVABLE(s, i)) {
          block.append(h('button', {class: 'tl-x', title: 'Remove this picture', 'aria-label': 'Remove ' + label,
            onpointerdown: (e) => e.stopPropagation(), onclick: (e) => { e.stopPropagation(); removeScene(i, label); }}, '×'));
        }
        drag(block, sc.from, (f) => { setStart(i, f); }, () => T.player.seek(segStart(T.seg) + Math.max(0, sc.from - 10)));
        // Right edge: drag left to end this picture sooner (double-click to undo).
        const trim = h('div', {class: 'tl-trim' + (touched && touched.end != null ? ' moved' : ''), title: 'Drag to end this picture sooner · double-click to undo',
          onpointerdown: (e) => e.stopPropagation(),
          ondblclick: (e) => { e.stopPropagation(); if (touched) { delete touched.end; updatePlayer(); draw(); setDirty(); } }});
        drag(trim, end, (f) => setEnd(i, Math.max(sc.from + 10, f)), () => T.player.seek(segStart(T.seg) + Math.max(0, end - 15)), block);
        block.append(trim);
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
      // The slide's end: drag left to make the whole slide shorter (double-click to undo).
      const cut = (T.timing[s.name] || {}).end != null;
      const endMark = h('div', {class: 'tl-end' + (cut ? ' moved' : ''), style: {left: x(s.durationInFrames) + 'px'}, title: 'End of this slide: drag to make it shorter · double-click to undo',
        ondblclick: () => { if (cut) { delete T.timing[s.name].end; updatePlayer(); draw(); setDirty(); } }}, [h('span', {text: 'End'})]);
      drag(endMark, s.durationInFrames, (f) => setSlideEnd(Math.max(s.audioOffsetInFrames + 30, f)), () => T.player.seek(segStart(T.seg) + Math.max(0, s.durationInFrames - 30)));
      wrap.append(endMark);
      const head = h('div', {class: 'tl-head', 'data-playhead': '', title: 'Drag to scrub'}, [h('i')]);
      scrubFrom(head);
      wrap.append(scenesRow, cuesRow, head);
      return wrap;

      // Drag horizontally; on release, apply and redraw.
      // `resize`: dragging a block's right edge, so the block grows/shrinks instead of moving.
      function drag(node, startFrame, set, after, resize) {
        node.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          try { node.setPointerCapture(e.pointerId); } catch { /* still drags while the pointer stays on it */ }
          const x0 = e.clientX;
          const left0 = parseFloat(node.style.left);
          const width0 = resize ? parseFloat(resize.style.width) : 0;
          let f = startFrame;
          const move = (ev) => {
            f = snap(Math.max(0, Math.min(s.durationInFrames - 5, startFrame + (ev.clientX - x0) / px)));
            if (resize) resize.style.width = Math.max(24, width0 + (f - startFrame) * px) + 'px';
            else node.style.left = left0 + (f - startFrame) * px + 'px';
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
          touched ? h('button', {class: 'btn', text: 'Reset this section', onclick: () => { delete T.timing[s.name].scenes; updatePlayer(); draw(); setDirty(); }}) : null,
          h('button', {class: 'btn', text: '+ Add a picture here', onclick: () => { T.adding = !T.adding; draw(); }}),
          h('button', {class: 'btn primary', 'data-save': '', disabled: !T.dirty, text: T.dirty ? 'Save timing' : 'Saved', onclick: save}),
        ]),
      ]);
      // Her camera clip for this slide (recorded with "Record my video too"): how it shows.
      const camRow = s.camera ? h('div', {class: 'row', style: {gap: '8px'}}, [
        h('span', {class: 'small muted', text: 'Your video on this slide:'}),
        h('span', {class: 'seg', role: 'group', 'aria-label': 'Your video on this slide'}, LAYOUTS.map(([v, label]) =>
          h('button', {'aria-pressed': s.camera.layout === v ? 'true' : 'false', text: label, onclick: () => {
            (T.timing[s.name] ||= {}).camera = v;
            updatePlayer(); draw(); setDirty();
            T.player.seek(Math.max(segStart(T.seg), T.player.frame()));
          }}))),
        SIDED.includes(s.camera.layout) ? h('span', {class: 'seg', role: 'group', 'aria-label': 'Which side your video is on'}, [['left', 'Left'], ['right', 'Right']].map(([v, label]) => {
          const current = s.camera.side || (s.camera.layout === 'bubble' ? 'right' : 'left');
          return h('button', {'aria-pressed': current === v ? 'true' : 'false', text: label, onclick: () => {
            (T.timing[s.name] ||= {}).side = v;
            updatePlayer(); draw(); setDirty();
            T.player.seek(Math.max(segStart(T.seg), T.player.frame()));
          }});
        })) : null,
      ]) : null;
      const adder = T.adding ? addForm() : null;
      const tl = timeline();
      const box = root.querySelector('.tl-scroll') || h('div', {class: 'tl-scroll'});
      const keep = box.scrollLeft;
      box.replaceChildren(tl);
      const kids = [strip, controls, camRow, adder, box,
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
      typeSel.addEventListener('change', () => { T.picked = null; fill(); draw(); });
      fill();
      // Picture: search free sources, pick one, add a caption.
      if (T.addType === 'image') fields.replaceChildren(imagePicker());
      const at = h('input', {type: 'number', step: '0.1', min: '0', value: now.toFixed(1), style: {width: '6em'}});
      const add = async () => {
        const v = Object.fromEntries(Object.entries(vals).map(([k, el]) => [k, el.type === 'checkbox' ? el.checked : el.value]));
        try {
          await persist();
          let scene;
          if (T.addType === 'image') {
            if (!T.picked) { alert('Pick a picture first.'); return; }
            const credit = await post('/api/images/import?id=' + encodeURIComponent(T.id), {img: T.picked});
            const line = [credit.creator && credit.creator !== 'Unknown' ? credit.creator : '', credit.source, credit.license].filter(Boolean).join(' · ');
            scene = {type: 'image', src: credit.file, aspect: credit.aspect, credit: line, ...(T.caption ? {caption: T.caption} : {}), ...(T.fit === 'cover' ? {fit: 'cover'} : {})};
            T.picked = null;
          } else scene = ADD[T.addType].make(v);
          const d = await post('/api/scene?id=' + encodeURIComponent(T.id), {op: 'add', section: s.name, scene, start: Number(at.value)});
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

    function imagePicker() {
      const q = h('input', {type: 'search', placeholder: 'Search pictures, e.g. iconostasis, Hagia Sophia, St. Peter', value: T.imageQ || '', style: {flex: '1'}});
      const src = h('select', {'aria-label': 'Where to search'});
      const grid = h('div', {class: 'img-grid'});
      const status = h('div', {class: 'small muted'});
      api('/api/images/sources').then((list) => {
        src.replaceChildren(h('option', {value: 'all', text: 'All sources'}), ...list.filter((x) => x.ready).map((x) => h('option', {value: x.id, text: x.label, selected: x.id === T.imageSrc})));
      });
      const show = () => {
        grid.replaceChildren(...(T.imageResults || []).map((r) => h('button', {class: 'img-pick' + (T.picked && T.picked.source === r.source && T.picked.id === r.id ? ' on' : ''), type: 'button',
          title: `${r.title} — ${r.creator} (${r.license})`, onclick: () => { T.picked = r; show(); }}, [
          h('img', {src: r.thumb, alt: r.title, loading: 'lazy'}), h('span', {text: r.title}), h('small', {text: `${r.creator} · ${r.license}`})])));
      };
      const go = async () => {
        if (!q.value.trim()) return;
        T.imageQ = q.value; T.imageSrc = src.value;
        status.textContent = 'Searching…'; grid.replaceChildren();
        try {
          const d = await api('/api/images/search?id=' + encodeURIComponent(T.id) + '&q=' + encodeURIComponent(q.value) + '&source=' + encodeURIComponent(src.value));
          T.imageResults = d.results;
          status.textContent = (d.results.length ? d.results.length + ' found. Pick one.' : 'Nothing found; try other words.') + (d.errors.length ? ' (' + d.errors.join('; ') + ')' : '');
          show();
        } catch (e) { status.textContent = 'Search failed: ' + e.message; }
      };
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      const caption = h('input', {type: 'text', placeholder: 'Caption (optional)', value: T.caption || '', oninput: (e) => { T.caption = e.target.value; }});
      const fit = h('select', {onchange: (e) => { T.fit = e.target.value; }}, [h('option', {value: 'contain', text: 'Show the whole picture'}), h('option', {value: 'cover', text: 'Fill the frame (crops edges)', selected: T.fit === 'cover'})]);
      show();
      return h('div', {class: 'stack', style: {gap: '8px'}}, [
        h('div', {class: 'row', style: {gap: '8px', flexWrap: 'nowrap'}}, [q, src, h('button', {class: 'btn', type: 'button', text: 'Search', onclick: go})]),
        status, grid,
        h('div', {class: 'row', style: {gap: '8px'}}, [h('label', {class: 'tl-field', style: {flex: '1'}}, [h('span', {text: 'Caption'}), caption]), h('label', {class: 'tl-field'}, [h('span', {text: 'Framing'}), fit])]),
        h('div', {class: 'small muted', text: 'The picture is saved into the lesson with its credit; the credit shows small on the video and in the post’s Image credits.'}),
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
      const total = () => T.props.segments.reduce((n, x) => n + x.durationInFrames, 0);
      const bar = h('input', {type: 'range', class: 'tl-bar', min: '0', step: '1', 'aria-label': 'Scrub through the whole lesson'});
      const sectionOf = (f) => { let si = 0; while (si < T.props.segments.length - 1 && f >= segStart(si + 1)) si++; return si; };
      bar.addEventListener('pointerdown', () => T.player.pause());
      bar.addEventListener('input', () => {
        const f = Number(bar.value);
        T.player.seek(f);
        const si = sectionOf(f);
        if (si !== T.seg) { T.seg = si; draw(); }
      });
      T.bar = bar;
      const top = h('div', {class: 'tl-top'}, [h('div', {class: 'tl-player'}), h('div', {class: 'tl-player'}, [bar])]);
      T.body = h('div', {class: 'stack', style: {gap: '12px'}});
      // Video on the left (stays put), timeline on the right; stacked on narrow windows.
      root.classList.add('tl-grid');
      root.replaceChildren(top, T.body);
      if (!window.StudioPlayer) { top.replaceChildren(h('div', {class: 'notice error', text: 'The video preview didn’t load. Restart the studio.'})); return; }
      T.player = window.StudioPlayer.mount(top.firstChild, T.props);
      T.player.onFrame((f) => {
        if (T.bar) { T.bar.max = String(total() - 1); if (document.activeElement !== T.bar) T.bar.value = String(f); }
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
