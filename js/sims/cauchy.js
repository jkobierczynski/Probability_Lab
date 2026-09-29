'use strict';
Lab.register({
  id: 'cauchy', group: 'Central limit theorem', title: 'When the CLT Fails', short: 'When the CLT fails',
  html: () => U.layout({
    eyebrow: 'Infinite variance',
    title: 'When the CLT Fails',
    lede: 'The Cauchy distribution looks like a harmless bell with fatter tails. But its tails are so heavy that it has <b>no mean and no variance</b>. Averaging Cauchy draws never settles down, however many you take.',
    controls: `
      <div class="group"><div class="label">Running averages</div><div class="buttons">
        <button class="btn primary wide" data-k="run" type="button">Run</button><button class="btn wide" data-k="reset" type="button">New paths</button></div>
        <p class="desc">Three normal paths and three Cauchy paths, up to 100,000 draws each.</p></div>
      <div class="group"><div class="label">Averages of n Cauchy draws</div><div class="chips" data-k="ns"></div>
        <p class="desc">Each setting draws 5,000 fresh averages. The histogram looks the same for every n.</p></div>`,
    charts: U.panel('Running average', U.legend([['ln', '--means', 'Normal(0, 1)'], ['ln', '--curve', 'Cauchy(0, 1)']]),
        `<canvas data-k="runChart" style="height:320px" aria-label="Running averages of normal and Cauchy draws"></canvas>
        <div class="stats">${U.stat('n', 'Draws per path')}${U.stat('navg', 'Normal average', 'settles on 0')}${U.stat('cavg', 'Cauchy average', 'never settles')}${U.stat('cmax', 'Largest Cauchy draw', 'one draw can move the whole average')}</div>`)
      + U.panel('<span data-k="histTitle">Distribution of averages</span>', U.legend([['', '--curve', 'Averages of n Cauchy draws'], ['ln', '--ink', 'Standard Cauchy density']]),
        `<canvas data-k="hist" style="height:260px" aria-label="Histogram of Cauchy averages"></canvas>
        <div class="stats">${U.stat('beyond', 'Averages beyond ±2', 'Cauchy predicts ' + U.pred('pb') + ' for every n')}${U.stat('iqr', 'Middle 50% spans', 'Cauchy predicts −1 to 1')}${U.stat('nsd', 'If the CLT held', 'middle 50% of N(0, 1/n)')}</div>`),
    notes: `<div><h3>What breaks</h3>
      <p>The Cauchy density 1/(π(1 + x²)) falls off so slowly that the integral for its mean does not converge. Without a mean or a finite variance, the central limit theorem has nothing to work with.</p>
      <p>Worse, the average of <em>n</em> independent Cauchy draws has exactly the same Cauchy distribution as a single draw. Taking more data gives you no more precision at all. Every so often a single enormous draw arrives and yanks the running average somewhere new.</p></div>
      <div><h3>Where this shows up</h3><ul class="plain">
      <li>The ratio of two independent normal variables is Cauchy, so it appears whenever you divide one noisy measurement by another that can be near zero.</li>
      <li>The shape of spectral lines (the Lorentzian profile) is a Cauchy distribution.</li>
      <li>Heavy-tailed data such as insurance claims, city sizes or network flow sizes can have infinite variance too. There, the sample mean converges slowly or not at all, and medians are safer.</li></ul></div>`
  }),
  init(root) {
    const q = k => root.querySelector(`[data-k="${k}"]`);
    const MAX = 100000, K = 3, IDX = U.logIndex(MAX);
    const cauchy = () => Math.tan(Math.PI * (Math.random() - 0.5));
    const S = { n: 0, ns: null, cs: null, rn: null, rc: null, ri: 0, cmax: 0, hn: 1, means: null };
    q('ns').innerHTML = U.chipHtml([[1, 'n = 1'], [10, '10'], [100, '100'], [1000, '1,000']], S.hn);
    U.chips(root, '[data-k="ns"]', v => { S.hn = +v; hist(); });

    function reset() {
      S.n = 0; S.ri = 0; S.cmax = 0; S.ns = new Float64Array(K); S.cs = new Float64Array(K);
      S.rn = Array.from({ length: K }, () => new Float32Array(IDX.length)); S.rc = Array.from({ length: K }, () => new Float32Array(IDX.length));
      stats(); render();
    }
    function step() {
      S.n++;
      for (let k = 0; k < K; k++) { S.ns[k] += U.gauss(); const c = cauchy(); S.cs[k] += c; if (Math.abs(c) > Math.abs(S.cmax)) S.cmax = c; }
      if (IDX[S.ri] === S.n) { for (let k = 0; k < K; k++) { S.rn[k][S.ri] = S.ns[k] / S.n; S.rc[k][S.ri] = S.cs[k] / S.n; } S.ri++; }
    }
    function hist() {
      const N = 5000, n = S.hn, m = new Float64Array(N);
      for (let i = 0; i < N; i++) { let s = 0; for (let j = 0; j < n; j++) s += cauchy(); m[i] = s / n; }
      S.means = m; q('histTitle').textContent = `Distribution of averages, n = ${n.toLocaleString('en-US')}`;
      let beyond = 0; for (const v of m) if (Math.abs(v) > 2) beyond++;
      const sorted = Float64Array.from(m).sort();
      U.set(root, 'beyond', U.pct(beyond / N)); U.set(root, 'pb', U.pct(1 - 2 / Math.PI * Math.atan(2)));
      U.set(root, 'iqr', `${U.fmt(sorted[Math.floor(N / 4)], 2)} to ${U.fmt(sorted[Math.floor(3 * N / 4)], 2)}`);
      U.set(root, 'nsd', `±${U.fmt(0.674 / Math.sqrt(n), 3)}`);
      render();
    }
    function stats() {
      U.set(root, 'n', U.int(S.n));
      U.set(root, 'navg', S.n ? U.fmt(S.ns[0] / S.n) : '–'); U.set(root, 'cavg', S.n ? U.fmt(S.cs[0] / S.n) : '–');
      U.set(root, 'cmax', S.n ? U.compact(S.cmax) : '–');
    }
    function render() {
      if (root.hidden) return;
      const p = U.plot(q('runChart'), { x: [1, MAX], y: [-4, 4], xlog: true, xLabel: 'draws (log scale)' }), c = p.c;
      U.clip(p); U.hline(p, 0, c.muted);
      for (let k = K - 1; k >= 0; k--) {
        const a = [], b = [];
        for (let r = 0; r < S.ri; r++) { a.push([p.X(IDX[r]), p.Y(S.rn[k][r])]); b.push([p.X(IDX[r]), p.Y(Math.max(-8, Math.min(8, S.rc[k][r])))]); }
        U.path(p.ctx, a, c.means, k ? 1.2 : 2, null, k ? 0.6 : 1); U.path(p.ctx, b, c.curve, k ? 1.2 : 2, null, k ? 0.6 : 1);
      }
      U.unclip(p);
      if (S.means) {
        const lo = -6, hi = 6, nb = 60, bw = (hi - lo) / nb, counts = new Uint32Array(nb);
        for (const v of S.means) { const j = Math.floor((v - lo) / bw); if (j >= 0 && j < nb) counts[j]++; }
        const dens = x => S.means.length * bw / (Math.PI * (1 + x * x));
        const h = U.plot(q('hist'), { x: [lo, hi], y: [0, Math.max(...counts, dens(0)) * 1.1], yFmt: U.compact });
        U.bars(h, counts, lo, bw, h.c.curve, 0.6);
        U.fnPath(h, dens, lo, hi, h.c.ink, 2);
      }
    }
    const anim = U.animator(on => U.runLabel(q('run'), on, S.n >= MAX ? 'Done' : 'Run'));
    const go = () => anim.start(() => { const per = Math.max(1, Math.ceil(S.n / 50)); for (let i = 0; i < per && S.n < MAX; i++) step(); stats(); render(); return S.n < MAX; });
    q('run').addEventListener('click', () => anim.running ? anim.stop() : (S.n >= MAX ? (reset(), go()) : go()));
    q('reset').addEventListener('click', () => { anim.stop(); reset(); });
    reset(); for (let i = 0; i < 20000; i++) step(); stats(); hist();
    return { render, stop: () => anim.stop() };
  }
});
