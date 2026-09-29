'use strict';
Lab.register({
  id: 'monty', group: 'Surprising results', title: 'Monty Hall Problem', short: 'Monty Hall',
  html: () => U.layout({
    eyebrow: 'Conditional probability',
    title: 'Monty Hall Problem',
    lede: 'A car hides behind one door, goats behind the rest. You pick a door, the host (who knows where the car is) opens doors with goats, and offers you a switch. <b>Should you switch?</b> Play it yourself, then let the computer play thousands of games.',
    controls: `
      <div class="group"><div class="label">Number of doors</div><div class="chips" data-k="ks"></div>
        <p class="desc">With 10 doors the host opens 8 goats and leaves one other door closed.</p></div>
      <div class="group"><div class="label">Simulate both strategies</div><div class="buttons">
        <button class="btn primary wide" data-k="run" type="button">Run 10,000 games</button><button class="btn wide" data-k="reset" type="button">Clear simulation</button></div></div>`,
    charts: U.panel('Play a round', '', `<div class="doors" data-k="doors"></div><p class="say" data-k="say" aria-live="polite"></p>
        <div class="buttons" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))"><button class="btn" data-k="stick" type="button" disabled>Stick</button><button class="btn" data-k="switch" type="button" disabled>Switch</button><button class="btn" data-k="again" type="button">New round</button></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Your games</th><th>Played</th><th>Won</th><th>Win rate</th><th>Theory</th></tr></thead><tbody data-k="mine"></tbody></table></div>`)
      + U.panel('Win rate over many games', U.legend([['ln', '--means', 'Always switch'], ['ln', '--curve', 'Always stick'], ['dash', '--muted', 'Theory']]),
        `<canvas data-k="chart" style="height:300px" aria-label="Win rates of stick and switch strategies"></canvas>
        <div class="stats">${U.stat('games', 'Games per strategy')}${U.stat('sw', 'Switch wins', 'theory ' + U.pred('psw'))}${U.stat('st', 'Stick wins', 'theory ' + U.pred('pst'))}</div>`),
    notes: `<div><h3>Why switching wins</h3>
      <p>Your first pick is right with probability 1/3. Nothing the host does changes that, because he can always open a goat door whatever you picked. So sticking wins 1/3 of the time.</p>
      <p>The other 2/3 of the probability sat on the doors you did not pick. The host removes every goat among them and leaves one door standing, so that door now carries the whole 2/3. With 10 doors the effect is stark: stick wins 1 in 10, switch wins 9 in 10.</p></div>
      <div><h3>The fine print</h3><ul class="plain">
      <li>The argument depends on the host knowing where the car is and always opening goat doors. If he opened doors at random and happened to show goats, switching would only be 50/50.</li>
      <li>Marilyn vos Savant published the correct answer in 1990 and received thousands of letters insisting she was wrong, including from mathematicians.</li></ul></div>`
  }),
  init(root) {
    const q = k => root.querySelector(`[data-k="${k}"]`);
    const S = { k: 3, g: null, mine: { stick: [0, 0], switch: [0, 0] }, sim: { n: 0, st: 0, sw: 0, rs: [], rw: [], ri: 0 } };
    const MAX = 10000, IDX = U.logIndex(MAX);
    q('ks').innerHTML = U.chipHtml([[3, '3 doors'], [10, '10 doors']], S.k);
    U.chips(root, '[data-k="ks"]', v => { S.k = +v; S.mine = { stick: [0, 0], switch: [0, 0] }; newRound(); simReset(); });

    function newRound() { S.g = { car: Math.floor(Math.random() * S.k), pick: null, left: null, opened: new Set(), final: null }; drawDoors(); say(`Pick one of the ${S.k} doors.`); setBtns(false); table(); }
    const say = html => q('say').innerHTML = html;
    function setBtns(on) { q('stick').disabled = !on; q('switch').disabled = !on; if (on) { q('stick').textContent = `Stick with door ${S.g.pick + 1}`; q('switch').textContent = `Switch to door ${S.g.left + 1}`; } else { q('stick').textContent = 'Stick'; q('switch').textContent = 'Switch'; } }
    function drawDoors() {
      const g = S.g; q('doors').innerHTML = '';
      for (let i = 0; i < S.k; i++) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'door';
        const open = g.opened.has(i) || g.final !== null, car = open && i === g.car;
        if (open) b.classList.add(car ? 'car' : 'open');
        if (i === g.pick) b.classList.add('picked');
        b.innerHTML = `${i + 1}<small>${open ? (car ? 'Car' : 'Goat') : i === g.pick ? 'Your pick' : ''}</small>`;
        b.disabled = open || g.final !== null || (g.pick !== null && i !== g.pick && i !== g.left);
        b.setAttribute('aria-label', `Door ${i + 1}${open ? (car ? ', car' : ', goat') : ''}`);
        b.addEventListener('click', () => click(i));
        q('doors').appendChild(b);
      }
    }
    function click(i) {
      const g = S.g;
      if (g.pick === null) {
        g.pick = i;
        g.left = i === g.car ? (() => { let j; do j = Math.floor(Math.random() * S.k); while (j === i); return j; })() : g.car;
        for (let j = 0; j < S.k; j++) if (j !== g.pick && j !== g.left) g.opened.add(j);
        drawDoors(); setBtns(true);
        say(`The host opens ${S.k === 3 ? `door ${[...g.opened][0] + 1}` : `${S.k - 2} doors`}: ${S.k === 3 ? 'a goat' : 'all goats'}. Stick with door <b>${g.pick + 1}</b> or switch to door <b>${g.left + 1}</b>?`);
      } else if (g.final === null) { decide(i === g.pick ? 'stick' : 'switch'); }
    }
    function decide(how) {
      const g = S.g; g.final = how === 'stick' ? g.pick : g.left;
      const win = g.final === g.car; S.mine[how][0]++; if (win) S.mine[how][1]++;
      drawDoors(); setBtns(false);
      say(win ? `You ${how === 'stick' ? 'stuck' : 'switched'} and <b>won the car</b>.` : `You ${how === 'stick' ? 'stuck' : 'switched'} and got a goat. The car was behind door <b>${g.car + 1}</b>.`);
      table();
    }
    function table() {
      const row = (name, [n, w], th) => `<tr><td>${name}</td><td>${n}</td><td>${w}</td><td>${n ? U.pct(w / n, 0) : '–'}</td><td>${th}</td></tr>`;
      q('mine').innerHTML = row('Stick', S.mine.stick, `1/${S.k}`) + row('Switch', S.mine.switch, `${S.k - 1}/${S.k}`);
    }
    q('stick').addEventListener('click', () => decide('stick'));
    q('switch').addEventListener('click', () => decide('switch'));
    q('again').addEventListener('click', newRound);

    function simReset() { S.sim = { n: 0, st: 0, sw: 0, rs: new Float32Array(IDX.length), rw: new Float32Array(IDX.length), ri: 0 }; simStats(); render(); }
    function game() {
      const sm = S.sim, car = Math.floor(Math.random() * S.k), pick = Math.floor(Math.random() * S.k);
      sm.n++; if (pick === car) sm.st++; else sm.sw++;
      if (IDX[sm.ri] === sm.n) { sm.rs[sm.ri] = sm.st / sm.n; sm.rw[sm.ri] = sm.sw / sm.n; sm.ri++; }
    }
    function simStats() {
      const sm = S.sim; U.set(root, 'games', U.int(sm.n));
      U.set(root, 'sw', sm.n ? U.pct(sm.sw / sm.n) : '–'); U.set(root, 'st', sm.n ? U.pct(sm.st / sm.n) : '–');
      U.set(root, 'psw', U.pct((S.k - 1) / S.k)); U.set(root, 'pst', U.pct(1 / S.k));
    }
    function render() {
      if (root.hidden) return;
      const sm = S.sim, p = U.plot(q('chart'), { x: [1, MAX], y: [0, 1], xlog: true, yFmt: v => Math.round(v * 100) + '%', xLabel: 'games played (log scale)' }), c = p.c;
      U.hline(p, (S.k - 1) / S.k, c.muted); U.hline(p, 1 / S.k, c.muted);
      const a = [], b = []; for (let r = 0; r < sm.ri; r++) { a.push([p.X(IDX[r]), p.Y(sm.rw[r])]); b.push([p.X(IDX[r]), p.Y(sm.rs[r])]); }
      U.path(p.ctx, a, c.means, 2.2); U.path(p.ctx, b, c.curve, 2.2);
      if (!sm.n) U.message(p, 'Press Run to simulate');
    }
    const anim = U.animator(on => q('run').textContent = on ? 'Pause' : 'Run 10,000 games');
    q('run').addEventListener('click', () => {
      if (anim.running) return anim.stop();
      if (S.sim.n >= MAX) simReset();
      anim.start(() => { const per = Math.max(1, Math.ceil(S.sim.n / 45)); for (let i = 0; i < per && S.sim.n < MAX; i++) game(); simStats(); render(); return S.sim.n < MAX; });
    });
    q('reset').addEventListener('click', () => { anim.stop(); simReset(); });
    newRound(); simReset(); for (let i = 0; i < 2000; i++) game(); simStats(); render();
    return { render, stop: () => anim.stop() };
  }
});
