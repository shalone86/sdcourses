// Pico Parish tab: everything on picoparish.com she changes herself, without touching JSON.
// The games, videos, books and comics (catalog.json "items"), the page's big buttons, the TV,
// the villagers and the story drawing ("page"). Save writes catalog.json, builds index.html and
// commits in the Pico Parish folder (scripts/picoparish.mjs); Check links opens every link.
'use strict';
window.PicoParishTab = (() => {
  const CODES = '0123456789abcdefghijklmnopqrstuvwxyz';
  const KINDS = [['game', 'Game'], ['video', 'Video'], ['card-game', 'Card game'], ['book', 'Book'], ['comic', 'Comic']];
  const STATUS = [['live', 'Live: on the page'], ['workshop', 'Coming soon'], ['hidden', 'Hidden']];
  const COLORS = ['tomato', 'sky', 'sun', 'grass', 'grape', 'sea'];
  const SWATCH = {tomato: '#ff5a4e', sky: '#5cc6f2', sun: '#ffd23f', grass: '#62c25a', grape: '#8f6bd8', sea: '#2d7fd3'};
  const SECTION = {games: 'Games', videos: 'Videos', people: 'Villagers', soon: 'Coming soon'};
  const POSES = [['idle', 'Stand'], ['walk', 'Walk'], ['blessing', 'Bless'], ['cross', 'Sign of the Cross']];

  function h(tag, attrs, kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
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
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const slugify = (t) => String(t || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

  const STYLE = `
.pp-list{display:flex;flex-direction:column;gap:8px}
.pp-item{display:flex;align-items:center;gap:12px;padding:8px 10px;border:1px solid var(--rule);border-radius:10px;background:var(--bg)}
.pp-item .t{flex:1;min-width:0}
.pp-item .t b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pp-item .t small{color:var(--muted)}
.pp-thumb{image-rendering:pixelated;background:var(--paper);border-radius:6px;flex:none}
.pp-tag{font:600 11px/1 var(--sans);text-transform:uppercase;letter-spacing:.06em;padding:5px 8px;border-radius:99px;border:1px solid var(--rule);color:var(--muted);white-space:nowrap}
.pp-tag.live{border-color:var(--ok);color:var(--ok)}.pp-tag.hidden{opacity:.6}.pp-tag.bad{border-color:var(--rec);color:var(--rec)}
.pp-mini{font:600 13px/1 var(--sans);padding:7px 9px;border-radius:7px;border:1px solid var(--rule);background:var(--paper);color:var(--ink);cursor:pointer}
.pp-mini:hover{border-color:var(--accent)}
.pp-form{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px;padding:12px;border:1px solid var(--accent);border-radius:10px;background:var(--paper)}
.pp-form .full{grid-column:1/-1}
.pp-form label,.pp-field{display:flex;flex-direction:column;gap:4px;font-size:14px;color:var(--muted)}
.pp-form input[type=text],.pp-form input[type=url],.pp-form textarea,.pp-form select,.pp-row input[type=text],.pp-row select{font:15px/1.4 var(--sans);color:var(--ink);background:var(--bg);border:1px solid var(--rule);border-radius:8px;padding:7px 9px;min-width:0}
.pp-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.pp-chip{display:flex;align-items:center;gap:6px;padding:4px 6px 4px 4px;border:1px solid var(--rule);border-radius:8px;background:var(--bg);font-size:13px;color:var(--ink)}
.pp-chip.main{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold)}
.pp-chip button{border:0;background:none;color:var(--muted);cursor:pointer;font:600 14px/1 var(--sans);padding:2px 4px}
.pp-chip button:hover{color:var(--accent)}
.pp-row{display:grid;grid-template-columns:auto 1fr 1fr auto auto;gap:8px;align-items:center;padding:8px;border:1px solid var(--rule);border-radius:10px;background:var(--bg)}
.pp-vill{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:start;padding:10px;border:1px solid var(--rule);border-radius:10px;background:var(--bg)}
.pp-vill .f{display:grid;grid-template-columns:1fr 140px;gap:6px}
.pp-vill .f .full{grid-column:1/-1}
.pp-poses{font-size:13px;color:var(--muted)}
.pp-poses b{color:var(--rec);font-weight:600}
.pp-sw{width:22px;height:22px;border-radius:50%;border:2px solid var(--rule);cursor:pointer;padding:0}
.pp-sw[aria-pressed="true"]{border-color:var(--ink);box-shadow:0 0 0 2px var(--paper),0 0 0 4px var(--ink)}
.pp-shade{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:50;display:grid;place-items:center;padding:16px}
.pp-dialog{background:var(--paper);border-radius:12px;padding:16px;width:min(720px,100%);max-height:90vh;overflow:auto;display:flex;flex-direction:column;gap:10px}
.pp-gif{width:128px;height:128px;image-rendering:pixelated;border-radius:6px;border:1px solid var(--rule);background:#111}
.pp-sticky{position:sticky;top:0;z-index:5;background:var(--bg);padding-block:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
@media (max-width:700px){.pp-form,.pp-vill .f{grid-template-columns:1fr}.pp-row{grid-template-columns:auto 1fr auto}}
`;

  function open(root, api, post) {
    if (!document.getElementById('pp-style')) document.head.append(h('style', {id: 'pp-style', text: STYLE}));
    const P = {cat: null, dir: '', gifs: [], sprites: [], art: {}, dirty: false, busy: false, msg: null, links: {}, edit: null, add: false};

    // ---------- drawings ----------
    const thumbCache = new Map();
    function thumb(slug, size = 40) {
      const a = P.art[slug];
      const c = h('canvas', {class: 'pp-thumb', width: size, height: size, title: slug});
      if (!a) return c;
      const g = c.getContext('2d');
      const k = Math.max(1, Math.floor(size / Math.max(a.width, a.height)));
      const ox = Math.floor((size - a.width * k) / 2), oy = Math.floor((size - a.height * k) / 2);
      (a.frames[0] || []).forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== '.') { g.fillStyle = a.palette[CODES.indexOf(row[x])]; g.fillRect(ox + x * k, oy + y * k, k, k); } });
      return c;
    }
    const nameOf = (slug) => P.art[slug]?.name || slug;
    const has = (slug) => !!P.art[slug];

    /** Pick a drawing in a box over the page. only: filter; returns the slug, or null. */
    function pickDrawing({title, value, only}) {
      return new Promise((done) => {
        const input = h('input', {type: 'hidden'});
        const items = P.sprites.filter((s) => !only || only(s));
        const close = (v) => { shade.remove(); document.removeEventListener('keydown', esc); done(v); };
        const esc = (e) => { if (e.key === 'Escape') close(null); };
        const box = h('div', {class: 'pp-dialog', role: 'dialog', 'aria-label': title}, [
          h('div', {class: 'row'}, [h('strong', {text: title}), h('button', {class: 'btn', text: 'Cancel', onclick: () => close(null)})]),
          window.SpriteGallery.picker({items, value, input}),
        ]);
        input.addEventListener('change', () => close(input.value || null));
        const shade = h('div', {class: 'pp-shade', onclick: (e) => { if (e.target === shade) close(null); }}, [box]);
        document.addEventListener('keydown', esc);
        document.body.append(shade);
        box.querySelector('input[type=search]')?.focus();
      });
    }

    // ---------- loading and saving ----------
    async function load() {
      try {
        const [state, sprites] = await Promise.all([api('/api/pp'), api('/api/sprites')]);
        P.cat = state.catalog; P.dir = state.dir; P.gifs = state.gifs;
        P.cat.page = P.cat.page || {};
        P.cat.page.menu = P.cat.page.menu || [];
        P.cat.page.tv = P.cat.page.tv || {buildings: [], walkers: [], vehicle: ''};
        P.cat.page.roster = P.cat.page.roster || [];
        P.cat.page.story = P.cat.page.story || {sprite: ''};
        P.sprites = sprites.filter((s) => s.kind !== 'sketch' && Array.isArray(s.frames) && !s.standin);
        P.art = Object.fromEntries(P.sprites.map((s) => [s.slug, s]));
        P.dirty = false;
      } catch (e) { P.msg = {error: true, text: e.message}; }
      draw();
    }
    const changed = () => { P.dirty = true; status.textContent = 'Not saved yet'; saveBtn.disabled = false; };

    async function save() {
      P.busy = true; draw();
      try {
        const r = await post('/api/pp/save', {catalog: P.cat});
        P.cat = r.state.catalog; P.gifs = r.state.gifs; P.dirty = false;
        P.msg = {text: `Saved and built (${r.items} entries, ${r.sprites} drawings, ${r.kb} KB).` + (r.committed ? ' Saved in git.' : ''), list: r.warnings};
      } catch (e) { P.msg = {error: true, text: 'Not saved: ' + e.message}; }
      P.busy = false; draw();
    }
    async function online() {
      if (P.dirty) { P.msg = {error: true, text: 'Save & build first, then put it online.'}; draw(); return; }
      if (!(await ask('Put the last saved version on picoparish.com for everyone?', {yes: 'Put it online'}))) return;
      P.busy = true; P.msg = {text: 'Putting it online… (about half a minute)'}; draw();
      try { const r = await post('/api/pp/deploy', {}); P.msg = {text: `It’s online at ${r.url}` + (r.version ? ` (version ${r.version}).` : '.'), link: r.url}; }
      catch (e) { P.msg = {error: true, text: 'Not put online: ' + e.message}; }
      P.busy = false; draw();
    }
    async function links() {
      P.busy = true; P.msg = {text: 'Opening every link…'}; draw();
      try {
        const res = await post('/api/pp/links', {catalog: P.cat});
        P.links = Object.fromEntries(res.map((l) => [l.id, l]));
        const bad = res.filter((l) => !l.ok);
        P.msg = bad.length ? {error: true, text: `${bad.length} of ${res.length} links don't work:`, list: bad.map((l) => `${l.title}: ${l.url} (${l.error || l.status})`)}
          : {text: `All ${res.length} links work.`};
      } catch (e) { P.msg = {error: true, text: e.message}; }
      P.busy = false; draw();
    }

    // ---------- pieces ----------
    const status = h('span', {class: 'small muted'});
    const saveBtn = h('button', {class: 'btn primary', text: 'Save & build', onclick: save});
    function chips(list, {main, onMain, onRemove}) {
      return list.map((slug, i) => h('span', {class: 'pp-chip' + (main === slug ? ' main' : ''), title: main === slug ? 'Main drawing' : slug}, [
        thumb(slug, 28), h('span', {text: nameOf(slug) + (has(slug) ? '' : ' (missing)')}),
        onMain && main !== slug ? h('button', {title: 'Make this the main drawing', 'aria-label': 'Make ' + slug + ' the main drawing', text: '★', onclick: () => onMain(slug)}) : null,
        h('button', {title: 'Remove', 'aria-label': 'Remove ' + slug, text: '×', onclick: () => onRemove(i)}),
      ]));
    }
    function drawingList(list, title, onChange, opts = {}) {
      return h('div', {class: 'pp-chips'}, [
        ...chips(list, {main: opts.main, onMain: opts.onMain, onRemove: (i) => { list.splice(i, 1); onChange(); }}),
        h('button', {class: 'pp-mini', text: '+ Add a drawing', onclick: async () => { const s = await pickDrawing({title, only: opts.only}); if (s) { list.push(s); onChange(); } }}),
      ]);
    }
    function oneDrawing(value, title, onPick, only) {
      return h('span', {class: 'pp-chips'}, [
        value ? h('span', {class: 'pp-chip'}, [thumb(value, 28), h('span', {text: nameOf(value) + (has(value) ? '' : ' (missing)')})]) : h('span', {class: 'small muted', text: 'None'}),
        h('button', {class: 'pp-mini', text: value ? 'Change' : 'Pick', onclick: async () => { const s = await pickDrawing({title, value, only}); if (s) onPick(s); }}),
      ]);
    }
    const field = (label, input, cls) => h('label', {class: cls || null}, [label, input]);
    const text = (obj, key, opts = {}) => h(opts.area ? 'textarea' : 'input', {type: opts.type || 'text', value: obj[key] || '', rows: opts.area ? 3 : null, placeholder: opts.placeholder || null,
      oninput: (e) => { obj[key] = e.target.value; changed(); if (opts.after) opts.after(); }});
    const select = (obj, key, options, after) => h('select', {onchange: (e) => { obj[key] = e.target.value; changed(); if (after) after(); }},
      options.map(([v, t]) => h('option', {value: v, selected: obj[key] === v, text: t})));
    const move = (list, i, d, redraw) => { const j = i + d; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; changed(); redraw(); };

    // ---------- entries ----------
    function itemsCard() {
      const items = P.cat.items;
      const rows = items.map((it, i) => {
        const l = P.links[it.id];
        const row = h('div', {class: 'pp-item'}, [
          thumb(it.heroSprite || (it.sprites || [])[0], 40),
          h('div', {class: 't'}, [h('b', {text: it.title || '(no title)'}), h('small', {text: (KINDS.find((k) => k[0] === it.type)?.[1] || it.type) + (it.url ? ' · ' + it.url.replace(/^https?:\/\//, '') : '')})]),
          l && !l.ok ? h('span', {class: 'pp-tag bad', text: 'Link broken'}) : null,
          h('span', {class: 'pp-tag ' + it.status, text: it.status === 'workshop' ? 'Coming soon' : it.status}),
          h('button', {class: 'pp-mini', 'aria-label': 'Move up', text: '↑', onclick: () => move(items, i, -1, draw)}),
          h('button', {class: 'pp-mini', 'aria-label': 'Move down', text: '↓', onclick: () => move(items, i, 1, draw)}),
          h('button', {class: 'pp-mini', text: P.edit === it.id ? 'Close' : 'Edit', onclick: () => { P.edit = P.edit === it.id ? null : it.id; draw(); }}),
        ]);
        return P.edit === it.id ? [row, itemForm(it, i)] : [row];
      }).flat();
      return h('section', {class: 'card'}, [
        h('div', {class: 'row'}, [h('h2', {text: 'Games, videos & more'}), h('button', {class: 'btn', text: '+ Add', onclick: () => {
          const it = {id: 'new-' + Date.now().toString(36), type: 'game', status: 'workshop', title: '', badge: '', subtitle: '', description: '', url: '', sprites: [], heroSprite: ''};
          items.unshift(it); P.edit = it.id; changed(); draw();
        }})]),
        h('div', {class: 'small muted', text: 'Live entries show on the page in their section; Coming soon ones go under "To be continued…". Order here is the order on the page.'}),
        h('div', {class: 'pp-list'}, rows),
      ]);
    }
    function itemForm(it, i) {
      const redraw = () => draw();
      const gifBox = () => {
        const file = h('input', {type: 'file', accept: 'image/gif', style: {display: 'none'}, onchange: async (e) => {
          const f = e.target.files[0]; if (!f) return;
          try { const r = await api('/api/pp/gif?id=' + encodeURIComponent(it.id), {method: 'POST', body: f}); it.gif = r.gif; changed(); draw(); }
          catch (err) { P.msg = {error: true, text: err.message}; draw(); }
        }});
        return h('div', {class: 'pp-field full'}, ['Gameplay GIF (shown on the cartridge instead of the drawings)',
          h('div', {class: 'pp-chips'}, [
            it.gif ? h('img', {class: 'pp-gif', src: '/pp/' + it.gif + '?v=' + Date.now(), alt: ''}) : h('span', {class: 'small muted', text: 'None yet'}),
            file, h('button', {class: 'pp-mini', text: it.gif ? 'Replace GIF…' : 'Upload a GIF…', onclick: () => file.click()}),
            it.gif ? h('button', {class: 'pp-mini', text: 'Don’t show it', onclick: () => { delete it.gif; changed(); draw(); }}) : null,
          ])]);
      };
      return h('div', {class: 'pp-form'}, [
        field('Title', text(it, 'title', {after: () => { if (/^new-/.test(it.id) && it.title) { it.id = slugify(it.title); P.edit = it.id; } }})),
        field('Kind', select(it, 'type', KINDS, redraw)),
        field('Shows as', select(it, 'status', STATUS, redraw)),
        field('Small label above the title', text(it, 'badge', {placeholder: 'e.g. PICO-8 Game · 1P & 4P'})),
        field('One line about it', text(it, 'subtitle'), 'full'),
        field('Longer description', text(it, 'description', {area: true}), 'full'),
        field('Link', text(it, 'url', {type: 'url', placeholder: 'https://kids.methodiusmedia.com/…'}), 'full'),
        h('div', {class: 'pp-field full'}, ['Drawings (★ = the main one, used on video and book covers)',
          drawingList(it.sprites = it.sprites || [], 'Add a drawing to ' + (it.title || 'this entry'), () => { if (!it.heroSprite) it.heroSprite = it.sprites[0] || ''; changed(); draw(); },
            {main: it.heroSprite, onMain: (s) => { it.heroSprite = s; changed(); draw(); }})]),
        it.type === 'game' ? gifBox() : null,
        h('div', {class: 'row full'}, [
          h('span', {class: 'small muted', text: 'id: ' + it.id}),
          h('button', {class: 'pp-mini', text: 'Remove this entry', onclick: async () => {
            if (!(await ask(`Remove “${it.title || 'this entry'}” from the site?`, {yes: 'Remove'}))) return;
            P.cat.items.splice(i, 1); P.edit = null; changed(); draw();
          }}),
        ]),
      ]);
    }

    // ---------- page ----------
    function menuCard() {
      const menu = P.cat.page.menu;
      return h('section', {class: 'card'}, [
        h('h2', {text: 'The big buttons'}),
        h('div', {class: 'small muted', text: 'The four buttons under the TV. In the small note, {n} becomes the number of live entries (e.g. "{n} games").'}),
        h('div', {class: 'pp-list'}, menu.map((m, i) => h('div', {class: 'pp-row'}, [
          thumb(m.sprite, 40),
          h('div', {class: 'pp-field'}, ['Goes to ' + (SECTION[m.to] || m.to), text(m, 'label')]),
          h('div', {class: 'pp-field'}, ['Small note', text(m, 'note')]),
          h('div', {class: 'pp-chips', role: 'group', 'aria-label': 'Color'}, COLORS.map((c) => h('button', {class: 'pp-sw', style: {background: SWATCH[c]}, title: c, 'aria-label': c, 'aria-pressed': m.color === c ? 'true' : 'false', onclick: () => { m.color = c; changed(); draw(); }}))),
          h('button', {class: 'pp-mini', text: 'Drawing…', onclick: async () => { const s = await pickDrawing({title: 'Drawing for ' + m.label, value: m.sprite}); if (s) { m.sprite = s; changed(); draw(); } }}),
        ]))),
      ]);
    }
    function tvCard() {
      const tv = P.cat.page.tv;
      tv.buildings = tv.buildings || []; tv.walkers = tv.walkers || [];
      const redraw = () => { changed(); draw(); };
      return h('section', {class: 'card'}, [
        h('h2', {text: 'The TV'}),
        h('div', {class: 'pp-field'}, ['Buildings and trees on the shore, left to right (32 × 32 drawings fit best)', drawingList(tv.buildings, 'Add a building or tree', redraw)]),
        h('div', {class: 'pp-field'}, ['Who walks along the promenade (walking drawings, 8 × 8)', drawingList(tv.walkers, 'Add someone walking', redraw, {only: (s) => /-walk$/.test(s.slug) || s.width <= 16})]),
        h('div', {class: 'pp-field'}, ['What drives along the road', oneDrawing(tv.vehicle, 'Pick a vehicle', (s) => { tv.vehicle = s; redraw(); })]),
        h('div', {class: 'pp-field'}, ['Drawing beside "Meanwhile, a long time ago…"', oneDrawing(P.cat.page.story.sprite, 'Pick the story drawing', (s) => { P.cat.page.story.sprite = s; redraw(); })]),
      ]);
    }
    function villagersCard() {
      const roster = P.cat.page.roster;
      const isIdle = (s) => /-idle$/.test(s.slug);
      return h('section', {class: 'card'}, [
        h('div', {class: 'row'}, [h('h2', {text: 'Villagers'}), h('button', {class: 'btn', text: '+ Add a villager', onclick: async () => {
          const s = await pickDrawing({title: 'Pick their standing drawing (…-idle)', only: isIdle});
          if (!s) return;
          roster.push({id: s.replace(/-idle$/, ''), name: '', rite: 'Villager', line: '', blesses: false}); changed(); draw();
        }})]),
        h('div', {class: 'small muted', text: 'Each villager uses your drawings named <name>-idle, -walk, -blessing and -cross. Missing poses are listed, so you know what to draw next. Only priests get Bless.'}),
        h('div', {class: 'pp-list'}, roster.map((r, i) => {
          const missing = POSES.filter(([p]) => (p !== 'blessing' || r.blesses) && !has(r.id + '-' + p)).map(([, t]) => t);
          const there = POSES.filter(([p]) => (p !== 'blessing' || r.blesses) && has(r.id + '-' + p)).map(([, t]) => t);
          return h('div', {class: 'pp-vill'}, [
            thumb(r.id + '-idle', 56),
            h('div', {class: 'f'}, [
              field('Name', text(r, 'name')),
              field('Group', select(r, 'rite', [['Latin', 'Latin'], ['Byzantine', 'Byzantine'], ['Villager', 'Villager']])),
              field('What they say', text(r, 'line'), 'full'),
              h('label', {class: 'full', style: {flexDirection: 'row', alignItems: 'center', gap: '8px'}}, [
                h('input', {type: 'checkbox', checked: !!r.blesses, onchange: (e) => { r.blesses = e.target.checked; changed(); draw(); }}), 'Can bless (priests, bishops and the Pope)']),
              h('div', {class: 'pp-poses full'}, ['Poses: ' + there.join(', '), missing.length ? h('span', {}, [' · Still to draw: ', h('b', {text: missing.join(', ')})]) : null]),
            ]),
            h('div', {class: 'stack', style: {gap: '6px'}}, [
              h('button', {class: 'pp-mini', 'aria-label': 'Move up', text: '↑', onclick: () => move(roster, i, -1, draw)}),
              h('button', {class: 'pp-mini', 'aria-label': 'Move down', text: '↓', onclick: () => move(roster, i, 1, draw)}),
              h('button', {class: 'pp-mini', 'aria-label': 'Remove ' + (r.name || r.id), text: '×', onclick: async () => {
                if (!(await ask(`Take ${r.name || r.id} off the page? (Your drawings stay.)`, {yes: 'Remove'}))) return;
                roster.splice(i, 1); changed(); draw();
              }}),
            ]),
          ]);
        })),
      ]);
    }
    function siteCard() {
      const site = P.cat.site = P.cat.site || {};
      return h('section', {class: 'card'}, [
        h('h2', {text: 'Site links'}),
        h('div', {class: 'pp-form'}, [
          field('Cyril & Methodius Media link (top right)', text(site, 'imprintUrl', {type: 'url'})),
          field('Kids site', text(site, 'kidsUrl', {type: 'url'})),
        ]),
      ]);
    }

    // ---------- the tab ----------
    function draw() {
      if (!P.cat) { root.replaceChildren(P.msg ? h('div', {class: 'notice error', text: P.msg.text}) : h('div', {class: 'muted', text: 'Loading Pico Parish…'})); return; }
      status.textContent = P.busy ? 'Working…' : P.dirty ? 'Not saved yet' : 'Saved';
      saveBtn.disabled = P.busy;
      const bar = h('div', {class: 'pp-sticky'}, [
        saveBtn,
        h('button', {class: 'btn', text: 'Check links', disabled: P.busy, onclick: links}),
        h('a', {class: 'btn', href: '/pp/index.html', target: '_blank', rel: 'noopener', text: 'Preview ↗', title: 'The page as it was last built'}),
        h('button', {class: 'btn', text: 'Put online', disabled: P.busy, onclick: online, title: 'Send the last saved version to picoparish.com'}),
        status,
      ]);
      const msg = P.msg ? h('div', {class: 'notice' + (P.msg.error ? ' error' : ''), role: P.msg.error ? 'alert' : 'status', style: {whiteSpace: 'pre-line'}}, [P.msg.text,
        P.msg.link ? h('div', {}, [h('a', {href: P.msg.link, target: '_blank', rel: 'noopener', text: 'Open ' + P.msg.link.replace('https://', '') + ' ↗'})]) : null,
        P.msg.list && P.msg.list.length ? h('ul', {}, P.msg.list.map((x) => h('li', {text: x}))) : null]) : null;
      root.replaceChildren(...[
        h('div', {class: 'card', style: {gap: '4px'}}, [h('h2', {text: 'Pico Parish'}), h('div', {class: 'small muted', text: 'picoparish.com · ' + P.dir}),
          h('div', {class: 'small muted', text: 'Save & build updates the preview and keeps a copy in git. Put online sends the last saved version to picoparish.com.'})]),
        bar, msg, itemsCard(), menuCard(), villagersCard(), tvCard(), siteCard()].filter(Boolean));
    }
    load();
    return {dirty: () => P.dirty};
  }
  return {open};
})();
