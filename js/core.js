'use strict';
/* Shared helpers for every simulation: random variates, formatting, canvas charts, animation. */
const U = (() => {
  const SQ2PI = Math.sqrt(2 * Math.PI);
  let spare = null;
  function gauss() {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let u = 0; while (u === 0) u = Math.random();
    const v = Math.random(), r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  }
  const npdf = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * SQ2PI);
  function poisson(l) {
    if (l < 30) { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; }
    return Math.max(0, Math.round(l + Math.sqrt(l) * gauss()));
  }
  function lgamma(x) { // Lanczos
    const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
    x -= 1; let a = c[0]; const t = x + g + 0.5;
    for (let i = 1; i < 9; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  const poissonPmf = (k, l) => Math.exp(k * Math.log(l) - l - lgamma(k + 1));
  const binomPmf = (k, n, p) => Math.exp(lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1) + k * Math.log(p) + (n - k) * Math.log(1 - p));
  function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  const minus = s => s.replace(/^-/, '−');
  function fmt(v, dp = 3) { if (v == null || !isFinite(v)) return '–'; const r = Math.abs(v) < 0.5 * 10 ** -dp ? 0 : v; return minus(r.toFixed(dp)); }
  const int = n => (n == null || !isFinite(n)) ? '–' : Math.round(n).toLocaleString('en-US');
  const pct = (v, dp = 1) => (v == null || !isFinite(v)) ? '–' : minus((100 * v).toFixed(dp)) + '%';
  function compact(v) {
    if (!isFinite(v)) return '–';
    const a = Math.abs(v);
    if (a >= 1e12) return +(v / 1e12).toPrecision(3) + 'T';
    if (a >= 1e9) return +(v / 1e9).toPrecision(3) + 'B';
    if (a >= 1e6) return +(v / 1e6).toPrecision(3) + 'M';
    if (a >= 1e4) return +(v / 1e3).toPrecision(3) + 'k';
    return minus(String(+v.toPrecision(3)));
  }

  let colorCache = null;
  function colors() {
    if (colorCache) return colorCache;
    const s = getComputedStyle(document.documentElement), g = k => s.getPropertyValue(k).trim();
    colorCache = { ink: g('--ink'), muted: g('--muted'), line: g('--line'), grid: g('--grid'), pop: g('--pop'), bg: g('--bg'),
      means: g('--means'), soft: g('--means-soft'), curve: g('--curve'), curveSoft: g('--curve-soft'), alt: g('--alt'),
      surface: g('--surface'), mono: g('--mono') || 'monospace' };
    return colorCache;
  }
  const resetColors = () => { colorCache = null; };

  function prep(canvas) {
    const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    return { ctx, w, h, visible: r.width > 0 };
  }
  function niceStep(span, m) { const raw = span / m, mag = 10 ** Math.floor(Math.log10(raw)), n = raw / mag; return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag; }
  function niceTicks(a, b, m) {
    if (!(b > a)) return [];
    const step = niceStep(b - a, m), out = [];
    const dp = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + step * 1e-6; v += step) {
      const vv = Math.abs(v) < step / 1e6 ? 0 : v;
      out.push({ v: vv, s: Math.abs(vv) >= 1e4 ? compact(vv) : minus(vv.toFixed(dp)) });
    }
    return out;
  }
  function logTicks(a, b) {
    const out = [], e0 = Math.floor(Math.log10(a)), e1 = Math.ceil(Math.log10(b));
    const ms = e1 - e0 <= 2 ? [1, 2, 5] : [1];
    for (let e = e0; e <= e1; e++) for (const m of ms) { const v = m * 10 ** e; if (v >= a * 0.999 && v <= b * 1.001) out.push({ v, s: compact(v) }); }
    return out;
  }
  /* Draws axes + grid and returns scales. o: {x:[a,b], y:[c,d], xlog, yTicks, yFmt, xFmt, pad, xLabel, yLabel, xTicks} */
  function plot(canvas, o) {
    const { ctx, w, h } = prep(canvas), c = colors();
    const pad = Object.assign({ l: o.yTicks === false ? 12 : 46, r: 14, t: 14, b: 26 }, o.pad || {});
    const L = pad.l, R = w - pad.r, T = pad.t, B = h - pad.b;
    const [xa, xb] = o.x, [ya, yb] = o.y;
    const X = o.xlog ? v => L + (Math.log(v) - Math.log(xa)) / (Math.log(xb) - Math.log(xa)) * (R - L) : v => L + (v - xa) / (xb - xa) * (R - L);
    const Y = v => B - (v - ya) / (yb - ya) * (B - T);
    ctx.font = `11px ${c.mono}`; ctx.lineWidth = 1;
    if (o.yTicks !== false) {
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (const t of niceTicks(ya, yb, Math.max(2, Math.floor((B - T) / 48)))) {
        const y = Math.round(Y(t.v)) + 0.5;
        ctx.strokeStyle = c.grid; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(R, y); ctx.stroke();
        ctx.fillStyle = c.muted; ctx.fillText(o.yFmt ? o.yFmt(t.v) : t.s, L - 7, y);
      }
    }
    ctx.strokeStyle = c.line; ctx.beginPath(); ctx.moveTo(L, B + 0.5); ctx.lineTo(R, B + 0.5); ctx.stroke();
    if (o.xTicks !== false) {
      const xt = o.xlog ? logTicks(xa, xb) : niceTicks(xa, xb, Math.max(3, Math.floor((R - L) / 80)));
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = c.muted;
      for (const t of xt) { const x = Math.round(X(t.v)) + 0.5; ctx.beginPath(); ctx.moveTo(x, B); ctx.lineTo(x, B + 4); ctx.stroke(); ctx.fillText(o.xFmt ? o.xFmt(t.v) : t.s, x, B + 7); }
    }
    ctx.fillStyle = c.muted;
    if (o.xLabel) { ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(o.xLabel, R, B - 4); }
    if (o.yLabel) { ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(o.yLabel, L + 6, T); }
    return { ctx, w, h, c, X, Y, L, R, T, B };
  }
  function clip(p) { p.ctx.save(); p.ctx.beginPath(); p.ctx.rect(p.L, p.T - 4, p.R - p.L, p.B - p.T + 4); p.ctx.clip(); }
  function unclip(p) { p.ctx.restore(); }
  function path(ctx, pts, color, width = 2, dash = null, alpha = 1) {
    if (pts.length < 2) return;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.globalAlpha = alpha;
    ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  function fnPath(p, f, a, b, color, width = 2, dash = null, n = 240, log = false) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const x = log ? a * (b / a) ** (i / n) : a + (b - a) * i / n;
      const y = f(x); if (isFinite(y)) pts.push([p.X(x), p.Y(y)]);
    }
    path(p.ctx, pts, color, width, dash);
  }
  function hline(p, v, color, label, dash = [4, 4]) {
    const y = Math.round(p.Y(v)) + 0.5, ctx = p.ctx;
    ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(p.L, y); ctx.lineTo(p.R, y); ctx.stroke(); ctx.setLineDash([]);
    if (label) { ctx.fillStyle = color; ctx.font = `11px ${p.c.mono}`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(label, p.R - 2, y - 3); }
  }
  function vline(p, v, color, label, dash = [4, 4]) {
    const x = Math.round(p.X(v)) + 0.5, ctx = p.ctx;
    ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x, p.T); ctx.lineTo(x, p.B); ctx.stroke(); ctx.setLineDash([]);
    if (label) { ctx.fillStyle = color; ctx.font = `11px ${p.c.mono}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(label, x + 4, p.T); }
  }
  /* Histogram bars in data coords: counts over bins [start + j*bw] */
  function bars(p, counts, start, bw, color, alpha = 0.72) {
    const ctx = p.ctx, gap = (p.X(start + bw) - p.X(start)) > 6 ? 1 : 0;
    ctx.fillStyle = color; ctx.globalAlpha = alpha;
    for (let j = 0; j < counts.length; j++) {
      if (!counts[j]) continue;
      const x0 = p.X(start + j * bw), x1 = p.X(start + (j + 1) * bw), y = Math.max(p.T - 4, p.Y(counts[j]));
      ctx.fillRect(x0 + gap / 2, y, Math.max(1, x1 - x0 - gap), p.B - y);
    }
    ctx.globalAlpha = 1;
  }
  function message(p, text) {
    const ctx = p.ctx; ctx.fillStyle = p.c.muted; ctx.font = `14px ${p.c.mono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, (p.L + p.R) / 2, (p.T + p.B) / 2);
  }
  /* Log-spaced sample indices 1..max for drawing long running series */
  function logIndex(max) { const out = []; let i = 1; while (i <= max) { out.push(i); i = Math.max(i + 1, Math.round(i * 1.012)); } return out; }

  /* Animation: fn runs once per frame while it returns true. */
  function animator(onChange) {
    let on = false, fn = null;
    function tick() { if (!on) return; let more = false; try { more = fn(); } catch (e) { on = false; console.error(e); } if (more === false) { on = false; onChange && onChange(false); return; } requestAnimationFrame(tick); }
    return {
      start(f) { fn = f; if (!on) { on = true; onChange && onChange(true); requestAnimationFrame(tick); } },
      stop() { if (on) { on = false; onChange && onChange(false); } },
      get running() { return on; }
    };
  }
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* DOM helpers */
  const qs = (root, s) => root.querySelector(s);
  function set(root, key, text) { const el = root.querySelector(`[data-s="${key}"]`); if (el) el.textContent = text; }
  const stat = (key, label, pred) => `<div class="stat"><span class="k">${label}</span><span class="v" data-s="${key}">–</span>${pred != null ? `<span class="p">${pred}</span>` : ''}</div>`;
  const pred = key => `<b data-s="${key}">–</b>`;
  function chips(root, sel, onPick) {
    const box = root.querySelector(sel);
    const pick = v => { for (const b of box.children) b.setAttribute('aria-pressed', b.dataset.v === String(v) ? 'true' : 'false'); };
    box.addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b) return; pick(b.dataset.v); onPick(b.dataset.v); });
    return pick;
  }
  const chipHtml = (items, cur) => items.map(([v, t]) => `<button type="button" class="chip" data-v="${v}" aria-pressed="${String(v) === String(cur)}">${t}</button>`).join('');
  function runLabel(btn, running, idle = 'Run') { btn.textContent = running ? 'Pause' : idle; }
  const layout = o => `
    <header class="sim-head"><div class="eyebrow">${o.eyebrow}</div><h1>${o.title}</h1><p class="lede">${o.lede}</p></header>
    <div class="bench"><aside class="controls" aria-label="Controls">${o.controls}</aside><div class="charts">${o.charts}</div></div>
    <section class="notes">${o.notes}</section>`;
  const panel = (title, right, body) => `<div class="panel"><div class="panel-head"><h2>${title}</h2>${right || ''}</div>${body}</div>`;
  const legend = items => `<div class="legend">${items.map(([cls, color, t]) => `<span><i class="${cls}" style="--c: var(${color})"></i>${t}</span>`).join('')}</div>`;

  return { gauss, npdf, poisson, poissonPmf, binomPmf, lgamma, mulberry, fmt, int, pct, compact, colors, resetColors, prep, niceTicks, logTicks,
    plot, clip, unclip, path, fnPath, hline, vline, bars, message, logIndex, animator, reduced, qs, set, stat, pred, chips, chipHtml, runLabel, layout, panel, legend };
})();

/* Registry + router. Each simulation registers {id, group, title, html(), init(root) -> {render, stop}}. */
const Lab = (() => {
  const sims = [], built = new Map();
  let active = null;
  const GROUPS = ['Central limit theorem', 'Surprising results', 'Monte Carlo & random processes', 'Going further'];
  const register = d => sims.push(d);

  function buildNav() {
    const nav = document.getElementById('nav');
    nav.innerHTML = GROUPS.map(g => `<div class="nav-group"><div class="nav-label">${g}</div><div class="nav-items">${
      sims.filter(s => s.group === g).map(s => `<a class="chip" href="#${s.id}" data-id="${s.id}">${s.short || s.title}</a>`).join('')}</div></div>`).join('');
  }
  function show(id) {
    const def = sims.find(s => s.id === id) || sims[0];
    if (active && active.def === def) return;
    if (active) { try { active.inst.stop && active.inst.stop(); } catch (e) { console.error(e); } active.el.hidden = true; }
    let b = built.get(def.id);
    if (!b) {
      const el = document.createElement('section');
      el.className = 'sim'; el.id = 'sim-' + def.id; el.setAttribute('aria-label', def.title);
      el.innerHTML = def.html();
      document.getElementById('stage').appendChild(el);
      let inst = {};
      try { inst = def.init(el) || {}; } catch (e) { console.error(e); }
      b = { def, el, inst }; built.set(def.id, b);
    }
    b.el.hidden = false; active = b;
    for (const a of document.querySelectorAll('#nav a')) a.toggleAttribute('aria-current', false), a.dataset.id === def.id && a.setAttribute('aria-current', 'page');
    render();
  }
  function render() { if (active && active.inst.render) requestAnimationFrame(() => { try { active.inst.render(); } catch (e) { console.error(e); } }); }
  const refresh = () => { U.resetColors(); render(); };
  function boot() {
    buildNav();
    const route = () => show((location.hash || '').slice(1));
    window.addEventListener('hashchange', route);
    window.addEventListener('resize', render);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refresh);
    new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
    route();
  }
  return { register, boot, render };
})();
