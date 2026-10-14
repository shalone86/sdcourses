// Renders every .cc-quiz block on the page from its embedded JSON.
// Results are kept in this browser only (localStorage), keyed by lesson.
(function () {
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(key) || 'null');
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { return null; }
  }

  function render(root) {
    var data;
    try { data = JSON.parse(root.querySelector('script[type="application/json"]').textContent); } catch (e) { return; }
    var key = 'cc-quiz:' + (root.getAttribute('data-lesson') || location.pathname);
    var answers = [];
    root.querySelectorAll('.cc-q, .cc-score, .cc-quiz-fallback').forEach(function (n) { n.remove(); });

    var score = el('p', 'cc-score');
    score.setAttribute('aria-live', 'polite');

    data.questions.forEach(function (q, qi) {
      var box = el('div', 'cc-q');
      box.appendChild(el('p', 'cc-q-text', (qi + 1) + '. ' + q.question));
      var opts = el('div', 'cc-opts');
      var why = el('p', 'cc-why', q.why);
      // Shuffle so the right answer isn't always in the same place.
      var order = q.options.map(function (_, i) { return i; });
      for (var i = order.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1)), t = order[i]; order[i] = order[j]; order[j] = t;
      }
      why.hidden = true;
      order.forEach(function (oi) {
        var b = el('button', 'cc-opt', q.options[oi]);
        b.setAttribute('data-i', oi);
        b.type = 'button';
        b.addEventListener('click', function () {
          answers[qi] = oi;
          opts.querySelectorAll('button').forEach(function (x) {
            var xi = +x.getAttribute('data-i');
            x.disabled = true;
            if (xi === q.answer) x.classList.add('is-right');
            else if (xi === oi) x.classList.add('is-wrong');
          });
          why.hidden = false;
          update();
        });
        opts.appendChild(b);
      });
      box.appendChild(opts);
      box.appendChild(why);
      root.appendChild(box);
    });
    root.appendChild(score);

    function update() {
      var done = answers.filter(function (a) { return a != null; }).length;
      if (done < data.questions.length) { score.textContent = ''; return; }
      var right = data.questions.filter(function (q, i) { return answers[i] === q.answer; }).length;
      score.textContent = 'You got ' + right + ' of ' + data.questions.length + '.';
      var retry = el('button', 'cc-retry', 'Try again');
      retry.type = 'button';
      retry.addEventListener('click', function () { render(root); });
      score.appendChild(retry);
      var prev = store(key) || {};
      store(key, {best: Math.max(prev.best || 0, right), total: data.questions.length, at: Date.now()});
    }
  }

  function init() { document.querySelectorAll('.cc-quiz').forEach(render); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
