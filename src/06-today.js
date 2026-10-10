/* ================= Day / Today view ================= */
const KIND_LABEL = { pull: 'Strength · Back', push: 'Strength · Chest & shoulders', legs: 'Strength · Legs', hyrox: 'HYROX', long: 'Long run', rest: 'Rest & recovery', race: 'Race day' };
function kindLabel(p) { if (p.day && p.day.week === 0 && p.kind === 'long') return 'Easy run · kick-off'; if (p.kind === 'hyrox') { const m = p.session.match(/HYROX ([AB])/); return 'HYROX ' + (m ? m[1] : ''); } return KIND_LABEL[p.kind] || p.kind; }
function badgesHTML(day) {
  let h = '';
  (day.badges || []).forEach(b => { h += '<span class="pill k-' + b + '">' + (b === 'test' ? 'Benchmark' : 'Simulation') + '</span>'; });
  if (day.gate) h += '<span class="pill k-sim">Gate ' + day.gate + '</span>';
  return h;
}

function plateHeader(date) {
  const t = todayISO(), start = START(), race = RACE();
  const p = S.days[date] ? P(date) : null;
  const toRace = diffDays(t, race);
  let a, ac;
  if (t < start) { a = diffDays(t, start); ac = '<b>Days to day 1</b>Starts ' + fmtDate(start); }
  else if (t > race) { a = planLen(); ac = '<b>Days done</b>Season complete'; }
  else { const tp = P(t); a = tp ? tp.n : '–'; ac = '<b>Day</b>of ' + planLen() + (tp && tp.week ? '<br>Week ' + tp.week.n : ''); }
  const b = toRace > 0 ? toRace : toRace === 0 ? '0' : '✓';
  const bc = toRace > 0 ? '<b>' + (toRace === 1 ? 'Day' : 'Days') + '</b>to race' : toRace === 0 ? '<b>Race day</b>Go get it' : '<b>Race done</b>15 Jan 2027';
  const sc = scoreCard(date);
  return '<div class="topgrid' + (sc ? ' has-sc' : '') + '">' + sc + '<div class="plates one"><div class="plate alt"><span class="big">' + b + '</span><span class="cap">' + bc + '</span></div></div></div>';
}

function dayHead(date) {
  const t = todayISO(); const p = P(date);
  const prev = S.order[S.order.indexOf(date) - 1], next = S.order[S.order.indexOf(date) + 1];
  const sub = p ? ('Day ' + p.n + ' of ' + planLen() + (p.day.week === 0 ? ' · Kick-off weekend' : ' · Week ' + p.day.week + (p.week ? ' · ' + p.week.phaseName : ''))) : '';
  return '<div class="dayhead"><button class="iconbtn" data-a="go-day" data-d="' + (prev || '') + '" ' + (prev ? '' : 'disabled') + ' aria-label="Previous day">' + I.left + '</button>' +
    '<div class="t"><b>' + (date === t ? 'Today · ' : '') + esc(fmtDateLong(date)) + '</b><small>' + esc(sub) + '</small></div>' +
    '<button class="iconbtn" data-a="go-day" data-d="' + (next || '') + '" ' + (next ? '' : 'disabled') + ' aria-label="Next day">' + I.right + '</button></div>' +
    (date !== t && S.days[t] ? '<div class="row"><button class="btn sm" data-a="nav" data-v="today">Back to today</button></div>' : '');
}

function viewToday() {
  const t = todayISO();
  if (!S.order.length) return loadingView();
  if (t < START() && !S.days[t]) return plateHeader(t) + reminderBanner() + countdownView();
  if (t > RACE()) return plateHeader(t) + seasonDoneView();
  return plateHeader(t) + reminderBanner() + dayView(t);
}
function viewDay(date) {
  if (!S.days[date]) return loadingView();
  return plateHeader(date) + dayView(date);
}
function loadingView() {
  if (S.noDb && !S.order.length) return '<div class="card"><h3 class="disp" style="font-size:28px">Plan not available</h3><p class="muted" style="margin-top:8px">The tracker is not connected to Firebase yet. Follow the setup guide, then reload this page.</p></div>';
  return '<div class="card"><p class="muted">Loading your plan…</p></div>';
}
function reminderBanner() {
  const t = todayISO(); const p = S.days[t] && P(t); if (!p || p.rest || !S.pid) return '';
  const rem = me() && me().remind; const at = rem === undefined ? '19:00' : rem;
  if (!at) return '';
  const [h, m] = at.split(':').map(Number);
  if (nowISTMinutes() < h * 60 + m) return '';
  const l = getLog(t); if (l && (l.status || hasActivity(l))) return '';
  return '<div class="warnbox">' + I.warn.replace('<svg', '<svg width="22" height="22"') + '<div><b>Today\'s session isn\'t logged yet.</b>Tick your sets as you go, or mark it done or skipped at the bottom.</div></div>';
}

function dayView(date) {
  const p = P(date); if (!p) return loadingView();
  let h = dayHead(date);
  const warns = S.pid ? niggleWarnings(S.pid) : [];
  if (warns.length && date === todayISO()) h += '<div class="warnbox bad">' + I.warn.replace('<svg', '<svg width="22" height="22"') + '<div><b>' + esc(warns.map(w => w.part).join(', ')) + ' flagged repeatedly.</b>' + esc(((S.meta && S.meta.recovery) || [])[4] || 'Pain above 3/10 or pain that changes your stride means stop running today.') + ' <a href="#progress-body" data-a="sub" data-v="progress" data-s="body">See body log</a></div></div>';
  if (p.rest) return h + restView(date, p);
  return h + sessionView(date, p);
}

/* ---------- rest ---------- */
const REST_ACTS = [['rest', 'Full rest'], ['walk', 'Walk'], ['yoga', 'Yoga'], ['stretch', 'Stretching'], ['mobility', 'Mobility'], ['foam', 'Foam rolling'], ['swim', 'Easy swim'], ['cycle', 'Easy cycle'], ['other', 'Other']];
function restView(date, p) {
  const l = getLog(date) || {}; const r = l.rest || {}; const acts = r.acts || [];
  const next = S.order[p.idx + 1]; const np = next && P(next);
  const rec = (S.meta && S.meta.recovery) || [];
  const own = !!S.pid && canWriteDoc('logs', logKey(S.pid, date));
  const tomorrow = np ? '<section class="card k-' + np.kind + '"><span class="eyebrow">Tomorrow · ' + esc(fmtDate(next)) + '</span><h3 class="disp" style="font-size:30px;text-transform:uppercase;margin:6px 0">' + esc(np.day.heading) + '</h3><p class="small muted">' + esc(np.objective) + '</p><div class="row" style="margin-top:10px"><button class="btn sm" data-a="go-day" data-d="' + next + '">Preview tomorrow</button></div></section>' : '';
  return '<div class="restday"><span class="eyebrow">' + (p.day.week ? 'Week ' + p.day.week : 'Kick-off weekend') + ' · ' + esc(fmtDateLong(date)) + '</span><h1 style="margin-top:8px">Rest &amp; recover</h1><p>' + esc(p.restText || 'Complete rest.') + '</p>' + gymMovedNote(date) + (gymMovable(date) && gymMoveTargets(date).length ? '<div class="row" style="margin-top:10px">' + (p.day.moved && gymMovable(p.day.moved) ? '<button class="btn sm" data-a="gym-move-back" data-d="' + date + '">Move back</button>' : '<button class="btn sm" data-a="gym-move" data-d="' + date + '">' + I.cal + 'Train today instead</button>') + '</div>' : '') + '</div>' +
    '<div class="grid2 eq restgrid"><section class="card"><div class="card-h"><h3>What did you do?</h3><span class="sp"></span>' + (own && acts.length ? '<button class="btn sm ghost exall" data-a="share" data-d="' + date + '">' + I.share + 'Share</button>' : '<span class="muted small">Pick any</span>') + '</div>' +
    '<div class="chips">' + REST_ACTS.map(([k, t]) => '<button class="chip" data-a="rest-act" data-v="' + k + '" aria-pressed="' + acts.includes(k) + '"' + (own ? '' : ' disabled') + '>' + t + '</button>').join('') + '</div>' +
    (acts.some(a => a !== 'rest') ? '<div class="fgrid" style="margin-top:12px;grid-template-columns:minmax(0,160px)"><label class="field"><span>Minutes</span><input class="inp mono" id="rest-min" inputmode="numeric" placeholder="30" value="' + esc(r.min || '') + '" data-in="restmin"></label></div>' : '') +
    '<div style="margin-top:14px">' + photosHTML(date, l) + '</div></section>' +
    '<div class="rcol"><section class="card"><div class="card-h"><h3>Journal</h3></div><textarea class="inp" id="notes-' + date + '" data-in="notes" placeholder="How do you feel? Sleep, soreness, mood…">' + esc(l.notes || '') + '</textarea>' +
    '<div class="row" style="margin-top:10px"><button class="btn sm" data-a="niggle-add">' + I.body.replace('<svg', '<svg width="18" height="18"') + 'Log a niggle</button></div></section>' + tomorrow + '</div></div>' +
    (rec[0] ? '<section class="card"><div class="card-h"><h3>Morning check</h3></div><p class="small">' + esc(rec[0]) + '</p><p class="small muted" style="margin-top:6px">' + esc(rec[1] || '') + '</p></section>' : '');
}
function checkBtn(group, key, on, label, sub) {
  return '<button class="check" data-a="chk" data-g="' + group + '" data-k="' + esc(key) + '" aria-pressed="' + (!!on) + '"><span class="box">' + I.check + '</span><span class="lbl">' + esc(label) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span></button>';
}

/* ---------- daily score (0–100), updated live as you log ---------- */
function fracDone(obj, n) { if (!n) return null; let d = 0; for (let i = 0; i < n; i++) if (obj && obj[i]) d++; return d / n; }
function dayScore(pid, date) {
  const day = S.days[date]; if (!day) return null;
  if (day.caughtTo) return { score: null, parts: [], label: 'Done later' }; // v32: caught up on another day
  const t = todayISO(); if (date > t) return { score: null, parts: [], label: 'Upcoming' };
  const p = P(date); const l = getLog(date, pid) || {};
  const nPh = (l.photos || []).length;
  const parts = []; const add = (label, pts, max) => parts.push({ label, pts: Math.round(pts), max });
  if (p.rest) {
    const r = l.rest || {}; const acts = (r.acts || []).filter(a => a !== 'rest');
    const fu = fuelOn(pid, date);
    add('Rest day', fu ? 45 : 50, fu ? 45 : 50);
    add('Active recovery', (r.walk || r.mob || acts.length) ? (fu ? 25 : 30) : 0, fu ? 25 : 30);
    add('Journal', l.notes ? (fu ? 15 : 20) : 0, fu ? 15 : 20);
    if (fu) add('Fuel', fuelPts(pid, date, l), 15);
  } else {
    const st = dayState(pid, date);
    const fu = fuelOn(pid, date), k = fu ? 0.875 : 1;
    if (st === 'missed') { if (!fu) return { score: 0, parts: [{ label: 'Not logged', pts: 0, max: 100 }], label: 'Missed' }; const fp = Math.round(fuelPts(pid, date, l)); return { score: fp, parts: [{ label: 'Not logged', pts: 0, max: 85 }, { label: 'Fuel', pts: fp, max: 15 }], label: 'Missed' }; }
    add('Session', ({ complete: 40, modified: 30, partial: 20 }[st] || 0) * k, 40 * k);
    const comp = [];
    if (p.strength.length) { let tot = 0, dn = 0; p.strength.forEach((ex, i) => { tot += ex.sets || 1; dn += (((l.str || {})[i] || {}).s || []).filter(x => x && x.d).length; }); comp.push(tot ? Math.min(1, dn / tot) : 0); }
    if (!p.run.none) comp.push((l.runs || []).some(r => r.dist || r.time) ? 1 : 0);
    const hrows = p.hyrox.rows.filter(r => r.kind !== 'note');
    if (hrows.length) comp.push(hrows.filter(r => { const e = (l.hx || {})[r.i]; return e && (e.d || e.time); }).length / hrows.length);
    const WD = fu ? 25 : 30;
    add('Work done', comp.length ? WD * comp.reduce((a, b) => a + b, 0) / comp.length : (st === 'complete' ? WD : 0), WD);
    const vw = listView(pid, date, 'wu'), vc = listView(pid, date, 'cd'); // what's left after this person's edits
    const tot = vw.n + vc.n, dn = vw.done + vc.done;
    add('Warm-up & cooldown', tot ? 10 * Math.min(1, dn / tot) : 0, 10);
    let eff = 0;
    if (l.rpe) { eff = 5; const m = (p.rpe || '').match(/(\d+)(?:\s*[–-]\s*(\d+))?/); if (m) { const lo = +m[1], hi = +(m[2] || m[1]); if (l.rpe >= lo - 1 && l.rpe <= hi + 1) eff = 10; } }
    add('Effort logged', eff, 10);
    const note = l.notes || (l.runs || []).some(r => r.notes);
    if (fu) { add('Notes', note ? 5 : 0, 5); add('Fuel', fuelPts(pid, date, l), 15); }
    else add('Notes', note ? 10 : 0, 10);
  }
  const score = Math.min(100, parts.reduce((a, x) => a + x.pts, 0));
  return { score, parts, label: score >= 85 ? 'Crushing it' : score >= 70 ? 'Strong day' : score >= 50 ? 'Solid' : score >= 25 ? 'Getting there' : score > 0 ? 'Started' : (date === t ? 'Not started yet' : 'Missed') };
}
function scoreTotals(pid) {
  const t = todayISO(); let sum = 0, n = 0, best = null, good = 0;
  S.order.forEach(d => { if (d > t) return; const s = dayScore(pid, d); if (!s || s.score == null) return; if (d === t && !s.score) return; sum += s.score; n++; if (s.score >= 70) good++; if (!best || s.score > best.score) best = { d, score: s.score }; });
  return { sum, n, avg: n ? Math.round(sum / n) : 0, best, good };
}
/* ---------- motivation ---------- */
const MOTIVATION = [
  'Show up today. The race is built one ordinary session at a time.',
  'Easy days easy, hard days hard. Discipline is doing both properly.',
  'The sled doesn\'t care how you feel. Push anyway.',
  'Wall balls are won in training, not on race day.',
  'Consistency beats intensity. Tick today\'s box.',
  'You don\'t need to feel ready. You need to start the warm-up.',
  'Every kilometre banked now is time saved in January.',
  'Recovery is training too. Sleep like it matters, because it does.',
  'Slow runs build the engine that fast runs use.',
  'The Roxzone rewards the calm. Practise staying composed when it hurts.',
  'Small, boring, repeatable. That\'s how fitness is built.',
  'Your future self on the start line is counting on today.',
  'Tired legs, clear head. Finish the session.',
  'Good form at the end of a set is where strength is made.',
  'One more honest rep beats three sloppy ones.',
  'Run the mile you\'re in.',
  'You\'ve done hard things before. This is one more.',
  'Stack good days. Forgive bad ones. Keep going.',
  'Hydrate, eat, sleep, repeat. The basics win races.',
  'Train so race day feels familiar.',
  'Pace is a skill. Practise it on every run.',
  'Grip, breathe, walk. Farmers carries are a mindset.',
  'The first 250 m of the SkiErg decide the next 750. Stay patient.',
  'Being consistent for 16 weeks is rarer than being fast for one day.',
  'Leave a little in the tank on easy days. Spend it on the hard ones.',
  'Log it, learn from it, move on.',
  'Nobody remembers the sessions you skipped. Everyone feels the ones you did.',
  'Strong legs, strong lungs, strong head. Build all three.',
  'A good warm-up is part of the workout, not before it.',
  'When it gets hard, shorten the goal: next rep, next lap, next breath.',
  'The work you do when nobody\'s watching shows up when everyone is.',
  'Progress isn\'t loud. It\'s the same weight feeling lighter.',
  'Rest days are where the adaptation happens. Enjoy them.',
  'Finish every session a little better than you started it.',
  'Burpee broad jumps are a rhythm, not a sprint.',
  'Trust the plan. Then do the plan.'
];
function motivationFor(pid, date) {
  const i = Math.abs([...date].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)) % MOTIVATION.length;
  return MOTIVATION[i];
}
function nudgeFor(pid, date) {
  const t = todayISO(); if (date !== t || !pid) return '';
  const toRace = diffDays(t, RACE()); const st = streaks(pid); const sc = dayScore(pid, t);
  const others = peopleIds().filter(x => x !== pid && doneStates.has(dayState(x, t)));
  if (toRace > 0 && [100, 75, 50, 30, 21, 14, 7, 3, 2, 1].includes(toRace)) return toRace + (toRace === 1 ? ' day' : ' days') + ' to race day. Make it count.';
  if (sc && sc.score >= 85) return 'Top-scoring day. Now recover well.';
  if (others.length && !(sc && sc.score >= 40)) return pname(others[0]) + ' has already trained today. Your turn.';
  if (st.cur >= 3) return st.cur + '-day streak. Don\'t break the chain.';
  return '';
}
function scoreCard(date) {
  const pid = S.pid; if (!pid || !S.days[date]) return '';
  const t = todayISO(); const sc = dayScore(pid, date); const tot = scoreTotals(pid);
  const idx = S.order.indexOf(date); const last = S.order.slice(Math.max(0, idx - 6), idx + 1);
  const bars = last.map(d => { const s = dayScore(pid, d); const v = s && s.score != null ? s.score : null;
    return '<span class="scb' + (d === date ? ' cur' : '') + '" title="' + esc(fmtDate(d)) + ': ' + (v == null ? '–' : v) + '"><i style="height:' + (v == null ? 0 : Math.max(4, v)) + '%"></i><em>' + DOWS[dowOf(d)][0] + '</em></span>'; }).join('');
  const nudge = nudgeFor(pid, date);
  const parts = sc && sc.parts.length ? sc.parts.map(x => esc(x.label) + ' <b>' + x.pts + '</b>/' + x.max).join(' · ') : '';
  return '<div class="scorecard">' +
    '<div class="sc-num"><span class="big">' + (sc.score == null ? '–' : sc.score) + '</span><span class="cap"><b>' + (date === t ? 'Today\'s score' : 'Day score') + '</b>' + esc(sc.label) + '</span></div>' +
    '<div class="sc-mid">' + (nudge ? '<span class="pill pr" style="align-self:flex-start">' + esc(nudge) + '</span>' : '') + '<p class="sc-mot">“' + esc(motivationFor(pid, date)) + '”</p>' + (parts ? '<p class="sc-parts">' + parts + '</p>' : '') + '</div>' +
    '<div class="sc-side"><div class="sc-hist" aria-label="Last 7 days">' + bars + '</div><div class="sc-tot"><b>' + tot.sum.toLocaleString('en-IN') + '</b> pts · avg ' + tot.avg + '</div><button class="btn sm ghost" data-a="sub" data-v="progress" data-s="score">History</button></div>' +
    '</div>';
}
function pScore(pid) {
  const ids = peopleIds(); const t = todayISO();
  const weeks = []; for (let n = minWeek(); n <= Math.min(weekCount(), Math.max(currentWeekN(), 0)); n++) weeks.push(n);
  const avgW = (p, n) => { const v = weekDates(n).filter(d => d <= t).map(d => dayScore(p, d)).filter(s => s && s.score != null).map(s => s.score); return v.length ? Math.round(sum(v) / v.length) : null; };
  const tot = scoreTotals(pid);
  const tiles = '<div class="tiles"><div class="tile"><span>Total points</span><b>' + tot.sum.toLocaleString('en-IN') + '</b></div><div class="tile"><span>Average day</span><b>' + tot.avg + '<small>/100</small></b></div><div class="tile"><span>Best day</span><b>' + (tot.best ? tot.best.score : '–') + '</b><span class="pl">' + (tot.best ? esc(fmtDate(tot.best.d)) : '') + '</span></div><div class="tile"><span>Days 70+</span><b>' + tot.good + '</b></div></div>';
  const chart = weeks.length ? '<section class="card"><div class="card-h"><h3>Weekly average score</h3></div>' + chartBox({ type: 'bar', label: 'Average daily score per week', x: weeks.map(n => n === 0 ? 'K' : 'W' + n), series: ids.map(p => ({ name: pname(p), color: pcolor(p), vals: weeks.map(n => avgW(p, n)) })), yFmt: v => v + '' }, 200) + '</section>' : '';
  const recent = S.order.filter(d => d <= t).slice(-14).reverse();
  const rows = recent.map(d => { const s = dayScore(pid, d); return '<tr><td>' + esc(fmtDate(d)) + '</td><td class="wrap">' + esc(S.days[d].heading) + '</td><td class="num mono"><b>' + (s && s.score != null ? s.score : '–') + '</b></td><td class="small muted">' + esc(s ? s.label : '') + '</td></tr>'; }).join('');
  return tiles + chart + '<section class="card"><div class="card-h"><h3>Last 14 days</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Day</th><th>Session</th><th class="num">Score</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<p class="small muted" style="margin-top:10px">How the score works: training days give up to 40 for completing the session, 30 for the planned work (sets, runs, stations), 10 for warm-up and cooldown, 10 for logging an effort in the target range, and 10 for notes and a photo. Rest days give 50 for resting, 25 for a walk, yoga or mobility, 15 for a journal note and 10 for a photo.</p></section>';
}

/* ---------- muscle map ---------- */
const MUSCLE_RULES = [
  [/deadlift|\brdl\b|romanian|good morning/, ['hams', 'glutes', 'lowback'], ['traps', 'forearms', 'quads']],
  [/squat|leg press|goblet|step.?up|bulgarian/, ['quads', 'glutes'], ['adductors', 'hams', 'lowback']],
  [/lunge/, ['quads', 'glutes'], ['hams', 'adductors', 'calves']],
  [/pull.?up|chin.?up|pulldown|pull-down/, ['lats', 'biceps'], ['midback', 'forearms', 'delts']],
  [/\brows?\b|v-bar row|upright row/, ['lats', 'midback'], ['biceps', 'delts', 'forearms']],
  [/bench|push.?up|chest press|\bfly|flye|\bdips?\b/, ['chest', 'triceps'], ['delts']],
  [/overhead press|shoulder press|\bohp\b|military|arnold|push press|landmine press/, ['delts', 'triceps'], ['traps', 'chest']],
  [/lateral raise|rear delt|face pull|y.?raise|reverse fly/, ['delts'], ['traps', 'midback']],
  [/leg curl|hamstring curl|nordic/, ['hams'], ['calves']],
  [/curl/, ['biceps'], ['forearms']],
  [/leg extension/, ['quads'], []],
  [/tricep|skull|pushdown|push-down|extension/, ['triceps'], []],
  [/calf|calves/, ['calves'], []],
  [/side plank|oblique|pallof|woodchop|suitcase|russian twist/, ['obliques'], ['abs']],
  [/plank|dead ?bug|crunch|sit.?up|hollow|\bab\b|leg raise|v-up|bird.?dog|core|rollout/, ['abs'], ['obliques']],
  [/hip thrust|glute bridge|glute|abduct/, ['glutes'], ['hams']],
  [/farmer|carry|dead hang|\bhold\b/, ['forearms', 'traps'], ['abs', 'obliques']],
  [/shrug/, ['traps'], ['forearms']],
  [/wall ?ball|thruster/, ['quads', 'glutes', 'delts'], ['triceps', 'abs']],
  [/kettlebell swing|\bswing/, ['glutes', 'hams'], ['lowback', 'delts']],
  [/burpee|broad jump/, ['quads', 'glutes', 'chest'], ['delts', 'triceps', 'calves']],
  [/skierg|ski erg|\bski\b/, ['lats', 'triceps'], ['abs', 'delts']],
  [/rowing|row erg|erg/, ['quads', 'lats'], ['midback', 'biceps', 'glutes']],
  [/sled push/, ['quads', 'glutes', 'calves'], ['chest', 'triceps']],
  [/sled pull/, ['lats', 'biceps', 'hams'], ['forearms', 'midback']]
];
const STATION_MUSCLES = { ski: 'skierg', push: 'sled push', pull: 'sled pull', bbj: 'burpee broad jump', row: 'rowing', farm: 'farmers carry', lunge: 'lunge', wb: 'wall ball' };
const MUSCLE_NAMES = { chest: 'Chest', delts: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms', abs: 'Abs', obliques: 'Obliques', traps: 'Traps', lats: 'Lats', midback: 'Mid back', lowback: 'Lower back', glutes: 'Glutes', quads: 'Quads', hams: 'Hamstrings', adductors: 'Adductors', calves: 'Calves' };
function musclesFor(p, l, acc) { // acc (v32): the Accessory & core items as the card lists them
  const P1 = new Set(), P2 = new Set();
  const apply = (name, strong) => { const m = gymMusclesOf(name); if (!m) return false; m[0].forEach(x => (strong ? P1 : P2).add(x)); m[1].forEach(x => P2.add(x)); return true; }; // v32: exercises.js
  p.strength.forEach(ex => apply(ex.name, true));
  p.stations.forEach(k => apply(STATION_MUSCLES[k] || k, true));
  const main = P1.size > 0 || !p.run.none; // v32: core work and finishers only count as secondary when there's main work
  (acc || (p.acc || []).concat((((l || {}).xl || {}).acc || []).map(x => x.t))).forEach(t => apply(t, !main));
  if (!p.run.none) { const onlyRun = !P1.size; ['quads', 'hams', 'calves'].forEach(m => (onlyRun ? P1 : P2).add(m)); P2.add('glutes'); }
  P1.forEach(m => P2.delete(m));
  return { primary: [...P1], secondary: [...P2] };
}
function bodySVG(side, M) {
  const c = k => M.primary.includes(k) ? 'mp' : M.secondary.includes(k) ? 'ms' : 'mo';
  const g = (k, d) => '<g class="' + c(k) + '"><title>' + MUSCLE_NAMES[k] + '</title>' + d + '</g>';
  const base = '<g class="mb"><ellipse cx="50" cy="15" rx="9.5" ry="11.5"/><rect x="45" y="25" width="10" height="8" rx="3"/><path d="M33 36 Q50 30 67 36 L70 60 Q66 100 64 108 L36 108 Q34 100 30 60 Z"/>' +
    '<path d="M26 40 Q20 44 20 60 L16 100 Q16 108 20 110 L25 110 Q27 100 29 86 L33 58 Z"/><path d="M74 40 Q80 44 80 60 L84 100 Q84 108 80 110 L75 110 Q73 100 71 86 L67 58 Z"/>' +
    '<path d="M36 104 L64 104 L63 150 L60 196 L54 196 L51 150 L49 150 L46 196 L40 196 L37 150 Z"/><ellipse cx="42" cy="202" rx="6" ry="3.5"/><ellipse cx="58" cy="202" rx="6" ry="3.5"/><circle cx="19" cy="113" r="4"/><circle cx="81" cy="113" r="4"/></g>';
  let m = '';
  if (side === 'front') {
    m += g('traps', '<path d="M45 32 L37 37 L45 37 Z"/><path d="M55 32 L63 37 L55 37 Z"/>');
    m += g('delts', '<ellipse cx="31" cy="43" rx="7" ry="8"/><ellipse cx="69" cy="43" rx="7" ry="8"/>');
    m += g('chest', '<path d="M38 38 Q49 35 49.5 40 L49.5 55 Q42 58 36 53 Q34 45 38 38 Z"/><path d="M62 38 Q51 35 50.5 40 L50.5 55 Q58 58 64 53 Q66 45 62 38 Z"/>');
    m += g('biceps', '<ellipse cx="26" cy="60" rx="4.5" ry="10"/><ellipse cx="74" cy="60" rx="4.5" ry="10"/>');
    m += g('forearms', '<ellipse cx="21" cy="88" rx="4.2" ry="13"/><ellipse cx="79" cy="88" rx="4.2" ry="13"/>');
    m += g('abs', '<rect x="43.5" y="58" width="13" height="40" rx="4"/>');
    m += g('obliques', '<path d="M36 57 Q40 60 42 61 L42 96 Q38 94 36 86 Q34 72 36 57 Z"/><path d="M64 57 Q60 60 58 61 L58 96 Q62 94 64 86 Q66 72 64 57 Z"/>');
    m += g('quads', '<path d="M38 110 Q44 108 48 112 L48 150 Q43 154 39 148 Q36 130 38 110 Z"/><path d="M62 110 Q56 108 52 112 L52 150 Q57 154 61 148 Q64 130 62 110 Z"/>');
    m += g('adductors', '<path d="M47 112 L49.5 112 L49.5 136 L47 132 Z"/><path d="M53 112 L50.5 112 L50.5 136 L53 132 Z"/>');
    m += g('calves', '<ellipse cx="42" cy="176" rx="4" ry="15"/><ellipse cx="58" cy="176" rx="4" ry="15"/>');
    m += '<g class="mline"><path d="M50 60 L50 97 M44 70 L56 70 M44 80 L56 80 M44 89 L56 89"/></g>';
  } else {
    m += g('traps', '<path d="M50 28 L65 38 L50 48 L35 38 Z"/>');
    m += g('delts', '<ellipse cx="31" cy="43" rx="7" ry="8"/><ellipse cx="69" cy="43" rx="7" ry="8"/>');
    m += g('triceps', '<ellipse cx="26" cy="61" rx="4.5" ry="10"/><ellipse cx="74" cy="61" rx="4.5" ry="10"/>');
    m += g('forearms', '<ellipse cx="21" cy="88" rx="4.2" ry="13"/><ellipse cx="79" cy="88" rx="4.2" ry="13"/>');
    m += g('lats', '<path d="M37 46 Q34 62 41 82 L47 70 L46 52 Z"/><path d="M63 46 Q66 62 59 82 L53 70 L54 52 Z"/>');
    m += g('midback', '<path d="M45 49 L55 49 L54 66 L46 66 Z"/>');
    m += g('lowback', '<path d="M45 68 L55 68 L56 96 L44 96 Z"/>');
    m += g('glutes', '<ellipse cx="43" cy="110" rx="7.5" ry="8.5"/><ellipse cx="57" cy="110" rx="7.5" ry="8.5"/>');
    m += g('hams', '<path d="M38 120 Q44 118 48.5 121 L48 152 Q43 156 39 150 Q37 134 38 120 Z"/><path d="M62 120 Q56 118 51.5 121 L52 152 Q57 156 61 150 Q63 134 62 120 Z"/>');
    m += g('calves', '<ellipse cx="42.5" cy="172" rx="5" ry="14"/><ellipse cx="57.5" cy="172" rx="5" ry="14"/>');
  }
  return '<figure class="bodyfig"><svg viewBox="0 0 100 210" role="img" aria-label="' + (side === 'front' ? 'Front' : 'Back') + ' muscles">' + base + m + '</svg><figcaption>' + (side === 'front' ? 'Front' : 'Back') + '</figcaption></figure>';
}
function musclesCard(date, p, l) {
  const M = musclesFor(p, l, S.pid ? gymAccShown(date).map(r => r.t) : null); if (!M.primary.length && !M.secondary.length) return '';
  const names = a => a.map(k => MUSCLE_NAMES[k]).join(', ');
  return '<section class="card o3"><div class="card-h"><h3>Muscles worked</h3></div><div class="bodymap">' + bodySVG('front', M) + bodySVG('back', M) + '</div>' +
    '<div class="mleg"><span><i class="mp"></i>Primary</span><span><i class="ms"></i>Secondary</span><span><i class="mo"></i>Not targeted</span></div>' +
    (M.primary.length ? '<p class="small" style="margin-top:8px"><b>Primary:</b> ' + esc(names(M.primary)) + '</p>' : '') + (M.secondary.length ? '<p class="small muted"><b>Secondary:</b> ' + esc(names(M.secondary)) + '</p>' : '') + '</section>';
}

const FOLDS = () => LS.get('hx.fold', {}) || {};
function syncExAll() { const b = document.querySelector('#view [data-a=exfold-all]'); if (!b) return; const hs = $$('#view .ex .exfold'); b.textContent = hs.length && hs.every(h => h.closest('.ex').classList.contains('folded')) ? 'Show all sets' : 'Hide all sets'; }
function syncFoldAll() { const fa = document.querySelector('#view [data-a=fold-all]'); if (!fa) return; const secs = $$('#view section[data-fold^="' + fa.dataset.p + '"]'); fa.textContent = secs.length && secs.every(x => x.classList.contains('folded')) ? 'Show all' : 'Hide all'; }
function setFold(k, on) { const f = FOLDS(); if (on) f[k] = 1; else delete f[k]; LS.set('hx.fold', f); }
/* refresh just the score card after a quiet save (notes, minutes) so typing isn't interrupted */
function refreshScore() { const el = document.querySelector('.scorecard'); if (!el) return; const h = scoreCard(curDate()); if (h) el.outerHTML = h; }

/* ---------- fold any section open/closed (remembered on this device) ---------- */
function foldify(html, key) {
  if (!html || html.indexOf('<div class="card-h">') < 0) return html;
  const folded = !!(LS.get('hx.fold', {}) || {})[key];
  let out = html.replace(/^<section class="card/, '<section data-fold="' + key + '" class="card' + (folded ? ' folded' : ''));
  out = out.replace('<div class="card-h">', '<div class="card-h foldh" data-a="fold" data-k="' + key + '" role="button" tabindex="0" aria-expanded="' + !folded + '">');
  return out;
}

/* ---------- session ---------- */
function sessionView(date, p) {
  const l = getLog(date) || {};
  const brief = heroCard(date, p) + foldify(musclesCard(date, p, l), 'mus') + foldify(warmupCard(date, p, l), 'wu') + foldify(accCard(date, p, l), 'acc') + foldify(cdCard(date, p, l), 'cd');
  const log = statusCard(date, p, l) + togetherCard(date, p) + testsCard(date, p) + foldify(strengthCard(date, p, l), 'str') + foldify(runCard(date, p, l), 'run') + foldify(hyroxCard(date, p, l), 'hx') + foldify(finishCard(date, p, l), 'fin');
  return '<div class="session"><div class="col">' + brief + '</div><div class="col">' + log + '</div></div>';
}
function heroCard(date, p) {
  const km = p.day.km ? fmtKm(p.day.km) + ' km' : '';
  return '<section class="hero k-' + p.kind + ' o1"><div class="row"><span class="kind"><i></i>' + esc(kindLabel(p)) + '</span>' + badgesHTML(p.day) + '<span class="sp" style="flex:1"></span>' +
    gymMoveButtons(date) + (canEditPlan() ? '<button class="btn sm ghost" data-a="edit-plan" data-d="' + date + '" aria-label="Edit this day\'s plan">' + I.edit + 'Edit</button>' : '') + '</div>' +
    '<h1>' + esc(p.day.heading) + '</h1>' + gymMovedNote(date) + (p.objective ? '<p class="obj">' + esc(p.objective) + '</p>' : '') +
    '<div class="meta">' + (p.rpe ? '<div><span>Target RPE</span><b>' + esc(p.rpe.split(/[ ,(]/)[0]) + '</b></div>' : '') + (p.time ? '<div><span>Session</span><b>' + esc(p.time.replace(/including.*$/, '').trim()) + '</b></div>' : '') + (km ? '<div><span>Running</span><b>' + km + '</b></div>' : '') + '</div>' +
    (p.rpe && p.rpe.length > 8 ? '<p class="small muted" style="margin-top:6px">RPE: ' + esc(p.rpe) + '</p>' : '') +
    (p.notes ? '<div class="coach"><b>Coach\'s notes.</b> ' + esc(p.notes) + '</div>' : '') + '</section>';
}
function statusCard(date, p, l) {
  const t = todayISO();
  let h = '';
  if (l.status) {
    const ic = l.status === 'complete' ? I.check : l.status === 'skipped' ? I.skip : I.mod;
    h = '<div class="statusbar ' + l.status + '">' + ic + '<span>' + STATE_LABEL[l.status] + (l.rpe ? ' · RPE ' + l.rpe : '') + (l.time ? ' · ' + l.time + ' min' : '') + '</span><span class="sp"></span>' + (S.pid && l.status !== 'skipped' ? '<button class="btn sm ghost stshare" data-a="share" data-d="' + date + '">' + I.share + 'Share</button>' : '') + '<a href="#finish" class="small" data-a="scroll" data-t="finish">Edit</a></div>';
  } else if (date === t) {
    if (l.start) h = '<div class="statusbar complete" style="background:var(--surface);border:1px solid var(--line);color:var(--ink)">' + I.timer.replace('<svg', '<svg width="20" height="20"') + '<span>Session running <b class="mono" id="elapsed">' + fmtTime(Math.floor((Date.now() - l.start) / 1000)) + '</b></span><span class="sp"></span><button class="btn sm ghost" data-a="start-reset">Reset</button>' + (S.pid && (modeAvail(p).gym || modeAvail(p).hx) ? '<div class="runmodes">' + (modeAvail(p).gym ? '<button class="btn" data-a="md-open" data-v="gym">' + I.barbell + 'Gym mode</button>' : '') + (modeAvail(p).hx ? '<button class="btn' + (l.hxc ? ' accent' : '') + '" data-a="md-open" data-v="hx">' + I.stopwatch + (l.hxc ? 'Back to clock' : 'HYROX mode') + '</button>' : '') + '</div>' : '') + '</div>';
    else if (S.pid && (modeAvail(p).gym || modeAvail(p).hx)) { const g = modeAvail(p).gym; h = '<button class="btn primary lg block" data-a="md-open" data-v="' + (g ? 'gym' : 'hx') + '">' + (g ? I.barbell + 'Start in Gym mode' : I.stopwatch + 'Start HYROX mode') + '</button><button class="linkbtn" data-a="start">or start the timer and log on this page</button>'; }
    else h = '<button class="btn primary lg block" data-a="start">' + I.play + 'Start session</button>';
  } else if (date < t) {
    const st = dayState(S.pid, date);
    if (st === 'missed') h = '<div class="statusbar skipped">Not logged. Tick what you did below, or mark it skipped.</div>' + gymCatchBtn(date);
  }
  return h ? '<div class="o2">' + h + '</div>' : '';
}
function testsCard(date, p) {
  if (!p.tests.length || !S.pid) return '';
  const b = S.bench[S.pid] || { results: {} };
  return '<section class="card o2" style="border-color:var(--test)"><div class="card-h"><h3>Today\'s tests</h3><span class="pill k-test">Benchmark</span></div><div class="stack">' +
    p.tests.map(t => benchRow(t, (b.results || {})[t.id])).join('') + '</div><p class="small muted" style="margin-top:10px">' + esc((S.meta && S.meta.testNote) || '') + '</p></section>';
}
function benchRow(t, r) {
  const st = benchStatus(t, r);
  return '<div class="entry"><div class="entry-h"><b>' + esc(t.name) + '</b>' + (st ? '<span class="pill ' + st.cls + '">' + esc(st.txt) + '</span>' : '') + '</div>' +
    '<div class="small muted">' + esc(fmtDate(t.date)) + ' · Target ' + esc(t.target) + '</div>' +
    '<div class="fgrid"><label class="field"><span>' + (t.kind === 'reps' ? 'Reps' : 'Time (m:ss)') + '</span><input class="inp mono" id="b-' + t.id + '" inputmode="' + (t.kind === 'reps' ? 'numeric' : 'text') + '" placeholder="' + (t.kind === 'reps' ? '0' : 'm:ss') + '" value="' + esc(r ? r.v : '') + '" data-in="bench" data-id="' + t.id + '" data-k="v"></label>' +
    '<label class="field"><span>Note</span><input class="inp" id="bn-' + t.id + '" value="' + esc(r ? r.note || '' : '') + '" placeholder="Stops, drops, feel" data-in="bench" data-id="' + t.id + '" data-k="note"></label></div>' +
    (st && st.cls !== 'ok' ? '<p class="small" style="color:var(--ink-2)"><b>What changes:</b> ' + esc(t.action) + '</p>' : '<details class="small"><summary>What this changes</summary><p class="muted">' + esc(t.action) + '</p></details>') + '</div>';
}
function listCard(title, sub, items, group, lg, o, extra, own) {
  const on = lg || {}; own = own || [];
  const canAdd = !!S.pid && canWriteDoc('logs', logKey(S.pid, curDate()));
  if (!items.length && !own.length && !canAdd) return '';
  let n = 0, done = 0; let body = '';
  items.forEach((it, i) => {
    if (it.h) { body += '<div class="grp" style="margin-top:' + (i ? 12 : 0) + 'px">' + esc(it.h) + '</div>' + (it.note ? '<p class="small muted">+ ' + esc(it.note) + '</p>' : ''); return; }
    n++; if (on[i]) done++;
    body += checkBtn(group, i, on[i], it.t);
  });
  if (own.length) body += '<div class="grp" style="margin-top:' + (n ? 12 : 0) + 'px">Your additions</div>' + own.map((x, i) => { n++; if (x.d) done++; return '<div class="ownrow"><button class="check" data-a="xl-chk" data-g="' + group + '" data-i="' + i + '" aria-pressed="' + (!!x.d) + '"><span class="box">' + I.check + '</span><span class="lbl">' + esc(x.t) + '</span></button>' + (canAdd ? '<button class="iconbtn sm" data-a="xl-del" data-g="' + group + '" data-i="' + i + '" aria-label="Remove ' + esc(x.t) + '">' + I.close + '</button>' : '') + '</div>'; }).join('');
  const addRow = canAdd ? '<div class="row addrow"><input class="inp" id="xl-in-' + group + '" data-xl="' + group + '" placeholder="Add your own ' + (group === 'acc' ? 'exercise' : 'item') + (group === 'acc' ? ', e.g. Dead bug 3 × 10' : '') + '" style="flex:1;min-width:0"><button class="btn sm" data-a="xl-add" data-g="' + group + '">' + I.plus + 'Add</button></div>' : '';
  const allBtn = (group === 'wu' || group === 'cd' || group === 'acc') && n && canAdd ? '<button class="btn sm ghost exall" data-a="chk-all" data-g="' + group + '">' + (done >= n ? 'Untick all' : I.check + 'Tick all') + '</button>' : '';
  return '<section class="card ' + o + '"><div class="card-h"><h3>' + title + '</h3><span class="sp"></span><span class="mono small muted">' + (n ? done + '/' + n : 'Nothing planned') + '</span>' + allBtn + '</div>' +
    (sub ? '<p class="small muted" style="margin:-4px 0 8px">' + esc(sub) + '</p>' : '') + (n ? '<div class="progressline" style="margin-bottom:6px"><i style="width:' + Math.round(100 * done / n) + '%"></i></div>' : '') + '<div class="checks">' + body + '</div>' + addRow + (extra || '') + '</section>';
}
function warmupCard(date, p, l) { return editListCard('Warm-up', p.wuText, 'wu', 'o3', date); }
function cdCard(date, p, l) { return editListCard('Cooldown', p.cdText, 'cd', 'o8', date); }
function accCard(date, p, l) { return editListCard('Accessory &amp; core', '', 'acc', 'o7', date); } // v32: take out, put back, add; just today or every day

/* ---------- strength ---------- */
function unitLbl(ex) { return ex.unit === 's' ? 'sec' : ex.unit === 'm' ? 'm' : ex.unit === 'min' ? 'min' : 'reps' + (ex.per ? ex.per.replace('/', ' /') : ''); }
function loadLbl(ex) { return ex.dual ? 'kg ×2' : ex.added || ex.bw ? '+kg' : 'kg'; }
function loadAdvice(pid, date, ex) {
  const k = normEx(ex.name);
  const prevs = strengthEntries(pid).filter(e => e.key === k && e.date < date && e.top != null);
  if (!prevs.length) return null;
  const pr = prevs[prevs.length - 1];
  const pp = P(pr.date); const pex = pp && pp.strength[pr.idx];
  const l = getLog(pr.date, pid); const e = l && l.str && l.str[pr.idx];
  const sets = (e && e.s) || [];
  const needReps = pex ? pex.reps : null; const needSets = pex ? pex.sets : sets.length;
  const hit = sets.filter(x => x && x.d).length >= needSets && sets.every(x => !x || !x.d || needReps == null || (num(x.r) || 0) >= needReps);
  const rule = progressionFor(ex.name, ex);
  const tHi = (pex && pex.rpeHi) || ex.rpeHi || 8;
  const last = fmtDate(pr.date, false) + ': ' + pr.top + ' kg';
  if (pr.rpe != null && pr.rpe >= 9) return { kind: 'hold', load: pr.top, html: '<b>Hold the load.</b> ' + esc(last) + ' at RPE ' + pr.rpe + '. The plan says drop 10% when you hit RPE 9 early and don\'t add load this week.' };
  if (!hit) return { kind: 'hold', load: pr.top, html: '<b>Repeat ' + pr.top + ' kg.</b> ' + esc(last) + ', not every rep landed. Own it before adding load.' };
  if (pr.rpe == null) return { kind: 'info', html: 'Last time ' + esc(last) + ' × ' + (pr.reps || '?') + '. Rate the last set\'s RPE after this exercise to get load suggestions.' };
  if (pr.rpe > tHi) return { kind: 'hold', load: pr.top, html: '<b>Stay at ' + pr.top + ' kg.</b> ' + esc(last) + ' at RPE ' + pr.rpe + ', above the RPE ' + tHi + ' target.' };
  if (!rule.inc) return { kind: 'info', html: 'Hit every rep at RPE ' + pr.rpe + ' last time. ' + esc(rule.rule) + '.' };
  const step = rule.big && pr.rpe <= tHi - 1 ? rule.big : rule.inc;
  const next = Math.round((pr.top + step) * 100) / 100;
  if (ex.load != null && ex.load >= next) return { kind: 'ok', html: 'Last time ' + esc(last) + ' at RPE ' + pr.rpe + '. Today\'s plan already moves you to <b>' + ex.load + ' kg</b>.' };
  return { kind: 'up', load: next, html: '<b>Try ' + next + ' kg' + (ex.dual ? ' per hand' : '') + '.</b> ' + esc(last) + ', every rep at RPE ' + pr.rpe + ' (target ' + tHi + '). ' + esc(rule.rule) + '.' };
}
function nextTimeAdvice(ex, e) {
  if (!e || !e.s) return '';
  const done = e.s.filter(x => x && x.d);
  if (done.length < ex.sets) return '';
  const loads = done.map(x => num(x.w)).filter(x => x != null); const top = loads.length ? Math.max(...loads) : null;
  if (e.rpe == null) return '<div class="ex-rpe"><span>How hard was the last set?</span>' + [6, 7, 8, 9, 10].map(v => '<button class="chip" data-a="ex-rpe" data-ex="' + e._i + '" data-v="' + v + '">' + v + '</button>').join('') + '</div>';
  const hitReps = done.every(x => ex.reps == null || (num(x.r) || 0) >= ex.reps);
  const tHi = ex.rpeHi || 8; const rule = progressionFor(ex.name, ex);
  let msg;
  if (e.rpe >= 9) msg = 'RPE ' + e.rpe + ': keep ' + (top != null ? top + ' kg' : 'this load') + ' next time, don\'t add load.';
  else if (!hitReps) msg = 'Some reps short: repeat ' + (top != null ? top + ' kg' : 'this load') + ' next time.';
  else if (e.rpe > tHi) msg = 'Above target RPE: hold ' + (top != null ? top + ' kg' : 'the load') + ' next time.';
  else if (!rule.inc || top == null) msg = 'All reps at RPE ' + e.rpe + '. ' + rule.rule + '.';
  else { const step = rule.big && e.rpe <= tHi - 1 ? rule.big : rule.inc; msg = 'All reps at RPE ' + e.rpe + '. Next time: ' + (Math.round((top + step) * 100) / 100) + ' kg' + (ex.dual ? ' per hand' : '') + '.'; }
  return '<div class="ex-rpe"><span>Last-set RPE</span>' + [6, 7, 8, 9, 10].map(v => '<button class="chip" data-a="ex-rpe" data-ex="' + e._i + '" data-v="' + v + '" aria-pressed="' + (e.rpe === v) + '">' + v + '</button>').join('') + '</div><p class="sugg">' + esc(msg) + '</p>';
}
function exOrder(date, l) { // plan indexes in this person's order; tolerant of plan changes
  const p = P(date); const n = p ? p.strength.length : 0; const o = [];
  ((l && l.ord) || []).forEach(i => { if (Number.isInteger(i) && i >= 0 && i < n && !o.includes(i)) o.push(i); });
  for (let i = 0; i < n; i++) if (!o.includes(i)) o.push(i);
  return o;
}
function exMoveBtns(i, pos, n, name) {
  if (n < 2) return '';
  return '<div class="exmv"><button class="iconbtn sm mvb" data-a="ex-mv" data-ex="' + i + '" data-v="-1"' + (pos ? '' : ' disabled') + ' aria-label="Move ' + esc(name) + ' up">' + I.up + '</button>' +
    '<button class="iconbtn sm mvb" data-a="ex-mv" data-ex="' + i + '" data-v="1"' + (pos < n - 1 ? '' : ' disabled') + ' aria-label="Move ' + esc(name) + ' down">' + I.down + '</button></div>';
}
function exOrderNote(ord) {
  if (ord.every((x, q) => x === q)) return '';
  const who = S.pid && S.uid && S.pid !== S.uid ? pname(S.pid) + '’s' : 'your';
  return '<div class="exord"><span>In ' + esc(who) + ' own order. The plan hasn’t changed.</span><button class="btn sm ghost" data-a="ex-mv-reset">Back to plan order</button></div>';
}
function strengthCard(date, p, l) {
  if (!p.strength.length) return '<section class="card o4"><div class="row"><span class="muted small" style="flex:1">No strength work planned today.</span>' + (canEditPlan() ? '<button class="btn sm" data-a="pk-day" data-d="' + date + '">' + I.plus + 'Add exercise</button>' : '') + '</div></section>';
  const str = l.str || {};
  let total = 0, done = 0;
  const ord = exOrder(date, l), nEx = ord.length;
  const body = ord.map((i, pos) => {
    const ex = p.strength[i];
    const e = str[i] ? Object.assign({ _i: i }, str[i]) : { _i: i, s: [] };
    const lw = !ex.bw ? gymLastWeights(S.pid, ex.name, date) : null;
    const sets = [];
    let exDone = 0;
    for (let s = 0; s < ex.sets; s++) {
      const x = (e.s && e.s[s]) || {};
      const r = x.r != null ? x.r : (ex.reps != null ? ex.reps : '');
      const fromLast = x.w == null && ex.load == null ? gymLastW(lw, s) : null;
      const w = x.w != null ? x.w : (ex.load != null ? ex.load : fromLast != null ? fromLast : '');
      total++; if (x.d) { done++; exDone++; }
      let pr = false;
      if (x.d && num(w) > 0) { const best = bestLoadBefore(S.pid, ex.name, date); pr = best != null && num(w) > best; }
      sets.push('<div class="set' + (x.d ? ' d' : '') + (pr ? ' pr' : '') + '"><span class="i">' + (s + 1) + '</span>' +
        '<label class="cell"><input id="r-' + i + '-' + s + '" inputmode="decimal" value="' + esc(r) + '" data-in="str" data-ex="' + i + '" data-set="' + s + '" data-k="r" aria-label="Set ' + (s + 1) + ' ' + unitLbl(ex) + '"><em>' + unitLbl(ex) + '</em></label>' +
        '<label class="cell"><input id="w-' + i + '-' + s + '"' + (fromLast != null ? ' class="lw"' : '') + ' inputmode="decimal" value="' + esc(w) + '" placeholder="' + (ex.bw ? 'BW' : '–') + '" data-in="str" data-ex="' + i + '" data-set="' + s + '" data-k="w" aria-label="Set ' + (s + 1) + ' load"><em>' + loadLbl(ex) + '</em></label>' +
        '<button class="tick" data-a="set" data-ex="' + i + '" data-set="' + s + '" aria-pressed="' + (!!x.d) + '" aria-label="Set ' + (s + 1) + ' done">' + I.check + '</button></div>');
    }
    const fk = 'ex:' + date + ':' + i; const fo = !!FOLDS()[fk];
    return '<div class="ex' + (exDone >= ex.sets ? ' done' : '') + (fo ? ' folded' : '') + '" id="ex-' + i + '"><div class="ex-top"><div class="ex-h exfold" data-a="exfold" data-k="' + fk + '" role="button" tabindex="0" aria-expanded="' + !fo + '" aria-label="' + esc(ex.name) + ': show or hide sets"><div class="n"><b>' + esc(ex.name) + '</b></div>' +
      '<span class="exn mono">' + exDone + '/' + ex.sets + '</span></div>' + exMoveBtns(i, pos, nEx, ex.name) + '</div>' +
      '<div class="sets">' + (lw ? '<p class="small muted lastw">Last time, ' + esc(fmtDate(lw.date)) + ': ' + esc(gymLastTxt(lw, ex)) + '</p>' : '') + sets.join('') + gymPmHTML(date, i, ex) + '</div></div>';
  }).join('');
  const allFolded = p.strength.every((ex, i) => FOLDS()['ex:' + date + ':' + i]);
  return '<section class="card o4"><div class="card-h"><h3>Main strength</h3><span class="sp"></span><span class="mono small muted">' + done + '/' + total + ' sets</span>' + (date === todayISO() && S.pid ? '<button class="btn sm ghost exall" data-a="md-open" data-v="gym" data-s="set">' + I.barbell + 'Gym mode</button>' : '') + '<button class="btn sm ghost exall" data-a="exfold-all" data-d="' + date + '" data-n="' + p.strength.length + '">' + (allFolded ? 'Show all sets' : 'Hide all sets') + '</button></div>' +
    '<div class="progressline" style="margin-bottom:14px"><i style="width:' + (total ? Math.round(100 * done / total) : 0) + '%"></i></div>' + body + exOrderNote(ord) +
    (canEditPlan() ? '<div class="row" style="margin-top:14px"><button class="btn sm" data-a="pk-day" data-d="' + date + '">' + I.plus + 'Add exercise</button><button class="btn sm ghost" data-a="edit-plan" data-d="' + date + '">' + I.edit + 'Edit exercises</button></div>' : '') + '</section>';
}

/* ---------- running ---------- */
function runCard(date, p, l) {
  const run = p.run; if (run.none && !(l.runs && l.runs.length)) return '';
  const runs = (l.runs && l.runs.length) ? l.runs : [{ type: run.type, _draft: true }];
  const zones = S.pid ? zonesFor(S.pid) : [];
  const z = run.zone ? zones.find(x => x.key === run.zone) : null;
  const tKm = sum((l.runs || []).map(r => r.dist || 0)), tSec = sum((l.runs || []).map(r => r.time && r.dist ? r.time : 0)), tKmT = sum((l.runs || []).filter(r => r.time && r.dist).map(r => r.dist));
  const avg = tKmT ? tSec / tKmT : null;
  const rpes = (l.runs || []).map(r => r.rpe).filter(Boolean);
  let cmp = '';
  const tgt = run.pace || (z && z.lo ? { lo: z.lo, hi: z.hi } : null);
  if (avg && tgt && (run.type === 'easy' || run.type === 'long' || run.type === 'tempo')) {
    if (avg >= tgt.lo - 2 && avg <= tgt.hi + 2) cmp = '<span class="delta good">On target</span>';
    else if (avg < tgt.lo) cmp = '<span class="delta ' + (run.type === 'tempo' ? 'good' : 'bad') + '">' + Math.round(tgt.lo - avg) + ' s/km faster than target' + (run.type !== 'tempo' ? ', slow down' : '') + '</span>';
    else cmp = '<span class="delta bad">' + Math.round(avg - tgt.hi) + ' s/km slower than target</span>';
  }
  const tgtTxt = run.pace ? fmtPace(run.pace.lo) + '–' + fmtPace(run.pace.hi) + '/km' : z ? z.txt : run.type === 'tt' ? 'Time trial: hard and even' : '–';
  const w = p.week;
  const entries = runs.map((r, j) => runEntry(date, p, r, j, runs.length)).join('');
  return '<section class="card o5"><div class="card-h"><h3>Running</h3>' + (p.day.km ? '<span class="pill">≈' + fmtKm(p.day.km) + ' km planned</span>' : '') + '</div>' +
    '<p class="small" style="color:var(--ink-2);margin-bottom:12px">' + esc(run.text) + '</p>' +
    '<div class="target"><div class="tv"><span>Target</span><b>' + esc(tgtTxt) + '</b><small>' + (run.rpe ? 'RPE ' + esc(run.rpe) : z ? 'RPE ' + esc(z.rpe) : '') + (p.day.km ? ' · ≈' + fmtKm(p.day.km) + ' km' : '') + '</small></div>' +
    '<div class="tv' + (tKm ? ' me' : '') + '"><span>You</span><b>' + (tKm ? fmtKm(tKm, 2) + ' km' : '–') + (avg ? ' · ' + fmtPace(avg) + '/km' : '') + '</b><small>' + (tSec ? fmtTime(tSec) : 'Not logged yet') + (rpes.length ? ' · RPE ' + rpes.join(', ') : '') + '</small></div></div>' +
    (cmp ? '<p style="margin-top:8px">' + cmp + '</p>' : '') +
    '<div class="stack" style="margin-top:12px">' + entries + '</div>' +
    '<div class="row" style="margin-top:10px"><button class="btn sm" data-a="run-add">' + I.plus + 'Add run</button>' + '</div>' +
    (w ? '<details style="margin-top:10px"><summary class="small">Pace key this week</summary><p class="small muted">' + esc(w.pace) + '</p>' + (zones.length ? '<p class="small" style="margin-top:6px"><b>Your zones' + (zones[0].dflt ? ' (defaults until your first test)' : '') + ':</b> ' + zones.map(z => esc(z.name) + ' ' + esc(z.txt)).join(' · ') + '</p>' : '') + '</details>' : '') + '</section>';
}
function runEntry(date, p, r, j, n) {
  const pace = r.dist && r.time ? fmtPace(r.time / r.dist) + '/km' : '–';
  const repsN = Math.max(r.reps ? r.reps.length : 0, p.run.reps && j === 0 ? p.run.reps.n : 0); // v35: never fewer boxes than the plan's reps, however many are filled in so far
  const repDist = r.repDist || (p.run.reps && p.run.reps.dist) || null;
  let reps = '';
  if (repsN && (r.type === 'intervals' || r.type === 'rp' || r.reps)) {
    reps = '<div class="field"><span>Rep times' + (repDist ? ' (' + (repDist < 1 ? repDist * 1000 + ' m' : repDist + ' km') + ' each)' : '') + '</span><div class="fgrid" style="grid-template-columns:repeat(auto-fill,minmax(74px,1fr))">';
    for (let k = 0; k < repsN; k++) reps += '<input class="inp mono" id="rep-' + j + '-' + k + '" placeholder="#' + (k + 1) + '" inputmode="text" value="' + esc((r.reps && r.reps[k]) || '') + '" data-in="rep" data-j="' + j + '" data-k="' + k + '" data-rd="' + (repDist || '') + '" aria-label="Rep ' + (k + 1) + ' time">';
    reps += '</div></div>';
  }
  return '<div class="entry" data-run="' + j + '"><div class="entry-h"><b>' + (n > 1 ? 'Run ' + (j + 1) : 'Your run') + '</b>' +
    '<select class="inp" style="width:auto;min-height:36px;font-size:14px" id="rt-' + j + '" data-in="run" data-j="' + j + '" data-k="type" aria-label="Run type">' + RUN_TYPES.map(t => '<option value="' + t[0] + '"' + ((r.type || p.run.type) === t[0] ? ' selected' : '') + '>' + t[1] + '</option>').join('') + '</select>' +
    (!r._draft ? '<button class="btn sm ghost" data-a="run-del" data-j="' + j + '" aria-label="Remove run">' + I.close + '</button>' : '') + '</div>' +
    '<div class="fgrid"><label class="field"><span>Distance (km)</span><input class="inp mono" id="rd-' + j + '" inputmode="decimal" placeholder="' + (p.day.km ? fmtKm(p.day.km) : '0.0') + '" value="' + esc(r.dist != null ? r.dist : '') + '" data-in="run" data-j="' + j + '" data-k="dist"></label>' +
    '<label class="field"><span>Time (h:mm:ss)</span><input class="inp mono" id="rtm-' + j + '" inputmode="text" placeholder="mm:ss" value="' + esc(r.time ? fmtTime(r.time) : '') + '" data-in="run" data-j="' + j + '" data-k="time"></label>' +
    '<div class="field"><span>Avg pace</span><div class="inp mono" style="display:flex;align-items:center;background:var(--surface-2)" id="rp-' + j + '">' + pace + '</div></div></div>' +
    reps +
    '<div class="field"><span>RPE</span><div class="chips rpe">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => '<button class="chip" data-a="run-rpe" data-j="' + j + '" data-v="' + v + '" aria-pressed="' + (r.rpe === v) + '">' + v + '</button>').join('') + '</div></div>' +
    '<label class="field"><span>Notes</span><input class="inp" id="rn-' + j + '" value="' + esc(r.notes || '') + '" placeholder="Heart rate, route, how it felt" data-in="run" data-j="' + j + '" data-k="notes"></label></div>';
}

/* ---------- HYROX ---------- */
function hyroxCard(date, p, l) {
  const hy = p.hyrox; const xh = l.xh || [];
  if (hy.none && !xh.length) return '';
  const hx = l.hx || {};
  const pid = S.pid;
  let lastGrp = null, lastSrc = null;
  const rows = hy.rows.map(r => {
    let pre = '';
    if (r.grp && r.grp !== lastGrp) { pre = '<div class="grp">' + esc(r.grp) + '</div>'; }
    else if (!r.grp && lastGrp && r.src !== lastSrc) pre = '<div class="grp">&nbsp;</div>';
    lastGrp = r.grp; lastSrc = r.src;
    if (r.kind === 'note') return pre + '<p class="small muted">' + esc(r.text) + '</p>';
    const e = hx[r.i] || {};
    if (r.kind === 'run') {
      const tg = pid ? runTarget(pid, r) : null; const tm = parseTime(e.time);
      return pre + '<div class="hx run' + (e.d ? ' d' : '') + '"><div class="hx-h"><div class="n"><b>' + esc(r.label) + '</b><small>' + (tg ? 'Target ' + fmtTime(tg) + (r.tag === 'race' ? ' (Plan ' + planOf(pid) + ' Run ' + r.runNo + ')' : r.tag === 'rp' ? ' at race pace' : '') : 'Run segment') + (tm && tg ? ' · <span class="delta ' + (tm <= tg ? 'good' : 'bad') + '">' + fmtDelta(tm - tg) + '</span>' : '') + '</small></div>' +
        '<input class="inp mono" style="width:108px" id="hxt-' + r.i + '" placeholder="m:ss" value="' + esc(e.time || '') + '" data-in="hx" data-i="' + r.i + '" data-k="time" aria-label="' + esc(r.label) + ' time">' +
        '<button class="tickbtn" data-a="hx-tick" data-i="' + r.i + '" aria-pressed="' + (!!e.d) + '" aria-label="Done">' + I.check + '</button></div></div>';
    }
    const tg = (r.chain || r.test || p.kind === 'race') && r.st !== 'other' && pid ? stationTarget(pid, r.st, num(e.amt != null ? e.amt : r.amount)) : null;
    const tm = parseTime(e.time);
    return pre + '<div class="hx' + (e.d ? ' d' : '') + '"><div class="hx-h"><div class="n"><b>' + esc(r.title) + '</b><small>' + esc(r.sub) + '</small>' +
      (tg ? '<small style="display:block">Target ' + fmtTime(tg) + ' (Plan ' + planOf(pid) + (r.amount && r.amount !== ST_RACE_AMT[r.st] ? ', scaled' : '') + ')' + (tm ? ' · <span class="delta ' + (tm <= tg ? 'good' : 'bad') + '">' + fmtDelta(tm - tg) + '</span>' : '') + '</small>' : '') + '</div>' +
      '<button class="tickbtn" data-a="hx-tick" data-i="' + r.i + '" aria-pressed="' + (!!e.d) + '" aria-label="' + esc(r.title) + ' done">' + I.check + '</button></div>' +
      (r.st !== 'other' ? '<div class="fgrid"><label class="field"><span>' + (r.unit === 'reps' ? 'Reps' : 'Metres') + '</span><input class="inp mono" id="hxa-' + r.i + '" inputmode="decimal" value="' + esc(e.amt != null ? e.amt : (r.amount != null ? r.amount : '')) + '" data-in="hx" data-i="' + r.i + '" data-k="amt"></label>' +
        '<label class="field"><span>Load' + (r.dual ? ' (kg ×2)' : ' (kg)') + '</span><input class="inp mono" id="hxl-' + r.i + '" inputmode="decimal" value="' + esc(e.load != null ? e.load : (r.load != null ? r.load : '')) + '" placeholder="–" data-in="hx" data-i="' + r.i + '" data-k="load"></label>' +
        '<label class="field"><span>Time</span><input class="inp mono" id="hxt-' + r.i + '" placeholder="m:ss" value="' + esc(e.time || '') + '" data-in="hx" data-i="' + r.i + '" data-k="time"></label>' +
        '<label class="field"><span>RPE</span><select class="inp" id="hxr-' + r.i + '" data-in="hx" data-i="' + r.i + '" data-k="rpe"><option value="">–</option>' + [5, 6, 7, 8, 9, 10].map(v => '<option' + (+e.rpe === v ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label></div>' : '') +
      '</div>';
  }).join('');
  const extra = xh.map((e, k) => '<div class="hx"><div class="hx-h"><div class="n"><b>Extra: ' + esc(stName(e.st || 'other')) + '</b></div><button class="btn sm ghost" data-a="xh-del" data-k="' + k + '">' + I.close + '</button></div>' +
    '<div class="fgrid"><label class="field"><span>Station</span><select class="inp" id="xs-' + k + '" data-in="xh" data-k2="st" data-k="' + k + '">' + ST_KEYS.map(s => '<option value="' + s + '"' + (e.st === s ? ' selected' : '') + '>' + esc(stName(s)) + '</option>').join('') + '</select></label>' +
    '<label class="field"><span>m / reps</span><input class="inp mono" id="xa-' + k + '" value="' + esc(e.amt || '') + '" inputmode="decimal" data-in="xh" data-k2="amt" data-k="' + k + '"></label>' +
    '<label class="field"><span>Load (kg)</span><input class="inp mono" id="xl-' + k + '" value="' + esc(e.load || '') + '" inputmode="decimal" data-in="xh" data-k2="load" data-k="' + k + '"></label>' +
    '<label class="field"><span>Time</span><input class="inp mono" id="xt-' + k + '" value="' + esc(e.time || '') + '" placeholder="m:ss" data-in="xh" data-k2="time" data-k="' + k + '"></label>' +
    '<label class="field"><span>RPE</span><input class="inp mono" id="xr-' + k + '" value="' + esc(e.rpe || '') + '" inputmode="numeric" data-in="xh" data-k2="rpe" data-k="' + k + '"></label></div></div>').join('');
  const isSim = (p.day.badges || []).includes('sim') || p.kind === 'race' || hy.chain;
  const cues = p.stations.length ? '<div class="cues" style="margin-bottom:12px">' + p.stations.map(k => { const s = stInfo(k); return '<details class="cue"><summary>' + esc(s.name) + '</summary><p><b>Standard:</b> ' + esc(s.standard || '') + (loadText(k, S.pid) ? ' · ' + esc(loadText(k, S.pid)) : '') + '</p><p>' + esc(s.cue || '') + '</p></details>'; }).join('') + '</div>' : '';
  let simBox = '';
  if (isSim) {
    const segSum = sum(hy.rows.map(r => parseTime((hx[r.i] || {}).time) || 0));
    simBox = '<div class="fgrid" style="margin-top:14px;grid-template-columns:repeat(2,minmax(0,1fr))"><label class="field"><span>Roxzone / transitions total</span><input class="inp mono" id="rox" placeholder="m:ss" value="' + esc(l.rox || '') + '" data-in="lg" data-k="rox"></label>' +
      '<label class="field"><span>Total time' + (segSum ? ' (splits: ' + fmtTime(segSum) + ')' : '') + '</span><input class="inp mono" id="simtotal" placeholder="h:mm:ss" value="' + esc(l.simTotal || '') + '" data-in="lg" data-k="simTotal"></label></div>' +
      '<div class="row" style="margin-top:10px"><button class="btn sm" data-a="tool" data-t="race" data-mode="watch">' + I.timer + 'Split stopwatch</button></div>';
  }
  return '<section class="card o6"><div class="card-h"><h3>HYROX work</h3>' + (date === todayISO() && S.pid ? '<span class="hbr"></span><button class="btn sm ghost exall" data-a="md-open" data-v="hx" data-s="hx">' + I.stopwatch + (l.hxc ? 'Back to clock' : 'HYROX mode') + '</button>' : '') + '</div>' + (hy.qual ? '<p class="small" style="margin:-4px 0 12px;color:var(--ink-2)"><b>How:</b> ' + esc(hy.qual) + '</p>' : '') + cues +
    '<div class="stack">' + rows + extra + '</div>' + simBox +
    '<div class="row" style="margin-top:12px"><button class="btn sm" data-a="xh-add">' + I.plus + 'Add station entry</button></div></section>';
}

/* ---------- finish ---------- */
const REASONS = ['Tired', 'Sore', 'Unwell', 'No time', 'Equipment', 'Pain or niggle', 'Travel'];
