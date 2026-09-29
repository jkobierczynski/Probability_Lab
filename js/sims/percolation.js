'use strict';
Lab.register({
  id: 'percolation', group: 'Going further', title: 'Percolation', short: 'Percolation',
  html: () => U.layout({
    eyebrow: 'Phase transitions',
    title: 'Percolation',
    lede: 'Open each square of a grid with probability <b>p</b>. Below a critical value the open squares form small isolated islands; just above it, a path suddenly <b>connects top to bottom</b>. On a square grid the switch happens at p ≈ 0.5927.',
    controls: `
      <div class="group"><label class="label" for="perc-p">Open probability <output data-k="pOut">p = 0.590</output></label><input type="range" id="perc-p" min="0" max="1" step="0.005" value="0.59">
        <p class="desc">Slide slowly through 0.55–0.65. The grid keeps the same random numbers, so squares only ever open as p rises.</p></div>
      <div class="group"><div class="label">Grid size</div><div class="chips" data-k="sizes"></div></div>
      <div class="group"><div class="label">Grid</div><div class="buttons"><button class="btn wide" data-k="new" type="button">New random grid</button></div></div>
      <div class="group"><div class="label">Spanning curve</div><div class="buttons"><button class="btn primary wide" data-k="measure" type="button">Measure for this size</button></div>
        <p class="desc">Runs 60 random grids at each of 31 values of p. Measure several sizes to see the curve sharpen.</p></div>`,
    charts: U.panel('<span data-k="gridTitle">Grid</span>', U.legend([['', '--curve', 'Cluster spanning top to bottom'], ['', '--means', 'Largest cluster'], ['', '--pop', 'Other open squares']]),
        `<canvas data-k="grid" style="height:auto;aspect-ratio:1;max-width:560px;width:100%;justify-self:center" aria-label="Percolation grid"></canvas>
        <div class="stats">${U.stat('open', 'Open squares')}${U.stat('largest', 'Largest cluster', 'share of all squares')}${U.stat('spans', 'Spans top to bottom?')}${U.stat('clusters', 'Clusters')}</div>`)
      + U.panel('Chance that a grid spans', U.legend([['ln', '--pop', '20 × 20'], ['ln', '--alt', '50 × 50'], ['ln', '--means', '100 × 100'], ['dash', '--curve', 'p꜀ = 0.5927']]),
        `<canvas data-k="curve" style="height:260px" aria-label="Spanning probability against p"></canvas>`),
    notes: `<div><h3>A sharp threshold</h3>
      <p>Percolation is the simplest model with a phase transition. For an infinite grid, the chance that an infinite connected cluster exists jumps from 0 to 1 exactly at the critical probability p꜀ ≈ 0.592746. Finite grids blur that jump into an S-curve that gets steeper as the grid grows, which the measurements show.</p>
      <p>At p꜀ itself, the clusters are fractal: they have holes at every scale, and the largest one fills a vanishing share of a large grid.</p></div>
      <div><h3>Where it applies</h3><ul class="plain">
      <li>Whether water seeps through ground coffee or rock, which is where the name comes from.</li>
      <li>Whether a forest fire, an epidemic or a computer worm can spread across a whole population, given the fraction of trees, people or hosts that can pass it on.</li>
      <li>Network resilience: how many links or nodes can fail before a network splits into disconnected pieces.</li>
      <li>Conductivity of composite materials, such as the amount of conductive filler a plastic needs before it conducts.</li></ul></div>`
  }),
  init(root) {
    const q = k => root.querySelector(`[data-k="${k}"]`);
    const pIn = root.querySelector('#perc-p'), PC = 0.592746;
    const S = { L: 50, p: 0.59, u: null, label: null, curves: { 20: null, 50: null, 100: null }, measuring: null };
    q('sizes').innerHTML = U.chipHtml([[20, '20 × 20'], [50, '50 × 50'], [100, '100 × 100']], S.L);
    U.chips(root, '[data-k="sizes"]', v => { S.L = +v; newGrid(); });
    function newGrid() { S.u = new Float32Array(S.L * S.L); for (let i = 0; i < S.u.length; i++) S.u[i] = Math.random(); analyse(); }
    // union-find
    function clusters(L, open) {
      const par = new Int32Array(L * L).map((_, i) => i);
      const find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
      const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
      for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) { const i = y * L + x; if (!open[i]) continue; if (x + 1 < L && open[i + 1]) uni(i, i + 1); if (y + 1 < L && open[i + L]) uni(i, i + L); }
      return find;
    }
    function spans(L, open, find) {
      const top = new Set(); for (let x = 0; x < L; x++) if (open[x]) top.add(find(x));
      for (let x = 0; x < L; x++) { const i = (L - 1) * L + x; if (open[i] && top.has(find(i))) return find(i); }
      return -1;
    }
    function analyse() {
      const L = S.L, open = new Uint8Array(L * L); let nopen = 0;
      for (let i = 0; i < L * L; i++) if (S.u[i] < S.p) { open[i] = 1; nopen++; }
      const find = clusters(L, open), size = new Map();
      for (let i = 0; i < L * L; i++) if (open[i]) { const r = find(i); size.set(r, (size.get(r) || 0) + 1); }
      let big = -1, bigN = 0; for (const [r, n] of size) if (n > bigN) { big = r; bigN = n; }
      const sp = spans(L, open, find);
      const label = new Uint8Array(L * L); // 0 closed, 1 open, 2 largest, 3 spanning
      for (let i = 0; i < L * L; i++) if (open[i]) { const r = find(i); label[i] = r === sp ? 3 : r === big ? 2 : 1; }
      S.label = label;
      U.set(root, 'open', U.pct(nopen / (L * L))); U.set(root, 'largest', U.pct(bigN / (L * L)));
      U.set(root, 'spans', sp >= 0 ? 'Yes' : 'No'); U.set(root, 'clusters', U.int(size.size));
      q('gridTitle').textContent = `${L} × ${L} grid at p = ${S.p.toFixed(3)}`;
      render();
    }
    function spanOnce(L, p) {
      const open = new Uint8Array(L * L); for (let i = 0; i < L * L; i++) open[i] = Math.random() < p ? 1 : 0;
      return spans(L, open, clusters(L, open)) >= 0;
    }
    const PS = Array.from({ length: 31 }, (_, i) => 0.45 + i * 0.01);
    function render() {
      if (root.hidden) return;
      const c = U.colors();
      { const cv = q('grid'), { ctx, w } = U.prep(cv), L = S.L, cs = w / L, gap = cs > 6 ? 1 : 0;
        const col = [c.grid, c.pop, c.means, c.curve];
        for (let i = 0; i < L * L; i++) { ctx.fillStyle = col[S.label[i]]; ctx.fillRect((i % L) * cs, Math.floor(i / L) * cs, cs - gap, cs - gap); } }
      { const p = U.plot(q('curve'), { x: [0.45, 0.75], y: [0, 1], yFmt: v => Math.round(v * 100) + '%', xLabel: 'p' });
        U.vline(p, PC, p.c.curve, 'p꜀');
        const colr = { 20: c.pop, 50: c.alt, 100: c.means };
        for (const L of [20, 50, 100]) {
          const cur = S.curves[L]; if (!cur) continue;
          const pts = cur.map((v, i) => v === null ? null : [p.X(PS[i]), p.Y(v)]).filter(Boolean);
          U.path(p.ctx, pts, colr[L], 2.2); p.ctx.fillStyle = colr[L]; pts.forEach(([x, y]) => { p.ctx.beginPath(); p.ctx.arc(x, y, 2.6, 0, 7); p.ctx.fill(); });
        }
        U.vline(p, S.p, p.c.ink, null, [2, 3]);
        if (!S.curves[20] && !S.curves[50] && !S.curves[100]) U.message(p, 'Press Measure to trace the curve');
      }
    }
    const anim = U.animator(on => q('measure').textContent = on ? 'Stop measuring' : 'Measure for this size');
    q('measure').addEventListener('click', () => {
      if (anim.running) return anim.stop();
      const L = S.L, cur = S.curves[L] = PS.map(() => null); let i = 0;
      const perFrame = L >= 100 ? 10 : L >= 50 ? 30 : 60;
      let hits = 0, done = 0;
      anim.start(() => {
        for (let k = 0; k < perFrame && done < 60; k++, done++) if (spanOnce(L, PS[i])) hits++;
        if (done >= 60) { cur[i] = hits / 60; i++; hits = 0; done = 0; }
        render(); return i < PS.length;
      });
    });
    q('new').addEventListener('click', newGrid);
    pIn.addEventListener('input', () => { S.p = +pIn.value; q('pOut').textContent = 'p = ' + S.p.toFixed(3); analyse(); });
    // seed a 20×20 curve so the chart starts filled
    S.curves[20] = PS.map(p => { let h = 0; for (let k = 0; k < 60; k++) if (spanOnce(20, p)) h++; return h / 60; });
    newGrid();
    return { render, stop: () => anim.stop() };
  }
});
