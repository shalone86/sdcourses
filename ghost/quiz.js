// Renders every .cc-quiz block on the page from its embedded JSON.
// Question types: choice, truefalse, blank. Results stay in this browser
// only (localStorage), keyed by lesson. Built into the theme
// (theme/sdcourses) and usable on its own via Code Injection; when both are
// present it runs once. Fires a `cc-quiz-done` event when finished.
(function () {
  if (window.ccQuizLoaded) return;
  window.ccQuizLoaded = true;
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
  function shuffled(n) {
    var order = [];
    for (var i = 0; i < n; i++) order.push(i);
    for (var k = n - 1; k > 0; k--) {
      var j = Math.floor(Math.random() * (k + 1)), t = order[k]; order[k] = order[j]; order[j] = t;
    }
    return order;
  }
  function simplify(s) {
    return String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  // Each builder adds its controls to `box` and calls done(correct) once.
  var builders = {
    choice: function (q, box, done) {
      var opts = el('div', 'cc-opts');
      shuffled(q.options.length).forEach(function (oi) {
        var b = el('button', 'cc-opt', q.options[oi]);
        b.type = 'button';
        b.setAttribute('data-i', oi);
        b.addEventListener('click', function () {
          opts.querySelectorAll('button').forEach(function (x) {
            var xi = +x.getAttribute('data-i');
            x.disabled = true;
            if (xi === q.answer) x.classList.add('is-right');
            else if (xi === oi) x.classList.add('is-wrong');
          });
          done(oi === q.answer);
        });
        opts.appendChild(b);
      });
      box.appendChild(opts);
    },
    truefalse: function (q, box, done) {
      builders.choice({options: ['True', 'False'], answer: q.answer ? 0 : 1}, box, done);
      // True/False read better in a fixed order.
      var opts = box.querySelector('.cc-opts');
      opts.classList.add('cc-opts-row');
      if (opts.firstChild.getAttribute('data-i') === '1') opts.appendChild(opts.firstChild);
    },
    blank: function (q, box, done, id) {
      var form = el('form', 'cc-blank');
      var input = el('input', 'cc-input');
      input.type = 'text';
      input.id = id;
      input.autocomplete = 'off';
      input.setAttribute('aria-label', 'Your answer');
      var go = el('button', 'cc-opt cc-check', 'Check');
      go.type = 'submit';
      form.appendChild(input);
      form.appendChild(go);
      var reveal = el('p', 'cc-answer');
      reveal.hidden = true;
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!input.value.trim()) { input.focus(); return; }
        var ok = q.accept.some(function (a) { return simplify(a) === simplify(input.value); });
        input.disabled = go.disabled = true;
        form.classList.add(ok ? 'is-right' : 'is-wrong');
        if (!ok) { reveal.textContent = 'Answer: ' + q.accept[0]; reveal.hidden = false; }
        done(ok);
      });
      box.appendChild(form);
      box.appendChild(reveal);
    },
  };

  function render(root) {
    var data;
    try { data = JSON.parse(root.querySelector('script[type="application/json"]').textContent); } catch (e) { return; }
    var key = 'cc-quiz:' + (root.getAttribute('data-lesson') || location.pathname);
    var results = [];
    root.querySelectorAll('.cc-q, .cc-score, .cc-quiz-fallback').forEach(function (n) { n.remove(); });

    var score = el('p', 'cc-score');
    score.setAttribute('aria-live', 'polite');

    data.questions.forEach(function (q, qi) {
      var box = el('div', 'cc-q');
      var label = { choice: '', truefalse: 'True or false? ', blank: 'Fill in the blank: ' }[q.type || 'choice'] || '';
      box.appendChild(el('p', 'cc-q-text', (qi + 1) + '. ' + label + q.question));
      var why = el('p', 'cc-why', q.why);
      why.hidden = true;
      (builders[q.type] || builders.choice)(q, box, function (ok) {
        results[qi] = ok;
        why.hidden = false;
        update();
      }, 'cc-' + (root.getAttribute('data-lesson') || 'q') + '-' + qi);
      box.appendChild(why);
      root.appendChild(box);
    });
    root.appendChild(score);

    function update() {
      var done = results.filter(function (r) { return r != null; }).length;
      if (done < data.questions.length) { score.textContent = ''; return; }
      var right = results.filter(Boolean).length;
      score.textContent = 'You got ' + right + ' of ' + data.questions.length + '.';
      var retry = el('button', 'cc-retry', 'Try again');
      retry.type = 'button';
      retry.addEventListener('click', function () {
        render(root);
        // Back to the first question, not wherever the score was.
        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        root.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block: 'start'});
        var first = root.querySelector('.cc-opt, .cc-input');
        if (first) first.focus({preventScroll: true});
      });
      score.appendChild(retry);
      var prev = store(key) || {};
      store(key, {best: Math.max(prev.best || 0, right), total: data.questions.length, at: Date.now()});
      document.dispatchEvent(new CustomEvent('cc-quiz-done', {detail: {lesson: root.getAttribute('data-lesson'), right: right, total: data.questions.length}}));
    }
  }

  function init() { document.querySelectorAll('.cc-quiz').forEach(render); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
