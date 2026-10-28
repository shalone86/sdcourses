// "Are you sure?" beside the button just clicked, instead of the browser's box at the top of
// the screen. ask(message, {yes, no, extra}) → Promise<true|false>; `extra` is an element shown
// under the message (e.g. a choice to make first). Enter says yes, Esc says no.
'use strict';
(() => {
  let anchor = null, point = null;
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest?.('.ask-pop')) return;
    anchor = e.target.closest?.('button, a, label, summary, [role=button]') || null;
    point = {x: e.clientX, y: e.clientY};
  }, true);

  window.ask = (message, {yes = 'Yes', no = 'Cancel', extra = null} = {}) => new Promise((done) => {
    document.querySelector('.ask-pop')?.dispatchEvent(new Event('cancel'));
    const pop = document.createElement('div');
    pop.className = 'ask-pop';
    pop.setAttribute('role', 'alertdialog');
    const text = document.createElement('div');
    text.className = 'ask-text';
    text.textContent = message;
    const row = document.createElement('div');
    row.className = 'ask-row';
    const noB = Object.assign(document.createElement('button'), {className: 'btn', textContent: no, type: 'button'});
    const yesB = Object.assign(document.createElement('button'), {className: 'btn primary', textContent: yes, type: 'button'});
    row.append(noB, yesB);
    pop.append(...[text, extra, row].filter(Boolean));
    const back = document.activeElement;
    const finish = (v) => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onOutside, true);
      pop.remove();
      back?.focus?.({preventScroll: true});
      done(v);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
      // Enter, or F19 (her record key), presses the yes button.
      else if ((e.key === 'Enter' && e.target.tagName !== 'SELECT') || e.key === 'F19' || e.code === 'F19') { e.preventDefault(); e.stopPropagation(); finish(true); }
    };
    const onOutside = (e) => { if (!pop.contains(e.target)) finish(false); };
    noB.onclick = () => finish(false);
    yesB.onclick = () => finish(true);
    pop.addEventListener('cancel', () => finish(false));
    document.body.append(pop);
    // Under the button if it fits, else above it; kept on screen.
    const r = anchor?.isConnected ? anchor.getBoundingClientRect() : point ? {left: point.x, right: point.x, top: point.y, bottom: point.y} : null;
    const w = pop.offsetWidth, hgt = pop.offsetHeight, vw = innerWidth, vh = innerHeight;
    let x = r ? (r.left + r.right) / 2 - w / 2 : (vw - w) / 2;
    let y = r ? (r.bottom + 8 + hgt < vh ? r.bottom + 8 : r.top - 8 - hgt) : (vh - hgt) / 3;
    pop.style.left = Math.max(8, Math.min(vw - w - 8, x)) + 'px';
    pop.style.top = Math.max(8, Math.min(vh - hgt - 8, y)) + 'px';
    setTimeout(() => {
      document.addEventListener('keydown', onKey, true);
      document.addEventListener('pointerdown', onOutside, true);
    });
    (extra?.querySelector?.('select, input') || yesB).focus({preventScroll: true});
  });
})();
