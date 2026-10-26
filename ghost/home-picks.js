// Homepage "picks of the day" for her Ghost sites (pasted into Code injection → Site footer,
// built into ghost/home-picks-<site>.html by scripts/home-picks.mjs). Each pick changes once a
// day (everyone sees the same one that day) and a button opens a random one. Runs in the
// visitor's browser because Ghost serves cached pages. Uses the Content API key the site
// already publishes for its search box.
(function () {
  var cfg = window.SD_PICKS;
  if (!cfg || location.pathname !== '/') return;
  var keyEl = document.querySelector('[data-key][data-api]');
  if (!keyEl) return;
  var api = keyEl.getAttribute('data-api').replace(/\/$/, '') + '/posts/';
  var key = keyEl.getAttribute('data-key');
  var day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  // Spread the days over the list (a fixed shuffle, not just "the next one").
  var spot = function (n, salt) { return ((day + salt) * 2654435761 >>> 0) % n; };
  var esc = function (s) { return String(s || '').replace(/[&<>"]/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]; }); };
  var get = function (filter, page, limit) {
    return fetch(api + '?key=' + key + '&filter=' + encodeURIComponent(filter) + '&limit=' + limit + '&page=' + page +
      '&fields=title,url,feature_image,custom_excerpt,excerpt').then(function (r) { return r.json(); });
  };
  // One post from a list: the day's (seeded) or a random one.
  var pick = function (filter, salt, random) {
    return get(filter, 1, 1).then(function (d) {
      var n = d.meta && d.meta.pagination ? d.meta.pagination.total : 0;
      if (!n) return null;
      var i = random ? Math.floor(Math.random() * n) : spot(n, salt);
      // Posts that aren't lessons (a course's "Sources" or "Congratulations!" page): try the next one.
      var tries = 0;
      var at = function (j) {
        return get(filter, (j % n) + 1, 1).then(function (x) {
          var p = x.posts && x.posts[0];
          if (p && cfg.skip && cfg.skip.test(p.title) && ++tries < 8) return at(j + 1);
          return p;
        });
      };
      return at(i);
    });
  };
  var anchor = document.querySelector(cfg.before);
  if (!anchor) return;
  var box = document.createElement('section');
  box.className = cfg.sectionClass;
  var inner = box;
  if (cfg.innerClass) { inner = document.createElement('div'); inner.className = cfg.innerClass; box.appendChild(inner); }
  inner.innerHTML = '<h2 class="' + cfg.titleClass + '">' + esc(cfg.title) + '</h2><div class="' + cfg.gridClass + '"></div><div class="sd-picks-actions"></div>';
  anchor.parentNode.insertBefore(box, anchor);
  var grid = inner.children[1], actions = inner.children[2];
  Promise.all(cfg.lists.map(function (l, i) { return pick(l.filter, i * 101 + 7, false); })).then(function (posts) {
    posts.forEach(function (p, i) { if (p) grid.insertAdjacentHTML('beforeend', cfg.card(p, cfg.lists[i].label, esc)); });
    if (!grid.children.length) { box.remove(); return; }
    cfg.lists.forEach(function (l, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = cfg.buttonClass;
      b.textContent = l.button;
      b.addEventListener('click', function () {
        b.disabled = true;
        pick(l.filter, i * 101 + 7, true).then(function (p) { if (p) location.href = p.url; else b.disabled = false; }, function () { b.disabled = false; });
      });
      actions.appendChild(b);
    });
  }, function () { box.remove(); });
})();
