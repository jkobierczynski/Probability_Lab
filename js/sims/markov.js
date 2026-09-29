'use strict';
Lab.register({
  id: 'markov', group: 'Going further', title: 'Markov Chains', short: 'Markov chains',
  html: () => U.layout({
    eyebrow: 'Stationary distributions',
    title: 'Markov Chains',
    lede: 'A token hops between states, choosing each move only from where it is now. Count where it spends its time and the fractions settle on a fixed <b>stationary distribution</b>, whatever state it started in. That long-run share is what PageRank computes for the web.',
    controls: `
      <div class="group"><div class="label">Chain</div><div class="chips" data-k="presets"></div><p class="desc" data-k="desc"></p></div>
      <div class="group"><div class="label">Speed</div><div class="chips" data-k="speeds"></div></div>
      <div class="group"><div class="label">Simulation</div><div class="buttons">
        <button class="btn primary wide" data-k="run" type="button">Run</button><button class="btn" data-k="step" type="button">One step</button><button class="btn" data-k="reset" type="button">Clear counts</button></div></div>`,
    charts: `<div class="split">${U.panel('The chain', '<span class="cap" data-k="now"></span>', `<canvas data-k="graph" style="height:320px" aria-label="State diagram"></canvas>`)}
      ${U.panel('Share of time in each state', U.legend([['', '--means', 'Observed'], ['dash', '--curve', 'Stationary π']]), `<canvas data-k="bars" style="height:320px" aria-label="Time spent in each state"></canvas>`)}</div>`
      + U.panel('Transition probabilities', '<span class="cap">edit a cell; each row is rescaled to sum to 1</span>',
        `<div class="tbl-wrap"><table class="tbl" data-k="matrix"></table></div>
        <div class="stats">${U.stat('steps', 'Steps taken')}${U.stat('tv', 'Distance from π', 'total variation, shrinks like 1/√steps')}${U.stat('mix', 'Second eigenvalue', 'closer to 1 means slower mixing')}</div>`),
    notes: `<div><h3>What the chain does</h3>
      <p>Row <em>i</em> of the matrix lists the probabilities of moving from state <em>i</em> to each state. If every state can reach every other and the chain does not cycle with a fixed period, the time-average of visits converges to the unique distribution π that satisfies π = πP. This is the ergodic theorem, the law of large numbers for dependent sequences.</p>
      <p>How fast it gets there depends on the second-largest eigenvalue of P. The sticky two-state chain has one close to 1, so it lingers in each state and the bars take far longer to settle.</p></div>
      <div><h3>Where chains appear</h3><ul class="plain">
      <li><b>PageRank.</b> A surfer follows a random link with probability 0.85 or jumps to a random page. A page's rank is its stationary probability.</li>
      <li><b>MCMC.</b> Markov chain Monte Carlo designs a chain whose stationary distribution is a posterior you cannot sample directly, then runs it.</li>
      <li>Text prediction, queueing systems, board games such as Snakes and Ladders, and credit-rating migrations are all modelled as Markov chains.</li></ul></div>`
  }),
  init(root) {
    const q = k => root.querySelector(`[data-k="${k}"]`);
    const pagerank = () => {
      const links = [[1, 2], [2], [0], [2, 0]], n = 4, d = 0.85;
      return links.map(out => Array.from({ length: n }, (_, j) => (1 - d) / n + (out.includes(j) ? d / out.length : 0)));
    };
    const PRE = {
      weather: { name: 'Weather', desc: 'Tomorrow depends only on today.', states: ['Sunny', 'Cloudy', 'Rainy'], P: [[0.7, 0.2, 0.1], [0.3, 0.4, 0.3], [0.2, 0.3, 0.5]] },
      web: { name: 'Web surfer', desc: 'Four linked pages: A→B, A→C, B→C, C→A, D→A, D→C. The surfer follows a link with probability 0.85, otherwise jumps anywhere.', states: ['Page A', 'Page B', 'Page C', 'Page D'], P: pagerank() },
      sticky: { name: 'Sticky switch', desc: 'Two states that rarely change: slow to settle.', states: ['On', 'Off'], P: [[0.97, 0.03], [0.06, 0.94]] },
    };
    const S = { key: 'weather', states: [], P: [], cur: 0, visits: [], steps: 0, pi: [], lam2: 0, speed: 'med', prev: null, anim: 0 };
    q('presets').innerHTML = U.chipHtml(Object.entries(PRE).map(([k, v]) => [k, v.name]), S.key);
    q('speeds').innerHTML = U.chipHtml([['slow', 'Watch'], ['med', 'Fast'], ['fast', 'Very fast']], S.speed);
    U.chips(root, '[data-k="presets"]', k => load(k));
    U.chips(root, '[data-k="speeds"]', v => S.speed = v);

    function load(k) { const p = PRE[k]; S.key = k; S.states = p.states.slice(); S.P = p.P.map(r => r.slice()); q('desc').textContent = p.desc; analyse(); buildMatrix(); clear(); }
    function analyse() {
      const n = S.P.length; let v = new Array(n).fill(1 / n);
      for (let it = 0; it < 5000; it++) { const w = new Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) w[j] += v[i] * S.P[i][j]; v = w; }
      S.pi = v;
      // |second eigenvalue|: left vectors summing to zero stay in that subspace under xP, so power-iterate there
      let x = Array.from({ length: n }, (_, i) => Math.sin(1.7 * i + 0.3)), lam = 0;
      const centre = v2 => { const m = v2.reduce((a, b) => a + b, 0) / n; return v2.map(t => t - m); };
      x = centre(x);
      const growth = [];
      for (let it = 0; it < 600; it++) {
        let y = new Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) y[j] += x[i] * S.P[i][j];
        y = centre(y);
        const nx = Math.hypot(...x), ny = Math.hypot(...y); if (!nx || !ny) { lam = 0; break; }
        if (it >= 400) growth.push(Math.log(ny / nx));
        x = y.map(t => t / ny);
      }
      S.lam2 = growth.length ? Math.exp(growth.reduce((a, b) => a + b, 0) / growth.length) : lam;
    }
    function buildMatrix() {
      const n = S.states.length;
      q('matrix').innerHTML = `<thead><tr><th>From \\ to</th>${S.states.map(s => `<th>${s}</th>`).join('')}</tr></thead><tbody>${S.P.map((r, i) =>
        `<tr><td>${S.states[i]}</td>${r.map((v, j) => `<td><input type="number" min="0" max="1" step="0.01" id="markov-${i}-${j}" value="${v.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}" aria-label="From ${S.states[i]} to ${S.states[j]}"></td>`).join('')}</tr>`).join('')}</tbody>`;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) root.querySelector(`#markov-${i}-${j}`).addEventListener('change', e => {
        let v = Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)); S.P[i][j] = v;
        const s = S.P[i].reduce((a, b) => a + b, 0);
        if (s === 0) S.P[i][i] = 1; else S.P[i] = S.P[i].map(x => x / s);
        analyse(); buildMatrix(); clear();
      });
    }
    function clear() { S.visits = new Array(S.states.length).fill(0); S.steps = 0; S.cur = 0; S.prev = null; stats(); render(); }
    function step() {
      const r = Math.random(), row = S.P[S.cur]; let acc = 0, nxt = row.length - 1;
      for (let j = 0; j < row.length; j++) { acc += row[j]; if (r < acc) { nxt = j; break; } }
      S.prev = S.cur; S.cur = nxt; S.visits[nxt]++; S.steps++;
    }
    function stats() {
      U.set(root, 'steps', U.int(S.steps));
      let tv = 0; if (S.steps) S.visits.forEach((v, i) => tv += Math.abs(v / S.steps - S.pi[i])); U.set(root, 'tv', S.steps ? U.fmt(tv / 2, 4) : '–');
      U.set(root, 'mix', U.fmt(S.lam2, 3));
      q('now').textContent = `now in ${S.states[S.cur]}`;
    }
    function render() {
      if (root.hidden) return;
      const c = U.colors(), n = S.states.length;
      { // graph
        const { ctx, w, h } = U.prep(q('graph')), cx = w / 2, cy = h / 2, nr = Math.min(34, Math.min(w, h) * 0.11), R = Math.min(w, h) / 2 - nr - 34;
        const pos = S.states.map((_, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n + (n === 2 ? Math.PI / 2 : 0); return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; });
        ctx.font = `11px ${c.mono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          const p = S.P[i][j]; if (p < 0.005) continue;
          const hot = S.prev === i && S.cur === j;
          ctx.strokeStyle = hot ? c.curve : c.pop; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 0.8 + p * 4; ctx.globalAlpha = hot ? 1 : 0.75;
          if (i === j) {
            const [x, y] = pos[i], a = Math.atan2(y - cy, x - cx), lx = x + Math.cos(a) * (nr + 14), ly = y + Math.sin(a) * (nr + 14);
            ctx.beginPath(); ctx.arc(lx, ly, 14, 0, 7); ctx.stroke();
            ctx.globalAlpha = 1; ctx.fillStyle = c.muted; ctx.fillText(p.toFixed(2), x + Math.cos(a) * (nr + 40), y + Math.sin(a) * (nr + 40));
          } else {
            const [x1, y1] = pos[i], [x2, y2] = pos[j], dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d, off = 9;
            const sx = x1 + ux * nr - uy * off, sy = y1 + uy * nr + ux * off, ex = x2 - ux * (nr + 4) - uy * off, ey = y2 - uy * (nr + 4) + ux * off;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - ux * 9 - uy * 5, ey - uy * 9 + ux * 5); ctx.lineTo(ex - ux * 9 + uy * 5, ey - uy * 9 - ux * 5); ctx.closePath(); ctx.fill();
            ctx.globalAlpha = 1; ctx.fillStyle = c.muted; ctx.fillText(p.toFixed(2), (sx + ex) / 2 - uy * 11, (sy + ey) / 2 + ux * 11);
          }
          ctx.globalAlpha = 1;
        }
        pos.forEach(([x, y], i) => {
          const on = i === S.cur;
          ctx.fillStyle = on ? c.means : c.surface; ctx.strokeStyle = on ? c.means : c.line; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x, y, nr, 0, 7); ctx.fill(); ctx.stroke();
          ctx.fillStyle = on ? c.surface : c.ink; ctx.font = `600 12px ${c.mono}`; ctx.fillText(S.states[i], x, y);
        });
      }
      { // bars
        const cv = q('bars'), ymax = Math.min(1, Math.max(...S.pi, ...S.visits.map(v => S.steps ? v / S.steps : 0)) * 1.2);
        const p = U.plot(cv, { x: [0, n], y: [0, ymax], yFmt: v => Math.round(v * 100) + '%', xTicks: false }), ctx = p.ctx;
        const bw = (p.X(1) - p.X(0));
        ctx.font = `12px ${c.mono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        S.states.forEach((s, i) => {
          const x0 = p.X(i) + bw * 0.2, x1 = p.X(i + 1) - bw * 0.2, f = S.steps ? S.visits[i] / S.steps : 0;
          ctx.fillStyle = c.means; ctx.globalAlpha = 0.75; ctx.fillRect(x0, p.Y(f), x1 - x0, p.B - p.Y(f)); ctx.globalAlpha = 1;
          ctx.setLineDash([5, 4]); ctx.strokeStyle = c.curve; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x0 - 6, p.Y(S.pi[i])); ctx.lineTo(x1 + 6, p.Y(S.pi[i])); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = c.muted; ctx.fillText(s, (x0 + x1) / 2, p.B + 7);
          ctx.fillStyle = c.curve; ctx.textBaseline = 'bottom'; ctx.fillText('π ' + U.pct(S.pi[i], 1), (x0 + x1) / 2, Math.min(p.Y(S.pi[i]), p.Y(f)) - 5); ctx.textBaseline = 'top';
        });
      }
    }
    let tick = 0;
    const anim = U.animator(on => U.runLabel(q('run'), on));
    q('run').addEventListener('click', () => anim.running ? anim.stop() : anim.start(() => {
      tick++;
      if (S.speed === 'slow') { if (tick % 18 === 0) step(); } else { const k = S.speed === 'med' ? 5 : 200; for (let i = 0; i < k; i++) step(); }
      stats(); render(); return true;
    }));
    q('step').addEventListener('click', () => { step(); stats(); render(); });
    q('reset').addEventListener('click', clear);
    load('weather'); for (let i = 0; i < 300; i++) step(); stats(); render();
    return { render, stop: () => anim.stop() };
  }
});
