'use strict';
Lab.register({
  id: 'stacking', group: 'Monte Carlo & random processes', title: 'Image Stacking', short: 'Image stacking',
  html: () => U.layout({
    eyebrow: 'Signal to noise',
    title: 'Image Stacking',
    lede: 'A single short exposure of the night sky is mostly noise. Average many of them and the stars stay put while the noise cancels. Signal-to-noise ratio grows like <b>√N</b>: four times the frames, twice the SNR.',
    controls: `
      <div class="group"><label class="label" for="stack-snr">Faint star, one frame <output data-k="sOut">SNR 1.0</output></label><input type="range" id="stack-snr" min="0.3" max="3" step="0.1" value="1">
        <p class="desc">Brightness of the circled target star, as its signal-to-noise ratio in a single frame.</p></div>
      <div class="group"><div class="label">Frames</div><div class="buttons">
        <button class="btn primary wide" data-k="run" type="button">Run</button>
        <button class="btn" data-k="ten" type="button">Add 10</button><button class="btn" data-k="reset" type="button">Start over</button></div>
        <p class="desc">Each frame: 100 e⁻ of sky per pixel, Poisson shot noise and 8 e⁻ read noise. Up to 1,000 frames.</p></div>`,
    charts: `<div class="split">${U.panel('Latest single frame', '', `<canvas data-k="one" class="pix" aria-label="Single noisy frame"></canvas>`)}${U.panel('<span data-k="stackTitle">Stack</span>', '', `<canvas data-k="stack" class="pix" aria-label="Average of all frames"></canvas>`)}</div>`
      + U.panel('Target star SNR', U.legend([['dot', '--means', 'Measured in the stack'], ['ln', '--curve', 'SNR₁ × √N']]),
        `<canvas data-k="chart" style="height:260px" aria-label="Signal to noise ratio against number of frames"></canvas>
        <div class="stats">${U.stat('n', 'Frames stacked')}${U.stat('snr', 'Measured SNR', 'theory ' + U.pred('psnr'))}${U.stat('noise', 'Background noise', 'per pixel, theory ' + U.pred('pnoise'))}</div>`),
    notes: `<div><h3>Why averaging works</h3>
      <p>The star's signal is the same in every frame, so averaging leaves it unchanged. The noise in each pixel is independent from frame to frame, so its standard deviation falls like 1/√N, the same law as the <a href="#clt">central limit theorem</a>. The ratio of the two, the SNR, therefore rises like √N.</p>
      <p>The images use the same brightness stretch throughout, so you are seeing the noise shrink, not a re-stretch. Around SNR 3 to 5 the circled star becomes easy to pick out by eye.</p></div>
      <div><h3>In practice</h3><ul class="plain">
      <li>The √N law means diminishing returns: going from SNR 10 to 20 costs four times the imaging time.</li>
      <li>Read noise is paid once per frame, so very short frames lose efficiency when read noise is large compared with sky noise.</li>
      <li>Lucky imaging turns the idea around: shoot thousands of very short frames of a planet, keep only the sharpest few percent (moments of steady air), then stack those. You trade frame count, and so some SNR, for resolution.</li>
      <li>Median stacking and sigma clipping reject outliers such as satellite trails and cosmic-ray hits, at a small cost in noise.</li></ul></div>`
  }),
  init(root) {
    const q = k => root.querySelector(`[data-k="${k}"]`);
    const W = 160, H = 100, SKY = 100, READ = 8, PSF = 1.3, AP = 3, MAX = 1000;
    const sigma1 = Math.sqrt(SKY + READ * READ);
    const snrIn = root.querySelector('#stack-snr');
    const TX = 112, TY = 58;
    const ap = []; for (let y = -AP; y <= AP; y++) for (let x = -AP; x <= AP; x++) if (x * x + y * y <= AP * AP) ap.push((TY + y) * W + TX + x);
    const patch = []; for (let y = 2; y < 30; y++) for (let x = 2; x < 44; x++) patch.push(y * W + x);
    const rnd = U.mulberry(20260929), stars = [];
    while (stars.length < 70) {
      const x = 4 + rnd() * (W - 8), y = 4 + rnd() * (H - 8);
      if (x < 50 && y < 36) continue;
      if (Math.hypot(x - TX, y - TY) < 10) continue;
      stars.push({ x, y, f: 60 * 10 ** (2.4 * rnd() ** 2.2) });
    }
    const S = { s1: 1, model: null, sig: null, sum: new Float64Array(W * H), last: new Float32Array(W * H), n: 0, rec: [] };
    function buildModel() {
      const m = new Float32Array(W * H).fill(SKY);
      const add = (sx, sy, f) => {
        for (let y = Math.max(0, Math.floor(sy - 6)); y < Math.min(H, sy + 7); y++) for (let x = Math.max(0, Math.floor(sx - 6)); x < Math.min(W, sx + 7); x++)
          m[y * W + x] += f * Math.exp(-((x - sx) ** 2 + (y - sy) ** 2) / (2 * PSF * PSF)) / (2 * Math.PI * PSF * PSF);
      };
      stars.forEach(s => add(s.x, s.y, s.f));
      // target flux so that aperture SNR in one frame is s1 (aperture holds ~93% of the flux for this PSF)
      let frac = 0; for (const i of ap) { const x = i % W, y = (i / W) | 0; frac += Math.exp(-((x - TX) ** 2 + (y - TY) ** 2) / (2 * PSF * PSF)) / (2 * Math.PI * PSF * PSF); }
      const npx = ap.length, s1 = S.s1;
      // solve F·frac / sqrt(F·frac + npx·σ²) = s1
      const Fin = (s1 * s1 + Math.sqrt(s1 ** 4 + 4 * s1 * s1 * npx * sigma1 * sigma1)) / 2;
      add(TX, TY, Fin / frac);
      S.model = m; S.sig = m.map(v => Math.sqrt(v + READ * READ)); S.fin = Fin;
    }
    function reset() { S.sum.fill(0); S.last.fill(SKY); S.n = 0; S.rec = []; stats(); render(); }
    function frame() {
      if (S.n >= MAX) return;
      const m = S.model, sg = S.sig, sum = S.sum, last = S.last;
      for (let i = 0; i < W * H; i++) { const v = m[i] + sg[i] * U.gauss(); last[i] = v; sum[i] += v; }
      S.n++;
      if (S.n <= 10 || S.n % Math.max(1, Math.floor(S.n / 12)) === 0) S.rec.push([S.n, measure().snr]);
    }
    function measure() {
      const n = S.n, sum = S.sum; let pm = 0, pv = 0;
      for (const i of patch) pm += sum[i] / n; pm /= patch.length;
      for (const i of patch) pv += (sum[i] / n - pm) ** 2; pv /= patch.length - 1;
      let sig = 0; for (const i of ap) sig += sum[i] / n - pm;
      return { snr: sig / Math.sqrt(pv * ap.length + Math.max(0, sig) / n), noise: Math.sqrt(pv) };
    }
    const theory = n => S.s1 * Math.sqrt(n);
    function stats() {
      U.set(root, 'n', U.int(S.n)); U.set(root, 'psnr', U.fmt(theory(Math.max(1, S.n)), 1)); U.set(root, 'pnoise', U.fmt(sigma1 / Math.sqrt(Math.max(1, S.n)), 2) + ' e⁻');
      if (!S.n) { U.set(root, 'snr', '–'); U.set(root, 'noise', '–'); q('stackTitle').textContent = 'Stack'; return; }
      const r = measure(); U.set(root, 'snr', U.fmt(r.snr, 1)); U.set(root, 'noise', U.fmt(r.noise, 2) + ' e⁻');
      q('stackTitle').textContent = `Stack of ${U.int(S.n)} frame${S.n > 1 ? 's' : ''}`;
    }
    const off = document.createElement('canvas'); off.width = W; off.height = H; const octx = off.getContext('2d'), img = octx.createImageData(W, H);
    function paint(cv, get, label) {
      const lo = SKY - 1.5 * sigma1, hi = SKY + 5 * sigma1;
      for (let i = 0; i < W * H; i++) { const v = Math.max(0, Math.min(1, (get(i) - lo) / (hi - lo))), g = Math.round(255 * Math.sqrt(v)); img.data[4 * i] = g; img.data[4 * i + 1] = g; img.data[4 * i + 2] = g; img.data[4 * i + 3] = 255; }
      octx.putImageData(img, 0, 0);
      const { ctx, w, h } = U.prep(cv); ctx.imageSmoothingEnabled = false; ctx.drawImage(off, 0, 0, w, h);
      const sx = w / W; ctx.strokeStyle = '#ffb27a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc((TX + 0.5) * sx, (TY + 0.5) * sx, 7 * sx, 0, 7); ctx.stroke();
      if (label) { ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = `11px ${U.colors().mono}`; ctx.textBaseline = 'top'; ctx.fillText(label, 8, 8); }
    }
    function render() {
      if (root.hidden) return;
      paint(q('one'), i => S.last[i], S.n ? '' : 'no frames yet');
      paint(q('stack'), S.n ? i => S.sum[i] / S.n : () => SKY, '');
      const ymax = Math.max(theory(MAX) * 1.08, ...S.rec.map(r => r[1] * 1.05));
      const p = U.plot(q('chart'), { x: [1, MAX], y: [0, ymax], xlog: true, xLabel: 'frames stacked (log scale)' });
      U.fnPath(p, theory, 1, MAX, p.c.curve, 2.2, null, 200, true);
      U.hline(p, 5, p.c.muted, 'SNR 5: clear detection');
      p.ctx.fillStyle = p.c.means; for (const [n, s] of S.rec) { p.ctx.beginPath(); p.ctx.arc(p.X(n), p.Y(Math.max(0, s)), 3.5, 0, 7); p.ctx.fill(); }
    }
    const anim = U.animator(on => U.runLabel(q('run'), on, S.n >= MAX ? 'Done' : 'Run'));
    const go = () => anim.start(() => { const per = Math.max(1, Math.floor(S.n / 40)); for (let i = 0; i < per; i++) frame(); stats(); render(); return S.n < MAX; });
    q('run').addEventListener('click', () => anim.running ? anim.stop() : (S.n >= MAX ? (reset(), go()) : go()));
    q('ten').addEventListener('click', () => { for (let i = 0; i < 10; i++) frame(); stats(); render(); });
    q('reset').addEventListener('click', () => { anim.stop(); reset(); });
    snrIn.addEventListener('input', () => { S.s1 = +snrIn.value; q('sOut').textContent = 'SNR ' + S.s1.toFixed(1); anim.stop(); buildModel(); reset(); });
    buildModel(); reset(); for (let i = 0; i < 16; i++) frame(); stats(); render();
    return { render, stop: () => anim.stop() };
  }
});
