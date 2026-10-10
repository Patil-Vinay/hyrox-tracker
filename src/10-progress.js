/* ================= Progress ================= */
const SUBS = [['week', 'Week'], ['score', 'Score'], ['running', 'Running'], ['strength', 'Strength'], ['stations', 'Stations'], ['tests', 'Tests'], ['race', 'Race'], ['streaks', 'Streaks'], ['badges', 'Badges'], ['journal', 'Journal'], ['body', 'Body']];
const viewPid = () => (S.route.pv && S.profiles[S.route.pv]) ? S.route.pv : S.pid;
function currentWeekN() { const t = todayISO(); if (S.days[t]) return S.days[t].week; return t < START() ? 1 : weekCount(); }
function personPicker() {
  const ids = peopleIds(); if (ids.length < 2) return '';
  const v = viewPid();
  return '<div class="seg" role="group" aria-label="Whose progress">' + ids.map(pid => '<button data-a="pv" data-v="' + pid + '" aria-pressed="' + (pid === v) + '"><span class="dot" style="--pc:' + pcolor(pid) + ';margin-right:6px;width:10px;height:10px"></span>' + esc(pname(pid)) + '</button>').join('') + '</div>';
}
function viewProgress() {
  if (!S.order.length) return loadingView();
  if (!S.pid) return '<div class="card"><p>Set up your profile first.</p><button class="btn primary" data-a="who" style="margin-top:10px">Set up profile</button></div>';
  const sub = S.route.sub || 'week';
  const nav = '<div class="scrollx"><div class="subnav" role="tablist">' + SUBS.map(s => '<button role="tab" data-a="sub" data-v="progress" data-s="' + s[0] + '" aria-pressed="' + (sub === s[0]) + '">' + s[1] + '</button>').join('') + '</div></div>';
  const fn = { week: pWeek, score: pScore, running: pRunning, strength: pStrength, stations: pStations, tests: pTests, race: pRace, streaks: pStreaks, badges: pBadges, journal: pJournal, body: pBody }[sub] || pWeek;
  return '<div class="row"><h2 class="disp" style="font-size:34px;text-transform:uppercase;flex:1">Progress</h2>' + personPicker() + '</div>' + nav + fn(viewPid());
}

/* ---------- Week ---------- */
let TREND_SUFFIX = 'vs last week';
function trendTxt(a, b, unit, d = 1) {
  if (b == null) return '';
  const x = a - b; if (Math.abs(x) < Math.pow(10, -d) / 2) return '<span class="tr muted">same as ' + TREND_SUFFIX.replace('vs ', '') + '</span>';
  return '<span class="tr ' + (x > 0 ? 'up' : 'down') + '">' + (x > 0 ? '▲ +' : '▼ −') + (d ? Math.abs(x).toFixed(d) : Math.round(Math.abs(x))) + (unit ? ' ' + unit : '') + ' ' + TREND_SUFFIX + '</span>';
}
function pWeek(pid) {
  const n = pickWeek();
  const w = weekDoc(n); const ws = weekStats(pid, n); const prev = n > 1 ? weekStats(pid, n - 1) : null;
  const t = todayISO(); const past = ws.dates.length && ws.dates[ws.dates.length - 1] < t; const started = ws.dates[0] <= t;
  let alert = '';
  if (started) {
    const expect = past ? ws.pkm : ws.pkmToDate;
    if (expect > 3 && ws.km < expect * 0.8) alert = '<div class="warnbox bad">' + I.warn.replace('<svg', '<svg width="22" height="22"') + '<div><b>Running volume is behind plan.</b>' + fmtKm(ws.km) + ' km logged against ' + fmtKm(expect) + ' km planned ' + (past ? 'for the week' : 'so far this week') + '.</div></div>';
    if (prev && past && ws.km < prev.km - 0.5 && ws.pkm >= prev.pkm) alert += '<div class="warnbox bad">' + I.warn.replace('<svg', '<svg width="22" height="22"') + '<div><b>Running dropped ' + fmtKm(prev.km - ws.km) + ' km from last week</b>while the plan went ' + (ws.pkm > prev.pkm ? 'up ' + fmtKm(ws.pkm - prev.pkm) + ' km' : 'unchanged') + '.</div></div>';
  }
  let cmp = prev; TREND_SUFFIX = 'vs last week';
  if (prev && started && !past) {
    const idx = ws.dates.filter(d => d <= t).length; const pd = prev.dates.slice(0, idx);
    cmp = { km: sum(pd.map(d => kmOn(pid, d))), runs: sum(pd.map(d => ((getLog(d, pid) || {}).runs || []).filter(r => r.dist).length)), min: sum(pd.map(d => (getLog(d, pid) || {}).time || 0)) };
    TREND_SUFFIX = 'vs same point last week';
  }
  const kmAlert = started && ws.km < (past ? ws.pkm : ws.pkmToDate) * 0.8 && (past ? ws.pkm : ws.pkmToDate) > 3;
  const tiles = '<div class="tiles">' +
    '<div class="tile' + (kmAlert ? ' alert' : '') + '"><span>Running</span><b>' + fmtKm(ws.km) + '<small>km</small></b><span class="pl">Plan ' + fmtKm(ws.pkm) + ' km</span>' + (cmp ? trendTxt(ws.km, cmp.km, 'km') : '') + '</div>' +
    '<div class="tile"><span>Runs</span><b>' + ws.runs + '<small>/ ' + ws.pruns + '</small></b><span class="pl">Planned ' + ws.pruns + '</span>' + (cmp ? trendTxt(ws.runs, cmp.runs, '', 0) : '') + '</div>' +
    '<div class="tile"><span>Sessions</span><b>' + ws.done + '<small>/ ' + ws.planned + '</small></b><span class="pl">' + ws.skipped + ' skipped · ' + ws.modified + ' modified</span></div>' +
    '<div class="tile"><span>Hard sessions</span><b>' + ws.hard + '<small>/ ' + ws.phard + '</small></b><span class="pl">RPE 7 or more</span></div>' +
    '<div class="tile"><span>Training time</span><b>' + (ws.min ? fmtMin(ws.min).replace(' min', '') : '0') + '<small>' + (ws.min >= 60 ? '' : 'min') + '</small></b><span class="pl">Plan ' + (ws.pmin ? fmtMin(ws.pmin) : '–') + '</span>' + (cmp ? trendTxt(ws.min, cmp.min, 'min', 0) : '') + '</div></div>';
  const rows = ws.dates.map(d => {
    const p = P(d), l = getLog(d, pid) || {}; const st = dayState(pid, d);
    return '<tr><td>' + esc(fmtDate(d)) + '</td><td class="wrap">' + esc(p.day.heading) + '</td><td><span class="stdot s-' + st + '"></span>' + (SHORT_STATE[st] || '') + '</td><td class="num mono">' + (p.day.km ? fmtKm(p.day.km) : '–') + '</td><td class="num mono">' + (kmOn(pid, d) ? fmtKm(kmOn(pid, d), 2) : '–') + '</td><td class="num mono">' + (l.rpe || '–') + '</td><td class="num mono">' + (l.time || '–') + '</td></tr>';
  }).join('');
  const wk = S.weekly[pid + '_w' + String(n).padStart(2, '0')] || {};
  const all = []; for (let i = 1; i <= weekCount(); i++) all.push(i);
  const stats = all.map(i => weekStats(pid, i));
  return '<div class="row"><button class="iconbtn" data-a="wk" data-v="' + (n - 1) + '" ' + (n > minWeek() ? '' : 'disabled') + ' aria-label="Previous week">' + I.left + '</button><div style="flex:1;text-align:center"><b class="disp" style="font-size:28px;text-transform:uppercase">' + weekName(n) + '</b><div class="small muted">' + esc(w ? w.dates + ' · ' + w.label : '') + '</div></div><button class="iconbtn" data-a="wk" data-v="' + (n + 1) + '" ' + (n < weekCount() ? '' : 'disabled') + ' aria-label="Next week">' + I.right + '</button></div>' +
    alert + tiles +
    '<div class="grid2 eq wk2"><section class="card"><div class="card-h"><h3>Day by day</h3></div><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Day</th><th>Session</th><th>Status</th><th class="num">Plan km</th><th class="num">Ran</th><th class="num">RPE</th><th class="num">Min</th></tr></thead><tbody>' + rows + '</tbody>' + wkFoot(pid, ws) + '</table></div></section>' +
    '<section class="card"><div class="card-h"><h3>Running by week</h3></div>' + chartBox({ type: 'bar', label: 'Weekly running, planned vs actual', x: all.map(i => 'W' + i), hlX: n - 1, series: [{ name: 'Planned', ghost: true, vals: stats.map(s => s.pkm) }, { name: 'Actual', color: pcolor(pid), vals: stats.map(s => s.dates[0] <= t ? +s.km.toFixed(1) : null) }], yFmt: v => v + '', tips: stats.map(s => 'Week ' + s.n + '\nPlanned ' + fmtKm(s.pkm) + ' km\nActual ' + fmtKm(s.km) + ' km') }, 280) + seasonSum(pid, stats) + '</section></div>' +
    '<section class="card"><div class="card-h"><h3>Week note</h3><span class="sp"></span>' + (pid !== S.pid ? '<span class="small muted">' + esc(pname(pid)) + '\'s note</span>' : '') + '</div>' +
    (pid === S.pid ? '<textarea class="inp" id="wnote-' + n + '" data-in="wnote" data-n="' + n + '" placeholder="Highlights, lessons, how the week felt">' + esc(wk.note || '') + '</textarea>' : '<p class="small">' + esc(wk.note || 'No note yet.') + '</p>') +
    (pid === S.pid && S.assets ? '<div class="row" style="margin-top:10px"><label class="btn sm">' + I.plus + (wk.photo ? 'Replace photo' : 'Add a photo') + '<input type="file" accept="image/*" id="wphoto" data-in="photo" data-n="' + n + '" hidden></label>' + (wk.photo ? '<button class="btn sm ghost" data-a="photo-del" data-n="' + n + '">Remove photo</button>' : '') + '</div>' : '') + '</section>' +
    (S.dl ? '<div class="row"><button class="btn" data-a="dl-week" data-n="' + n + '">Download printable summary</button><button class="btn" data-a="nav" data-v="together">Weekly recap card</button></div>' : '');
}

/* ---------- week table helpers ---------- */
const SHORT_STATE = { complete: 'Done', modified: 'Modified', skipped: 'Skipped', partial: 'Logged', missed: 'Missed', rest: 'Rest', restdone: 'Recovered', future: 'Upcoming', today: 'Today', none: '' };
function wkFoot(pid, ws) {
  const rp = ws.dates.map(d => (getLog(d, pid) || {}).rpe).filter(Boolean);
  return '<tfoot><tr><td colspan="3">Week total</td><td class="num mono">' + (ws.pkm ? fmtKm(ws.pkm) : '–') + '</td><td class="num mono">' + (ws.km ? fmtKm(ws.km, 1) : '–') + '</td><td class="num mono">' + (rp.length ? (sum(rp) / rp.length).toFixed(1) : '–') + '</td><td class="num mono">' + (ws.min || '–') + '</td></tr></tfoot>';
}
function seasonSum(pid, stats) {
  const t = todayISO(); const past = stats.filter(s => s.dates.length && s.dates[0] <= t);
  const km = sum(stats.map(s => s.km)) + (weekDates(0).length ? weekStats(pid, 0).km : 0), pkm = sum(stats.map(s => s.pkm)), runs = sum(stats.map(s => s.runs)) + (weekDates(0).length ? weekStats(pid, 0).runs : 0);
  const longest = Math.max(0, ...runsOf(pid).map(r => r.dist || 0));
  return '<div class="seasonsum"><div><span>Season so far</span><b>' + fmtKm(km) + '<small> km</small></b></div><div><span>Whole plan</span><b>' + fmtKm(pkm, 0) + '<small> km</small></b></div><div><span>Runs</span><b>' + runs + '</b></div><div><span>Longest</span><b>' + (longest ? fmtKm(longest) : '–') + '<small> km</small></b></div></div>';
}
/* ---------- 1 km reps: what to expect before any are logged ---------- */
function runTextOf(d) { const f = field(S.days[d], 'RUNNING'); return f ? [f.text || ''].concat(f.items || []).join(' ') : ''; }
function kmRepsEmpty(pid) {
  const t = todayISO(); const rp = rpPace(pid);
  const nx = S.order.find(d => d >= t && /\d+\s*×\s*1\s*km\b/.test(runTextOf(d)));
  const what = nx ? (runTextOf(nx).match(/\d+\s*×\s*1\s*km\b[^.;(—]*/) || [''])[0].trim().replace(/,$/, '') : '';
  const B = ((S.meta && S.meta.benchmarks) || []).find(b => /1\s*km/i.test(b.name));
  const r = B ? (((S.bench[pid] || {}).results || {})[B.id] || null) : null;
  return '<div class="target"><div class="tv"><span>Race pace · Plan ' + planOf(pid) + '</span><b>' + fmtPace(rp) + '</b><small>per km on race day</small></div>' +
    '<div class="tv' + (r && r.v ? ' me' : '') + '"><span>1 km time trial</span><b>' + esc(r && r.v ? r.v : '–') + '</b><small>' + (B ? (r && r.v ? esc(fmtDate(B.date)) : 'Test on ' + esc(fmtDate(B.date))) : 'Not in the plan') + '</small></div></div>' +
    (nx ? '<div class="nextup"><span class="eyebrow">First 1 km reps</span><b>' + esc(fmtDate(nx)) + ' · ' + esc(S.days[nx].heading) + '</b><span class="small muted">' + esc(what) + '</span><button class="btn sm" data-a="go-day" data-d="' + nx + '">Open day</button></div>' : '') +
    '<p class="small muted" style="margin-top:10px">Log the time of each 1 km rep on interval and simulation days and the average per session shows here, against your race pace.</p>';
}

/* ---------- Running ---------- */
function pRunning(pid) {
  const t = todayISO(); const all = []; for (let i = 1; i <= weekCount(); i++) all.push(i);
  const stats = all.map(i => weekStats(pid, i)); const runs = runsOf(pid);
  const pw = all.map(n => { const rs = runs.filter(r => S.days[r.date].week === n); const e = rs.filter(r => r.type === 'easy' || r.type === 'long'), q = rs.filter(r => !(r.type === 'easy' || r.type === 'long'));
    const avg = xs => { const d = sum(xs.map(r => r.dist)); return d ? sum(xs.map(r => r.time)) / d : null; }; return { e: avg(e), q: avg(q) }; });
  const longs = all.map(n => { const d = weekDates(n).find(x => S.days[x].kind === 'long'); return d ? { d, plan: S.days[d].km, act: kmOn(pid, d) || null } : { plan: null, act: null }; });
  const k1 = oneKmSplits(pid); const byDate = {};
  k1.forEach(x => { (byDate[x.date] = byDate[x.date] || []).push(x.t); });
  const k1d = Object.keys(byDate).sort();
  const rp = rpPace(pid);
  const zones = zonesFor(pid); const p5 = currentP5(pid);
  return '<div class="cgrid eq">' +
    '<section class="card"><div class="card-h"><h3>Weekly distance</h3></div>' + chartBox({ type: 'bar', label: 'Weekly distance', x: all.map(i => 'W' + i), series: [{ name: 'Planned', ghost: true, vals: stats.map(s => s.pkm) }, { name: 'Actual', color: pcolor(pid), vals: stats.map(s => s.dates[0] <= t ? +s.km.toFixed(1) : null) }], tips: stats.map(s => 'Week ' + s.n + '\nPlanned ' + fmtKm(s.pkm) + ' km\nActual ' + fmtKm(s.km) + ' km · ' + s.runs + ' runs') }, 220) + '</section>' +
    '<section class="card"><div class="card-h"><h3>Average pace</h3><span class="sp"></span><span class="small muted">faster ↑</span></div>' + chartBox({ type: 'line', label: 'Average pace by week', invert: true, time: true, x: all.map(i => 'W' + i), connect: true, series: [{ name: 'Easy & long', color: 'var(--k-long)', vals: pw.map(x => x.e) }, { name: 'Quality', color: 'var(--accent)', vals: pw.map(x => x.q) }], yFmt: v => fmtPace(v) }, 220) + '</section>' +
    '<section class="card"><div class="card-h"><h3>Long run</h3></div>' + chartBox({ type: 'line', label: 'Long run distance', x: all.map(i => 'W' + i), zero: true, series: [{ name: 'Planned', color: 'var(--line-2)', vals: longs.map(x => x.plan), dots: false, muted: true }, { name: 'Actual', color: pcolor(pid), vals: longs.map(x => x.act) }], yFmt: v => v + ' km' }, 220) + '</section>' +
    '<section class="card"><div class="card-h"><h3>1 km repeat pace</h3><span class="sp"></span><span class="small muted">faster ↑</span></div>' + (k1d.length ? chartBox({ type: 'line', label: '1 km split pace', invert: true, time: true, x: k1d.map(d => fmtDate(d, false)), refs: [{ v: rp, label: 'Plan ' + planOf(pid) + ' RP ' + fmtPace(rp) }], series: [{ name: 'Average 1 km', color: pcolor(pid), vals: k1d.map(d => sum(byDate[d]) / byDate[d].length), tips: k1d.map(d => fmtDate(d) + '\n' + byDate[d].length + ' × 1 km, avg ' + fmtPace(sum(byDate[d]) / byDate[d].length) + '\nBest ' + fmtPace(Math.min(...byDate[d]))) }], yFmt: v => fmtPace(v) }, 220) : kmRepsEmpty(pid)) + '</section></div>' +
    '<section class="card"><div class="card-h"><h3>Your pace zones</h3><span class="sp"></span><span class="small muted">' + (p5 ? 'From ' + esc(p5.from) : 'Defaults until your first run test') + '</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Zone</th><th>Pace</th><th>RPE</th><th>Talk test</th><th>Used for</th></tr></thead><tbody>' +
    zones.map(z => '<tr><td>' + esc(z.name) + '</td><td class="mono">' + esc(z.txt) + '</td><td>' + esc(z.rpe) + '</td><td>' + esc(z.talk) + '</td><td class="wrap">' + esc(z.use) + '</td></tr>').join('') + '</tbody></table></div></section>' +
    '<section class="card"><div class="card-h"><h3>Recent runs</h3></div>' + (runs.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Type</th><th class="num">km</th><th class="num">Time</th><th class="num">Pace</th><th class="num">RPE</th><th>Notes</th></tr></thead><tbody>' +
      runs.slice(-12).reverse().map(r => '<tr><td>' + esc(fmtDate(r.date)) + '</td><td>' + esc(runTypeName(r.type || 'other')) + '</td><td class="num mono">' + fmtKm(r.dist, 2) + '</td><td class="num mono">' + fmtTime(r.time) + '</td><td class="num mono">' + fmtPace(r.pace) + '</td><td class="num">' + (r.rpe || '–') + '</td><td class="wrap">' + esc(r.notes || '') + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="empty">No runs logged yet.</p>') + '</section>';
}

/* ---------- Strength ---------- */
function nextOccurrence(re) {
  const t = todayISO();
  for (const d of S.order) { if (d < t) continue; const p = P(d); const ex = p.strength.find(e => re.test(e.name)); if (ex) return { d, ex }; }
  return null;
}
function pStrength(pid) {
  const cards = LIFTS.map(L => {
    const hist = liftHistory(pid, L.key);
    if (!hist.length) {
      const nx = nextOccurrence(L.re);
      return '<section class="card"><div class="card-h"><h3>' + esc(L.name) + '</h3></div><p class="empty">' + (nx ? 'No sessions logged yet. Next: ' + esc(fmtDate(nx.d)) + ', ' + esc(nx.ex.name) + ' ' + nx.ex.sets + ' × ' + nx.ex.reps + (nx.ex.bw && !nx.ex.load ? ', bodyweight' : nx.ex.load != null ? ' at ' + (nx.ex.added ? '+' : '') + nx.ex.load + ' kg' : '') + '.' : L.key === 'legpress' ? 'Leg press isn\'t in your plan. Add it to a day with Edit, and logged sets show up here.' : 'Not in the remaining plan.') + '</p></section>';
    }
    let best = -Infinity; const hl = hist.map(h => { const pr = h.top > best; if (pr) best = h.top; return pr; });
    const variants = [...new Set(hist.map(h => h.name.replace(/\s*\(.*?\)/, '')))];
    const series = variants.length > 1 && L.key === 'ohp'
      ? variants.slice(0, 2).map((v, i) => ({ name: v.replace('Barbell overhead press, standing', 'Overhead press').replace('Standing strict barbell press', 'Strict press').replace('Barbell push press', 'Push press'), color: i ? 'var(--accent)' : pcolor(pid), vals: hist.map(h => h.name.startsWith(v) ? h.top : null), tips: hist.map(h => fmtDate(h.date) + '\n' + h.name + '\n' + h.top + ' kg × ' + (h.reps || '?') + (h.rpe ? ' @ RPE ' + h.rpe : '')) }))
      : [{ name: L.name, color: pcolor(pid), vals: hist.map(h => h.top), hl, tips: hist.map((h, i) => fmtDate(h.date) + '\n' + h.top + ' kg × ' + (h.reps || '?') + (h.rpe ? ' @ RPE ' + h.rpe : '') + (hl[i] && i ? '\nPR' : '')) }];
    const top = Math.max(...hist.map(h => h.top));
    return '<section class="card"><div class="card-h"><h3>' + esc(L.name) + '</h3><span class="sp"></span><span class="pill pr">Best ' + (L.key === 'pullup' ? '+' : '') + top + ' kg</span></div>' + chartBox({ type: 'line', label: L.name + ' top set by session', x: hist.map(h => fmtDate(h.date, false)), series, yFmt: v => (L.key === 'pullup' && v > 0 ? '+' : '') + v + ' kg' }, 190) + '</section>';
  }).join('');
  return '<div class="cgrid c3">' + cards + '</div><section class="card"><div class="card-h"><h3>Personal records</h3><span class="sp"></span><span class="small muted">Heaviest top set per exercise</span></div>' + recordsTable(pid) + '</section>';
}

/* ---------- Stations ---------- */
function pStations(pid) {
  const sp = planSplits(pid);
  return '<div class="cgrid c3">' + ST_KEYS.map(st => {
    const s = stationBest(pid, st); const info = stInfo(st); const tgt = sp ? parseTime(sp.stations[st]) : null;
    const last = s.entries.slice(-3).reverse();
    return '<section class="card"><div class="card-h"><h3>' + esc(info.name) + '</h3><span class="sp"></span><span class="small muted">' + esc(info.amount + ' ' + info.unit) + '</span></div>' +
      '<div class="target"><div class="tv' + (s.best ? ' me' : '') + '"><span>Best at race standard</span><b>' + (s.best ? fmtTime(s.best.time) : '–') + '</b><small>' + (s.best ? esc(fmtDate(s.best.date, false)) + (tgt ? ' · <span class="delta ' + (s.best.time <= tgt ? 'good' : 'bad') + '">' + fmtDelta(s.best.time - tgt) + '</span>' : '') : 'Full distance at race load') + '</small></div>' +
      '<div class="tv"><span>Plan ' + planOf(pid) + ' target</span><b>' + (tgt ? fmtTime(tgt) : '–') + '</b><small>' + esc(info.load || '') + '</small></div></div>' +
      '<div class="row small" style="margin-top:10px;gap:14px"><span><b>' + (s.heaviest != null ? s.heaviest + ' kg' : '–') + '</b> <span class="muted">heaviest</span></span><span><b>' + (s.volume ? Math.round(s.volume).toLocaleString('en-IN') + ' ' + info.unit : '–') + '</b> <span class="muted">logged volume</span></span><span><b>' + s.entries.length + '</b> <span class="muted">entries</span></span></div>' +
      (last.length ? '<div class="tbl-wrap" style="margin-top:8px"><table class="tbl"><tbody>' + last.map(e => '<tr><td>' + esc(fmtDate(e.date, false)) + '</td><td class="num mono">' + (e.amount != null ? e.amount + ' ' + e.unit : '') + '</td><td class="num mono">' + (e.load != null ? e.load + ' kg' : '') + '</td><td class="num mono">' + (e.time ? fmtTime(e.time) : '') + '</td><td class="num">' + (e.rpe ? 'RPE ' + e.rpe : '') + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="empty">No entries yet.</p>') +
      '<details style="margin-top:6px"><summary class="small">Technique cues</summary><p class="small"><b>Standard:</b> ' + esc(info.standard || '') + '</p><p class="small muted" style="margin-top:4px">' + esc(info.cue || '') + '</p></details></section>';
  }).join('') + '</div>';
}

/* ---------- Tests ---------- */
function pTests(pid) {
  const B = (S.meta && S.meta.benchmarks) || []; const res = (S.bench[pid] || {}).results || {};
  const gp = gatePlan(pid); const dates = [...new Set(B.map(b => b.date))];
  const editable = pid === S.pid;
  const done = B.filter(b => res[b.id] && res[b.id].v).length;
  const allF = dates.length && dates.every(d => FOLDS()['tst:' + d]);
  return '<section class="card"><div class="card-h"><h3>Benchmarks</h3><span class="sp"></span><span class="mono small muted">' + done + '/' + B.length + ' done</span>' + (dates.length ? '<button class="btn sm ghost exall" data-a="fold-all" data-p="tst:">' + (allF ? 'Show all' : 'Hide all') + '</button>' : '') + '</div>' +
    '<p class="small muted">' + esc((S.meta && S.meta.testNote) || '') + '</p>' + (gp ? '<div class="warnbox good" style="margin-top:10px"><div><b>Your gates point to Plan ' + gp.plan + '.</b>Based on ' + esc(gp.from) + '. Your race plan is set to Plan ' + planOf(pid) + (planOf(pid) !== gp.plan && editable ? ' <button class="btn sm" data-a="set-plan" data-v="' + gp.plan + '">Switch to Plan ' + gp.plan + '</button>' : '') + '</div></div>' : '') + '</section>' +
    dates.map(d => foldify('<section class="card"><div class="card-h"><h3>' + esc(fmtDate(d)) + '</h3><span class="tnames">' + esc(B.filter(b => b.date === d).map(b => b.name).join(' · ')) + '</span><span class="sp"></span>' + (d === todayISO() ? '<span class="pill k-test">Today</span>' : '') + (() => { const bs = B.filter(b => b.date === d); const k = bs.filter(b => res[b.id] && res[b.id].v).length; return '<span class="pill' + (k === bs.length ? ' ok' : '') + '">' + k + '/' + bs.length + ' done</span>'; })() + '</div><div class="stack">' +
      B.filter(b => b.date === d).map(b => editable ? benchRow(b, res[b.id]) : (() => { const r = res[b.id]; const st = benchStatus(b, r); return '<div class="entry"><div class="entry-h"><b>' + esc(b.name) + '</b>' + (st ? '<span class="pill ' + st.cls + '">' + esc(st.txt) + '</span>' : '') + '</div><div class="small muted">Target ' + esc(b.target) + ' · Result ' + esc(r && r.v ? r.v : '–') + '</div></div>'; })()).join('') + '</div></section>', 'tst:' + d)).join('');
}

/* ---------- Race ---------- */
function pRace(pid) {
  const M = S.meta; if (!M) return '';
  const pr = predict(pid); const goal = parseTime(M.goal || '1:30:00');
  const marks = [['A', parseTime(M.plans.A.finish)], ['B', parseTime(M.plans.B.finish)], ['C', parseTime(M.plans.C.finish)], ['Sept', parseTime(M.plans.S.finish)]];
  const lo = 80 * 60, hi = 120 * 60; const pos = v => Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100));
  const plan = planOf(pid); const sp = M.plans[plan]; const gp = gatePlan(pid);
  let cum = 0; const splitRows = [];
  ST_KEYS.forEach((k, i) => {
    const r = parseTime(sp.runs[i]), s = parseTime(sp.stations[k]); const rox = parseTime(sp.rox) / 8;
    cum += r; splitRows.push('<tr><td>Run ' + (i + 1) + '</td><td class="num mono">' + sp.runs[i] + '</td><td class="num mono muted">' + fmtTime(cum, true) + '</td></tr>');
    cum += rox + s; splitRows.push('<tr><td>' + esc(stName(k)) + (k === 'wb' && sp.wbSets ? ' <span class="muted small">(' + esc(sp.wbSets) + ')</span>' : '') + '</td><td class="num mono">' + sp.stations[k] + '</td><td class="num mono muted">' + fmtTime(cum, true) + '</td></tr>');
    if (i === 3) splitRows.push('<tr><td colspan="3" class="small" style="color:var(--accent);font-weight:600">Halfway checkpoint ≈ ' + esc(sp.halfway) + '</td></tr>');
  });
  const sims = simsOf(pid); const order = SEG_ORDER();
  const used = order.filter(k => sims.some(s => s.segs[k]));
  const loss = used.map(k => { const ds = sims.map(s => s.segs[k]).filter(x => x && x.t && x.target).map(x => x.t - x.target); return { k, avg: ds.length ? sum(ds) / ds.length : null, n: ds.length }; }).filter(x => x.avg != null).sort((a, b) => b.avg - a.avg);
  return '<section class="card"><div class="card-h"><h3>Race-time predictor</h3><span class="sp"></span><span class="small muted">' + pr.dataPoints + ' data sources</span></div>' +
    '<div class="row" style="align-items:flex-end;gap:18px"><span class="bigtime">' + fmtTime(pr.total, true) + '</span><div><div class="delta ' + (pr.total <= goal ? 'good' : 'bad') + '" style="font-size:16px">' + fmtDelta(pr.total - goal) + ' vs 1:30 goal</div><div class="small muted">Running ' + fmtTime(pr.runs) + ' · Stations ' + fmtTime(pr.stTotal) + ' · Roxzone ' + fmtTime(pr.rox) + '</div></div></div>' +
    '<div class="scale" aria-hidden="true"><div class="track"></div>' + marks.map(m => '<div class="mk" style="left:' + pos(m[1]) + '%">' + (m[0] === 'Sept' ? 'Sept' : 'Plan ' + m[0]) + '<i></i></div>').join('') + '<div class="mk you" style="left:' + pos(pr.total) + '%"><i></i>You</div></div>' +
    '<details style="margin-top:14px"><summary>How this is worked out</summary><div class="tbl-wrap"><table class="tbl"><tbody><tr><td>8 × 1 km running</td><td class="num mono">' + fmtTime(pr.runs) + '</td><td class="wrap small muted">' + esc(pr.runFrom) + '</td></tr>' +
    ST_KEYS.map(k => '<tr><td>' + esc(stName(k)) + '</td><td class="num mono">' + fmtTime(pr.stations[k].t) + '</td><td class="wrap small muted">' + esc(pr.stations[k].from) + '</td></tr>').join('') +
    '<tr><td>Roxzone</td><td class="num mono">' + fmtTime(pr.rox) + '</td><td class="wrap small muted">' + esc(pr.roxFrom) + '</td></tr></tbody></table></div><p class="small muted" style="margin-top:8px">Fatigue allowances on test results are estimates. The full simulation on 22 Dec is the real check.</p></details></section>' +
    '<div class="grid2"><section class="card"><div class="card-h"><h3>Target splits</h3><span class="sp"></span><div class="seg">' + ['A', 'B', 'C'].map(k => '<button data-a="set-plan" data-v="' + k + '" aria-pressed="' + (plan === k) + '"' + (pid !== S.pid ? ' disabled' : '') + '>Plan ' + k + '</button>').join('') + '</div></div>' +
    (gp ? '<p class="small" style="margin-bottom:8px">Your gates point to <b>Plan ' + gp.plan + '</b> (' + esc(gp.from) + ').</p>' : '<p class="small muted" style="margin-bottom:8px">Gates on 22 Nov, 1 Dec and 22 Dec decide between A (1:29), B (1:34) and C (1:40).</p>') +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Segment</th><th class="num">Target</th><th class="num">Clock</th></tr></thead><tbody>' + splitRows.join('') + '<tr><td>Roxzone (8 passes)</td><td class="num mono">' + sp.rox + '</td><td></td></tr><tr><td><b>Finish</b></td><td class="num mono"><b>' + sp.finish + '</b></td><td></td></tr></tbody></table></div>' +
    '<div class="row" style="margin-top:12px"><button class="btn primary" data-a="tool" data-t="race">' + I.flag + 'Race-day mode</button><button class="btn" data-a="tool" data-t="race" data-mode="log">Log a simulation</button></div></section>' +
    '<section class="card"><div class="card-h"><h3>Where time goes</h3></div>' + (loss.length ? '<p class="small muted" style="margin-bottom:10px">Average against Plan ' + plan + ' targets across your simulations (scaled for shorter distances).</p><div class="stack">' + loss.map(x => { const w = Math.min(100, Math.abs(x.avg) / 90 * 100); return '<div><div class="row small" style="justify-content:space-between"><span>' + esc(segLabel(x.k)) + '</span><span class="delta ' + (x.avg <= 0 ? 'good' : 'bad') + '">' + fmtDelta(x.avg) + '</span></div><div class="wbar"><i style="width:' + w + '%;background:' + (x.avg <= 0 ? 'var(--done)' : 'var(--miss)') + '"></i></div></div>'; }).join('') + '</div>' : '<p class="empty">Log a simulation (10 Nov mini-sim, 1 Dec half sim, 22 Dec full sim) to see which segments cost you time.</p>') + '</section></div>' +
    '<section class="card"><div class="card-h"><h3>Simulation history</h3></div>' + (sims.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Segment</th>' + sims.map(s => '<th class="num">' + esc(fmtDate(s.date, false)) + '<br><span style="text-transform:none;font-weight:500">' + esc(s.label.slice(0, 22)) + '</span></th>').join('') + '</tr></thead><tbody>' +
      used.map(k => '<tr><td>' + esc(segLabel(k)) + '</td>' + sims.map(s => { const x = s.segs[k]; if (!x || !x.t) return '<td></td>'; const d = x.target ? x.t - x.target : null; return '<td class="num mono ' + (d == null ? '' : d <= 0 ? 'cell-good' : 'cell-bad') + '">' + fmtTime(x.t) + (d != null ? '<br><span class="small">' + fmtDelta(d) + '</span>' : '') + '</td>'; }).join('') + '</tr>').join('') +
      '<tr><td>Roxzone</td>' + sims.map(s => '<td class="num mono">' + (s.rox ? fmtTime(s.rox) : '') + '</td>').join('') + '</tr><tr><td><b>Total</b></td>' + sims.map(s => '<td class="num mono"><b>' + (s.total ? fmtTime(s.total, true) : '') + '</b></td>').join('') + '</tr></tbody></table></div>' : '<p class="empty">No simulations logged yet.</p>') + '</section>';
}

/* ---------- Streaks ---------- */
function pStreaks(pid) {
  const c = completion(pid), st = streaks(pid), t = todayISO();
  let heat = '<div class="heat"><span></span>' + ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => '<span class="hd">' + d + '</span>').join('');
  for (let n = 1; n <= weekCount(); n++) {
    const ds = weekDates(n); heat += '<span class="wl">W' + n + '</span>';
    for (let i = 0; i < 7; i++) {
      const d = ds.find(x => (dowOf(x) + 6) % 7 === i);
      if (!d) { heat += '<span></span>'; continue; }
      let s = dayState(pid, d); if (s === 'partial') s = 'modified'; if (s === 'today') s = 'future';
      heat += '<button class="hc ' + s + (d === t ? ' today' : '') + '" data-a="go-day" data-d="' + d + '" data-tip="' + esc(fmtDate(d) + ' · ' + S.days[d].short + '\n' + STATE_LABEL[dayState(pid, d)]) + '" aria-label="' + esc(fmtDate(d) + ': ' + STATE_LABEL[dayState(pid, d)]) + '"></button>';
    }
  }
  heat += '</div>';
  return '<div class="tiles"><div class="tile"><span>Completion</span><b>' + c.pct + '<small>%</small></b><span class="pl">' + c.done + ' of ' + c.planned + ' sessions to date</span></div><div class="tile"><span>Current streak</span><b>' + st.cur + '<small>days</small></b><span class="pl">Rest days count</span></div><div class="tile"><span>Best streak</span><b>' + st.best + '<small>days</small></b></div></div>' +
    '<section class="card"><div class="card-h"><h3>Season heatmap</h3></div>' + heat + '<div class="hleg" style="margin-top:12px"><span><i class="hc complete"></i>Done</span><span><i class="hc modified"></i>Modified</span><span><i class="hc skipped"></i>Skipped</span><span><i class="hc rest"></i>Rest</span><span><i class="hc restdone"></i>Rest + walk</span><span><i class="hc missed"></i>Missed</span><span><i class="hc future"></i>Upcoming</span></div></section>';
}

/* ---------- Badges ---------- */
function pBadges(pid) {
  const B = badges(pid); const on = B.filter(b => b.on).length;
  return '<section class="card"><div class="card-h"><h3>Milestones</h3><span class="sp"></span><span class="mono small muted">' + on + '/' + B.length + '</span></div><div class="badges">' +
    B.map(b => '<div class="badge' + (b.on ? ' on' : '') + '"><span class="medal">' + I.medal + '</span><b>' + esc(b.name) + '</b><small>' + esc(b.desc) + '</small><small>' + (b.on ? 'Earned ' + esc(fmtDate(b.on, false)) : (b.prog ? 'Progress ' + esc(b.prog) : 'Not yet')) + '</small></div>').join('') + '</div></section>' +
    '<section class="card"><div class="card-h"><h3>Personal records</h3></div>' + recordsTable(pid) + '</section>';
}

/* ---------- Journal ---------- */
function journalEntries(pids) {
  const out = [];
  pids.forEach(pid => {
    logsOf(pid).forEach(l => {
      const s = S.days[l.date] ? S.days[l.date].heading : '';
      if (l.notes) out.push({ pid, date: l.date, kind: s, text: l.notes });
      if (l.reason) out.push({ pid, date: l.date, kind: (l.status === 'skipped' ? 'Skipped' : 'Modified') + ': ' + s, text: l.reason });
      (l.runs || []).forEach(r => { if (r.notes) out.push({ pid, date: l.date, kind: 'Run · ' + fmtKm(r.dist || 0) + ' km', text: r.notes }); });
      if (l.photos && l.photos.length) out.push({ pid, date: l.date, kind: 'Photos · ' + s, text: l.photos.length + ' photo' + (l.photos.length > 1 ? 's' : ''), photos: l.photos });
    });
    Object.keys(S.weekly).filter(k => k.startsWith(pid + '_w')).forEach(k => { const w = S.weekly[k]; const n = +k.split('_w')[1]; if (w.note) out.push({ pid, date: (weekDates(n).slice(-1)[0] || ''), kind: 'Week ' + n + ' note', text: w.note }); });
    const b = (S.bench[pid] || {}).results || {}; Object.keys(b).forEach(id => { if (b[id].note) { const bm = ((S.meta && S.meta.benchmarks) || []).find(x => x.id === id); out.push({ pid, date: bm ? bm.date : '', kind: 'Test · ' + (bm ? bm.name : id), text: b[id].note }); } });
    niggleItems(pid).forEach(n => { if (n.note) out.push({ pid, date: n.date, kind: 'Niggle · ' + n.part, text: n.note }); });
  });
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
function journalResults(q) {
  const both = LS.get('hx.jboth', false);
  const pids = both ? peopleIds() : [viewPid()];
  let E = journalEntries(pids);
  const qq = q.trim().toLowerCase();
  if (qq) E = E.filter(e => (e.text + ' ' + e.kind).toLowerCase().includes(qq));
  if (!E.length) return '<p class="empty">' + (qq ? 'Nothing matches "' + esc(q) + '".' : 'Notes you write on sessions, runs, tests, weeks and niggles collect here.') + '</p>';
  const hl = s => { const e = esc(s); if (!qq) return e; const i = e.toLowerCase().indexOf(esc(qq)); return i < 0 ? e : e.slice(0, i) + '<mark>' + e.slice(i, i + esc(qq).length) + '</mark>' + e.slice(i + esc(qq).length); };
  return '<div class="stack">' + E.slice(0, 200).map(e => '<button class="entry" style="text-align:left;background:var(--surface)" data-a="go-day" data-d="' + e.date + '"><div class="entry-h"><b class="small">' + esc(fmtDate(e.date)) + ' · ' + hl(e.kind) + '</b>' + (pids.length > 1 ? '<span class="dot" style="--pc:' + pcolor(e.pid) + '"></span>' : '') + '</div><div>' + hl(e.text) + '</div>' + (e.photos ? '<div class="phstrip">' + e.photos.slice(0, 6).map(x => '<img src="' + esc(x.turl || x.url) + '" alt="" loading="lazy">').join('') + '</div>' : '') + '</button>').join('') + '</div>';
}
function pJournal(pid) {
  const q = S.route.q || '';
  return '<section class="card"><div class="row"><div class="srch" style="flex:1"><input class="inp" id="jq" type="search" placeholder="Search notes: knee, sled, sleep…" value="' + esc(q) + '" data-in="jq" aria-label="Search journal"></div>' +
    (peopleIds().length > 1 ? '<button class="chip" data-a="jboth" aria-pressed="' + LS.get('hx.jboth', false) + '">Both of us</button>' : '') + '</div></section><div id="jres">' + journalResults(q) + '</div>';
}

/* ---------- Body ---------- */
function pBody(pid) { return gymBodyCard(pid) + pBodyV31(pid); }
function pBodyV31(pid) {
  const W = niggleWarnings(pid), items = niggleItems(pid); const rec = (S.meta && S.meta.recovery) || [];
  const f = S.nigForm || { part: '', side: '', sev: 3 };
  const form = pid === S.pid ? '<section class="card" id="nig-form"><div class="card-h"><h3>Log a niggle</h3></div><div class="stack"><div class="field"><span>Where</span><div class="chips">' + BODY.map(b => '<button class="chip" data-a="nig" data-k="part" data-v="' + b + '" aria-pressed="' + (f.part === b) + '">' + b + '</button>').join('') + '</div></div>' +
    '<div class="field"><span>Side</span><div class="chips">' + ['Left', 'Right', 'Both', 'Centre'].map(b => '<button class="chip" data-a="nig" data-k="side" data-v="' + b + '" aria-pressed="' + (f.side === b) + '">' + b + '</button>').join('') + '</div></div>' +
    '<div class="field"><span>How bad (0–10)</span><div class="chips rpe">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => '<button class="chip" data-a="nig" data-k="sev" data-v="' + v + '" aria-pressed="' + (f.sev === v) + '">' + v + '</button>').join('') + '</div></div>' +
    '<label class="field"><span>Note</span><input class="inp" id="nig-note" placeholder="When it hurts, what makes it better or worse"></label>' +
    '<div class="row"><button class="btn primary" data-a="nig-save"' + (f.part ? '' : ' disabled') + '>Save</button></div></div></section>' : '';
  return (W.length ? W.map(w => '<div class="warnbox bad">' + I.warn.replace('<svg', '<svg width="22" height="22"') + '<div><b>' + esc(w.part) + ': flagged ' + w.n + ' times in 3 weeks (worst ' + w.max + '/10).</b>' + esc(rec[4] || '') + '</div></div>').join('') : '') +
    '<div class="grid2">' + form + '<section class="card"><div class="card-h"><h3>History</h3></div>' + (items.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Where</th><th class="num">0–10</th><th>Note</th><th></th></tr></thead><tbody>' +
      items.map(n => '<tr><td>' + esc(fmtDate(n.date, false)) + '</td><td>' + esc(n.part + (n.side ? ' · ' + n.side : '')) + '</td><td class="num mono">' + n.sev + '</td><td class="wrap">' + esc(n.note || '') + '</td><td>' + (pid === S.pid ? '<button class="btn sm ghost" data-a="nig-del" data-t="' + n.t + '" aria-label="Delete">' + I.close + '</button>' : '') + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="empty">Nothing logged. Good.</p>') + '</section></div>';
}

