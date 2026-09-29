'use strict';
Lab.register({
  id: 'bayes', group: 'Surprising results', title: 'Base-Rate Fallacy', short: 'Base-rate fallacy',
  html: () => U.layout({
    eyebrow: "Bayes' theorem",
    title: 'Base-Rate Fallacy',
    lede: 'A test that is right 99% of the time sounds trustworthy. But when the thing you are looking for is rare, <b>most positive results are false alarms</b>. Change the numbers and watch the share of real cases among all positives.',
    controls: `
      <div class="group"><div class="label">Scenario</div><div class="chips" data-k="presets"></div><p class="desc" data-k="pdesc"></p></div>
      <div class="group"><label class="label" for="bayes-prev">How common it is <output data-k="prevOut"></output></label><input type="range" id="bayes-prev" min="-6" max="-0.3" step="0.05"><div class="scale"><span>1 in a million</span><span>1 in 2</span></div></div>
      <div class="group"><label class="label" for="bayes-sens">Detection rate <output data-k="sensOut"></output></label><input type="range" id="bayes-sens" min="0.5" max="0.999" step="0.001">
        <p class="desc">Share of real cases the test catches (sensitivity).</p></div>
      <div class="group"><label class="label" for="bayes-fpr">False-alarm rate <output data-k="fprOut"></output></label><input type="range" id="bayes-fpr" min="-5" max="-0.7" step="0.05">
        <p class="desc">Share of clean cases wrongly flagged (1 − specificity).</p></div>`,
    charts: U.panel('Of every positive result', '', `<div style="display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 18px"><span class="big" data-k="ppv">–</span><span data-k="ppvSay" style="color:var(--muted);max-width:44ch"></span></div>
        <canvas data-k="bar" style="height:34px" aria-label="Share of true and false positives"></canvas>`)
      + U.panel('<span data-k="gridTitle">All positive results</span>', U.legend([['', '--means', 'Real case caught'], ['', '--curve', 'False alarm']]),
        `<canvas data-k="dots" style="height:260px" aria-label="Every positive result as a dot"></canvas><div class="cap" data-k="dotNote"></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th data-k="popHead">Out of</th><th>Test positive</th><th>Test negative</th><th>Total</th></tr></thead><tbody data-k="tbl"></tbody></table></div>`),
    notes: `<div><h3>The arithmetic</h3>
      <p>Bayes' theorem turns "how likely is a positive test, given the condition" into the question you actually care about: "how likely is the condition, given a positive test".</p>
      <div class="formula">P(real | +) = <span class="n">s·π</span> / ( <span class="n">s·π</span> + f·(1 − π) )</div>
      <p>Here π is how common the condition is, s the detection rate and f the false-alarm rate. When π is tiny, the f·(1 − π) term swamps everything: there are simply far more clean cases available to be misflagged than real cases to be caught.</p></div>
      <div><h3>Why it matters in practice</h3><ul class="plain">
      <li><b>Security monitoring.</b> An intrusion detector with a 0.1% false-alarm rate looks excellent on paper. Applied to a million events with ten real attacks, it raises about a thousand alerts, and fewer than 1% are real. This is why alert fatigue is a base-rate problem, not a tuning problem.</li>
      <li><b>Screening tests.</b> Doctors routinely overestimate what a positive mammogram means. Gigerenzer found that presenting the numbers as natural frequencies, as the dot grid does, fixes most of the confusion.</li>
      <li>The cure is a second, independent test on the positives. Their base rate is much higher, so the second result means far more.</li></ul></div>`
  }),
  init(root) {
    const q = k => root.querySelector(`[data-k="${k}"]`);
    const prevIn = root.querySelector('#bayes-prev'), sensIn = root.querySelector('#bayes-sens'), fprIn = root.querySelector('#bayes-fpr');
    const PRE = {
      ids: { name: 'Intrusion alerts', desc: '1 malicious event in 100,000. The detector catches 99% of attacks and flags 0.1% of normal events.', prev: 1e-5, sens: 0.99, fpr: 0.001, unit: 'events' },
      mammo: { name: 'Screening test', desc: 'A classic teaching example: 1% prevalence, 90% detection, 9% false positives.', prev: 0.01, sens: 0.9, fpr: 0.09, unit: 'people' },
      rare: { name: 'Rare disease', desc: 'A 99%-accurate test for a condition 1 in 1,000 people have.', prev: 0.001, sens: 0.99, fpr: 0.01, unit: 'people' },
      spam: { name: 'Spam filter', desc: 'Half of all mail is spam. The filter catches 95% of it and flags 0.5% of real mail.', prev: 0.5, sens: 0.95, fpr: 0.005, unit: 'emails' },
    };
    const S = { prev: 1e-5, sens: 0.99, fpr: 0.001, unit: 'events' };
    q('presets').innerHTML = U.chipHtml(Object.entries(PRE).map(([k, v]) => [k, v.name]), 'ids');
    const pick = U.chips(root, '[data-k="presets"]', k => load(k));
    function load(k) { const p = PRE[k]; Object.assign(S, { prev: p.prev, sens: p.sens, fpr: p.fpr, unit: p.unit }); q('pdesc').textContent = p.desc; sync(); update(); }
    function sync() { prevIn.value = Math.log10(S.prev); sensIn.value = S.sens; fprIn.value = Math.log10(S.fpr); }
    const oneIn = v => v >= 0.1 ? U.pct(v, v >= 0.2 ? 0 : 1) : '1 in ' + U.int(1 / v);
    const pctSmart = v => v >= 0.1 ? U.pct(v, 0) : v >= 0.01 ? U.pct(v, 1) : U.pct(v, 2);
    function counts() {
      const tpR = S.sens * S.prev; // rate per event
      let N = 10 ** Math.ceil(Math.log10(Math.max(1000, 20 / tpR)));
      N = Math.min(N, 1e9);
      const P = N * S.prev, Nn = N - P;
      return { N, TP: P * S.sens, FN: P * (1 - S.sens), FP: Nn * S.fpr, TN: Nn * (1 - S.fpr), P, Nn };
    }
    function update() {
      q('prevOut').textContent = oneIn(S.prev); q('sensOut').textContent = pctSmart(S.sens); q('fprOut').textContent = pctSmart(S.fpr);
      const C = counts(), ppv = C.TP / (C.TP + C.FP);
      q('ppv').textContent = ppv >= 0.995 ? U.pct(ppv, 1) : ppv >= 0.1 ? U.pct(ppv, 0) : ppv >= 0.01 ? U.pct(ppv, 1) : U.pct(ppv, 2);
      q('ppvSay').textContent = `are real. Roughly ${ppv >= 0.5 ? `${Math.round(ppv * 10)} in 10` : `1 in ${U.int(1 / ppv)}`} positives is a real case; the rest are false alarms.`;
      const r = n => U.int(n);
      q('popHead').textContent = `Out of ${U.compact(C.N)} ${S.unit}`;
      q('tbl').innerHTML = `<tr><td>Real cases</td><td>${r(C.TP)}</td><td>${r(C.FN)}</td><td>${r(C.P)}</td></tr><tr><td>Clean</td><td>${r(C.FP)}</td><td>${r(C.TN)}</td><td>${r(C.Nn)}</td></tr><tr><td>Total</td><td>${r(C.TP + C.FP)}</td><td>${r(C.FN + C.TN)}</td><td>${r(C.N)}</td></tr>`;
      q('gridTitle').textContent = `All ${U.int(C.TP + C.FP)} positive results among ${U.compact(C.N)} ${S.unit}`;
      render();
    }
    function render() {
      if (root.hidden) return;
      const C = counts(), c = U.colors(), ppv = C.TP / (C.TP + C.FP);
      { const { ctx, w, h } = U.prep(q('bar')); const x = Math.max(2, w * ppv);
        ctx.fillStyle = c.means; ctx.fillRect(0, 4, x, h - 8); ctx.fillStyle = c.curve; ctx.fillRect(x, 4, w - x, h - 8); }
      let tp = Math.round(C.TP), fp = Math.round(C.FP), per = 1;
      const MAXD = 4000;
      if (tp + fp > MAXD) { per = 10 ** Math.ceil(Math.log10((tp + fp) / MAXD)); tp = Math.round(C.TP / per); fp = Math.round(C.FP / per); if (C.TP > 0 && tp === 0) tp = 1; }
      const n = tp + fp, cv = q('dots'), W = cv.getBoundingClientRect().width || 600;
      let cell = Math.max(4, Math.min(18, Math.floor(Math.sqrt((W * 380) / Math.max(1, n)))));
      const cols = Math.max(1, Math.floor(W / cell)), rows = Math.ceil(n / cols);
      cv.style.height = Math.max(60, rows * cell + 4) + 'px';
      const { ctx } = U.prep(cv);
      for (let i = 0; i < n; i++) {
        const x = (i % cols) * cell, y = Math.floor(i / cols) * cell;
        ctx.fillStyle = i < tp ? c.means : c.curve;
        ctx.beginPath(); ctx.arc(x + cell / 2, y + cell / 2 + 2, Math.max(1.5, cell * 0.36), 0, 7); ctx.fill();
      }
      q('dotNote').textContent = per > 1 ? `Each dot stands for ${U.int(per)} positive results.` : 'Each dot is one positive result. Real cases come first.';
    }
    prevIn.addEventListener('input', () => { S.prev = 10 ** +prevIn.value; pick(''); q('pdesc').textContent = 'Custom scenario.'; update(); });
    sensIn.addEventListener('input', () => { S.sens = +sensIn.value; pick(''); q('pdesc').textContent = 'Custom scenario.'; update(); });
    fprIn.addEventListener('input', () => { S.fpr = 10 ** +fprIn.value; pick(''); q('pdesc').textContent = 'Custom scenario.'; update(); });
    load('ids');
    return { render };
  }
});
