/* ================= Charts (hand-drawn SVG, measured to fit) ================= */
const CHARTS = new Map(); let chartSeq = 0;
function chartBox(spec, h = 200) {
  const id = 'c' + (++chartSeq); CHARTS.set(id, spec);
  const leg = spec.legend !== false && spec.series.filter(s => s.name).length > 1
    ? '<div class="legend">' + spec.series.filter(s => s.name).map(s => '<span><i class="' + (s.ghost ? 'gh' : spec.type === 'line' ? 'ln' : '') + '" style="--c:' + s.color + '"></i>' + esc(s.name) + '</span>').join('') + '</div>' : '';
  return leg + '<div class="chart" data-chart="' + id + '" style="height:' + h + 'px" role="img" aria-label="' + esc(spec.label || '') + '"></div>';
}
function drawCharts() {
  $$('.chart[data-chart]').forEach(el => {
    const spec = CHARTS.get(el.dataset.chart); if (!spec) return;
    const w = Math.floor(el.clientWidth), h = el.clientHeight; if (!w) return;
    el.innerHTML = spec.type === 'bar' ? barSVG(spec, w, h) : lineSVG(spec, w, h);
  });
}
function niceTicks(lo, hi, n = 4) {
  if (lo === hi) { lo -= 1; hi += 1; }
  const span = hi - lo, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const err = step0 / mag; const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step; const t = [];
  for (let v = a; v <= b + step * 1e-6; v += step) t.push(+v.toFixed(6));
  return t;
}
function timeTicks(lo, hi, n = 4) {
  const steps = [5, 10, 15, 20, 30, 60, 120, 300, 600, 900, 1800, 3600];
  const span = Math.max(1, hi - lo); let step = steps.find(s => span / s <= n) || 3600;
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step; const t = [];
  for (let v = a; v <= b; v += step) t.push(v); return t;
}
function xLabelsEvery(n, W) { const max = Math.max(2, Math.floor(W / 46)); return Math.max(1, Math.ceil(n / max)); }
function lineSVG(sp, W, H) {
  const L = sp.padL || 46, R = 14, T = 12, B = 26, iw = W - L - R, ih = H - T - B;
  const vals = []; sp.series.forEach(s => s.vals.forEach(v => { if (v != null) vals.push(v); })); (sp.refs || []).forEach(r => vals.push(r.v));
  if (!vals.length) return '<svg width="' + W + '" height="' + H + '"><text x="' + (W / 2) + '" y="' + (H / 2) + '" text-anchor="middle">No data yet</text></svg>';
  let lo = sp.yMin != null ? sp.yMin : Math.min(...vals), hi = sp.yMax != null ? sp.yMax : Math.max(...vals);
  const pad = (hi - lo) * 0.12 || (sp.time ? 15 : 1); if (sp.yMin == null) lo -= pad; if (sp.yMax == null) hi += pad;
  if (sp.zero) lo = Math.min(0, lo);
  const ticks = sp.time ? timeTicks(lo, hi) : niceTicks(lo, hi); lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]);
  const n = sp.x.length; const xs = i => L + (n === 1 ? iw / 2 : i * iw / (n - 1));
  const ys = v => sp.invert ? T + (v - lo) / (hi - lo) * ih : T + ih - (v - lo) / (hi - lo) * ih;
  const f = sp.yFmt || (v => String(v));
  let g = '';
  ticks.forEach(t => { const y = ys(t); if (y < T - 1 || y > T + ih + 1) return; g += '<line class="ax" x1="' + L + '" x2="' + (L + iw) + '" y1="' + y + '" y2="' + y + '"/><text x="' + (L - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + esc(f(t)) + '</text>'; });
  const every = xLabelsEvery(n, iw);
  sp.x.forEach((lb, i) => { if (i % every && i !== n - 1) return; g += '<text x="' + xs(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(lb) + '</text>'; });
  (sp.refs || []).forEach(r => { const y = ys(r.v); g += '<line x1="' + L + '" x2="' + (L + iw) + '" y1="' + y + '" y2="' + y + '" stroke="var(--line-2)" stroke-width="1"/><text x="' + (L + iw) + '" y="' + (y - 5) + '" text-anchor="end" class="lbl-strong">' + esc(r.label) + '</text>'; });
  let lines = '', dots = '', hits = '';
  sp.series.forEach(s => {
    let d = '', pen = false;
    s.vals.forEach((v, i) => { if (v == null) { pen = sp.connect ? pen : false; return; } d += (pen ? 'L' : 'M') + xs(i).toFixed(1) + ' ' + ys(v).toFixed(1); pen = true; });
    if (s.area && d) { const first = s.vals.findIndex(v => v != null), last = s.vals.length - 1 - [...s.vals].reverse().findIndex(v => v != null); lines += '<path d="' + d + 'L' + xs(last) + ' ' + (T + ih) + 'L' + xs(first) + ' ' + (T + ih) + 'Z" fill="' + s.color + '" opacity=".1"/>'; }
    if (d) lines += '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"' + (s.muted ? ' opacity=".55"' : '') + '/>';
    const lastI = s.vals.length - 1 - [...s.vals].reverse().findIndex(v => v != null);
    s.vals.forEach((v, i) => {
      if (v == null) return;
      if (s.dots !== false || i === lastI) dots += '<circle cx="' + xs(i) + '" cy="' + ys(v) + '" r="' + (s.hl && s.hl[i] ? 6 : 4) + '" fill="' + (s.hl && s.hl[i] ? 'var(--accent)' : s.color) + '" stroke="var(--surface)" stroke-width="2"/>';
      const tip = (s.tips && s.tips[i]) || (sp.x[i] + (s.name ? ' · ' + s.name : '') + ': ' + f(v));
      hits += '<circle cx="' + xs(i) + '" cy="' + ys(v) + '" r="13" fill="transparent" data-tip="' + esc(tip) + '"/>';
    });
  });
  return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' + g + lines + dots + hits + '</svg>';
}
function barSVG(sp, W, H) {
  const L = sp.padL || 40, R = 10, T = 12, B = 26, iw = W - L - R, ih = H - T - B;
  const vals = []; sp.series.forEach(s => s.vals.forEach(v => { if (v != null) vals.push(v); }));
  const hi0 = vals.length ? Math.max(...vals) : 1; const ticks = niceTicks(0, hi0 || 1); const hi = ticks[ticks.length - 1] || 1;
  const n = sp.x.length, band = iw / n; const ys = v => T + ih - (v / hi) * ih; const f = sp.yFmt || (v => String(v));
  let g = '';
  ticks.forEach(t => { const y = ys(t); g += '<line class="ax" x1="' + L + '" x2="' + (L + iw) + '" y1="' + y + '" y2="' + y + '"/><text x="' + (L - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + esc(f(t)) + '</text>'; });
  const every = xLabelsEvery(n, iw);
  sp.x.forEach((lb, i) => { if (i % every && i !== n - 1) return; g += '<text x="' + (L + band * i + band / 2) + '" y="' + (H - 6) + '" text-anchor="middle"' + (sp.hlX === i ? ' class="lbl-strong"' : '') + '>' + esc(lb) + '</text>'; });
  const ghost = sp.series.filter(s => s.ghost), real = sp.series.filter(s => !s.ghost);
  const bw = Math.max(3, Math.min(24, (band * 0.72 - 2 * (real.length - 1)) / Math.max(1, real.length)));
  const gw = Math.min(band * 0.86, Math.max(bw * real.length + 2 * (real.length - 1) + 10, bw + 10));
  const rr = (x, y, w, h, c, extra) => { if (h <= 0.5) return ''; const r = Math.min(4, w / 2, h); return '<path d="M' + x + ' ' + (y + h) + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (y + h) + 'Z" fill="' + c + '"' + (extra || '') + '/>'; };
  let bars = '', hits = '';
  for (let i = 0; i < n; i++) {
    const cx = L + band * i + band / 2;
    ghost.forEach(s => { const v = s.vals[i]; if (v == null) return; bars += rr(cx - gw / 2, ys(v), gw, T + ih - ys(v), 'var(--plan-bar)'); });
    const tot = real.length * bw + (real.length - 1) * 2; let x = cx - tot / 2;
    real.forEach(s => { const v = s.vals[i]; if (v != null) bars += rr(x, ys(v), bw, T + ih - ys(v), s.color, sp.fade && sp.fade[i] ? ' opacity=".45"' : ''); x += bw + 2; });
    const tip = sp.tips ? sp.tips[i] : sp.x[i] + '\n' + sp.series.map(s => (s.name || '') + ': ' + (s.vals[i] == null ? '–' : f(s.vals[i]))).join('\n');
    hits += '<rect x="' + (L + band * i) + '" y="' + T + '" width="' + band + '" height="' + ih + '" fill="transparent" data-tip="' + esc(tip) + '"/>';
  }
  return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' + g + bars + hits + '</svg>';
}
let _rw = 0;
window.addEventListener('resize', debounce(() => { if (window.innerWidth !== _rw) { _rw = window.innerWidth; drawCharts(); } }, 150));

