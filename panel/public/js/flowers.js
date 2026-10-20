// Falling red & white flowers / petals for the sidebar (and login screen)
(function () {
  function FlowerRain(canvas, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const colors = opts.colors || ['#ffffff', '#ffe3e8', '#ff4d6d', '#ffb3c1', '#ffffff'];
    let W = 0, H = 0, items = [], raf = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

    function size() {
      const r = canvas.parentElement.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function make(top) {
      const flower = Math.random() < 0.35;
      return {
        x: Math.random() * W, y: top ? -20 - Math.random() * H : Math.random() * H,
        r: flower ? 5 + Math.random() * 5 : 3 + Math.random() * 4,
        vy: 0.35 + Math.random() * 0.8, vx: -0.2 + Math.random() * 0.4,
        rot: Math.random() * 6.28, vr: -0.02 + Math.random() * 0.04,
        sway: Math.random() * 6.28, flower,
        color: colors[(Math.random() * colors.length) | 0],
        alpha: 0.55 + Math.random() * 0.45,
      };
    }
    function petal(p) {
      ctx.beginPath();
      ctx.moveTo(0, -p.r);
      ctx.bezierCurveTo(p.r, -p.r * 0.6, p.r * 0.7, p.r * 0.8, 0, p.r);
      ctx.bezierCurveTo(-p.r * 0.7, p.r * 0.8, -p.r, -p.r * 0.6, 0, -p.r);
      ctx.fill();
    }
    function flower(p) {
      for (let i = 0; i < 5; i++) {
        ctx.save(); ctx.rotate((i * Math.PI * 2) / 5);
        ctx.beginPath(); ctx.ellipse(0, -p.r * 0.75, p.r * 0.45, p.r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = p.color === '#ffffff' ? '#ff4d6d' : '#fff4c2';
      ctx.beginPath(); ctx.arc(0, 0, p.r * 0.3, 0, Math.PI * 2); ctx.fill();
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      for (const p of items) {
        p.sway += 0.02; p.y += p.vy; p.x += p.vx + Math.sin(p.sway) * 0.4; p.rot += p.vr;
        if (p.y > H + 20 || p.x < -30 || p.x > W + 30) Object.assign(p, make(true), { y: -15 });
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
        p.flower ? flower(p) : petal(p);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }
    size();
    const count = opts.count || Math.round((W * H) / 9000) + 12;
    items = Array.from({ length: Math.min(count, 90) }, () => make(false));
    const ro = new ResizeObserver(size); ro.observe(canvas.parentElement);
    if (reduce) { frame(); cancelAnimationFrame(raf); } else frame();
    return { stop() { cancelAnimationFrame(raf); ro.disconnect(); } };
  }
  window.FlowerRain = FlowerRain;
})();
