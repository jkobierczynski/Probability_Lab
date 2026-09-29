'use strict';
Lab.register({
  id: 'pi', group: 'Monte Carlo & random processes', title: 'Estimating π', short: 'Estimating π',
  html: () => U.layout({
    eyebrow: 'Monte Carlo method',
    title: 'Estimating π',
    lede: 'Throw random darts at a square, or drop needles on a striped floor, and count. The count estimates π. It works for any number of throws, but the error only shrinks like <b>1/√N</b>: each extra digit of accuracy costs a hundred times more throws.',
    controls: `
      <div class="group"><div class="label">Method</div><div class="chips" data-k="modes"></div><p class="desc" data-k="desc"></p></div>
      <div class="group"><div class="label">Throws</div><div class="buttons">
        <button class="btn primary wide" data-k="run" type="button">Run</button>
        <button class="btn" data-k="hundred" type="button">Add 100</button><button class="btn" data-k="reset" type="button">Clear</button></div></div>`,
    charts: `<div class="split">${U.panel('<span data-k="boardTitle">Darts</span>', '', `<canvas data-k="board" style="height:auto;aspect-ratio:1" aria-label="Random throws"></canvas>`)}
      ${U.panel('Estimate', '', `<div class="big" data-k="est">–</div><div class="stats" style="grid-template-columns:1fr 1fr">${U.stat('n', 'Throws')}${U.stat('hits', '<span data-k="hitLabel">Inside circle</span>')}${U.stat('err', 'Error', 'π = 3.14159…')}${U.stat('sd', 'Expected error', '±1 standard deviation')}</div>`)}</div>`
      + U.panel('Estimate as throws accumulate', U.legend([['ln', '--means', 'Your estimate'], ['', '--means-soft', 'π ± 2 SD'], ['dash', '--curve', 'π']]),
        `<canvas data-k="chart" style="height:260px" aria-label="Estimate of pi against number of throws"></canvas>`),
    notes: `<div><h3>How the counts give π</h3>
      <p><b>Darts.</b> A circle of radius 1 inside a 2 × 2 square covers π/4 of its area. The fraction of uniformly random darts that land inside estimates π/4, so π ≈ 4 × inside ÷ throws.</p>
      <p><b>Buffon's needle.</b> A needle of length ℓ dropped on a floor with lines a distance t apart (ℓ ≤ t) crosses a line with probability 2ℓ/(πt). Georges-Louis Leclerc, Comte de Buffon, posed the problem in 1733; it is one of the oldest problems in geometric probability. Here ℓ = 0.8t.</p></div>
      <div><h3>Why Monte Carlo matters</h3><ul class="plain">
      <li>The error of any Monte Carlo estimate falls like 1/√N regardless of the problem's dimension. That makes it the method of choice for integrals in many dimensions, where grid methods collapse.</li>
      <li>It powers radiation transport, option pricing, rendering (path tracing), and Bayesian statistics.</li>
      <li>The shaded band on the chart is that 1/√N law. Roughly 95% of the time, your line stays inside it.</li></ul></div>`
  }),
  init(root) {
    const q = k => root.querySelector(`[data-k="${k}"]`);
    const MAXN = 2000000, KEEP = 40000, IDX = U.logIndex(MAXN), L = 0.8;
    const S = { mode: 'darts', n: 0, hits: 0, pts: new Float32Array(KEEP * 3), kept: 0, rec: new Float32Array(IDX.length), ri: 0 };
    q('modes').innerHTML = U.chipHtml([['darts', 'Darts in a circle'], ['needle', "Buffon's needle"]], S.mode);
    U.chips(root, '[data-k="modes"]', v => { S.mode = v; anim.stop(); reset(); });
    const est = () => S.mode === 'darts' ? 4 * S.hits / S.n : (2 * L * S.n) / S.hits;
    const pHit = () => S.mode === 'darts' ? Math.PI / 4 : 2 * L / Math.PI;
    const sdAt = n => { const p = pHit(); return S.mode === 'darts' ? 4 * Math.sqrt(p * (1 - p) / n) : Math.PI * Math.sqrt((1 - p) / (p * n)); };
    function reset() {
      S.n = 0; S.hits = 0; S.kept = 0; S.ri = 0;
      q('desc').textContent = S.mode === 'darts' ? 'Uniform random points in a square. Blue landed inside the circle.' : 'Needles of length 0.8 dropped between lines 1 apart. Blue needles cross a line.';
      q('boardTitle').textContent = S.mode === 'darts' ? 'Darts' : 'Needles'; q('hitLabel').textContent = S.mode === 'darts' ? 'Inside circle' : 'Crossing a line';
      stats(); render();
    }
    function throwOne() {
      let hit, a, b, t;
      if (S.mode === 'darts') { a = Math.random() * 2 - 1; b = Math.random() * 2 - 1; hit = a * a + b * b <= 1; t = 0; }
      else {
        // centre y in [0,1) between lines at 0 and 1, x across the board; angle uniform. Crossing if half-projection reaches a line.
        a = Math.random() * 4; b = Math.random() * 4; t = Math.random() * Math.PI;
        const y = b - Math.floor(b), half = L / 2 * Math.sin(t); hit = y < half || 1 - y < half;
      }
      S.n++; if (hit) S.hits++;
      if (S.kept < KEEP) { S.pts[S.kept * 3] = a; S.pts[S.kept * 3 + 1] = b; S.pts[S.kept * 3 + 2] = hit ? t + 10 : t; S.kept++; }
      if (IDX[S.ri] === S.n) { S.rec[S.ri] = S.hits ? est() : NaN; S.ri++; }
    }
    function stats() {
      U.set(root, 'n', U.int(S.n)); U.set(root, 'hits', U.int(S.hits));
      q('est').textContent = S.n && S.hits ? est().toFixed(5) : '–';
      U.set(root, 'err', S.n && S.hits ? U.fmt(est() - Math.PI, 5) : '–'); U.set(root, 'sd', S.n ? '±' + U.fmt(sdAt(S.n), 5) : '–');
    }
    function renderBoard() {
      const cv = q('board'), { ctx, w } = U.prep(cv), c = U.colors(), pad = 6, size = w - 2 * pad;
      if (S.mode === 'darts') {
        const X = v => pad + (v + 1) / 2 * size;
        ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.strokeRect(pad + 0.5, pad + 0.5, size - 1, size - 1);
        const r = S.kept > 5000 ? 1 : S.kept > 1000 ? 1.6 : 2.4;
        for (let i = 0; i < S.kept; i++) { const hit = S.pts[i * 3 + 2] >= 10; ctx.fillStyle = hit ? c.means : c.curve; ctx.globalAlpha = S.kept > 5000 ? 0.55 : 0.85; ctx.fillRect(X(S.pts[i * 3]) - r / 2, X(S.pts[i * 3 + 1]) - r / 2, r, r); }
        ctx.globalAlpha = 1; ctx.strokeStyle = c.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(pad + size / 2, pad + size / 2, size / 2, 0, 7); ctx.stroke();
      } else {
        const sc = size / 4, Xp = v => pad + v * sc;
        ctx.strokeStyle = c.ink; ctx.lineWidth = 1.2;
        for (let k = 0; k <= 4; k++) { ctx.beginPath(); ctx.moveTo(pad, Xp(k)); ctx.lineTo(pad + size, Xp(k)); ctx.stroke(); }
        const show = Math.min(S.kept, 2500); ctx.lineWidth = show > 800 ? 1 : 1.6;
        for (let i = 0; i < show; i++) {
          const x = S.pts[i * 3], y = S.pts[i * 3 + 1], raw = S.pts[i * 3 + 2], hit = raw >= 10, t = hit ? raw - 10 : raw;
          const dx = Math.cos(t) * L / 2, dy = Math.sin(t) * L / 2;
          ctx.strokeStyle = hit ? c.means : c.pop; ctx.globalAlpha = show > 800 ? 0.6 : 0.9;
          ctx.beginPath(); ctx.moveTo(Xp(x - dx), Xp(y - dy)); ctx.lineTo(Xp(x + dx), Xp(y + dy)); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
    function renderChart() {
      const xmax = Math.max(1000, 10 ** Math.ceil(Math.log10(Math.max(10, S.n))));
      const p = U.plot(q('chart'), { x: [1, xmax], y: [2.6, 3.7], xlog: true, xLabel: 'throws (log scale)' }), ctx = p.ctx, c = p.c;
      U.clip(p);
      const up = [], dn = [];
      for (let i = 0; i <= 200; i++) { const n = xmax ** (i / 200); up.push([p.X(n), p.Y(Math.PI + 2 * sdAt(n))]); dn.push([p.X(n), p.Y(Math.PI - 2 * sdAt(n))]); }
      ctx.beginPath(); ctx.moveTo(up[0][0], up[0][1]); up.forEach(q2 => ctx.lineTo(q2[0], q2[1])); dn.reverse().forEach(q2 => ctx.lineTo(q2[0], q2[1])); ctx.closePath(); ctx.fillStyle = c.soft; ctx.fill();
      U.hline(p, Math.PI, c.curve, 'π');
      const pts = []; for (let r = 0; r < S.ri; r++) if (isFinite(S.rec[r])) pts.push([p.X(IDX[r]), p.Y(S.rec[r])]);
      U.path(ctx, pts, c.means, 2);
      U.unclip(p);
    }
    function render() { if (root.hidden) return; renderBoard(); renderChart(); }
    const anim = U.animator(on => U.runLabel(q('run'), on, S.n >= MAXN ? 'Done' : 'Run'));
    const go = () => anim.start(() => { const per = Math.max(2, Math.ceil(S.n / 30)); for (let i = 0; i < per && S.n < MAXN; i++) throwOne(); stats(); render(); return S.n < MAXN; });
    q('run').addEventListener('click', () => anim.running ? anim.stop() : (S.n >= MAXN ? (reset(), go()) : go()));
    q('hundred').addEventListener('click', () => { for (let i = 0; i < 100; i++) throwOne(); stats(); render(); });
    q('reset').addEventListener('click', () => { anim.stop(); reset(); });
    reset(); for (let i = 0; i < 2000; i++) throwOne(); stats(); render();
    return { render, stop: () => anim.stop() };
  }
});
