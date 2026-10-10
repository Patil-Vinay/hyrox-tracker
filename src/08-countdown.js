/* ---------- extras ---------- */
function bagItems(p) {
  const B = (S.meta && S.meta.bag) || {}; const set = new Set(B.all || []);
  const add = k => (B[k] || []).forEach(x => set.add(x));
  if (['pull', 'push', 'legs'].includes(p.kind)) add('strength');
  if (p.kind === 'hyrox') add('hyrox');
  if (p.kind === 'long') add('long');
  if (p.kind === 'race') add('race');
  if (!p.run.none && p.kind !== 'long' && p.kind !== 'hyrox') add('run');
  if ((p.day.badges || []).includes('sim')) add('sim');
  ((me() && me().bagExtra) || []).forEach(x => set.add(x));
  return Array.from(set);
}
function extrasCard(date, p, l) {
  const items = bagItems(p); const on = l.bag || {};
  const n = items.filter(x => on[x]).length;
  return '<section class="card o11"><details><summary>' + I.bag.replace('<svg', '<svg width="20" height="20"') + 'Gym bag <span class="mono small muted" style="margin-left:6px">' + n + '/' + items.length + '</span></summary><div class="checks">' +
    items.map(x => checkBtn('bag', x, on[x], x)).join('') + '</div>' +
    '<div class="row" style="margin-top:8px"><input class="inp" id="bag-new" placeholder="Add your own item" style="flex:1"><button class="btn sm" data-a="bag-add">Add</button></div></details></section>';
}

/* ---------- countdown & season done ---------- */
function countdownView() {
  const t = todayISO(), s = START(); const n = diffDays(t, s);
  const p1 = P(s); const w1 = weekDates(1);
  return '<div class="count"><span class="eyebrow" style="color:inherit;opacity:.75">Training starts ' + esc(fmtDateLong(s)) + '</span><span class="big">' + n + '</span><span class="lbl">' + (n === 1 ? 'Day' : 'Days') + ' to day 1</span><p>' + diffDays(t, RACE()) + ' days to race day. Use them to set up, pack your bag and read Week 1.</p></div>' +
    '<div class="grid2">' + (p1 ? '<section class="card k-' + p1.kind + '"><span class="eyebrow">Day 1 · ' + esc(fmtDate(s)) + '</span><h3 class="disp" style="font-size:34px;text-transform:uppercase;margin:8px 0">' + esc(p1.day.heading) + '</h3><p class="small">' + esc(p1.objective) + '</p><div class="row" style="margin-top:12px"><button class="btn primary" data-a="go-day" data-d="' + s + '">Open day 1</button></div></section>' : '') +
    '<section class="card"><div class="card-h"><h3>Week 1</h3></div><div class="list-w">' + w1.map(d => listRow(d)).join('') + '</div></section></div>' +
    '<section class="card"><div class="card-h"><h3>Get ready</h3></div><ul class="stack small" style="padding-left:18px;margin:0">' +
    '<li>' + (S.pid ? 'You\'re set up as <b>' + esc(pname(S.pid)) + '</b>. Change your colour or race plan in Settings.' : 'Set up your profile so your logs are yours.') + '</li>' +
    '<li>Training with someone? Send them the link. They sign in with Google and set up their own profile once.</li>' +
    '<li>Tue 29 Sep is a test day: a 1 km time trial and a max set of wall balls. Fri 2 Oct: SkiErg and row 1,000 m.</li>' +
    '<li>Easy runs are slow on purpose: 7:45–8:15/km until your tests set your own zones.</li></ul></section>';
}
function seasonDoneView() {
  const pid = S.pid; if (!pid) return '';
  const c = completion(pid), st = streaks(pid), runs = runsOf(pid), b = badges(pid).filter(x => x.on).length;
  const rl = getLog(RACE(), pid); const sim = simsOf(pid).find(s => s.date === RACE());
  const raceT = (rl && rl.simTotal && parseTime(rl.simTotal)) || (sim && sim.total) || null;
  return '<div class="count" style="background:var(--k-race);color:#fff"><span class="eyebrow" style="color:inherit;opacity:.8">Season complete · HYROX ' + esc(raceLabel(raceOf(pid)) || 'Singles Men Open') + '</span><span class="big" style="font-size:clamp(64px,18vw,120px)">' + (raceT ? fmtTime(raceT, true) : 'Done') + '</span><span class="lbl">' + (raceT ? 'Race time' : 'Log your race time on 15 Jan') + '</span></div>' +
    '<div class="tiles"><div class="tile"><span>Running logged</span><b>' + fmtKm(sum(runs.map(r => r.dist)), 0) + '<small>km</small></b></div><div class="tile"><span>Sessions</span><b>' + c.done + '<small>/ ' + c.planned + '</small></b></div><div class="tile"><span>Completion</span><b>' + c.pct + '<small>%</small></b></div><div class="tile"><span>Best streak</span><b>' + st.best + '<small>days</small></b></div><div class="tile"><span>Badges</span><b>' + b + '</b></div></div>' +
    '<section class="card"><div class="card-h"><h3>Records</h3></div>' + recordsTable(pid) + '</section>' +
    '<div class="row"><button class="btn" data-a="go-day" data-d="' + RACE() + '">Open race day</button><button class="btn" data-a="nav" data-v="progress">Season progress</button></div>';
}
function recordsTable(pid) {
  const R = records(pid); if (!R.length) return '<p class="empty">Records appear as you log sessions.</p>';
  return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Record</th><th class="num">Best</th><th>Date</th></tr></thead><tbody>' + R.map(r => '<tr><td>' + esc(r.label) + '</td><td class="num mono">' + esc(r.value) + '</td><td class="muted">' + (r.date ? esc(fmtDate(r.date, false)) : '') + '</td></tr>').join('') + '</tbody></table></div>';
}

