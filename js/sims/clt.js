'use strict';
Lab.register({
  id: 'clt', group: 'Central limit theorem', title: 'Central Limit Theorem', short: 'Central limit theorem',
  html: () => U.layout({
    eyebrow: 'Sampling distributions',
    title: 'Central Limit Theorem',
    lede: 'Pick any population, draw samples of size <b>n</b>, and average each one. The averages pile up into a <b>bell curve</b> whose width shrinks like <b>σ/√n</b>, no matter how lopsided the population is.',
    controls: `
      <div class="group"><div class="label">Population</div><div class="chips" data-k="dists"></div><p class="desc" data-k="desc" style="min-height:2.6em"></p></div>
      <div class="group"><label class="label" for="clt-n">Sample size <output data-k="nOut">n = 5</output></label>
        <input type="range" id="clt-n" min="0" max="11" step="1" value="4"><div class="scale"><span>1</span><span>10</span><span>100</span></div></div>
      <div class="group"><div class="label">Draw samples</div><div class="buttons">
        <button class="btn primary wide" data-k="run" type="button">Run</button>
        <button class="btn" data-k="one" type="button">Draw 1</button><button class="btn" data-k="hundred" type="button">Draw 100</button>
        <button class="btn" data-k="thousand" type="button">Draw 1,000</button><button class="btn" data-k="reset" type="button">Clear</button></div></div>
      <label class="toggle" for="clt-scale"><input type="checkbox" id="clt-scale"><span>Keep population scale<small>Use the population's x-axis for the means, so you can watch the spread shrink as n grows.</small></span></label>`,
    charts: U.panel('<span data-k="popTitle">Population</span>',
        '<div class="params"><span>μ = <b data-k="mu"></b></span><span>σ = <b data-k="sd"></b></span><span>skew = <b data-k="sk"></b></span></div>',
        `<canvas data-k="pop" style="height:150px" aria-label="Population distribution"></canvas><div class="cap" data-k="stripLabel">Latest sample</div><canvas data-k="strip" style="height:46px" aria-label="Latest sample values"></canvas>`)
      + U.panel('Distribution of sample means', U.legend([['', '--means', 'Simulated means'], ['ln', '--curve', 'Normal prediction N(μ, σ²/n)']]),
        `<canvas data-k="means" style="height:300px" aria-label="Histogram of sample means"></canvas>
        <div class="stats">${U.stat('count', 'Samples drawn', 'each of size ' + U.pred('n'))}${U.stat('mean', 'Mean of means', 'predicted μ = ' + U.pred('pMean'))}${U.stat('sd', 'SD of means', 'predicted σ/√n = ' + U.pred('pSd'))}${U.stat('skew', 'Skewness', 'predicted γ/√n = ' + U.pred('pSkew'))}</div>`),
    notes: `<div><h3>What the theorem says</h3>
      <p>Take <em>n</em> independent draws from a population with mean μ and finite standard deviation σ, and compute their average X̄. Repeat that many times. As <em>n</em> grows, the distribution of X̄ approaches a normal distribution:</p>
      <div class="formula">X̄<sub class="n">n</sub> ≈ N( μ , σ² / <span class="n">n</span> )</div>
      <p>The shape of the population stops mattering. Its skew fades like 1/√n, its humps blur together, and its gaps fill in. The orange curve is this prediction and the blue bars are what the simulation actually produced.</p>
      <p>The theorem needs a finite variance. The <a href="#cauchy">Cauchy simulation</a> shows what happens without one.</p></div>
      <div><h3>Things to try</h3><ul class="tries" data-k="tries"></ul></div>`
  }),
  init(root) {
    const q = k => root.querySelector(`[data-k="${k}"]`);
    const N_STOPS = [1, 2, 3, 4, 5, 8, 10, 15, 20, 30, 50, 100], CAP = 100000, LN_S2 = 0.5625;
    const D = {
      uniform: { name: 'Uniform', desc: 'Every value between 0 and 1 is equally likely. Flat, no peak at all.', mu: 0.5, sd: Math.sqrt(1 / 12), skew: 0, lo: 0, hi: 1,
        sample: () => Math.random(), pdf: x => (x >= 0 && x <= 1) ? 1 : 0 },
      exponential: { name: 'Exponential', desc: 'Waiting times between random events. Piled up near 0 with a long right tail.', mu: 1, sd: 1, skew: 2, lo: 0, hi: 6,
        sample: () => -Math.log(1 - Math.random()), pdf: x => x < 0 ? 0 : Math.exp(-x) },
      die: { name: 'Fair die', desc: 'A single roll: 1 to 6, each with probability 1/6. Discrete and flat.', mu: 3.5, sd: Math.sqrt(35 / 12), skew: 0, lo: 0.5, hi: 6.5, lattice: 1, origin: 1,
        sample: () => 1 + Math.floor(Math.random() * 6), pmf: [1, 2, 3, 4, 5, 6].map(v => [v, 1 / 6]) },
      coin: { name: 'Biased coin', desc: 'Heads (1) with probability 0.2, tails (0) otherwise. Just two spikes.', mu: 0.2, sd: 0.4, skew: 1.5, lo: -0.5, hi: 1.5, lattice: 1, origin: 0,
        sample: () => Math.random() < 0.2 ? 1 : 0, pmf: [[0, 0.8], [1, 0.2]] },
      bimodal: { name: 'Two humps', desc: 'An even mix of two narrow normals centred at −2 and +2. Nothing lives in the middle.', mu: 0, sd: Math.sqrt(4.36), skew: 0, lo: -4.5, hi: 4.5,
        sample: () => (Math.random() < 0.5 ? -2 : 2) + 0.6 * U.gauss(), pdf: x => 0.5 * (U.npdf(x, -2, 0.6) + U.npdf(x, 2, 0.6)) },
      lognormal: { name: 'Log-normal', desc: 'Like incomes or file sizes: most values small, a few very large.', mu: Math.exp(LN_S2 / 2), sd: Math.sqrt((Math.exp(LN_S2) - 1) * Math.exp(LN_S2)),
        skew: (Math.exp(LN_S2) + 2) * Math.sqrt(Math.exp(LN_S2) - 1), lo: 0, hi: 6, sample: () => Math.exp(0.75 * U.gauss()),
        pdf: x => x <= 0 ? 0 : Math.exp(-(Math.log(x) ** 2) / (2 * LN_S2)) / (x * 0.75 * Math.sqrt(2 * Math.PI)) },
      arcsine: { name: 'U-shaped', desc: 'Beta(½, ½): values crowd against both ends and avoid the centre.', mu: 0.5, sd: Math.sqrt(0.125), skew: 0, lo: 0, hi: 1, cap: 3.2,
        sample: () => Math.sin(Math.PI * Math.random() / 2) ** 2, pdf: x => (x <= 0 || x >= 1) ? 0 : 1 / (Math.PI * Math.sqrt(x * (1 - x))) },
    };
    const TRIES = [
      { t: 'Coin flips become a bell', d: 'Two spikes at n = 1. By n = 30 the proportion of heads is close to normal.', dist: 'coin', n: 30 },
      { t: 'Two humps make three', d: 'Averaging two draws gives low+low, low+high, or high+high: three peaks at n = 2.', dist: 'bimodal', n: 2 },
      { t: 'Skew is slow to fade', d: 'Log-normal means at n = 5 still lean right. Compare the skewness readout with its prediction.', dist: 'lognormal', n: 5 },
      { t: 'Uniform converges fast', d: 'Symmetric populations need very few draws. Three is already close.', dist: 'uniform', n: 3 },
      { t: 'Watch the spread shrink', d: 'Turns on the population scale. Move n from 1 to 100 and the means close in on μ.', dist: 'exponential', n: 1, scale: true },
    ];
    const S = { dist: 'exponential', nIdx: 4, means: new Float64Array(CAP), count: 0, s1: 0, s2: 0, s3: 0, latest: null, latestMean: null, target: 0, keepScale: false };
    const d = () => D[S.dist], nVal = () => N_STOPS[S.nIdx];
    const slider = root.querySelector('#clt-n'), scaleBox = root.querySelector('#clt-scale');

    q('dists').innerHTML = U.chipHtml(Object.entries(D).map(([k, v]) => [k, v.name]), S.dist);
    U.chips(root, '[data-k="dists"]', k => { setDist(k); autoFill(); });
    TRIES.forEach(tr => {
      const li = document.createElement('li');
      li.innerHTML = `<div><strong></strong><span></span></div><button type="button" class="btn">${D[tr.dist].name}, n = ${tr.n}</button>`;
      li.querySelector('strong').textContent = tr.t; li.querySelector('span').textContent = tr.d;
      li.querySelector('button').addEventListener('click', () => {
        if (tr.scale !== undefined) { S.keepScale = tr.scale; scaleBox.checked = tr.scale; }
        S.nIdx = N_STOPS.indexOf(tr.n); slider.value = S.nIdx; q('nOut').textContent = 'n = ' + tr.n;
        setDist(tr.dist); autoFill();
        root.querySelector('.bench').scrollIntoView({ behavior: U.reduced() ? 'auto' : 'smooth', block: 'start' });
      });
      q('tries').appendChild(li);
    });

    function setDist(k) {
      S.dist = k;
      for (const c of q('dists').children) c.setAttribute('aria-pressed', c.dataset.v === k ? 'true' : 'false');
      q('desc').textContent = d().desc; q('popTitle').textContent = 'Population: ' + d().name;
      q('mu').textContent = U.fmt(d().mu); q('sd').textContent = U.fmt(d().sd); q('sk').textContent = U.fmt(d().skew, 2);
      clear();
    }
    function clear() { S.count = 0; S.s1 = S.s2 = S.s3 = 0; S.latest = null; S.latestMean = null; S.target = 0; stats(); render(); }
    function sample() {
      const n = nVal(), vals = new Array(n); let s = 0;
      for (let i = 0; i < n; i++) { const x = d().sample(); vals[i] = x; s += x; }
      const m = s / n; S.latest = vals; S.latestMean = m;
      if (S.count < CAP) { S.means[S.count++] = m; S.s1 += m; S.s2 += m * m; S.s3 += m * m * m; }
    }
    const many = k => { for (let i = 0; i < k; i++) sample(); };
    function stats() {
      const n = nVal(), N = S.count, set = (k, v) => U.set(root, k, v);
      set('count', U.int(N)); set('n', n); set('pMean', U.fmt(d().mu)); set('pSd', U.fmt(d().sd / Math.sqrt(n))); set('pSkew', U.fmt(d().skew / Math.sqrt(n), 2));
      if (N < 2) { set('mean', '–'); set('sd', '–'); set('skew', '–'); return; }
      const m = S.s1 / N, e2 = S.s2 / N, e3 = S.s3 / N, v = Math.max(0, e2 - m * m), m3 = e3 - 3 * m * e2 + 2 * m ** 3, sd = Math.sqrt(v);
      set('mean', U.fmt(m)); set('sd', U.fmt(sd)); set('skew', sd > 1e-9 && N > 20 ? U.fmt(m3 / sd ** 3, 2) : '–');
    }

    function renderPop() {
      const D0 = d(), pw = D0.pmf ? 0 : (D0.hi - D0.lo) * 0.03, a = D0.lo - pw, b = D0.hi + pw;
      let ymax;
      if (D0.pmf) ymax = Math.max(...D0.pmf.map(p => p[1])) * 1.15;
      else { ymax = 0; for (let i = 0; i <= 300; i++) { const y = D0.pdf(a + (b - a) * i / 300); if (isFinite(y)) ymax = Math.max(ymax, Math.min(y, D0.cap || Infinity)); } ymax *= 1.08; }
      const p = U.plot(q('pop'), { x: [a, b], y: [0, ymax], yTicks: false, pad: { t: 8, b: 24, l: 10, r: 10 } }), ctx = p.ctx, c = p.c;
      if (D0.pmf) {
        const bw = Math.min(40, (p.X(1) - p.X(0)) * 0.55);
        ctx.font = `11px ${c.mono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        for (const [x, pr] of D0.pmf) { const y = p.Y(pr); ctx.fillStyle = c.pop; ctx.fillRect(p.X(x) - bw / 2, y, bw, p.B - y); ctx.fillStyle = c.muted; ctx.fillText(pr === 1 / 6 ? '1/6' : pr.toFixed(1), p.X(x), y - 3); }
      } else {
        const pts = [];
        for (let i = 0; i <= 400; i++) { const x = a + (b - a) * i / 400; let y = D0.pdf(x); if (!isFinite(y)) y = 0; pts.push([p.X(x), p.Y(Math.min(y, (D0.cap || Infinity) * 1.05))]); }
        U.clip(p);
        ctx.beginPath(); ctx.moveTo(pts[0][0], p.B); pts.forEach(pt => ctx.lineTo(pt[0], pt[1])); ctx.lineTo(pts[pts.length - 1][0], p.B); ctx.closePath();
        ctx.globalAlpha = 0.35; ctx.fillStyle = c.pop; ctx.fill(); ctx.globalAlpha = 1;
        U.path(ctx, pts, c.pop, 2); U.unclip(p);
      }
      U.vline(p, D0.mu, c.muted, 'μ');
      return p;
    }
    function renderStrip(pp) {
      const { ctx, w, h } = U.prep(q('strip')), c = U.colors(), n = nVal(), y = h / 2 - 2;
      ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(10, y + 0.5); ctx.lineTo(w - 10, y + 0.5); ctx.stroke();
      if (!S.latest) { q('stripLabel').textContent = 'Latest sample: none yet'; return; }
      q('stripLabel').textContent = `Latest sample: ${n} value${n > 1 ? 's' : ''}, mean x̄ = ${U.fmt(S.latestMean)}`;
      const r = n <= 10 ? 5 : n <= 30 ? 4 : 3, jit = d().pmf ? 7 : 0;
      ctx.globalAlpha = n > 30 ? 0.5 : 0.7; ctx.fillStyle = c.pop;
      S.latest.forEach((v, i) => { const cx = Math.min(w - 10, Math.max(10, pp.X(v))); ctx.beginPath(); ctx.arc(cx, y + (jit ? ((i * 7919) % 5 - 2) * jit / 2.2 : 0), r, 0, 7); ctx.fill(); });
      ctx.globalAlpha = 1;
      const mx = Math.min(w - 10, Math.max(10, pp.X(S.latestMean)));
      ctx.strokeStyle = c.means; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(mx, y - 16); ctx.lineTo(mx, y + 16); ctx.stroke();
    }
    function range() {
      const D0 = d(), se = D0.sd / Math.sqrt(nVal());
      if (S.keepScale) return [D0.lo, D0.hi];
      let a = Math.max(D0.lo, D0.mu - 4.5 * se), b = Math.min(D0.hi, D0.mu + 4.5 * se);
      if (D0.pmf) { const hs = D0.lattice / nVal() / 2; a = Math.max(D0.lo, a - hs); b = Math.min(D0.hi, b + hs); }
      return [a, b];
    }
    function binning(a, b, target) {
      const D0 = d();
      if (D0.lattice) {
        const hs = D0.lattice / nVal(), k = Math.max(1, Math.ceil((b - a) / hs / target)), bw = k * hs, o = D0.origin - hs / 2;
        const start = o + Math.floor((a - o) / bw + 1e-9) * bw;
        return { start, bw, nb: Math.ceil((b - start) / bw - 1e-9) };
      }
      return { start: a, bw: (b - a) / target, nb: target };
    }
    function renderMeans() {
      const cv = q('means'), W = cv.getBoundingClientRect().width, D0 = d();
      const [a, b] = range(), { start, bw, nb } = binning(a, b, Math.max(20, Math.min(60, Math.floor(W / 11))));
      const lo = start, hi = start + nb * bw, counts = new Uint32Array(nb), N = S.count;
      for (let i = 0; i < N; i++) { const j = Math.floor((S.means[i] - lo) / bw); if (j >= 0 && j < nb) counts[j]++; }
      const se = D0.sd / Math.sqrt(nVal()), peak = U.npdf(D0.mu, D0.mu, se) * N * bw;
      let cmax = 0; for (const k of counts) cmax = Math.max(cmax, k);
      const p = U.plot(cv, { x: [lo, hi], y: [0, Math.max(cmax, N ? peak : 1, 1) * 1.1], pad: { l: 46 }, yFmt: v => U.compact(v) });
      U.bars(p, counts, lo, bw, p.c.means);
      if (N) { U.clip(p); U.fnPath(p, x => U.npdf(x, D0.mu, se) * N * bw, lo, hi, p.c.curve, 2.5, null, 300); U.unclip(p); }
      U.vline(p, D0.mu, p.c.muted, 'μ');
      if (S.latestMean !== null && S.latestMean >= lo && S.latestMean <= hi) {
        const mx = p.X(S.latestMean), ctx = p.ctx; ctx.fillStyle = p.c.means;
        ctx.beginPath(); ctx.moveTo(mx, p.B - 1); ctx.lineTo(mx - 6, p.B - 11); ctx.lineTo(mx + 6, p.B - 11); ctx.closePath(); ctx.fill();
      }
      if (!N) U.message(p, 'Press Run or Draw to start sampling');
    }
    let pending = false;
    function render() {
      if (pending) return; pending = true;
      requestAnimationFrame(() => { pending = false; if (root.hidden) return; const pp = renderPop(); renderStrip(pp); renderMeans(); });
    }

    const anim = U.animator(on => q('run').textContent = on ? 'Pause' : (S.count >= CAP ? 'Limit reached' : 'Run'));
    function start(target) {
      S.target = Math.min(CAP, target);
      anim.start(() => {
        const per = Math.max(1, Math.min(60, Math.round(S.count / 40) + 1, Math.floor(20000 / nVal())));
        many(Math.min(per, S.target - S.count)); stats(); render();
        return S.count < S.target && S.count < CAP;
      });
    }
    const autoFill = () => start(3000);
    q('run').addEventListener('click', () => { if (anim.running) { S.target = S.count; anim.stop(); } else start(CAP); });
    const burst = k => { many(k); S.target = Math.max(S.target, S.count); stats(); render(); };
    q('one').addEventListener('click', () => burst(1));
    q('hundred').addEventListener('click', () => burst(100));
    q('thousand').addEventListener('click', () => burst(1000));
    q('reset').addEventListener('click', () => { anim.stop(); clear(); });
    slider.addEventListener('input', () => { S.nIdx = +slider.value; q('nOut').textContent = 'n = ' + nVal(); clear(); autoFill(); });
    scaleBox.addEventListener('change', () => { S.keepScale = scaleBox.checked; render(); });

    setDist('exponential'); many(2500); S.target = S.count; stats(); render();
    return { render, stop: () => { S.target = S.count; anim.stop(); } };
  }
});
