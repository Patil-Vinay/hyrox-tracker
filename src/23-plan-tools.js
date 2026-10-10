/* ---------- v32: plan tools, brought over from GymFloorCoach and fitted to the one shared HYROX plan ----------
   In GymFloorCoach every member has a plan of their own. Here there is one plan (plan_days) that everyone follows and
   trains together on, so these tools change that plan for everyone (Vinay's choice):
   - Who: any member with a profile, and the admin (canEditPlan). firestore.rules lets a member write plan_days only.
   - Add exercise on a day (the picker, exercises.js), and the day editor ("Edit exercises") for members too.
     Logged sets stay with their exercise: ptRelogAll moves every person's sets, own order and accessory ticks for that
     day to where their items are now. A member can only write their own log (and a training partner's that day), so
     a member's save is refused when it would move somebody else's logged sets (ptEditBlocked); adding is always fine.
   - + / − sets (day page and gym mode): that exercise gets the same number of sets on that day and on every later day
     that has it (plan_days is rewritten for those days). − never goes below 1 and not while the last set is ticked.
   - Move a session: two days swap, in the same week or up to 3 days either side (v36: a Monday session can go to the
     Sunday before it). Days gone by, days anyone has logged, test days and race day stay. The day remembers where it came from (`moved`), so "Move back" swaps again.
   - Catch up a session you missed this week: on a free day, or added to another day's session. The missed day becomes
     "Done later" (no score). Only when nobody logged the missed day (the plan is shared). Undo while the new day isn't
     logged: both days go back exactly as they were (kept in the "Done later" day as `orig` and `prevTo`).
   - Change exercises: swap or remove a Main strength exercise on every day from today on. Sets and reps stay; the
     planned weight goes (it was for the old exercise). Days anyone has logged stay as they were.
   - Last time's weights: under each exercise, and grey in the weight boxes when the plan gives no weight.
   - Training together, gym mode: a line per partner under each set for their reps and weight ("Own weights" only).
     together.js mirrors only what you changed (tgCopyDiff), so a partner's own reps stay theirs. */
const canEditPlan = () => !!S.user && !S.readOnly && (isAdmin() || ownProfile());
const PT_NO = 'Set up your profile first to change the plan.';
const ptMain = day => (day && Array.isArray(day.fields) ? day.fields.find(f => f.label === 'MAIN STRENGTH') : null);
const ptItems = day => ((ptMain(day) || {}).items || []);
const ptName = it => String(it).split(/\s+—\s+/)[0].trim();
const ptAccOf = day => { const af = day && Array.isArray(day.fields) ? day.fields.find(f => f.label === 'ACCESSORY/CORE') : null; return af ? parseList(af.text || (af.items || []).join('; ')) : []; };
const ptWithItems = (day, items) => { const nd = clone(day); delete nd._u; nd.fields = nd.fields.map(f => f.label === 'MAIN STRENGTH' ? Object.assign({}, f, { items, text: items.length ? '' : 'None.' }) : f); return nd; };
const PT_LOGGED = new Set(['complete', 'modified', 'partial', 'skipped', 'restdone']);
function ptLoggedBy(pid, d) { const l = getLog(d, pid); return PT_LOGGED.has(dayState(pid, d)) || !!(l && (l.start || (l.photos || []).length || hasActivity(l))); }
const ptLoggedWho = d => peopleIds().filter(pid => ptLoggedBy(pid, d));
const ptLoggedAny = d => ptLoggedWho(d).length > 0;
const ptNames = ids => ids.map(u => u === S.uid ? 'you' : pname(u)).join(' and ');

/* ---- logged sets, own order and accessory ticks stay with their item when a day's lists change ---- */
function ptRelog(l, oldNames, newNames, oldAcc, newAcc) {
  const nl = clone(l);
  if (JSON.stringify(newNames) !== JSON.stringify(oldNames) && (l.str || l.ord)) {
    if (l.str) {
      const used = new Set(), ns = {};
      newNames.forEach((n, j) => { const i = oldNames.findIndex((o, k) => o === n && !used.has(k) && l.str[k]); if (i >= 0) { used.add(i); ns[j] = l.str[i]; } });
      nl.str = ns;
    }
    if (l.ord) {
      const used = new Set(), no = [];
      l.ord.forEach(k => { const j = newNames.findIndex((n, q) => n === oldNames[k] && !used.has(q)); if (j >= 0) { used.add(j); no.push(j); } });
      if (no.length && !no.every((x, q) => x === q)) nl.ord = no; else delete nl.ord;
    }
  }
  if (oldAcc && newAcc && JSON.stringify(newAcc) !== JSON.stringify(oldAcc) && (l.acc || (l.rm && l.rm.acc))) {
    const used = new Set(), map = {}; oldAcc.forEach((t, i) => { const j = newAcc.findIndex((n, q) => n === t && !used.has(q)); if (j >= 0) { used.add(j); map[i] = j; } });
    if (l.acc) { nl.acc = {}; Object.keys(l.acc).forEach(i => { if (l.acc[i] && map[i] != null) nl.acc[map[i]] = l.acc[i]; }); }
    if (l.rm && l.rm.acc) { const o = {}; Object.keys(l.rm.acc).forEach(k => { if (k[0] === '+') o[k] = l.rm.acc[k]; else if (map[k] != null) o[map[k]] = l.rm.acc[k]; }); if (Object.keys(o).length) nl.rm.acc = o; else { delete nl.rm.acc; if (!Object.keys(nl.rm).length) delete nl.rm; } }
  }
  return nl;
}
function ptRelogAll(date, oldNames, newNames, oldAcc, newAcc, dry) { // dry: who has a log that would change and that this account can't write
  const blocked = [];
  Object.keys(S.logs).forEach(id => {
    const l = S.logs[id]; if (!l || l.date !== date) return;
    const nl = ptRelog(l, oldNames, newNames, oldAcc, newAcc); if (canon(nl) === canon(l)) return;
    if (!canWriteDoc('logs', id)) { blocked.push(l.pid); return; }
    if (!dry) put('logs', id, nl);
  });
  return blocked;
}
function ptEditBlocked(date) { // the day editor, before saving: [pids] whose logged sets a member's change would have to move
  if (!ED || isAdmin()) return [];
  const newNames = ED.ex.filter(e => e.name.trim()).map(e => ptName(joinEx(e))), newAcc = ED.acc.map(x => x.trim()).filter(Boolean);
  return ptRelogAll(date, ED.orig, newNames, ptAccOf(S.days[date]), newAcc, true);
}

/* ---- last time's weights ---- */
function gymLastWeights(pid, name, date) {
  if (!pid || !name || !date) return null;
  const k = normEx(name); let best = null;
  Object.values(S.logs).forEach(l => {
    if (!l || l.pid !== pid || !l.str || !l.date || l.date >= date || (best && l.date <= best.date)) return;
    Object.keys(l.str).forEach(idx => {
      const e = l.str[idx]; if (!e || !Array.isArray(e.s) || normEx(exName(l.date, +idx, e)) !== k) return;
      const ws = e.s.map(x => x && x.w != null && x.w !== '' && !isNaN(+x.w) ? +x.w : null);
      if (ws.some(w => w != null)) best = { date: l.date, ws };
    });
  });
  return best;
}
function gymLastW(lw, k) { // set k's weight last time; a set they didn't have takes the nearest one before it
  if (!lw) return null;
  for (let q = Math.min(k, lw.ws.length - 1); q >= 0; q--) if (lw.ws[q] != null) return lw.ws[q];
  return lw.ws.find(w => w != null);
}
const gymLastTxt = (lw, ex) => lw.ws.filter(w => w != null).join(' · ') + ' ' + loadLbl(ex);

/* ---- + / − sets: that day and every later day that has the exercise ---- */
function gymSetsTo(it, n) { // the item with n sets, or null if it has no sets to change
  const parts = String(it).split(/\s+—\s+/), i = parts.findIndex((p, j) => j > 0 && /^\d+\s*×/.test(p));
  if (i > 0) parts[i] = parts[i].replace(/^\d+/, String(n));
  else if (parts[1] && /^\d/.test(parts[1])) parts[1] = n + ' × ' + parts[1];
  else return null;
  return parts.join(' — ');
}
function gymSetPm(date, i, v) {
  const p = P(date), ex = p && p.strength[i], day = S.days[date]; if (!ex || !day) return;
  if (!canEditPlan()) { toast(PT_NO); return; }
  const n = ex.sets + v; if (n < 1) return; if (n > 12) { toast('12 sets is the most.'); return; }
  const raw = ptItems(day)[i];
  if (!raw || !gymSetsTo(raw, n)) { toast('This one has no sets to change. Use Edit exercises.'); return; }
  if (v < 0) { // the set that goes: nobody may have ticked it
    const who = peopleIds().filter(u => { const x = (((((getLog(date, u) || {}).str || {})[i] || {}).s) || [])[ex.sets - 1]; return x && x.d; });
    if (who.length) { toast(who.includes(S.pid) ? 'Untick set ' + ex.sets + ' first.' : ptNames(who) + ' ticked set ' + ex.sets + ', so it stays.'); return; }
  }
  const key = normEx(ex.name); let days = 0;
  S.order.filter(d => d >= date).forEach(d => {
    const its = ptItems(S.days[d]); if (!its.length) return; let ch = false;
    const out = its.map((it, j) => {
      if (normEx(ptName(it)) !== key) return it;
      if (d !== date && v < 0 && peopleIds().some(u => { const x = (((((getLog(d, u) || {}).str || {})[j] || {}).s) || [])[n]; return x && x.d; })) return it; // a later day somebody already did more of
      const x = gymSetsTo(it, n); if (!x || x === it) return it; ch = true; return x;
    });
    if (ch && put('plan_days', d, ptWithItems(S.days[d], out))) days++;
  });
  if (!days) return;
  if (v < 0) { const gone = ((((getLog(date) || {}).str || {})[i] || {}).s) || []; if (gone.length > n) editLog(date, x => { const e = x.str && x.str[i]; if (e && Array.isArray(e.s)) e.s = e.s.slice(0, n); }, { render: false }); }
  toast(ex.name.replace(/\s*\(.*?\)/, '') + ': ' + n + (n === 1 ? ' set' : ' sets') + ' from ' + fmtDate(date) + ' on' + (days > 1 ? ', on all ' + days + ' days that have it' : '') + ', for everyone.');
  if (typeof MODE !== 'undefined' && MODE && MODE.kind === 'gym' && MODE.date === date) { if (MODE.i === i && MODE.s >= n) MODE.s = n - 1; renderMode(); }
  render();
}
const gymPmHTML = (date, i, ex) => canEditPlan() ? '<div class="setpm"><button class="iconbtn sm" data-a="set-pm" data-d="' + date + '" data-ex="' + i + '" data-v="-1"' + (ex.sets > 1 ? '' : ' disabled') + ' aria-label="One set fewer of ' + esc(ex.name) + '">−</button><span class="small muted">' + ex.sets + (ex.sets === 1 ? ' set' : ' sets') + '</span><button class="iconbtn sm" data-a="set-pm" data-d="' + date + '" data-ex="' + i + '" data-v="1" aria-label="One more set of ' + esc(ex.name) + '">+</button></div>' : '';

/* ---- move a session (two days of the same week swap) ---- */
function gymMovable(d) {
  const day = S.days[d];
  if (!S.pid || !day || !day.week || d < todayISO() || day.kind === 'race' || day.caught || day.caughtTo || !canEditPlan()) return false;
  if (ptLoggedAny(d)) return false;
  const p = P(d); return !(p && p.tests && p.tests.length);
}
function gymMoveTargets(d) {
  const wk = S.days[d].week, rest = S.days[d].kind === 'rest';
  return S.order.filter(x => x !== d && (S.days[x].week === wk || Math.abs(diffDays(x, d)) <= 3) && !(rest && S.days[x].kind === 'rest') && gymMovable(x)); // v36: or up to 3 days either side, across the week's edge
}
function gymSwapDays(a, b) {
  const mk = (d, other) => { // what date d holds after the swap: the other day's session
    const x = clone(S.days[other]); delete x._u; const home = x.moved || other;
    Object.assign(x, { date: d, dow: S.days[d].dow || DOWS[dowOf(d)], week: S.days[d].week });
    if (home === d) delete x.moved; else x.moved = home;
    return x;
  };
  const na = mk(a, b), nb = mk(b, a);
  return put('plan_days', a, na) && put('plan_days', b, nb);
}
const gymDayName = d => S.days[d] && S.days[d].kind === 'rest' ? 'Rest' : (S.days[d] || {}).heading || 'Session';
function gymMoveButtons(date) { // on a session: Move, or Move back
  const day = S.days[date]; let h = '';
  if (day && day.moved && S.days[day.moved] && gymMovable(date) && gymMovable(day.moved)) h += '<button class="btn sm ghost" data-a="gym-move-back" data-d="' + date + '">Move back</button>';
  else if (gymMovable(date) && gymMoveTargets(date).length) h += '<button class="btn sm ghost" data-a="gym-move" data-d="' + date + '">' + I.cal + 'Move</button>';
  return h;
}
const gymMovedNote = date => { const d = S.days[date] || {}; if (d.caught || d.caughtTo) return gymCaughtNote(date); return d.moved ? '<p class="small muted moved">Moved here from ' + esc(fmtDateLong(d.moved)) + '.</p>' : ''; };
function sheetMove(o) {
  const d = o.date, day = S.days[d]; if (!day) return { title: 'Move', body: '' };
  const rest = day.kind === 'rest', ts = gymMoveTargets(d);
  const row = x => '<button class="toolbtn" data-a="gym-move-to" data-d="' + d + '" data-v="' + x + '"><span><b>' + esc(fmtDateLong(x)) + '</b><br><span class="small muted">' + esc(gymDayName(x)) + '</span></span></button>';
  return { title: rest ? 'Train on ' + esc(fmtDate(d)) : 'Move ' + esc(day.heading), body: '<div class="stack"><p class="small muted">' +
    (rest ? 'Pick a session from this week (or up to 3 days either side) to do on ' + esc(fmtDateLong(d)) + '. Its day becomes a rest day.' : 'Pick another day this week, or up to 3 days either side. The two days swap: ' + esc(day.heading) + ' goes there, and that day’s session (or rest) comes to ' + esc(fmtDateLong(d)) + '.') +
    ' The plan changes for everyone. Days gone by, days someone has logged, test days and race day stay where they are.</p>' +
    (ts.length ? ts.map(row).join('') : '<p class="empty">No other day this week can swap.</p>') + '</div>' };
}

/* ---- catch up a missed session (same week) ---- */
function gymCatchSrc(d) { // can the session on d still be done this week?
  const pid = S.pid, day = S.days[d], t = todayISO();
  if (!pid || !day || d >= t || !day.week || ['rest', 'race'].includes(day.kind) || day.caughtTo || day.caught || !canEditPlan()) return false;
  if (dayState(pid, d) !== 'missed' || ptLoggedAny(d)) return false; // somebody did it that day: the shared plan stays
  const p = P(d); return !(p && p.tests && p.tests.length);
}
function gymCatchTargets(d) { // { free: [dates], add: [dates] }
  const t = todayISO(), wk = mondayOf(d), out = { free: [], add: [] };
  S.order.forEach(x => {
    const day = S.days[x]; if (x < t || x === d || mondayOf(x) !== wk || !day || day.caught || day.caughtTo || day.kind === 'race') return;
    if (ptLoggedAny(x)) return; const p = P(x); if (p && p.tests && p.tests.length) return;
    (day.kind === 'rest' ? out.free : out.add).push(x);
  });
  return out;
}
const gymCatchBtn = d => { if (!gymCatchSrc(d)) return ''; const tg = gymCatchTargets(d); return tg.free.length || tg.add.length ? '<button class="btn sm" data-a="catch-open" data-d="' + d + '" style="margin-top:8px">' + I.cal + 'Catch up this week</button>' : ''; };
function sheetCatch(o) {
  const d = o.date, day = S.days[d]; if (!day) return { title: 'Catch up', body: '' };
  const tg = gymCatchTargets(d), row = (x, how) => '<button class="toolbtn" data-a="catch-do" data-d="' + d + '" data-v="' + x + '" data-h="' + how + '"><span><b>' + esc(fmtDateLong(x)) + '</b><br><span class="small muted">' + esc(how === 'move' ? 'Rest day' : gymDayName(x) + ' + ' + day.heading) + '</span></span></button>';
  return { title: 'Catch up ' + esc(day.heading), body: '<div class="stack"><p class="small muted">' + esc(day.heading) + ' on ' + esc(fmtDateLong(d)) + ' wasn’t done. Do it later this week instead: it then counts on the day you do it, and ' + esc(fmtDate(d)) + ' shows “Done later”. The plan changes for everyone.</p>' +
    '<b class="small">Do it on a free day</b>' + (tg.free.length ? tg.free.map(x => row(x, 'move')).join('') : '<p class="small muted">No free day left this week.</p>') +
    '<b class="small" style="margin-top:6px">Add it to another day’s session</b>' + (tg.add.length ? tg.add.map(x => row(x, 'add')).join('') : '<p class="small muted">No other session left this week.</p>') + '</div>' };
}
function gymCatchDo(d, to, how) {
  if (!gymCatchSrc(d)) return;
  const orig = clone(S.days[d]), prevTo = clone(S.days[to]); if (!orig || !prevTo) return; delete orig._u; delete prevTo._u;
  const src = clone(orig); delete src.moved;
  let nd;
  if (how === 'move') nd = Object.assign(src, { date: to, dow: prevTo.dow || DOWS[dowOf(to)], week: prevTo.week, caught: d, caughtHow: 'move' });
  else {
    nd = clone(prevTo);
    const items = f => ((src.fields.find(x => x.label === f) || {}).items || []);
    nd.fields = nd.fields.map(f => {
      if (f.label === 'MAIN STRENGTH') { const its = (f.items || []).concat(gymFresh(items('MAIN STRENGTH').map(ptName), (f.items || []).map(ptName)).map(n => items('MAIN STRENGTH').find(it => ptName(it) === n))); return Object.assign({}, f, { items: its, text: its.length ? '' : f.text }); } // an exercise both days have stays once
      if (f.label === 'ACCESSORY/CORE') { const a = (src.fields.find(x => x.label === 'ACCESSORY/CORE') || {}).text || ''; return isNone(a) ? f : Object.assign({}, f, { text: [isNone(f.text) ? '' : String(f.text).replace(/\.\s*$/, ''), a.replace(/\.\s*$/, '')].filter(Boolean).join('; ') + '.' }); }
      if (f.label === 'TOTAL SESSION TIME') { const m = s => +((String(s || '').match(/(\d+)/) || [])[1] || 0); const t2 = m(f.text) + m((src.fields.find(x => x.label === 'TOTAL SESSION TIME') || {}).text); return t2 ? Object.assign({}, f, { text: '~' + t2 + ' min' }) : f; }
      return f;
    });
    const h = prevTo.heading + ' + ' + src.heading;
    Object.assign(nd, { heading: h, short: h, session: h, caught: d, caughtHow: 'add' });
  }
  const mark = { date: d, dow: orig.dow || DOWS[dowOf(d)], week: orig.week, kind: 'rest', heading: 'Done later', short: 'Later', tiny: 'Later', session: 'Done later', km: 0, gate: 0, badges: [],
    caughtTo: to, caughtHow: how, caughtName: orig.heading, orig, prevTo, fields: [{ items: [], label: 'REST / RECOVERY', qual: '', text: orig.heading + (how === 'move' ? ' moved to ' : ' added to ') + fmtDateLong(to) + ', to catch up.' }] };
  if (!put('plan_days', to, nd) || !put('plan_days', d, mark)) return;
  closeSheet(); toast(orig.heading + (how === 'move' ? ' is on ' : ' is added to ') + fmtDate(to) + ' now, for everyone.'); go({ view: 'day', date: to });
}
function gymCatchUndo(d) {
  const m = S.days[d]; if (!m || !m.caughtTo || !m.orig || !m.prevTo || !canEditPlan()) return;
  const to = m.caughtTo, who = ptLoggedWho(to); if (who.length) { toast(ptNames(who).replace(/^y/, 'Y') + (who.length === 1 && who[0] !== S.uid ? ' has' : ' have') + ' logged ' + fmtDate(to) + ' already, so it stays.'); return; }
  if (put('plan_days', to, m.prevTo) && put('plan_days', d, m.orig)) { toast('Back as it was.'); render(); }
}
function gymCaughtNote(date) { // on both days
  const day = S.days[date] || {};
  if (day.caughtTo) return '<p class="small muted moved">' + esc(day.caughtName || 'The session') + (day.caughtHow === 'add' ? ' was added to ' : ' moved to ') + esc(fmtDateLong(day.caughtTo)) + ', to catch up.</p>' +
    (canEditPlan() && day.orig && !ptLoggedAny(day.caughtTo) ? '<button class="btn sm ghost" data-a="catch-undo" data-d="' + date + '" style="margin-top:6px">Undo catch up</button>' : '');
  if (day.caught) return '<p class="small muted moved">' + (day.caughtHow === 'add' ? 'Includes the session missed on ' : 'Catching up the session missed on ') + esc(fmtDateLong(day.caught)) + '.</p>';
  return '';
}

/* ---- change exercises: every day from today on ---- */
const PT_REST_RE = /^(\d+(?:\.\d+)?(?:\s*[–-]\s*\d+(?:\.\d+)?)?\s*(s|min)\b|\d+:\d\d)/;
function ptRename(it, name) { // "Barbell curl — 3 × 10 — 20 kg, RPE 7 — 60 s" → "<name> — 3 × 10 — 60 s": sets, reps and rest stay, the old weight goes
  const parts = String(it).split(/\s+—\s+/), iSR = parts.findIndex((p, j) => j > 0 && /^\d+\s*×/.test(p)), last = parts.length - 1;
  if (iSR < 0) return [name].concat(parts.slice(1)).join(' — ');
  return [name, parts[iSR]].concat(last > iSR && PT_REST_RE.test(parts[last]) ? [parts[last]] : []).join(' — ');
}
function ptPlanExercises() { // every Main strength exercise from today on: [{ n, days: [dates] }], in plan order
  const t = todayISO(), out = new Map();
  S.order.filter(d => d >= t).forEach(d => ptItems(S.days[d]).forEach(it => { const n = ptName(it); if (!out.has(n)) out.set(n, { n, days: [] }); out.get(n).days.push(d); }));
  return [...out.values()];
}
const ptHas = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
function ptSwapPlan(sw) { // { writes: [[date, items]], skipped: [dates], dup: { n, d } | null }
  const t = todayISO(), writes = [], skipped = [];
  for (const d of S.order.filter(x => x >= t)) {
    const items = ptItems(S.days[d]); if (!items.some(it => ptHas(sw, ptName(it)))) continue;
    if (ptLoggedAny(d)) { skipped.push(d); continue; }
    const its = items.map(it => { const n = ptName(it); return !ptHas(sw, n) ? it : sw[n] ? ptRename(it, sw[n]) : null; }).filter(Boolean);
    const dup = gymDupIn(its.map(ptName)); if (dup && !gymDupIn(items.map(ptName))) return { writes: [], skipped, dup: { n: dup, d } };
    writes.push([d, its]);
  }
  return { writes, skipped, dup: null };
}
function sheetSwap() {
  if (!S.swapForm) S.swapForm = { sw: {} };
  const F = S.swapForm, list = ptPlanExercises();
  const rows = list.map((x, i) => {
    const has = ptHas(F.sw, x.n), gone = has && !F.sw[x.n];
    return '<div class="sw-row"><div class="sw-n"><b' + (gone ? ' class="sw-gone"' : '') + '>' + esc(x.n) + '</b><small>' + x.days.length + (x.days.length === 1 ? ' day' : ' days') + ', next ' + esc(fmtDate(x.days[0])) + '</small></div>' +
      (gone ? '<span class="small muted" style="flex:1">Removed</span>' : '<input class="inp" id="sw-' + i + '" value="' + esc(has ? F.sw[x.n] : '') + '" placeholder="Keep" maxlength="50" data-in="gsw" data-n="' + esc(x.n) + '" aria-label="Replace ' + esc(x.n) + ' with"><button class="btn sm" data-a="gsw-pick" data-n="' + esc(x.n) + '" aria-label="Pick an exercise instead of ' + esc(x.n) + '">Pick</button>') +
      '<button class="btn sm ghost" data-a="gsw-rm" data-n="' + esc(x.n) + '">' + (gone ? 'Put back' : 'Remove') + '</button></div>';
  }).join('');
  return { title: 'Change exercises', body: '<div class="stack"><p class="small muted">Pick or type a new exercise to do it instead on every day from today on, or remove one. The plan changes for everyone. Sets and reps stay as the plan has them; the planned weight goes, because it was for the old exercise. Days someone has already logged stay as they are.</p>' +
    '<div class="sw-list">' + (rows || '<p class="empty">No strength exercises left in the plan.</p>') + '</div>' +
    '<div class="flexend"><button class="btn" data-a="close">Cancel</button><button class="btn primary" data-a="gsw-save">Save</button></div></div>' };
}

/* ---- training together, gym mode: your partners' reps and weight, set by set ---- */
function ptTgPartners(date) { // the people you can fill in today, when each keeps their own weights
  if (S.pid !== S.uid || date !== todayISO()) return [];
  const g = tgActive(S.uid, date); if (!g || g.weights === 'same') return [];
  return g.joined.filter(u => u !== S.uid && tgCanWrite(u, date));
}
function ptTgPh(u, date, ex, k, mine) { const w = gymLastW(gymLastWeights(u, ex.name, date), k); return w != null ? w : ex.load != null ? ex.load : (mine != null && mine !== '' ? mine : '–'); } // the grey number: their last time, the plan, else yours
function gymTgModeRows(date, i, k) {
  const us = ptTgPartners(date); if (!us.length) return '';
  const ex = P(date).strength[i]; if (!ex) return '';
  const id = (u, f) => 'mtw' + (f === 'r' ? 'r' : '') + '-' + u + '-' + i + '-' + k, at = (u, f) => ' data-in="gtgw" data-f="' + f + '" data-u="' + u + '" data-ex="' + i + '" data-set="' + k + '"';
  return '<div class="md-card md-tgw"><span class="eyebrow">Training with · set ' + (k + 1) + '</span>' + us.map(u => {
    const l = S.logs[logKey(u, date)] || {}, x = ((((l.str || {})[i] || {}).s) || [])[k] || {}, nm = esc(pname(u));
    const rph = MODE && MODE.r !== '' && MODE.r != null ? MODE.r : ex.reps != null ? ex.reps : '–';
    return '<div class="md-tgw-row"><div class="row md-tgw-who"><span class="dot" style="--pc:' + pcolor(u) + '"></span><b>' + nm + '</b>' + (x.d ? '<span class="small muted">' + I.check + 'set ' + (k + 1) + ' ticked</span>' : '') + '</div>' +
      '<div class="row md-tgw-in"><label class="md-tgw-f"><input class="inp mono" id="' + id(u, 'r') + '" inputmode="decimal" value="' + esc(x.r != null ? x.r : '') + '" placeholder="' + esc(rph) + '"' + at(u, 'r') + ' aria-label="' + nm + ' set ' + (k + 1) + ' ' + esc(unitLbl(ex)) + '"><em class="small muted">' + esc(unitLbl(ex)) + '</em></label>' +
      '<label class="md-tgw-f"><input class="inp mono" id="' + id(u, 'w') + '" inputmode="decimal" value="' + esc(x.w != null ? x.w : '') + '" placeholder="' + esc(ptTgPh(u, date, ex, k, MODE && MODE.w)) + '"' + at(u, 'w') + ' aria-label="' + nm + ' set ' + (k + 1) + ' weight"><em class="small muted">' + loadLbl(ex) + '</em></label>' +
      '<button class="btn sm" data-a="mtw-same" data-u="' + u + '" data-ex="' + i + '" data-set="' + k + '" aria-label="' + nm + ': same reps and weight as you">Same</button></div></div>';
  }).join('') + '</div>';
}
function gymTgSetW(u, list) { // list: [[exercise, set, value, field]]; field 'w' (weight) or 'r' (reps). Written straight into their log for today.
  const d = todayISO(), p = P(d), id = logKey(u, d);
  if (!p || !ptTgPartners(d).includes(u)) return false;
  const out = clone(S.logs[id]) || { pid: u, date: d }; delete out._u; out.str = out.str || {};
  list.forEach(([i, k, v, f]) => {
    const ex = p.strength[i]; if (!ex) return; const fld = f === 'r' ? 'r' : 'w';
    const e = out.str[i] = Object.assign({ n: ex.name }, out.str[i]); e.s = (e.s || []).slice();
    const x = Object.assign({}, e.s[k] || {}), w = num(v); if (w == null) delete x[fld]; else x[fld] = w;
    e.s[k] = x; for (let q = 0; q < e.s.length; q++) if (!e.s[q]) e.s[q] = null;
  });
  out.tg = { by: S.uid, at: Date.now() };
  return put('logs', id, out);
}

const PT_ACT = {
  'set-pm': el => gymSetPm(el.dataset.d || curDate(), +el.dataset.ex, +el.dataset.v),
  'gym-move': el => openSheet('gmove', { date: el.dataset.d }),
  'gym-move-to': el => { const a = el.dataset.d, b = el.dataset.v, ha = gymDayName(a), hb = gymDayName(b); if (!gymMovable(a) || !gymMovable(b)) return; if (gymSwapDays(a, b)) { closeSheet(); render(); toast(ha + ' is now on ' + fmtDate(b) + '; ' + (hb === 'Rest' ? 'rest' : hb) + ' on ' + fmtDate(a) + '. For everyone.'); } },
  'gym-move-back': el => { const a = el.dataset.d, b = (S.days[a] || {}).moved; if (!b || !gymMovable(a) || !gymMovable(b)) return; if (gymSwapDays(a, b)) { render(); toast('Moved back.'); } },
  'catch-open': el => openSheet('gcatch', { date: el.dataset.d }),
  'catch-do': el => gymCatchDo(el.dataset.d, el.dataset.v, el.dataset.h),
  'catch-undo': el => gymCatchUndo(el.dataset.d),
  'gym-swap': () => { if (!canEditPlan()) { toast(PT_NO); return; } S.swapForm = null; openSheet('gswap'); },
  'gsw-pick': el => { // the picker; not one the same day already has
    const F = S.swapForm; if (!F) return; const n = el.dataset.n, x = ptPlanExercises().find(y => y.n === n), have = {};
    if (x) x.days.forEach(d => ptItems(S.days[d]).forEach(it => { const m = ptName(it); if (m === n) return; const now = ptHas(F.sw, m) ? F.sw[m] : m; if (now) have[glKey(now)] = 'Already on ' + fmtDate(d); }));
    gymPick({ multi: false, title: 'Instead of ' + n, have, done: names => { F.sw[n] = names[0]; } });
  },
  'gsw-rm': el => { const F = S.swapForm; if (!F) return; const n = el.dataset.n; if (ptHas(F.sw, n) && !F.sw[n]) delete F.sw[n]; else F.sw[n] = ''; renderSheet(); },
  'gsw-save': () => {
    const F = S.swapForm; if (!F) return; if (!canEditPlan()) { toast(PT_NO); return; }
    const sw = {}; Object.keys(F.sw).forEach(k => { const v = String(F.sw[k] || '').trim().slice(0, 50); if (v !== k) sw[k] = v; });
    if (!Object.keys(sw).length) { S.swapForm = null; closeSheet(); toast('Nothing changed.'); return; }
    const R = ptSwapPlan(sw);
    if (R.dup) { toast(gymDupMsg(R.dup.n, fmtDate(R.dup.d))); return; }
    let n = 0; R.writes.forEach(([d, its]) => { if (put('plan_days', d, ptWithItems(S.days[d], its))) n++; });
    S.swapForm = null; closeSheet(); render();
    toast((n ? 'Changed on ' + n + (n === 1 ? ' day' : ' days') + ', for everyone.' : 'Nothing to change.') + (R.skipped.length ? ' ' + R.skipped.length + (R.skipped.length === 1 ? ' day that is already logged stays' : ' days that are already logged stay') + ' as before.' : ''));
  },
  'mtw-same': el => { // your reps and weight for this set, both
    gymCapture(); const r = num(MODE && MODE.r), w = num(MODE && MODE.w); if (r == null && w == null) { toast('Enter your reps or weight first.'); return; }
    const u = el.dataset.u, i = +el.dataset.ex, k = +el.dataset.set, ex = P(MODE.date).strength[i], list = [];
    if (r != null) list.push([i, k, r, 'r']); if (w != null) list.push([i, k, w, 'w']);
    if (gymTgSetW(u, list)) { const br = $('#mtwr-' + u + '-' + i + '-' + k), bw = $('#mtw-' + u + '-' + i + '-' + k); if (br && r != null) br.value = r; if (bw && w != null) bw.value = w;
      toast(pname(u) + ': ' + [r != null ? r + ' ' + (ex ? unitLbl(ex) : 'reps') : '', w != null ? w + ' kg' : ''].filter(Boolean).join(' × ')); }
  }
};
const PT_IN = {
  gsw: el => { const F = S.swapForm; if (F) F.sw[el.dataset.n] = el.value; },
  gtgw: (el, type) => { const u = el.dataset.u, i = +el.dataset.ex, k = +el.dataset.set, f = el.dataset.f === 'r' ? 'r' : 'w'; deferSave(el.id, () => gymTgSetW(u, [[i, k, el.value, f]]), type === 'change' ? 0 : 500); }
};

