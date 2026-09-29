'use strict';
Lab.register({
  id: 'poisson', group: 'Monte Carlo & random processes', title: 'Poisson Process', short: 'Poisson process',
  html: () => U.layout({
    eyebrow: 'Random arrivals',
    title: 'Poisson Process',
    lede: 'Events that arrive independently at a steady average rate, such as photons on a sensor, packets on a link or calls to a help desk, form a Poisson process. The <b>count per second</b> follows the Poisson distribution and the <b>gaps between events</b> are exponential.',
    controls: `
      <div class="group"><label class="label" for="pois-rate">Average rate λ <output data-k="rOut">4 per second</output></label><input type="range" id="pois-rate" min="0.5" max="20" step="0.5" value="4"></div>
      <div class="group"><div class="label">Simulation</div><div class="buttons">
        <button class="btn primary wide" data-k="run" type="button">Run</button>
        <button class="btn" data-k="ff" type="button">Skip 1,000 s</button><button class="btn" data-k="reset" type="button">Clear</button></div>
        <p class="desc">Run plays the arrivals at two simulated seconds per real second.</p></div>`,
    charts: U.panel('Arrivals as they happen', '<span class="cap">last 10 seconds</span>', `<canvas data-k="tl" style="height:78px" aria-label="Timeline of recent arrivals"></canvas>`)
      + `<div class="split">${U.panel('Events per second', U.legend([['', '--means', 'Observed'], ['dot', '--curve', 'Poisson(λ)']]), `<canvas data-k="counts" style="height:240px" aria-label="Histogram of counts per second"></canvas>`)}
      ${U.panel('Gap between events', U.legend([['', '--alt', 'Observed'], ['ln', '--curve', 'Exponential(λ)']]), `<canvas data-k="gaps" style="height:240px" aria-label="Histogram of gaps between arrivals"></canvas>`)}</div>`
      + `<div class="panel"><div class="stats" style="border-top:0;padding-top:0">${U.stat('secs', 'Seconds observed')}${U.stat('mean', 'Mean count', 'theory λ = ' + U.pred('pl'))}${U.stat('var', 'Variance of count', 'theory λ = ' + U.pred('pl2'))}${U.stat('gap', 'Mean gap', 'theory 1/λ = ' + U.pred('pg'))}</div></div>`,
    notes: `<div><h3>Two views of one process</h3>
      <p>Chop time into seconds and count the events in each: you get the Poisson distribution, P(k) = λ<sup>k</sup>e<sup>−λ</sup>/k!. Its mean and its variance are both λ, so the ratio of the two (the index of dispersion) is 1. A ratio well above 1 is a sign that events are clumping rather than arriving independently.</p>
      <p>Measure instead the waiting time between events and you get the exponential distribution with mean 1/λ. It is memoryless: having waited a while does not make the next event any more due.</p></div>
      <div><h3>Where it appears</h3><ul class="plain">
      <li><b>Photon counting.</b> The shot noise in an astronomical image is Poisson: a pixel expecting 100 photons gets 100 ± 10. That √λ noise is why faint targets need long total exposure.</li>
      <li><b>Networks.</b> Queueing models of routers and servers start from Poisson arrivals (the M in M/M/1). Real traffic is often burstier, which the variance check exposes.</li>
      <li><b>Radioactive decay</b>, typos per page, goals per football match: all close to Poisson when events are independent and rare.</li></ul></div>`
  }),
  init(root) {
    const q = k => root.querySelector(`[data-k="${k}"]`);
    const rIn = root.querySelector('#pois-rate');
    const S = { lam: 4, t: 0, next: 0, recent: [], counts: new Map(), cur: 0, secs: 0, gaps: [], gs: 0, last: null, s1: 0, s2: 0 };
    function reset() { Object.assign(S, { t: 0, recent: [], counts: new Map(), cur: 0, secs: 0, gaps: [], gs: 0, last: null, s1: 0, s2: 0 }); S.next = expo(); stats(); render(); }
    const expo = () => -Math.log(1 - Math.random()) / S.lam;
    function advance(dt) {
      const end = S.t + dt;
      while (S.next <= end) {
        while (Math.floor(S.next) > Math.floor(S.t)) closeSecond();
        S.t = S.next; S.cur++; if (S.t > end - 10) S.recent.push(S.t);
        if (S.last !== null) { const g = S.t - S.last; S.gs += g; if (S.gaps.length < 200000) S.gaps.push(g); }
        S.last = S.t; S.next = S.t + expo();
      }
      while (Math.floor(end) > Math.floor(S.t)) closeSecond();
      S.t = end;
      while (S.recent.length && S.recent[0] < S.t - 10) S.recent.shift();
    }
    function closeSecond() { S.counts.set(S.cur, (S.counts.get(S.cur) || 0) + 1); S.s1 += S.cur; S.s2 += S.cur * S.cur; S.secs++; S.cur = 0; S.t = Math.floor(S.t) + 1; }
    function stats() {
      const n = S.secs, m = S.s1 / n;
      U.set(root, 'secs', U.int(n)); U.set(root, 'mean', n ? U.fmt(m, 3) : '–'); U.set(root, 'var', n > 1 ? U.fmt((S.s2 - n * m * m) / (n - 1), 3) : '–');
      U.set(root, 'gap', S.gaps.length ? U.fmt(S.gs / S.gaps.length, 3) + ' s' : '–');
      U.set(root, 'pl', U.fmt(S.lam, 1)); U.set(root, 'pl2', U.fmt(S.lam, 1)); U.set(root, 'pg', U.fmt(1 / S.lam, 3) + ' s');
    }
    function render() {
      if (root.hidden) return;
      const c = U.colors();
      { // timeline
        const { ctx, w, h } = U.prep(q('tl')), L = 18, R = w - 18, y = h / 2 - 6, X = t => L + (t - (S.t - 10)) / 10 * (R - L);
        ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L, y + 18.5); ctx.lineTo(R, y + 18.5); ctx.stroke();
        ctx.font = `11px ${c.mono}`; ctx.fillStyle = c.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        for (let s = Math.ceil(S.t - 10); s <= S.t; s++) { const x = Math.round(X(s)) + 0.5; ctx.strokeStyle = c.grid; ctx.beginPath(); ctx.moveTo(x, y - 20); ctx.lineTo(x, y + 18); ctx.stroke(); ctx.fillText(s + 's', x, y + 24); }
        ctx.strokeStyle = c.means; ctx.lineWidth = 2;
        for (const t of S.recent) { const x = X(t), fresh = S.t - t < 0.25; ctx.globalAlpha = fresh ? 1 : 0.75; ctx.beginPath(); ctx.moveTo(x, y - (fresh ? 20 : 14)); ctx.lineTo(x, y + 14); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      { // counts
        const kmax = Math.ceil(S.lam + 4.5 * Math.sqrt(S.lam) + 2), n = S.secs;
        const arr = new Array(kmax + 1).fill(0); for (const [k, v] of S.counts) if (k <= kmax) arr[k] = v;
        const exp = arr.map((_, k) => U.poissonPmf(k, S.lam) * n);
        const p = U.plot(q('counts'), { x: [-0.5, kmax + 0.5], y: [0, Math.max(1, ...arr, ...exp) * 1.1], yFmt: U.compact, xLabel: 'events in a second' });
        U.bars(p, arr, -0.5, 1, p.c.means);
        if (n) { p.ctx.fillStyle = p.c.curve; exp.forEach((e, k) => { p.ctx.beginPath(); p.ctx.arc(p.X(k), p.Y(e), 3.5, 0, 7); p.ctx.fill(); }); }
        else U.message(p, 'Press Run');
      }
      { // gaps
        const gmax = 5 / S.lam, nb = 40, bw = gmax / nb, arr = new Uint32Array(nb);
        for (const g of S.gaps) { const j = Math.floor(g / bw); if (j < nb) arr[j]++; }
        const N = S.gaps.length, f = g => N * bw * S.lam * Math.exp(-S.lam * g);
        const p = U.plot(q('gaps'), { x: [0, gmax], y: [0, Math.max(1, ...arr, f(0)) * 1.1], yFmt: U.compact, xLabel: 'seconds' });
        U.bars(p, arr, 0, bw, p.c.alt, 0.65);
        if (N) U.fnPath(p, f, 0, gmax, p.c.curve, 2.2);
      }
    }
    const anim = U.animator(on => U.runLabel(q('run'), on));
    q('run').addEventListener('click', () => anim.running ? anim.stop() : anim.start(() => { advance(2 / 60); stats(); render(); return true; }));
    q('ff').addEventListener('click', () => { advance(1000); stats(); render(); });
    q('reset').addEventListener('click', () => { reset(); });
    rIn.addEventListener('input', () => { S.lam = +rIn.value; q('rOut').textContent = `${S.lam} per second`; reset(); advance(300); stats(); render(); });
    reset(); advance(300); stats(); render();
    return { render, stop: () => anim.stop() };
  }
});
