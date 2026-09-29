'use strict';
Lab.register({
  id: 'birthday', group: 'Surprising results', title: 'Birthday Paradox', short: 'Birthday paradox',
  html: () => U.layout({
    eyebrow: 'Collisions',
    title: 'Birthday Paradox',
    lede: 'In a room of just <b>23 people</b>, two of them probably share a birthday. The same maths tells you when random IDs and hashes start to collide: after roughly the <b>square root</b> of the number of possible values.',
    controls: `
      <div class="group"><div class="label">Mode</div><div class="chips" data-k="modes"></div></div>
      <div data-k="bdayCtl" class="group" style="gap:22px">
        <div class="group"><label class="label" for="bday-k">People in the room <output data-k="kOut">23</output></label><input type="range" id="bday-k" min="2" max="80" value="23"></div>
        <div class="group"><div class="label">Test it</div><div class="buttons">
          <button class="btn primary wide" data-k="one" type="button">New room</button><button class="btn wide" data-k="many" type="button">Try 1,000 rooms</button></div></div></div>
      <div data-k="hashCtl" class="group" style="gap:22px" hidden>
        <div class="group"><label class="label" for="bday-bits">Hash size <output data-k="bOut">32 bits</output></label><input type="range" id="bday-bits" min="8" max="256" step="8" value="32">
          <p class="desc" data-k="space"></p></div>
        <div class="group"><div class="label">Test it</div><div class="buttons"><button class="btn primary wide" data-k="hrun" type="button">Hash until a collision (20×)</button></div>
          <p class="desc" data-k="hnote">Generates random values until one repeats. Available up to 32 bits.</p></div></div>`,
    charts: `<div data-k="bdayView" style="display:grid;gap:20px">${U.panel('<span data-k="roomTitle">One room</span>', U.legend([['', '--means', 'Birthday'], ['', '--curve', 'Shared birthday']]),
        `<canvas data-k="cal" style="height:228px" aria-label="Calendar of birthdays in the room"></canvas><p class="say" data-k="roomSay" aria-live="polite" style="min-height:0"></p>`)
      + U.panel('Chance that two people share a birthday', U.legend([['ln', '--curve', 'Exact probability'], ['dot', '--means', 'Your simulations']]),
        `<canvas data-k="curve" style="height:260px" aria-label="Probability of a shared birthday by group size"></canvas>
        <div class="stats">${U.stat('pk', 'Exact chance', 'for this room size')}${U.stat('sim', 'Simulated', U.pred('simN'))}${U.stat('pairs', 'Pairs of people', 'each pair has a 1/365 chance')}</div>`)}</div>
      <div data-k="hashView" hidden>${U.panel('<span data-k="hashTitle">Collision chance</span>', U.legend([['ln', '--curve', 'P(at least one collision)'], ['dot', '--means', 'Your collision tests']]),
        `<canvas data-k="hcurve" style="height:300px" aria-label="Collision probability by number of hashed items"></canvas>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Chance of a collision</th><th>Items needed</th><th>About</th></tr></thead><tbody data-k="htable"></tbody></table></div>
        <div class="stats">${U.stat('hfirst', 'First collision after', 'theory √(πN/2) = ' + U.pred('hth'))}</div>`)}</div>`,
    notes: `<div><h3>Why so few people?</h3>
      <p>The question is not whether someone shares <em>your</em> birthday. It is whether <em>any</em> two people match, and the number of pairs grows fast: 23 people form 253 pairs. The exact chance that all birthdays differ is 365/365 × 364/365 × … × 343/365 ≈ 0.493.</p>
      <div class="formula">P(collision) ≈ 1 − e<sup>−k²/2N</sup></div>
      <p>For N possible values, a 50% chance of collision arrives at about 1.18√N items. That is 23 for N = 365.</p></div>
      <div><h3>Why security people care</h3><ul class="plain">
      <li>A hash with <em>b</em> bits resists a birthday attack only up to about 2<sup>b/2</sup> items. That is why a 64-bit value is too short for collision-sensitive uses and SHA-256 is sized to give 128-bit collision resistance.</li>
      <li>Random 32-bit IDs collide with 50% probability after only about 77,000 items.</li>
      <li>The same effect limits how much data one key should encrypt with a 64-bit block cipher (the Sweet32 attack) and how random a nonce must be.</li></ul></div>`
  }),
  init(root) {
    const q = k => root.querySelector(`[data-k="${k}"]`);
    const kIn = root.querySelector('#bday-k'), bIn = root.querySelector('#bday-bits');
    const S = { mode: 'bday', k: 23, room: null, sims: new Map(), bits: 32, htests: [] };
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const pShared = k => { let p = 1; for (let i = 0; i < k; i++) p *= (365 - i) / 365; return 1 - p; };
    const pHash = (k, bits) => -Math.expm1(-(k * (k - 1) / 2) / 2 ** bits);
    q('modes').innerHTML = U.chipHtml([['bday', 'Birthdays'], ['hash', 'Hash collisions']], S.mode);
    U.chips(root, '[data-k="modes"]', v => { S.mode = v; const b = v === 'bday'; q('bdayCtl').hidden = !b; q('bdayView').hidden = !b; q('hashCtl').hidden = b; q('hashView').hidden = b; hashInfo(); render(); });

    function newRoom() {
      const days = Array.from({ length: S.k }, () => Math.floor(Math.random() * 365)), cnt = new Map();
      days.forEach(d => cnt.set(d, (cnt.get(d) || 0) + 1));
      S.room = cnt; record(S.k, [...cnt.values()].some(v => v > 1));
      const shared = [...cnt.entries()].filter(([, v]) => v > 1);
      q('roomTitle').textContent = `One room of ${S.k} people`;
      q('roomSay').innerHTML = shared.length ? `<b>${shared.length} shared birthday${shared.length > 1 ? 's' : ''}</b>: ${shared.slice(0, 4).map(([d, v]) => `${fmtDay(d)} (${v} people)`).join(', ')}${shared.length > 4 ? ', …' : ''}.` : 'Everyone has a different birthday this time.';
    }
    function fmtDay(d) { let m = 0; while (d >= DAYS[m]) { d -= DAYS[m]; m++; } return `${MONTHS[m]} ${d + 1}`; }
    function record(k, hit) { const r = S.sims.get(k) || [0, 0]; r[0]++; if (hit) r[1]++; S.sims.set(k, r); }
    function many() {
      for (let t = 0; t < 1000; t++) { const seen = new Uint8Array(365); let hit = false; for (let i = 0; i < S.k; i++) { const d = Math.floor(Math.random() * 365); if (seen[d]) { hit = true; break; } seen[d] = 1; } record(S.k, hit); }
      stats(); render();
    }
    function stats() {
      U.set(root, 'pk', U.pct(pShared(S.k))); U.set(root, 'pairs', U.int(S.k * (S.k - 1) / 2));
      const r = S.sims.get(S.k); U.set(root, 'sim', r ? U.pct(r[1] / r[0]) : '–'); U.set(root, 'simN', r ? `${U.int(r[0])} rooms of ${S.k}` : 'no rooms yet');
    }
    function hashInfo() {
      const N = 2 ** S.bits, b = S.bits;
      q('bOut').textContent = b + ' bits'; q('hashTitle').textContent = `Collision chance for a ${b}-bit hash`;
      q('space').textContent = `2^${b} ≈ ${fmtBig(N)} possible values.`;
      const rows = [[0.000001, 'one in a million'], [0.01, '1%'], [0.5, '50%'], [0.99, '99%']];
      q('htable').innerHTML = rows.map(([p, t]) => { const k = Math.sqrt(2 * N * -Math.log1p(-p)); return `<tr><td>${t}</td><td>${fmtBig(k)}</td><td>2^${(Math.log2(k)).toFixed(1)}</td></tr>`; }).join('');
      U.set(root, 'hth', fmtBig(Math.sqrt(Math.PI * N / 2)));
      const can = b <= 32; q('hrun').disabled = !can; q('hnote').textContent = can ? 'Generates random values until one repeats, 20 times over.' : `At ${b} bits a collision needs about ${fmtBig(Math.sqrt(Math.PI * N / 2))} values, too many for a browser. Try 32 bits or fewer.`;
      const t = S.htests.filter(x => x.bits === b); U.set(root, 'hfirst', t.length ? fmtBig(t.reduce((s, x) => s + x.k, 0) / t.length) + ` (avg of ${t.length})` : '–');
    }
    function fmtBig(v) { if (v < 1e6) return U.int(v); const e = Math.floor(Math.log10(v)); return (v / 10 ** e).toFixed(2) + '×10' + String(e).split('').map(d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]).join(''); }
    function hrun() {
      const b = S.bits, N = 2 ** b;
      for (let t = 0; t < 20; t++) {
        const seen = new Set(); let k = 0;
        for (;;) { const v = b <= 30 ? Math.floor(Math.random() * N) : Math.floor(Math.random() * 2 ** 30) * 2 ** (b - 30) + Math.floor(Math.random() * 2 ** (b - 30)); k++; if (seen.has(v)) break; seen.add(v); }
        S.htests.push({ bits: b, k });
      }
      hashInfo(); render();
    }
    function render() {
      if (root.hidden) return;
      if (S.mode === 'bday') { renderCal(); renderCurve(); } else renderHash();
    }
    function renderCal() {
      const { ctx, w, h } = U.prep(q('cal')), c = U.colors();
      const lw = 34, cw = Math.min(22, (w - lw) / 31), ch = Math.min(18, (h - 8) / 12), gap = 2;
      ctx.font = `11px ${c.mono}`; ctx.textBaseline = 'middle';
      let d0 = 0;
      for (let m = 0; m < 12; m++) {
        ctx.fillStyle = c.muted; ctx.textAlign = 'left'; ctx.fillText(MONTHS[m], 0, 4 + m * ch + ch / 2);
        for (let d = 0; d < 31; d++) {
          const x = lw + d * cw, y = 4 + m * ch;
          if (d >= DAYS[m]) continue;
          const n = S.room ? S.room.get(d0 + d) || 0 : 0;
          ctx.fillStyle = n > 1 ? c.curve : n === 1 ? c.means : c.grid;
          ctx.fillRect(x, y, cw - gap, ch - gap);
          if (n > 1 && cw > 12) { ctx.fillStyle = c.surface; ctx.textAlign = 'center'; ctx.fillText(n, x + (cw - gap) / 2, y + (ch - gap) / 2 + 0.5); }
        }
        d0 += DAYS[m];
      }
    }
    function renderCurve() {
      const p = U.plot(q('curve'), { x: [1, 80], y: [0, 1], yFmt: v => Math.round(v * 100) + '%', xLabel: 'people in the room' }), c = p.c;
      U.hline(p, 0.5, c.muted);
      U.fnPath(p, k => pShared(Math.round(k)), 1, 80, c.curve, 2.5, null, 79);
      for (const [k, [n, hit]] of S.sims) { p.ctx.fillStyle = c.means; p.ctx.beginPath(); p.ctx.arc(p.X(k), p.Y(hit / n), n >= 100 ? 4.5 : 3, 0, 7); p.ctx.fill(); }
      const x = p.X(S.k); p.ctx.strokeStyle = c.ink; p.ctx.lineWidth = 1; p.ctx.beginPath(); p.ctx.moveTo(x, p.T); p.ctx.lineTo(x, p.B); p.ctx.stroke();
      p.ctx.fillStyle = c.ink; p.ctx.font = `600 12px ${c.mono}`; p.ctx.textAlign = x > p.R - 90 ? 'right' : 'left'; p.ctx.textBaseline = 'top';
      p.ctx.fillText(`${S.k} people: ${U.pct(pShared(S.k))}`, x + (x > p.R - 90 ? -6 : 6), p.T + 16);
    }
    function renderHash() {
      const N = 2 ** S.bits, mid = Math.sqrt(N), a = Math.max(1, mid / 1000), b = mid * 10;
      const p = U.plot(q('hcurve'), { x: [a, b], y: [0, 1], xlog: true, yFmt: v => Math.round(v * 100) + '%', xLabel: 'items hashed (log scale)', xFmt: v => v >= 1e6 ? '10' + String(Math.round(Math.log10(v))).split('').map(d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]).join('') : U.compact(v) }), c = p.c;
      U.hline(p, 0.5, c.muted);
      U.fnPath(p, k => pHash(k, S.bits), a, b, c.curve, 2.5, null, 300, true);
      const t = S.htests.filter(x => x.bits === S.bits).map(x => x.k).sort((x, y) => x - y);
      p.ctx.fillStyle = c.means; t.forEach((k, i) => { p.ctx.beginPath(); p.ctx.arc(p.X(k), p.Y((i + 0.5) / t.length), 3.5, 0, 7); p.ctx.fill(); });
    }
    kIn.addEventListener('input', () => { S.k = +kIn.value; q('kOut').textContent = S.k; newRoom(); stats(); render(); });
    bIn.addEventListener('input', () => { S.bits = +bIn.value; hashInfo(); render(); });
    q('one').addEventListener('click', () => { newRoom(); stats(); render(); });
    q('many').addEventListener('click', many);
    q('hrun').addEventListener('click', hrun);
    for (const k of [5, 10, 15, 23, 30, 40, 50, 60]) { const save = S.k; S.k = k; many(); S.k = save; }
    newRoom(); hashInfo(); stats(); render();
    return { render };
  }
});
