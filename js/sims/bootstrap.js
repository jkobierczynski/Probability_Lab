'use strict';
Lab.register({
  id: 'bootstrap', group: 'Going further', title: 'Bootstrap Confidence Intervals', short: 'Bootstrap',
  html: () => U.layout({
    eyebrow: 'Resampling',
    title: 'Bootstrap Confidence Intervals',
    lede: 'You have one small sample and want to know how uncertain a statistic is. The bootstrap <b>resamples your own data with replacement</b> thousands of times and watches how much the statistic moves. No formula needed, and it works for medians and percentiles too.',
    controls: `
      <div class="group"><div class="label">Example data</div><div class="chips" data-k="sets"></div><p class="desc" data-k="desc"></p></div>
      <div class="group"><div class="label">Statistic</div><div class="chips" data-k="stats"></div></div>
      <div class="group"><div class="label">Resamples</div><div class="buttons">
        <button class="btn primary wide" data-k="run" type="button">Run</button>
        <button class="btn" data-k="one" type="button">Resample once</button><button class="btn" data-k="reset" type="button">Clear</button></div></div>`,
    charts: U.panel('Original sample and one resample', U.legend([['dot', '--pop', 'Original values'], ['dot', '--means', 'Picked in this resample (stacked when repeated)']]),
        `<canvas data-k="strip" style="height:130px" aria-label="Original data and latest resample"></canvas>`)
      + U.panel('<span data-k="histTitle">Bootstrap distribution</span>', U.legend([['', '--means', 'Resampled statistic'], ['', '--curve-soft', '95% percentile interval'], ['dash', '--ink', 'Original statistic']]),
        `<canvas data-k="hist" style="height:280px" aria-label="Histogram of bootstrap statistics"></canvas>
        <div class="stats">${U.stat('B', 'Resamples')}${U.stat('orig', 'Original statistic', 'n = ' + U.pred('n'))}${U.stat('se', 'Bootstrap standard error')}${U.stat('ci', '95% interval', '<span data-k="tci"></span>')}</div>`),
    notes: `<div><h3>The idea</h3>
      <p>Ideally you would draw many fresh samples from the population and see how the statistic varies. You cannot, so the bootstrap uses the sample as a stand-in for the population: draw <em>n</em> values from it with replacement, compute the statistic, repeat. Some values appear twice or three times, others not at all.</p>
      <p>The spread of the resampled statistics estimates its standard error, and the middle 95% of them gives a percentile confidence interval. Bradley Efron introduced the method in 1979.</p></div>
      <div><h3>Things to notice</h3><ul class="plain">
      <li>For the mean of the exam scores, the bootstrap interval nearly matches the classic t-interval. For the skewed response times it is lopsided, which the t-interval cannot be.</li>
      <li>The median's bootstrap distribution is lumpy, because a resampled median can only take values that are in the data.</li>
      <li>The bootstrap cannot invent information: with very small samples or extreme statistics such as the maximum, it underestimates uncertainty.</li></ul></div>`
  }),
  init(root) {
    const q = k => root.querySelector(`[data-k="${k}"]`);
    const SETS = {
      exam: { name: 'Exam scores', desc: 'Example data: 30 exam scores out of 100. Roughly symmetric.', unit: '', data: [52, 58, 61, 63, 64, 66, 67, 68, 69, 70, 71, 71, 72, 73, 74, 75, 75, 76, 77, 78, 79, 80, 81, 82, 84, 85, 87, 89, 91, 95] },
      commute: { name: 'Commute times', desc: 'Example data: 20 commute times in minutes. Skewed right.', unit: ' min', data: [12, 15, 17, 18, 19, 21, 22, 22, 24, 25, 27, 28, 31, 33, 36, 41, 45, 52, 64, 88] },
      latency: { name: 'Response times', desc: 'Example data: 25 server response times in ms, with a heavy tail.', unit: ' ms', data: [38, 41, 42, 44, 45, 47, 48, 50, 51, 53, 55, 56, 58, 61, 63, 66, 70, 74, 81, 90, 112, 140, 210, 390, 820] },
    };
    const T975 = { 19: 2.093, 24: 2.064, 29: 2.045 };
    const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
    const median = a => { const b = Float64Array.from(a).sort(), n = b.length; return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2; };
    const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
    const STATS = { mean: ['Mean', mean], median: ['Median', median], sd: ['Standard deviation', sd] };
    const S = { set: 'latency', stat: 'mean', boots: [], picks: null };
    const MAX = 20000;
    q('sets').innerHTML = U.chipHtml(Object.entries(SETS).map(([k, v]) => [k, v.name]), S.set);
    q('stats').innerHTML = U.chipHtml(Object.entries(STATS).map(([k, v]) => [k, v[0]]), S.stat);
    U.chips(root, '[data-k="sets"]', v => { S.set = v; clear(); fill(); });
    U.chips(root, '[data-k="stats"]', v => { S.stat = v; clear(); fill(); });
    const data = () => SETS[S.set].data, f = () => STATS[S.stat][1];
    function clear() { S.boots = []; S.picks = null; q('desc').textContent = SETS[S.set].desc; q('histTitle').textContent = `Bootstrap distribution of the ${STATS[S.stat][0].toLowerCase()}`; stats(); render(); }
    function resample() {
      const d = data(), n = d.length, idx = new Array(n), r = new Array(n);
      for (let i = 0; i < n; i++) { idx[i] = Math.floor(Math.random() * n); r[i] = d[idx[i]]; }
      S.picks = idx; S.boots.push(f()(r));
    }
    const fill = () => { for (let i = 0; i < 2000; i++) resample(); stats(); render(); };
    function ci() { const b = Float64Array.from(S.boots).sort(), n = b.length; return [b[Math.floor(0.025 * (n - 1))], b[Math.ceil(0.975 * (n - 1))]]; }
    function stats() {
      const d = data(), u = SETS[S.set].unit, o = f()(d), dp = S.stat === 'sd' || S.stat === 'mean' ? 1 : 1;
      U.set(root, 'B', U.int(S.boots.length)); U.set(root, 'orig', U.fmt(o, dp) + u); U.set(root, 'n', d.length);
      if (S.boots.length < 20) { U.set(root, 'se', '–'); U.set(root, 'ci', '–'); q('tci').textContent = ''; return; }
      U.set(root, 'se', U.fmt(sd(S.boots), 2) + u);
      const [a, b] = ci(); U.set(root, 'ci', `${U.fmt(a, 1)} to ${U.fmt(b, 1)}`);
      if (S.stat === 'mean') { const t = T975[d.length - 1], h = t * sd(d) / Math.sqrt(d.length); q('tci').innerHTML = `t-interval <b>${U.fmt(o - h, 1)} to ${U.fmt(o + h, 1)}</b>`; }
      else q('tci').textContent = 'percentile method';
    }
    function render() {
      if (root.hidden) return;
      const d = data(), lo0 = Math.min(...d), hi0 = Math.max(...d), padv = (hi0 - lo0) * 0.04;
      { // strip
        const p = U.plot(q('strip'), { x: [lo0 - padv, hi0 + padv], y: [0, 1], yTicks: false, pad: { t: 6, b: 24, l: 12, r: 12 } }), ctx = p.ctx, c = p.c;
        const base = p.B - 8, r = 4.5;
        const cnt = new Map(); if (S.picks) S.picks.forEach(i => cnt.set(i, (cnt.get(i) || 0) + 1));
        d.forEach((v, i) => {
          const x = p.X(v); ctx.strokeStyle = c.pop; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, base, r, 0, 7); ctx.stroke();
          const k = cnt.get(i) || 0; ctx.fillStyle = c.means;
          for (let j = 0; j < k; j++) { ctx.beginPath(); ctx.arc(x, base - 12 - j * 10, r, 0, 7); ctx.fill(); }
        });
      }
      { // histogram
        if (!S.boots.length) { const p = U.plot(q('hist'), { x: [lo0, hi0], y: [0, 1] }); U.message(p, 'Press Run to resample'); return; }
        const b = S.boots, lo = Math.min(...b), hi = Math.max(...b), span = (hi - lo) || 1, nb = 50, bw = span * 1.02 / nb, start = lo - span * 0.01;
        const counts = new Uint32Array(nb); for (const v of b) counts[Math.min(nb - 1, Math.floor((v - start) / bw))]++;
        const p = U.plot(q('hist'), { x: [start, start + nb * bw], y: [0, Math.max(...counts) * 1.12], yFmt: U.compact }), ctx = p.ctx, c = p.c;
        if (b.length >= 20) { const [a, z] = ci(); ctx.fillStyle = c.curveSoft; ctx.fillRect(p.X(a), p.T, p.X(z) - p.X(a), p.B - p.T); }
        U.bars(p, counts, start, bw, c.means);
        U.vline(p, f()(d), c.ink, 'original');
      }
    }
    const anim = U.animator(on => U.runLabel(q('run'), on, S.boots.length >= MAX ? 'Done' : 'Run'));
    q('run').addEventListener('click', () => anim.running ? anim.stop() : anim.start(() => { for (let i = 0; i < 40; i++) resample(); stats(); render(); return S.boots.length < MAX; }));
    q('one').addEventListener('click', () => { resample(); stats(); render(); });
    q('reset').addEventListener('click', () => { anim.stop(); clear(); });
    clear(); fill();
    return { render, stop: () => anim.stop() };
  }
});
