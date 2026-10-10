/* ---------- Share card (v24) ----------
   One tap on a finished day makes an image: days to race, the score, the session and what you did.
   It is drawn on a canvas right here on the phone (1080 × 1920 story or 1080 × 1080 square), then handed to the phone's
   share menu (navigator.share with the file: WhatsApp, Instagram Stories, Save Image) or downloaded.
   The score on the card is the workout score by default: the day's score without Fuel, scaled to 100, because Fuel is
   logged through the day and a morning share would otherwise look low. "Full day" and "Hide" are the other choices.
   No week bars, streak or training-partner line (v25). Choices (size, look, score, exercises, my name) are remembered on the device in hx.share. Notes, body weight and
   nutrition never go on the card. */
let SHARE = null; // { date, pid, size, look, score, ex, names, url, file, tok }
const scoreWord = v => v >= 85 ? 'Crushing it' : v >= 70 ? 'Strong day' : v >= 50 ? 'Solid' : v >= 25 ? 'Getting there' : v > 0 ? 'Started' : 'Not started yet';
function workoutScore(pid, date) { // the day's score without Fuel, out of 100
  const s = dayScore(pid, date); if (!s || s.score == null) return null;
  const ps = s.parts.filter(x => x.label !== 'Fuel'), mx = sum(ps.map(x => x.max));
  const v = mx ? Math.round(100 * sum(ps.map(x => x.pts)) / mx) : s.score;
  return { score: v, label: scoreWord(v), full: s.score, fullLabel: s.label, hasFuel: s.parts.some(x => x.label === 'Fuel') };
}
const shareTitle = (p, date) => { if (p.rest) return 'Rest day'; const h = (S.days[date] || {}).heading || p.session || ''; return h.includes(' · ') ? h.split(' · ').pop() : h; };
function shareData(pid, date, o) {
  const p = P(date), l = getLog(date, pid) || {}, day = S.days[date] || {}, race = RACE(), t = todayISO();
  const ws = workoutScore(pid, date) || { score: 0, label: '', full: 0, fullLabel: '' };
  const st = dayState(pid, date);
  const d = { brand: 'HYROX Training', dateLine: (o.names ? pname(pid) + ' · ' : '') + fmtDate(date), days: diffDays(date, race), raceLine: fmtDate(race) + ' ' + race.slice(0, 4), title: shareTitle(p, date), pills: [], stats: [], lists: [] };
  d.score = o.score === 'off' ? null : o.score === 'day' ? { v: ws.full || 0, w: ws.fullLabel, lab: date === t ? 'Today’s score' : 'Day score' } : { v: ws.score || 0, w: ws.label, lab: 'Workout score' };
  // pills: how it went, tests, where in the plan
  if (doneStates.has(st)) d.pills.push({ t: '✓ ' + (st === 'complete' ? 'Completed' : st === 'modified' ? 'Modified' : 'Logged'), k: 'ok' });
  else if (st === 'restdone') d.pills.push({ t: '✓ Recovered', k: 'ok' });
  if (p.tests.length) d.pills.push({ t: p.tests.length + (p.tests.length > 1 ? ' tests' : ' test'), k: 't' });
  d.pills.push({ t: (day.week ? 'Week ' + day.week : 'Kick-off week') + ' · Day ' + (S.order.indexOf(date) + 1) + ' of ' + S.order.length, k: '' });
  // numbers
  if (p.rest) {
    const r = l.rest || {}, acts = (r.acts || []).filter(a => a !== 'rest');
    if (r.min) d.stats.push({ big: String(r.min), unit: 'min', sub: 'recovery' });
    if (l.time) d.stats.push({ big: String(l.time), unit: 'min', sub: 'active' });
    const names = Object.fromEntries(typeof REST_ACTS !== 'undefined' ? REST_ACTS : []);
    const rows = (r.acts || []).map(a => [names[a] || a, '']);
    if (rows.length) d.lists.push({ h: 'What I did', rows });
  } else {
    let tot = 0, dn = 0, vol = 0;
    p.strength.forEach((ex, i) => { tot += ex.sets || 1; ((((l.str || {})[i] || {}).s) || []).forEach(x => { if (!x || !x.d) return; dn++; const w = num(x.w), r = num(x.r); if (w > 0 && r && !['s', 'm', 'min'].includes(ex.unit)) vol += r * w * (ex.dual ? 2 : 1); }); });
    if (p.strength.length) d.stats.push({ big: String(dn), unit: '/' + tot, sub: 'sets' });
    if (vol) d.stats.push({ big: Math.round(vol).toLocaleString('en-IN'), unit: 'kg', sub: 'lifted' });
    const runs = l.runs || [], km = sum(runs.map(r => r.dist || 0)), timed = runs.filter(r => r.dist && r.time);
    const pace = timed.length ? sum(timed.map(r => r.time)) / sum(timed.map(r => r.dist)) : null;
    if (km) d.stats.push({ big: fmtKm(km), unit: 'km', sub: pace ? 'run · ' + fmtPace(pace) + '/km' : 'running' });
    if (l.simTotal) d.stats.push({ big: String(l.simTotal), unit: '', sub: 'on the clock' });
    if (l.time) d.stats.push({ big: String(l.time), unit: 'min', sub: l.rpe ? 'effort RPE ' + l.rpe : 'session' });
    else if (l.rpe) d.stats.push({ big: String(l.rpe), unit: '/10', sub: 'effort (RPE)' });
    // tests first: they are the headline of a test day
    if (p.tests.length) d.lists.push({ h: 'Tests', rows: p.tests.map(tb => { const r = benchVal(pid, tb.id), bs = benchStatus(tb, r); return [tb.name, r && r.v ? r.v + (tb.kind === 'reps' ? ' reps' : '') : '–', bs ? (bs.cls === 'ok' ? 'good' : 'bad') : '', 'target ' + tb.target]; }) });
    if (o.ex && p.strength.length) {
      const rows = [];
      exOrder(date, l).forEach(i => {
        const ex = p.strength[i], s = ((((l.str || {})[i] || {}).s) || []).filter(x => x && x.d); if (!s.length) return;
        const reps = (() => { const c = {}; s.forEach(x => { const r = num(x.r); if (r) c[r] = (c[r] || 0) + 1; }); const k = Object.keys(c).sort((a, b) => c[b] - c[a])[0]; return k != null ? k : ex.reps; })();
        const w = Math.max(0, ...s.map(x => num(x.w) || 0)), u = ex.unit === 's' ? ' s' : ex.unit === 'm' ? ' m' : '';
        rows.push([ex.name.replace(/\s*\(.*?\)/g, ''), s.length + ' × ' + (reps != null ? reps : '') + u + (w ? ' · ' + w + ' kg' : ex.bw ? ' · BW' : '')]);
      });
      if (rows.length) d.lists.push({ h: 'What I did', rows });
    }
    if (o.ex && !p.hyrox.none) {
      const hx = l.hx || {}, rows = [];
      p.hyrox.rows.forEach(r => {
        if (r.kind !== 'station' || r.test) return; const e = hx[r.i]; if (!e || !(e.d || e.time)) return;
        const sub = String(r.sub || '').split(' · ').slice(0, 2).join(' · ').replace(/\babout\s+/gi, '≈').replace(/\s+total\b/gi, '').replace(/\bbodyweight\b/gi, 'BW').replace(/\s+reps\b/gi, '');
        rows.push([r.title, e.time ? String(e.time) : sub]);
      });
      if (rows.length) d.lists.push({ h: 'Stations', rows });
    }
  }
  // v25: no week bars, streak or training-partner line on the card
  return d;
}

/* ---- drawing ---- */
const SHARE_THEME = {
  dark: { bg: '#0B1024', surface: '#141A36', surface2: '#1A2144', ink: '#EEF2FF', ink2: '#C9D2F5', muted: '#9FABD8', line: '#262E57', line2: '#3A4370', head: '#8FB5FF', done: '#4FD69C', doneT: '#10352E', doneL: 'rgba(79,214,156,.45)', test: '#FFC24F', testT: '#3A2C12', testL: 'rgba(255,194,79,.45)', miss: '#FF7C68', label: '#FF7DBE', txt: ['#FF8A4C', '#FF62B0', '#B08FFF'], empty: '#2A3366', rest: '#4FD69C' },
  light: { bg: '#EEF1FB', surface: '#FFFFFF', surface2: '#F3F6FE', ink: '#162B6E', ink2: '#2B4383', muted: '#4F6392', line: '#D5DDF1', line2: '#B3C0DE', head: '#3035C2', done: '#0E7843', doneT: '#DDF4E7', doneL: 'rgba(14,120,67,.35)', test: '#9A5A00', testT: '#FDF0D8', testL: 'rgba(154,90,0,.35)', miss: '#C0301F', label: '#B8155F', txt: ['#D8420C', '#C81769', '#6522D6'], empty: '#D5DDF1', rest: '#0E7843' }
};
const SH_FILL = ['#E0440C', '#D3196F', '#6B24DE'];
const SH_FONT = { d: '"Big Shoulders Display", "Arial Narrow", Impact, sans-serif', b: '"IBM Plex Sans", system-ui, -apple-system, sans-serif', m: '"IBM Plex Mono", ui-monospace, Menlo, monospace' };
function drawShare(d, o) {
  const T = SHARE_THEME[o.look] || SHARE_THEME.dark, sq = o.size === 'square', W = 1080, H = sq ? 1080 : 1920, k = 3;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const font = (w, px, f) => { g.font = w + ' ' + Math.round(px * k) + 'px ' + SH_FONT[f]; };
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const lin = (x0, y0, x1, y1, cols) => { const gr = g.createLinearGradient(x0, y0, x1, y1); cols.forEach((cl, i) => gr.addColorStop(i / (cols.length - 1), cl)); return gr; };
  const fit = (txt, maxW) => { let s = String(txt); if (g.measureText(s).width <= maxW) return s; while (s.length > 1 && g.measureText(s + '…').width > maxW) s = s.slice(0, -1); return s.trimEnd() + '…'; };
  const gradText = (txt, x, y, align) => { const w = g.measureText(txt).width, x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x; g.fillStyle = lin(x0, y, x0 + w, y, T.txt); g.textAlign = 'left'; g.fillText(txt, x0, y); };
  // background
  if (o.look === 'light') { g.fillStyle = lin(0, 0, W * 0.45, H, ['#E2ECFF', '#ECE8FF', '#FFEDE3']); g.fillRect(0, 0, W, H); }
  else {
    g.fillStyle = T.bg; g.fillRect(0, 0, W, H);
    const glow = (x, y, r, col) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); };
    glow(0, -0.04 * H, 1.15 * W, 'rgba(42,33,112,.95)'); glow(W * 1.05, H * 0.18, 1.0 * W, 'rgba(10,54,86,.9)');
  }
  const X = 18 * k, CW = W - 2 * X; let y = 20 * k;
  g.textBaseline = 'alphabetic';
  // top row: brand and name · date
  font(800, 17, 'd'); gradText(d.brand.toUpperCase(), X, y + 14 * k);
  font(500, 12.5, 'b'); g.fillStyle = T.ink2; g.textAlign = 'right'; g.fillText(fit(d.dateLine, CW * 0.55), X + CW, y + 13 * k); g.textAlign = 'left';
  y += 28 * k;
  // hero: days to race + score
  const HH = (sq ? 140 : 160) * k, gap = 10 * k, cw = d.score ? (CW - gap) * 1.1 / 2.1 : CW;
  rr(X, y, cw, HH, 16 * k); g.fillStyle = lin(X, y + HH, X + cw, y, SH_FILL); g.fill();
  const hl = g.createRadialGradient(X + cw * 0.2, y - HH * 0.1, 0, X + cw * 0.2, y - HH * 0.1, cw * 0.8); hl.addColorStop(0, 'rgba(255,255,255,.22)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = hl; g.fill();
  g.fillStyle = '#FFFFFF';
  const big = d.days > 0 ? String(d.days) : d.days === 0 ? 'RACE' : '✓';
  font(800, sq ? 60 : 64, 'd'); g.fillText(big, X + 14 * k, y + (sq ? 62 : 66) * k);
  font(800, 17, 'd'); g.fillText(d.days > 0 ? (d.days === 1 ? 'DAY TO RACE' : 'DAYS TO RACE') : d.days === 0 ? 'DAY. GO.' : 'RACE DONE', X + 14 * k, y + (sq ? 88 : 94) * k);
  if (!sq) { font(500, 11.5, 'b'); g.globalAlpha = 0.92; g.fillText(d.raceLine, X + 14 * k, y + 111 * k); g.globalAlpha = 1; }
  if (d.score) {
    const sx = X + cw + gap, sw = CW - cw - gap, cx = sx + sw / 2;
    rr(sx, y, sw, HH, 16 * k); g.fillStyle = T.surface; g.fill(); g.lineWidth = 1.5 * k; g.strokeStyle = lin(sx, y + HH, sx + sw, y, SH_FILL); g.stroke();
    let ry = y + HH / 2 + (sq ? -4 : 2) * k; const R = (sq ? 31 : 34) * k, th = 7.5 * k;
    if (!sq) { font(600, 11, 'b'); g.fillStyle = T.muted; g.textAlign = 'center'; g.fillText(d.score.lab.toUpperCase(), cx, y + 24 * k); g.textAlign = 'left'; }
    g.lineCap = 'round'; g.lineWidth = th; g.strokeStyle = T.line; g.beginPath(); g.arc(cx, ry, R, 0, Math.PI * 2); g.stroke();
    const frac = Math.max(0, Math.min(1, (d.score.v || 0) / 100));
    if (frac > 0) { const a0 = -Math.PI / 2; g.strokeStyle = typeof g.createConicGradient === 'function' ? (() => { const cg = g.createConicGradient(a0, cx, ry); cg.addColorStop(0, T.txt[0]); cg.addColorStop(0.45, T.txt[1]); cg.addColorStop(1, T.txt[2]); return cg; })() : lin(cx - R, ry, cx + R, ry, T.txt); g.beginPath(); g.arc(cx, ry, R, a0, a0 + Math.PI * 2 * frac); g.stroke(); }
    g.lineCap = 'butt';
    font(800, sq ? 31 : 38, 'd'); gradText(String(d.score.v), cx, ry + (sq ? 11 : 13) * k, 'center');
    font(700, 13, 'b'); g.fillStyle = T.label; g.textAlign = 'center'; g.fillText(fit(d.score.w || '', sw - 12 * k), cx, y + HH - (sq ? 14 : 16) * k); g.textAlign = 'left';
  }
  y += HH + 12 * k;
  // title: shrink to fit, then two lines if it still doesn't
  g.fillStyle = T.head; let ts = sq ? 28 : 31; const title = d.title.toUpperCase();
  font(800, ts, 'd'); while (g.measureText(title).width > CW && ts > 22) { ts -= 1; font(800, ts, 'd'); }
  if (g.measureText(title).width <= CW) { g.fillText(title, X, y + ts * 0.8 * k); y += ts * 0.9 * k; }
  else { const wds = title.split(' '); let a = ''; while (wds.length && g.measureText((a + ' ' + wds[0]).trim()).width <= CW) a = (a + ' ' + wds.shift()).trim(); g.fillText(a, X, y + ts * 0.8 * k); g.fillText(fit(wds.join(' '), CW), X, y + ts * 1.7 * k); y += ts * 1.8 * k; }
  // pills
  {
    y += 6 * k; let px = X; font(600, 11, 'b');
    d.pills.forEach(pl => {
      const w = g.measureText(pl.t).width + 16 * k, h = 20 * k; if (px + w > X + CW) { px = X; y += h + 5 * k; }
      rr(px, y, w, h, h / 2); g.fillStyle = pl.k === 'ok' ? T.doneT : pl.k === 't' ? T.testT : T.surface2; g.fill(); g.lineWidth = 1 * k; g.strokeStyle = pl.k === 'ok' ? T.doneL : pl.k === 't' ? T.testL : T.line2; g.stroke();
      g.fillStyle = pl.k === 'ok' ? T.done : pl.k === 't' ? T.test : T.ink2; g.fillText(pl.t, px + 8 * k, y + 14 * k); px += w + 6 * k;
    });
    y += 20 * k;
  }
  y += 9 * k;
  // number tiles
  const stats = d.stats.slice(0, sq ? 3 : 4), cols = sq ? Math.max(1, stats.length) : 2, tg = 8 * k, tw = (CW - (cols - 1) * tg) / cols, thh = 54 * k;
  stats.forEach((s, i) => {
    const tx = X + (i % cols) * (tw + tg), ty = y + Math.floor(i / cols) * (thh + tg);
    rr(tx, ty, tw, thh, 12 * k); g.fillStyle = T.surface; g.fill(); g.lineWidth = 1 * k; g.strokeStyle = T.line; g.stroke();
    font(800, 25, 'd'); g.fillStyle = T.ink; const bw = g.measureText(s.big).width; g.fillText(s.big, tx + 11 * k, ty + 27 * k);
    if (s.unit) { font(800, 15, 'd'); g.fillStyle = T.ink2; g.fillText(s.unit, tx + 11 * k + bw + 2 * k, ty + 27 * k); }
    font(500, 11.5, 'b'); g.fillStyle = T.muted; g.fillText(fit(s.sub, tw - 20 * k), tx + 11 * k, ty + 45 * k);
  });
  if (stats.length) y += Math.ceil(stats.length / cols) * (thh + tg) + 2 * k;
  const maxY = H - 18 * k;
  // lists (story only), cut to what fits
  if (!sq) d.lists.forEach(li => {
    const rowH = 21 * k, head = 24 * k, pad = 8 * k; const room = Math.floor((maxY - y - head - pad) / rowH);
    if (room < Math.min(2, li.rows.length)) return; // not even two rows fit: leave this list off rather than show just "+ more"
    let rows = li.rows.slice(0, room); if (li.rows.length > room) rows = li.rows.slice(0, room - 1).concat([['+ ' + (li.rows.length - room + 1) + ' more', '', 'muted']]);
    const hh = head + rows.length * rowH + pad; rr(X, y, CW, hh, 12 * k); g.fillStyle = T.surface; g.fill(); g.lineWidth = 1 * k; g.strokeStyle = T.line; g.stroke();
    font(700, 10.5, 'b'); g.fillStyle = T.muted; g.fillText(li.h.toUpperCase(), X + 12 * k, y + 17 * k);
    rows.forEach((r, i) => {
      const ry = y + head + i * rowH; if (i) { g.fillStyle = T.line; g.fillRect(X + 12 * k, ry, CW - 24 * k, 1 * k); }
      font(500, 12.5, 'm'); let right = r[1] || '', rw = g.measureText(right).width, tail = r[3] ? ' · ' + r[3] : '';
      font(500, 11, 'b'); let tw2 = tail ? g.measureText(tail).width : 0;
      font(500, 12.5, 'b'); const lw = Math.min(g.measureText(r[0]).width, CW * 0.5);
      if (lw + rw + tw2 + 34 * k > CW) { tail = ''; tw2 = 0; } // the name comes first; drop the target if both don't fit
      font(500, 12.5, 'b'); g.fillStyle = r[2] === 'muted' ? T.muted : T.ink; g.fillText(fit(r[0], CW - 24 * k - rw - tw2 - 10 * k), X + 12 * k, ry + 15 * k);
      if (tail) { font(500, 11, 'b'); g.fillStyle = T.muted; g.textAlign = 'right'; g.fillText(tail, X + CW - 12 * k, ry + 15 * k); g.textAlign = 'left'; }
      font(500, 12.5, 'm'); g.fillStyle = r[2] === 'good' ? T.done : r[2] === 'bad' ? T.miss : T.ink2; g.textAlign = 'right'; g.fillText(right, X + CW - 12 * k - tw2, ry + 15 * k); g.textAlign = 'left';
    });
    y += hh + 8 * k;
  });
  return c;
}

/* ---- the sheet ---- */
function openShare(date) {
  if (!S.pid) { openWho(); return; }
  const prev = LS.get('hx.share', {}) || {};
  SHARE = Object.assign({ size: 'story', look: 'dark', score: 'workout', ex: true, names: true }, prev, { date: date || todayISO(), pid: S.pid, url: null, file: null, tok: 0 });
  openSheet('share'); shareDraw();
}
async function shareDraw() {
  const o = SHARE; if (!o) return; const tok = o.tok = (o.tok || 0) + 1;
  try { await Promise.all(['800 60px "Big Shoulders Display"', '500 20px "IBM Plex Sans"', '700 20px "IBM Plex Sans"', '500 20px "IBM Plex Mono"'].map(f => document.fonts.load(f))); } catch (e) { }
  if (SHARE !== o || o.tok !== tok) return;
  let c; try { c = drawShare(shareData(o.pid, o.date, o), o); } catch (e) { console.error(e); toast('Couldn’t draw the image.'); return; }
  o.url = c.toDataURL('image/png'); o.file = null;
  if (SHEET && SHEET.kind === 'share') renderSheet();
  c.toBlob(b => {
    if (SHARE !== o || o.tok !== tok || !b) return;
    o.file = new File([b], 'hyrox-' + o.date + (o.size === 'square' ? '-square' : '-story') + '.png', { type: 'image/png' });
    if (SHEET && SHEET.kind === 'share') renderSheet();
  }, 'image/png');
}
function sheetShare() {
  const o = SHARE || {}, ws = o.pid ? workoutScore(o.pid, o.date) : null;
  const seg = (key, list) => '<div class="seg">' + list.map(([v, t]) => '<button data-a="sh-opt" data-k="' + key + '" data-v="' + v + '" aria-pressed="' + (o[key] === v) + '">' + t + '</button>').join('') + '</div>';
  const tog = (key, t) => '<button class="chip sh-tog" data-a="sh-opt" data-k="' + key + '" data-v="' + (o[key] ? '0' : '1') + '" aria-pressed="' + !!o[key] + '">' + I.check + t + '</button>';
  const fld = (lab, h) => '<div class="field"><span>' + lab + '</span>' + h + '</div>';
  const note = ws && ws.hasFuel ? '<p class="small muted">Workout score leaves out Fuel, which you log through the day. Now: workout ' + ws.score + ', full day ' + ws.full + '.</p>' : '';
  const ready = !!o.file;
  return {
    title: 'Share ' + (o.date === todayISO() ? 'today' : esc(fmtDate(o.date))),
    body: '<div class="sh-wrap"><div class="sh-prev' + (o.size === 'square' ? ' sq' : '') + '">' + (o.url ? '<img id="sh-img" src="' + o.url + '" alt="Preview of the image to share">' : '<div class="sh-wait">Drawing…</div>') + '</div>' +
      '<div class="sh-opts">' + fld('Size', seg('size', [['story', 'Story'], ['square', 'Square']])) + fld('Look', seg('look', [['dark', 'Dark'], ['light', 'Light']])) + fld('Score', seg('score', [['workout', 'Workout'], ['day', 'Full day'], ['off', 'Off']])) + note +
      '<div class="chips">' + tog('ex', 'Exercises') + tog('names', 'My name') + '</div></div></div>' +
      '<div class="sh-btns"><button class="btn primary lg block" data-a="sh-share"' + (ready ? '' : ' disabled') + '>' + I.share + 'Share…</button><button class="btn block" data-a="sh-save"' + (ready ? '' : ' disabled') + '>Download image</button></div>' +
      '<p class="small muted" style="text-align:center;margin-top:8px">Share opens your phone’s menu: WhatsApp, Instagram Stories, or Save Image to put it in Photos. Your notes, weight and nutrition are never on the card.</p>'
  };
}
function shareSave(f) { const url = URL.createObjectURL(f), a = document.createElement('a'); a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
const SHARE_ACT = {
  share: el => { if (MODE) closeMode(); openShare(el.dataset.d || curDate()); },
  'sh-opt': el => {
    if (!SHARE) return; const key = el.dataset.k; let v = el.dataset.v; if (key === 'ex' || key === 'names') v = v === '1';
    SHARE[key] = v; LS.set('hx.share', { size: SHARE.size, look: SHARE.look, score: SHARE.score, ex: SHARE.ex, names: SHARE.names });
    SHARE.file = null; renderSheet(); shareDraw();
  },
  'sh-share': () => { // no await before navigator.share: iPhones only allow it straight from the tap
    const f = SHARE && SHARE.file; if (!f) return;
    if (navigator.canShare && navigator.share && navigator.canShare({ files: [f] })) navigator.share({ files: [f] }).catch(e => { if (!e || e.name !== 'AbortError') toast('Couldn’t open the share menu. Use Download image instead.'); });
    else { shareSave(f); toast('Image downloaded'); }
  },
  'sh-save': () => { const f = SHARE && SHARE.file; if (f) { shareSave(f); toast('Image downloaded'); } }
};

