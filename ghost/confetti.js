// A burst of confetti for a perfect quiz (no libraries). window.ccConfetti()
// Skipped for people who ask their device for less motion.
(function () {
  'use strict';
  var COLORS = ['#FF4F6D', '#18B7A6', '#FFB300', '#7B5CFF', '#2F8CFF', '#FF8A3D', '#A9842F'];
  window.ccConfetti = function () {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483647';
    document.body.appendChild(canvas);
    var g = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var W = canvas.width = innerWidth * dpr, H = canvas.height = innerHeight * dpr;
    var bits = [];
    for (var i = 0; i < 170; i++) {
      var fromLeft = i % 2 === 0;
      bits.push({
        x: fromLeft ? W * 0.1 : W * 0.9, y: H * 0.75,
        vx: (fromLeft ? 1 : -1) * (4 + Math.random() * 9) * dpr, vy: -(10 + Math.random() * 12) * dpr,
        size: (6 + Math.random() * 6) * dpr, color: COLORS[i % COLORS.length],
        spin: Math.random() * 6, turn: (Math.random() - 0.5) * 0.3, round: Math.random() < 0.3
      });
    }
    var start = performance.now();
    (function frame(now) {
      var t = now - start;
      g.clearRect(0, 0, W, H);
      bits.forEach(function (b) {
        b.vy += 0.35 * dpr; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.spin += b.turn;
        g.save();
        g.globalAlpha = Math.max(0, 1 - Math.max(0, t - 2200) / 800);
        g.translate(b.x, b.y); g.rotate(b.spin); g.fillStyle = b.color;
        if (b.round) { g.beginPath(); g.arc(0, 0, b.size / 2, 0, Math.PI * 2); g.fill(); }
        else g.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2);
        g.restore();
      });
      if (t < 3000) requestAnimationFrame(frame); else canvas.remove();
    })(start);
  };
})();
