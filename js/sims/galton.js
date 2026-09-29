'use strict';
Lab.register({
  id: 'galton', group: 'Central limit theorem', title: 'Galton Board', short: 'Galton board',
  html: () => U.layout({
    eyebrow: 'Binomial distribution',
    title: 'Galton Board',
    lede: 'Each ball hits a peg in every row and bounces left or right. Its final bin is the <b>number of right bounces</b>, a sum of many small coin flips. Drop enough balls and the bins trace out a bell.',
    controls: `
      <div class="group"><label class="label" for="galton-rows">Rows of pegs <output data-k="rowsOut">12</output></label><input type="range" id="galton-rows" min="4" max="20" value="12"></div>
      <div class="group"><label class="label" for="galton-p">Chance of bouncing right <output data-k="pOut">0.50</output></label><input type="range" id="galton-p" min="0.1" max="0.9" step="0.05" value="0.5">
        <p class="desc">Tilt the board to skew the bins. With enough rows, even a tilted board gives a bell.</p></div>
      <div class="group"><div class="label">Drop balls</div><div class="buttons">
        <button class="btn primary wide" data-k="run" type="button">Run</button>
        <button class="btn" data-k="one" type="button">Drop 1</button><button class="btn" data-k="hundred" type="button">Drop 100</button>
        <button class="btn" data-k="thousand" type="button">Add 1,000</button><button class="btn" data-k="reset" type="button">Clear</button></div></div>`,
    charts: U.panel('The board', U.legend([['', '--means', 'Balls in each bin'], ['dot', '--curve', 'Binomial expectation'], ['ln', '--pop', 'Normal approximation']]),
        `<canvas data-k="board" style="height:520px" aria-label="Galton board"></canvas>
        <div class="stats">${U.stat('balls', 'Balls landed')}${U.stat('mean', 'Average bin', 'predicted np = ' + U.pred('pm'))}${U.stat('sd', 'SD of bins', 'predicted √(np(1−p)) = ' + U.pred('ps'))}</div>`),
    notes: `<div><h3>Why a bell appears</h3>
      <p>A ball's final position is the sum of <em>n</em> independent left-or-right bounces. That sum follows the binomial distribution B(n, p): the chance of ending in bin <em>k</em> is C(n, k)·p<sup>k</sup>(1−p)<sup>n−k</sup>. The orange dots show that exact expectation.</p>
      <p>Because each bin count is a sum of independent pieces, the central limit theorem applies and the binomial approaches the normal curve with mean np and variance np(1−p). Francis Galton built the first board in 1873 to show exactly this.</p></div>
      <div><h3>Things to try</h3><ul class="plain">
      <li>Set 4 rows: the bins are clearly stepped, and the normal curve is only a rough fit.</li>
      <li>Set the chance to 0.2 with 6 rows. The pile leans left. Now raise the rows to 20 and it straightens into a bell.</li>
      <li>Use <em>Add 1,000</em> a few times and watch the stats close in on the predictions.</li></ul></div>`
  }),
  init(root) {
    const q = k => root.querySelector(`[data-k="${k}"]`);
    const rowsIn = root.querySelector('#galton-rows'), pIn = root.querySelector('#galton-p');
    const S = { R: 12, p: 0.5, counts: [], total: 0, flying: [], queue: 0, geo: null };
    const reset = () => { S.counts = new Array(S.R + 1).fill(0); S.total = 0; S.flying = []; S.queue = 0; stats(); render(); };
    function path() { const ks = [0]; let k = 0; for (let r = 0; r < S.R; r++) { if (Math.random() < S.p) k++; ks.push(k); } return ks; }
    function land(k) { S.counts[k]++; S.total++; }
    function spawn() { if (U.reduced()) { land(path()[S.R]); return; } S.flying.push({ ks: path(), s: -0.6 }); }
    function stats() {
      U.set(root, 'balls', U.int(S.total)); U.set(root, 'pm', U.fmt(S.R * S.p, 2)); U.set(root, 'ps', U.fmt(Math.sqrt(S.R * S.p * (1 - S.p)), 2));
      if (S.total < 2) { U.set(root, 'mean', '–'); U.set(root, 'sd', '–'); return; }
      let m = 0, v = 0; S.counts.forEach((c, k) => m += c * k); m /= S.total; S.counts.forEach((c, k) => v += c * (k - m) ** 2); v /= S.total;
      U.set(root, 'mean', U.fmt(m, 2)); U.set(root, 'sd', U.fmt(Math.sqrt(v), 2));
    }
    function render() {
      if (root.hidden) return;
      const { ctx, w, h } = U.prep(q('board')), c = U.colors(), R = S.R;
      const dx = Math.min((w - 20) / (R + 1), 46), cx = w / 2, top = 18;
      const pegH = Math.min(h * 0.5, (R) * dx * 0.8), dy = pegH / R;
      const binTop = top + pegH + 14, base = h - 26;
      const pegX = (r, k) => cx + (k - r / 2) * dx, pegY = r => top + r * dy;
      // pegs
      ctx.fillStyle = c.pop;
      for (let r = 0; r < R; r++) for (let k = 0; k <= r; k++) { ctx.beginPath(); ctx.arc(pegX(r, k), pegY(r), Math.max(1.6, Math.min(3, dx * 0.08)), 0, 7); ctx.fill(); }
      // bin walls
      ctx.strokeStyle = c.line; ctx.lineWidth = 1;
      for (let k = 0; k <= R + 1; k++) { const x = Math.round(cx + (k - 0.5 - R / 2) * dx) + 0.5; ctx.beginPath(); ctx.moveTo(x, binTop); ctx.lineTo(x, base); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(cx - (R / 2 + 0.5) * dx, base + 0.5); ctx.lineTo(cx + (R / 2 + 0.5) * dx, base + 0.5); ctx.stroke();
      // bars + expectations
      const exp = S.counts.map((_, k) => U.binomPmf(k, R, S.p) * S.total);
      const ymax = Math.max(1, ...S.counts, ...exp) * 1.08, Hb = base - binTop - 4;
      const Y = v => base - v / ymax * Hb;
      ctx.fillStyle = c.means; ctx.globalAlpha = 0.75;
      S.counts.forEach((n, k) => { if (!n) return; const x = cx + (k - R / 2) * dx; ctx.fillRect(x - dx * 0.42, Y(n), dx * 0.84, base - Y(n)); });
      ctx.globalAlpha = 1;
      if (S.total) {
        const mu = R * S.p, sd = Math.sqrt(R * S.p * (1 - S.p)), pts = [];
        for (let i = 0; i <= 200; i++) { const k = -0.5 + (R + 1) * i / 200; pts.push([cx + (k - R / 2) * dx, Y(U.npdf(k, mu, sd) * S.total)]); }
        U.path(ctx, pts, c.pop, 2);
        ctx.fillStyle = c.curve; exp.forEach((e, k) => { ctx.beginPath(); ctx.arc(cx + (k - R / 2) * dx, Y(e), 3.5, 0, 7); ctx.fill(); });
      }
      // bin labels
      ctx.fillStyle = c.muted; ctx.font = `11px ${c.mono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const every = dx < 22 ? 2 : 1;
      for (let k = 0; k <= R; k += every) ctx.fillText(k, cx + (k - R / 2) * dx, base + 7);
      // balls in flight
      ctx.fillStyle = c.curve; const br = Math.max(2.5, Math.min(5, dx * 0.16));
      for (const b of S.flying) {
        let x, y;
        if (b.s < 0) { x = pegX(0, 0); y = pegY(0) - br - 6 + (b.s + 0.6) * 10; }
        else {
          const r = Math.floor(b.s), t = b.s - r;
          const x0 = pegX(r, b.ks[r]), x1 = r + 1 <= R ? (r + 1 < R ? pegX(r + 1, b.ks[r + 1]) : cx + (b.ks[R] - R / 2) * dx) : x0;
          const y0 = pegY(r) - br - 2, y1 = r + 1 < R ? pegY(r + 1) - br - 2 : binTop;
          x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t - Math.sin(Math.PI * t) * dy * 0.35;
        }
        ctx.beginPath(); ctx.arc(x, y, br, 0, 7); ctx.fill();
      }
      if (!S.total && !S.flying.length) { ctx.fillStyle = c.muted; ctx.font = `14px ${c.mono}`; ctx.fillText('Press Run or Drop to release balls', cx, (binTop + base) / 2); }
    }
    let running = false;
    const anim = U.animator(on => { if (!on) running = false; U.runLabel(q('run'), running); });
    function loop() {
      if (running || S.queue > 0) { const k = running ? 2 : Math.min(3, S.queue); for (let i = 0; i < k; i++) spawn(); S.queue = Math.max(0, S.queue - k); }
      const speed = 0.14;
      for (const b of S.flying) b.s += speed;
      const still = [];
      for (const b of S.flying) { if (b.s >= S.R) land(b.ks[S.R]); else still.push(b); }
      S.flying = still; stats(); render();
      return running || S.queue > 0 || S.flying.length > 0;
    }
    const kick = () => { U.runLabel(q('run'), running); anim.start(loop); };
    q('run').addEventListener('click', () => { running = !running; if (U.reduced() && running) { running = false; for (let i = 0; i < 200; i++) spawn(); stats(); render(); return; } kick(); });
    q('one').addEventListener('click', () => { spawn(); stats(); kick(); });
    q('hundred').addEventListener('click', () => { if (U.reduced()) { for (let i = 0; i < 100; i++) spawn(); stats(); render(); } else { S.queue += 100; kick(); } });
    q('thousand').addEventListener('click', () => { for (let i = 0; i < 1000; i++) land(path()[S.R]); stats(); render(); });
    q('reset').addEventListener('click', () => { running = false; anim.stop(); reset(); });
    rowsIn.addEventListener('input', () => { S.R = +rowsIn.value; q('rowsOut').textContent = S.R; reset(); });
    pIn.addEventListener('input', () => { S.p = +pIn.value; q('pOut').textContent = S.p.toFixed(2); reset(); });
    reset();
    for (let i = 0; i < 600; i++) land(path()[S.R]); stats(); render();
    return { render, stop: () => { running = false; S.queue = 0; anim.stop(); } };
  }
});
