'use strict';
Lab.register({
  id: 'lln', group: 'Central limit theorem', title: 'Law of Large Numbers', short: 'Law of large numbers',
  html: () => U.layout({
    eyebrow: 'Running averages',
    title: 'Law of Large Numbers',
    lede: 'Keep a running average of coin flips, die rolls or waiting times. Early on it swings wildly. The more trials you add, the more tightly every path <b>settles on the true mean μ</b>, each along its own route.',
    controls: `
      <div class="group"><div class="label">Experiment</div><div class="chips" data-k="pops"></div><p class="desc" data-k="desc"></p></div>
      <div class="group"><div class="label">Paths at once</div><div class="chips" data-k="paths"></div></div>
      <div class="group"><div class="label">Trials</div><div class="buttons">
        <button class="btn primary wide" data-k="run" type="button">Run</button>
        <button class="btn" data-k="step" type="button">Add 10 trials</button><button class="btn" data-k="reset" type="button">New paths</button></div></div>`,
    charts: U.panel('Running average after n trials', U.legend([['ln', '--means', 'Path 1'], ['ln', '--pop', 'Other paths'], ['', '--means-soft', 'μ ± 2σ/√n']]),
        `<canvas data-k="chart" style="height:360px" aria-label="Running averages"></canvas>
        <div class="stats">${U.stat('n', 'Trials', 'up to 10,000')}${U.stat('avg', 'Path 1 average', 'true μ = ' + U.pred('mu'))}${U.stat('err', 'Path 1 error', 'typical σ/√n = ' + U.pred('se'))}${U.stat('inside', 'Paths inside band', 'expected about 95%')}</div>`),
    notes: `<div><h3>What is going on</h3>
      <p>The law of large numbers says the average of <em>n</em> independent trials converges to the expected value μ. It does not say the results even out: after a run of heads the coin has no memory. Early luck simply gets diluted by everything that comes after it.</p>
      <p>The shaded band is μ ± 2σ/√n. Its width shrinks like 1/√n, which is the central limit theorem at work: to halve the typical error you need four times as many trials.</p></div>
      <div><h3>Things to notice</h3><ul class="plain">
      <li>The x-axis is logarithmic. Each gridline is ten times more trials than the last, yet the paths keep narrowing at the same steady rate.</li>
      <li>With 25 paths, roughly 1 in 20 sits outside the band at any moment. Which ones changes over time.</li>
      <li>Exponential waiting times make big upward jumps early on, because rare long waits pull the average up.</li></ul></div>`
  }),
  init(root) {
    const q = k => root.querySelector(`[data-k="${k}"]`);
    const MAX = 10000;
    const P = {
      coin: { name: 'Coin flips', desc: 'Fraction of heads with a fair coin. μ = 0.5.', mu: 0.5, sd: 0.5, y: [0, 1], sample: () => Math.random() < 0.5 ? 1 : 0 },
      die: { name: 'Die rolls', desc: 'Average face of a fair die. μ = 3.5.', mu: 3.5, sd: Math.sqrt(35 / 12), y: [1, 6], sample: () => 1 + Math.floor(Math.random() * 6) },
      wait: { name: 'Waiting times', desc: 'Average wait with an exponential distribution. μ = 1 minute.', mu: 1, sd: 1, y: [0, 3], sample: () => -Math.log(1 - Math.random()) },
    };
    const IDX = U.logIndex(MAX);
    const S = { pop: 'coin', K: 5, n: 0, sums: null, rec: null };
    const pop = () => P[S.pop];
    q('pops').innerHTML = U.chipHtml(Object.entries(P).map(([k, v]) => [k, v.name]), S.pop);
    q('paths').innerHTML = U.chipHtml([[1, '1'], [5, '5'], [25, '25']], S.K);
    U.chips(root, '[data-k="pops"]', v => { S.pop = v; reset(); go(); });
    U.chips(root, '[data-k="paths"]', v => { S.K = +v; reset(); go(); });

    function reset() {
      S.n = 0; S.sums = new Float64Array(S.K); S.rec = Array.from({ length: S.K }, () => new Float32Array(IDX.length)); S.ri = 0;
      q('desc').textContent = pop().desc; stats(); render();
    }
    function trial() {
      if (S.n >= MAX) return;
      S.n++;
      for (let k = 0; k < S.K; k++) S.sums[k] += pop().sample();
      if (IDX[S.ri] === S.n) { for (let k = 0; k < S.K; k++) S.rec[k][S.ri] = S.sums[k] / S.n; S.ri++; }
    }
    function stats() {
      const n = S.n, mu = pop().mu, se = pop().sd / Math.sqrt(Math.max(1, n));
      U.set(root, 'n', U.int(n)); U.set(root, 'mu', U.fmt(mu));
      U.set(root, 'se', n ? U.fmt(se) : '–');
      if (!n) { ['avg', 'err', 'inside'].forEach(k => U.set(root, k, '–')); return; }
      const avg = S.sums[0] / n; U.set(root, 'avg', U.fmt(avg)); U.set(root, 'err', U.fmt(Math.abs(avg - mu)));
      let inside = 0; for (let k = 0; k < S.K; k++) if (Math.abs(S.sums[k] / n - mu) <= 2 * se) inside++;
      U.set(root, 'inside', `${inside} of ${S.K}`);
    }
    function render() {
      if (root.hidden) return;
      const P0 = pop(), p = U.plot(q('chart'), { x: [1, MAX], y: P0.y, xlog: true, xLabel: 'trials n (log scale)' }), ctx = p.ctx, c = p.c;
      U.clip(p);
      // band
      ctx.beginPath(); const up = [], dn = [];
      for (const i of IDX) { const s = 2 * P0.sd / Math.sqrt(i); up.push([p.X(i), p.Y(P0.mu + s)]); dn.push([p.X(i), p.Y(P0.mu - s)]); }
      ctx.moveTo(up[0][0], up[0][1]); up.forEach(pt => ctx.lineTo(pt[0], pt[1])); dn.reverse().forEach(pt => ctx.lineTo(pt[0], pt[1])); ctx.closePath();
      ctx.fillStyle = c.soft; ctx.fill();
      U.hline(p, P0.mu, c.muted, 'μ = ' + P0.mu);
      for (let k = S.K - 1; k >= 0; k--) {
        const pts = []; for (let r = 0; r < S.ri; r++) pts.push([p.X(IDX[r]), p.Y(S.rec[k][r])]);
        if (S.n && IDX[S.ri - 1] !== S.n) pts.push([p.X(S.n), p.Y(S.sums[k] / S.n)]);
        U.path(ctx, pts, k === 0 ? c.means : c.pop, k === 0 ? 2.2 : 1.2, null, k === 0 ? 1 : 0.7);
      }
      U.unclip(p);
      if (!S.n) U.message(p, 'Press Run to start flipping');
    }
    const anim = U.animator(on => U.runLabel(q('run'), on, S.n >= MAX ? 'Done' : 'Run'));
    function go() {
      anim.start(() => { const per = Math.max(1, Math.ceil(S.n / 60)); for (let i = 0; i < per; i++) trial(); stats(); render(); return S.n < MAX; });
    }
    q('run').addEventListener('click', () => anim.running ? anim.stop() : (S.n >= MAX ? (reset(), go()) : go()));
    q('step').addEventListener('click', () => { for (let i = 0; i < 10; i++) trial(); stats(); render(); });
    q('reset').addEventListener('click', () => { anim.stop(); reset(); });
    reset();
    for (let i = 0; i < 3000; i++) trial(); stats(); render();
    return { render, stop: () => anim.stop() };
  }
});
