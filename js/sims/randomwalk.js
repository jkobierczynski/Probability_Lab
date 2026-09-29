'use strict';
Lab.register({
  id: 'walk', group: 'Monte Carlo & random processes', title: 'Random Walks', short: 'Random walks',
  html: () => U.layout({
    eyebrow: 'Diffusion',
    title: 'Random Walks',
    lede: 'Take a step left or right at random, again and again. No single walker goes anywhere in particular, but a crowd of them <b>spreads out like √t</b>. The same mathematics describes diffusing molecules, stock prices and a gambler\'s bankroll.',
    controls: `
      <div class="group"><div class="label">Experiment</div><div class="chips" data-k="modes"></div><p class="desc" data-k="desc"></p></div>
      <div data-k="ruinCtl" class="group" style="gap:18px" hidden>
        <div class="group"><label class="label" for="walk-k">Starting money <output data-k="kOut">€10</output></label><input type="range" id="walk-k" min="1" max="39" value="10"></div>
        <div class="group"><label class="label" for="walk-goal">Goal <output data-k="goalOut">€20</output></label><input type="range" id="walk-goal" min="4" max="40" value="20"></div>
        <div class="group"><label class="label" for="walk-p">Chance of winning each bet <output data-k="pOut">0.50</output></label><input type="range" id="walk-p" min="0.4" max="0.6" step="0.005" value="0.5">
          <p class="desc">European roulette red/black is 18/37 ≈ 0.486.</p></div></div>
      <div class="group"><div class="label">Simulation</div><div class="buttons">
        <button class="btn primary wide" data-k="run" type="button">Run</button><button class="btn wide" data-k="reset" type="button">Start over</button></div></div>`,
    charts: `<div data-k="v1d">${U.panel('Walkers over time', U.legend([['ln', '--means', 'One walker'], ['ln', '--pop', 'Others'], ['dash', '--curve', '±√t and ±2√t'], ['', '--alt', 'Positions now']]),
        `<canvas data-k="c1d" style="height:380px" aria-label="One-dimensional random walks"></canvas>
        <div class="stats">${U.stat('t1', 'Steps taken', '400 walkers')}${U.stat('mean1', 'Average position', 'expected 0')}${U.stat('rms1', 'RMS distance', 'predicted √t = ' + U.pred('p1'))}${U.stat('in1', 'Within ±2√t', 'normal predicts 95.4%')}</div>`)}</div>
      <div data-k="v2d" hidden>${U.panel('A cloud of walkers in 2D', U.legend([['dot', '--pop', 'Walkers'], ['ln', '--means', 'One walker\'s trail'], ['dash', '--curve', 'Circle of radius √t']]),
        `<canvas data-k="c2d" style="height:auto;aspect-ratio:1;max-width:560px;justify-self:center;width:100%" aria-label="Two-dimensional random walks"></canvas>
        <div class="stats">${U.stat('t2', 'Steps taken', '800 walkers')}${U.stat('rms2', 'RMS distance from start', 'predicted √t = ' + U.pred('p2'))}${U.stat('far2', 'Farthest walker', '')}</div>`)}</div>
      <div data-k="vruin" hidden>${U.panel('Bankroll in each game', U.legend([['ln', '--means', 'Reached the goal'], ['ln', '--curve', 'Went broke'], ['ln', '--pop', 'Still playing']]),
        `<canvas data-k="cruin" style="height:340px" aria-label="Gambler's ruin paths"></canvas>
        <div class="stats">${U.stat('games', 'Games finished')}${U.stat('win', 'Reached the goal', 'theory ' + U.pred('pwin'))}${U.stat('dur', 'Average bets per game', 'theory ' + U.pred('pdur'))}</div>`)}</div>`,
    notes: `<div><h3>Spreading like √t</h3>
      <p>After <em>t</em> steps of ±1, a walker's position is a sum of <em>t</em> independent steps with mean 0 and variance 1. So its variance is <em>t</em> and its typical distance from the start is √t. By the central limit theorem the positions are approximately normal, which is why the green histogram matches a bell.</p>
      <p>In two dimensions the same holds for the distance from the origin. Einstein used this in 1905 to explain Brownian motion and estimate the size of molecules.</p></div>
      <div><h3>Gambler's ruin</h3>
      <p>Bet €1 at a time until you reach your goal or run out. With a fair game the chance of reaching the goal is simply start ÷ goal. With even a slight house edge it collapses: starting with €10 and aiming for €20 at 18/37 odds, you win only about 37% of the time. The theory line uses</p>
      <div class="formula">P(goal) = (1 − r<sup>k</sup>) / (1 − r<sup>N</sup>),  r = q/p</div></div>`
  }),
  init(root) {
    const q = k => root.querySelector(`[data-k="${k}"]`);
    const W1 = 400, T1 = 1000, W2 = 800, T2 = 2000, SHOW = 60;
    const S = { mode: '1d', t: 0, pos: null, hist: null, pos2: null, trail: [], ruin: null };
    const kIn = root.querySelector('#walk-k'), gIn = root.querySelector('#walk-goal'), pIn = root.querySelector('#walk-p');
    const R = { k: 10, N: 20, p: 0.5 };
    const DESC = { '1d': '400 walkers each step ±1 with equal chance, for 1,000 steps.', '2d': '800 walkers each step one unit north, south, east or west.', ruin: 'Bet €1 per round until you reach the goal or go broke.' };
    q('modes').innerHTML = U.chipHtml([['1d', 'Walks in 1D'], ['2d', 'Diffusion in 2D'], ['ruin', "Gambler's ruin"]], S.mode);
    U.chips(root, '[data-k="modes"]', v => { anim.stop(); S.mode = v; q('v1d').hidden = v !== '1d'; q('v2d').hidden = v !== '2d'; q('vruin').hidden = v !== 'ruin'; q('ruinCtl').hidden = v !== 'ruin'; reset(); go(); });

    function reset() {
      q('desc').textContent = DESC[S.mode]; S.t = 0;
      if (S.mode === '1d') { S.pos = new Int16Array(W1); S.hist = Array.from({ length: SHOW }, () => [0]); }
      if (S.mode === '2d') { S.pos2 = new Int16Array(W2 * 2); S.trail = [[0, 0]]; }
      if (S.mode === 'ruin') S.ruin = { games: 0, wins: 0, steps: 0, live: [], done: [] };
      stats(); render();
    }
    function step1() { if (S.t >= T1) return; S.t++; for (let i = 0; i < W1; i++) { S.pos[i] += Math.random() < 0.5 ? 1 : -1; if (i < SHOW) S.hist[i].push(S.pos[i]); } }
    function step2() {
      if (S.t >= T2) return; S.t++;
      for (let i = 0; i < W2; i++) { const r = Math.random() * 4 | 0; if (r === 0) S.pos2[2 * i]++; else if (r === 1) S.pos2[2 * i]--; else if (r === 2) S.pos2[2 * i + 1]++; else S.pos2[2 * i + 1]--; }
      S.trail.push([S.pos2[0], S.pos2[1]]);
    }
    function ruinTheory() {
      const { k, N, p } = R, qq = 1 - p;
      if (Math.abs(p - 0.5) < 1e-9) return { win: k / N, dur: k * (N - k) };
      const r = qq / p, win = (1 - r ** k) / (1 - r ** N);
      return { win, dur: k / (qq - p) - N / (qq - p) * win };
    }
    function ruinStep() {
      const G = S.ruin;
      while (G.live.length < 12) G.live.push({ path: [R.k], m: R.k });
      for (const g of G.live) { g.m += Math.random() < R.p ? 1 : -1; g.path.push(g.m); }
      const still = [];
      for (const g of G.live) {
        if (g.m <= 0 || g.m >= R.N) { G.games++; G.steps += g.path.length - 1; if (g.m >= R.N) G.wins++; G.done.push(g); if (G.done.length > 40) G.done.shift(); }
        else still.push(g);
      }
      G.live = still;
    }
    function ruinBatch(n) { // finish n games quickly without drawing paths
      const G = S.ruin;
      for (let i = 0; i < n; i++) { let m = R.k, s = 0; while (m > 0 && m < R.N) { m += Math.random() < R.p ? 1 : -1; s++; } G.games++; G.steps += s; if (m >= R.N) G.wins++; }
    }
    function stats() {
      if (S.mode === '1d') {
        let s = 0, s2 = 0, inn = 0; const b = 2 * Math.sqrt(S.t);
        for (const x of S.pos) { s += x; s2 += x * x; if (Math.abs(x) <= b) inn++; }
        U.set(root, 't1', U.int(S.t)); U.set(root, 'mean1', S.t ? U.fmt(s / W1, 2) : '–'); U.set(root, 'rms1', S.t ? U.fmt(Math.sqrt(s2 / W1), 2) : '–');
        U.set(root, 'p1', U.fmt(Math.sqrt(S.t), 2)); U.set(root, 'in1', S.t ? U.pct(inn / W1) : '–');
      } else if (S.mode === '2d') {
        let s2 = 0, far = 0; for (let i = 0; i < W2; i++) { const d = S.pos2[2 * i] ** 2 + S.pos2[2 * i + 1] ** 2; s2 += d; far = Math.max(far, d); }
        U.set(root, 't2', U.int(S.t)); U.set(root, 'rms2', S.t ? U.fmt(Math.sqrt(s2 / W2), 2) : '–'); U.set(root, 'p2', U.fmt(Math.sqrt(S.t), 2)); U.set(root, 'far2', S.t ? U.fmt(Math.sqrt(far), 1) + ' steps' : '–');
      } else {
        const G = S.ruin, th = ruinTheory();
        U.set(root, 'games', U.int(G.games)); U.set(root, 'win', G.games ? U.pct(G.wins / G.games) : '–'); U.set(root, 'dur', G.games ? U.fmt(G.steps / G.games, 1) : '–');
        U.set(root, 'pwin', U.pct(th.win)); U.set(root, 'pdur', U.fmt(th.dur, 1));
      }
    }
    function render() {
      if (root.hidden) return;
      const c = U.colors();
      if (S.mode === '1d') {
        const lim = Math.ceil(3.2 * Math.sqrt(T1)), p = U.plot(q('c1d'), { x: [0, T1], y: [-lim, lim], pad: { r: 120 }, xLabel: 'steps' }), ctx = p.ctx;
        U.clip(p);
        for (let i = SHOW - 1; i >= 0; i--) { const h = S.hist[i], pts = []; const st = Math.max(1, Math.floor(h.length / 400)); for (let t = 0; t < h.length; t += st) pts.push([p.X(t), p.Y(h[t])]); pts.push([p.X(h.length - 1), p.Y(h[h.length - 1])]); U.path(ctx, pts, i ? c.pop : c.means, i ? 1 : 2.2, null, i ? 0.35 : 1); }
        for (const m of [1, 2]) for (const sg of [1, -1]) U.fnPath(p, t => sg * m * Math.sqrt(t), 0, T1, c.curve, 1.5, [5, 4], 200);
        U.unclip(p);
        // sideways histogram of all walkers
        const x0 = p.R + 10, wmax = 100, bw = Math.max(2, Math.ceil(lim / 30)), bins = new Map();
        for (const x of S.pos) { const j = Math.floor(x / bw); bins.set(j, (bins.get(j) || 0) + 1); }
        const cmax = Math.max(1, ...bins.values(), S.t ? W1 * bw * U.npdf(0, 0, Math.sqrt(S.t)) : 0);
        ctx.fillStyle = c.alt; ctx.globalAlpha = 0.7;
        for (const [j, n] of bins) { const y0 = p.Y((j + 1) * bw), y1 = p.Y(j * bw); if (y1 < p.T || y0 > p.B) continue; ctx.fillRect(x0, y0 + 0.5, n / cmax * wmax, Math.max(1, y1 - y0 - 1)); }
        ctx.globalAlpha = 1;
        if (S.t) { const pts = []; for (let y = -lim; y <= lim; y += lim / 80) pts.push([x0 + W1 * bw * U.npdf(y, 0, Math.sqrt(S.t)) / cmax * wmax, p.Y(y)]); U.path(ctx, pts, c.ink, 1.5); }
      } else if (S.mode === '2d') {
        const { ctx, w, h } = U.prep(q('c2d')), lim = 3 * Math.sqrt(T2) * 0.72, sc = Math.min(w, h) / 2 / lim, cx = w / 2, cy = h / 2;
        ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, cy + 0.5); ctx.lineTo(w, cy + 0.5); ctx.moveTo(cx + 0.5, 0); ctx.lineTo(cx + 0.5, h); ctx.stroke();
        ctx.fillStyle = c.pop; ctx.globalAlpha = 0.75;
        for (let i = 1; i < W2; i++) { ctx.beginPath(); ctx.arc(cx + S.pos2[2 * i] * sc, cy + S.pos2[2 * i + 1] * sc, 2.2, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
        U.path(ctx, S.trail.map(([x, y]) => [cx + x * sc, cy + y * sc]), c.means, 1.4);
        ctx.fillStyle = c.means; ctx.beginPath(); ctx.arc(cx + S.pos2[0] * sc, cy + S.pos2[1] * sc, 4.5, 0, 7); ctx.fill();
        ctx.setLineDash([6, 5]); ctx.strokeStyle = c.curve; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, Math.sqrt(S.t) * sc, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      } else {
        const G = S.ruin, tmax = Math.max(50, ...G.done.map(g => g.path.length), ...G.live.map(g => g.path.length));
        const p = U.plot(q('cruin'), { x: [0, tmax], y: [0, R.N], yFmt: v => '€' + v, xLabel: 'bets placed' }), ctx = p.ctx;
        U.hline(p, R.N, c.means, 'goal', [2, 3]); U.hline(p, R.k, c.muted, 'start');
        const draw = (g, col, a) => { const pts = []; const st = Math.max(1, Math.floor(g.path.length / 300)); for (let t = 0; t < g.path.length; t += st) pts.push([p.X(t), p.Y(g.path[t])]); pts.push([p.X(g.path.length - 1), p.Y(g.path[g.path.length - 1])]); U.path(ctx, pts, col, 1.4, null, a); };
        for (const g of G.done) draw(g, g.m >= R.N ? c.means : c.curve, 0.55);
        for (const g of G.live) draw(g, c.pop, 0.9);
      }
    }
    const anim = U.animator(on => U.runLabel(q('run'), on));
    function go() {
      anim.start(() => {
        if (S.mode === '1d') { for (let i = 0; i < 4; i++) step1(); stats(); render(); return S.t < T1; }
        if (S.mode === '2d') { for (let i = 0; i < 4; i++) step2(); stats(); render(); return S.t < T2; }
        for (let i = 0; i < 3; i++) ruinStep(); ruinBatch(4); stats(); render(); return S.ruin.games < 20000;
      });
    }
    q('run').addEventListener('click', () => {
      if (anim.running) return anim.stop();
      if ((S.mode === '1d' && S.t >= T1) || (S.mode === '2d' && S.t >= T2) || (S.mode === 'ruin' && S.ruin.games >= 20000)) reset();
      go();
    });
    q('reset').addEventListener('click', () => { anim.stop(); reset(); });
    const ruinInput = () => {
      R.N = +gIn.value; kIn.max = R.N - 1; R.k = Math.min(+kIn.value, R.N - 1); kIn.value = R.k; R.p = +pIn.value;
      q('kOut').textContent = '€' + R.k; q('goalOut').textContent = '€' + R.N; q('pOut').textContent = R.p.toFixed(3).replace(/0$/, '');
      anim.stop(); reset(); ruinBatch(300); stats(); render();
    };
    [kIn, gIn, pIn].forEach(el => el.addEventListener('input', ruinInput));
    reset(); for (let i = 0; i < 400; i++) step1(); stats(); render();
    return { render, stop: () => anim.stop() };
  }
});
