/* ---------- Training together (v27, direct in v28) ----------
   Gym-style: on Today, "Train with…" picks one or more members and they're in the group straight away (no invite to
   accept). From then on, whoever logs fills in everyone in the group, for that day only.
   Copied: warm-up / core / cooldown ticks, sets (reps and done), exercise order, HYROX stations (done, sets, amount, time),
   runs (type, distance, time, reps), session minutes, start time, Completed, clock total.
   Weights (set kg and station load): "same" copies them too; "own" keeps each person's own (open their log to fill them in).
   Never copied: effort (RPE), notes, soreness, nutrition, photos, own added items, test results.
   Stored in the "together" collection, one doc per person per day (id "<uid>_<date>", like logs):
   { uid, date, from (who made the group), g (the group: "<maker>:<time>"), group: [uids], st: 'in' | 'left', weights, at }.
   The maker's doc holds the group. Each member's phone writes its own doc when it sees it's been added (so it can log
   for the others too), and "left" when they leave. "<uid>_prefs" { st: 'in' | 'off' } is the Settings switch
   "Others can add me to their group". "allow", "g", "in" and "group" are also saved outside the JSON so firestore.rules
   can check them: X may change Y's log for that day only if X's own doc says X is in group g, g's maker lists Y, and Y
   hasn't left g, isn't in another group that day, and hasn't switched adding off. */
let TGF = null; // the Train with… sheet: { picks: [uids], q, weights }
let TG_BUSY = false;
const tgId = (uid, date) => uid + '_' + date;
const tgDoc = (uid, date) => (S.together || {})[tgId(uid, date)] || null;
const tgOpen = uid => { const p = (S.together || {})[uid + '_prefs']; return !(p && p.st === 'off'); };
function tgMaker(g, date) { if (!g) return null; const c = tgDoc(String(g).split(':')[0], date); return c && c.st === 'in' && c.g === g && c.from === c.uid ? c : null; }
const tgLeft = (uid, g, date) => { const d = tgDoc(uid, date); return !!(d && d.g === g && d.st !== 'in'); };
function tgGroupOf(pid, date) { // the group pid is in that day: their own doc, or the newest group someone put them in
  const mine = tgDoc(pid, date);
  if (mine && mine.st === 'in') { const c = tgMaker(mine.g, date); if (c) return c; }
  if (!tgOpen(pid)) return null;
  return Object.values(S.together || {}).filter(c => c && c.date === date && c.from === c.uid && c.st === 'in' && c.uid !== pid && isPerson(c.uid) && (c.group || []).includes(pid) && !tgLeft(pid, c.g, date))
    .sort((a, b) => (b.at || 0) - (a.at || 0))[0] || null;
}
function tgActive(pid, date) {
  const c = tgGroupOf(pid, date); if (!c) return null;
  const members = (c.group || []).filter(u => isPerson(u) && !S.profiles[u].removed).map(u => ({ uid: u, st: u === c.uid ? 'in' : tgLeft(u, c.g, date) ? 'left' : !tgOpen(u) ? 'off' : 'in' }));
  return { from: c.uid, g: c.g, weights: c.weights === 'same' ? 'same' : 'own', members, joined: members.filter(m => m.st === 'in').map(m => m.uid) };
}
function tgCanWrite(owner, date) { // same test as firestore.rules
  if (!S.uid) return false;
  const mine = tgDoc(S.uid, date); if (!mine || mine.st !== 'in') return false;
  const c = tgMaker(mine.g, date); if (!c || !(c.group || []).includes(owner)) return false;
  const od = tgDoc(owner, date); if (od && (od.g === c.g ? od.st !== 'in' : od.st === 'in')) return false;
  return tgOpen(owner);
}
const TG_COPY = ['wu', 'cd', 'acc', 'ord', 'status', 'time', 'start', 'simTotal'];
function tgCopy(src, dst, weights) { // the shared parts of src, laid over dst (dst keeps everything personal)
  const d = clone(dst) || {}; src = src || {};
  TG_COPY.forEach(k => { if (src[k] === undefined || src[k] === null) delete d[k]; else d[k] = clone(src[k]); });
  const str = Object.assign({}, d.str);
  Object.keys(src.str || {}).forEach(i => {
    const se = src.str[i] || {}, de = str[i] || {};
    const n = Math.max((se.s || []).length, (de.s || []).length); // gym v8: sets only they have (weights typed in for them) stay
    str[i] = Object.assign({}, de, { n: se.n || de.n, s: Array.from({ length: n }, (_, k) => { const x = (se.s || [])[k], dx0 = (de.s || [])[k]; if (!x) return dx0 || null; const dx = dx0 || {}; const o = Object.assign({}, dx, { r: x.r, d: !!x.d }); if (weights === 'same' && x.w != null && x.w !== '') o.w = x.w; return o; /* gym v6: a set without a weight doesn't wipe theirs */ }) });
  });
  if (Object.keys(str).length) d.str = str;
  if (src.runs || d.runs) d.runs = (src.runs || []).map((r, j) => { const dr = ((dst && dst.runs) || [])[j] || {}; const o = Object.assign({}, dr, { type: r.type }); ['dist', 'time', 'reps', 'repDist'].forEach(k => { if (r[k] === undefined) delete o[k]; else o[k] = clone(r[k]); }); return o; });
  const hx = Object.assign({}, d.hx);
  Object.keys(src.hx || {}).forEach(i => {
    const se = src.hx[i] || {}, o = Object.assign({}, hx[i]);
    ['d', 'sd', 'time', 'amt'].forEach(k => { if (se[k] === undefined) delete o[k]; else o[k] = se[k]; });
    if (weights === 'same') { if (se.load === undefined) delete o.load; else o.load = se.load; }
    hx[i] = o;
  });
  if (Object.keys(hx).length) d.hx = hx;
  return d;
}
function tgMerge(a, b) { // joining late: keep what either of you has done so far (a wins where both have something)
  a = a || {}; b = b || {};
  const m = clone(a);
  ['wu', 'cd', 'acc'].forEach(k => { if (a[k] || b[k]) m[k] = Object.assign({}, b[k], a[k]); });
  ['ord', 'status', 'time', 'start', 'simTotal'].forEach(k => { if (m[k] == null && b[k] != null) m[k] = clone(b[k]); });
  if (b.str) { m.str = m.str || {}; Object.keys(b.str).forEach(i => { const ea = m.str[i], eb = b.str[i]; if (!ea) { m.str[i] = clone(eb); return; } const n = Math.max((ea.s || []).length, (eb.s || []).length); ea.s = Array.from({ length: n }, (_, k) => { const x = (ea.s || [])[k], y = (eb.s || [])[k]; return x && x.d ? x : y && y.d ? y : x || y || null; }); }); }
  if (!(a.runs || []).some(r => r && (r.dist || r.time)) && b.runs) m.runs = clone(b.runs);
  if (b.hx) { m.hx = m.hx || {}; Object.keys(b.hx).forEach(i => { const x = m.hx[i], y = b.hx[i]; if (!x || (!(x.d || x.time) && (y.d || y.time))) m.hx[i] = clone(y); }); }
  return m;
}
const tgShared = l => { const o = {}; TG_COPY.concat(['str', 'runs', 'hx']).forEach(k => { if (l && l[k] !== undefined) o[k] = l[k]; }); return canon(o); };
/* v32 (from GymFloorCoach): after an edit, only what changed in that edit goes across, and only forwards: a set you tick
   ticks theirs (with your reps if they have none), but an untick or a rep change stays on your own log, so each person
   can have their own reps; the same for warm-up, cooldown and core ticks. Weights go across only with "Same weights".
   Runs and stations: what you changed. Joining a group still lays the whole log over (tgCopy). */
function tgCopyDiff(prev, src, dst, weights) {
  const d = clone(dst) || {}; prev = prev || {}; src = src || {};
  const same = (a, b) => JSON.stringify(a == null ? null : a) === JSON.stringify(b == null ? null : b);
  TG_COPY.forEach(k => {
    if (same(src[k], prev[k]) || src[k] == null) return; // unchanged, or cleared: theirs stays
    if (k === 'wu' || k === 'cd' || k === 'acc') { const a = src[k] || {}, b = prev[k] || {}, o = Object.assign({}, d[k]); let ch = false; Object.keys(a).forEach(i => { if (a[i] && !b[i] && !o[i]) { o[i] = a[i]; ch = true; } }); if (ch) d[k] = o; return; }
    d[k] = clone(src[k]);
  });
  Object.keys(src.str || {}).forEach(i => {
    const se = (src.str[i] || {}).s || [], pe = (((prev.str || {})[i]) || {}).s || [];
    const de = Object.assign({}, (d.str || {})[i]), ds = (de.s || []).slice(); let ch = false;
    se.forEach((x, k) => {
      if (!x) return; const px = pe[k] || {}, dx = Object.assign({}, ds[k] || {}); let c = false;
      if (x.d && !px.d && !dx.d) { dx.d = true; if (dx.r == null && x.r != null) dx.r = x.r; c = true; }
      if (weights === 'same' && x.w != null && x.w !== '' && x.w !== px.w) { dx.w = x.w; c = true; }
      if (c) { ds[k] = dx; ch = true; }
    });
    if (!ch) return;
    for (let q = 0; q < ds.length; q++) if (ds[q] === undefined) ds[q] = null;
    d.str = Object.assign({}, d.str, { [i]: Object.assign(de, { n: de.n || src.str[i].n, s: ds }) });
  });
  if (!same(src.runs, prev.runs) && src.runs) d.runs = src.runs.map((r, j) => { const dr = ((dst && dst.runs) || [])[j] || {}, pr = (prev.runs || [])[j] || {}; const o = Object.assign({}, dr, { type: r.type }); ['dist', 'time', 'reps', 'repDist'].forEach(k => { if (!same(r[k], pr[k]) && r[k] !== undefined) o[k] = clone(r[k]); }); return o; });
  const hx = Object.assign({}, d.hx); let hch = false;
  Object.keys(src.hx || {}).forEach(i => {
    const se = src.hx[i] || {}, pe = (prev.hx || {})[i] || {}, o = Object.assign({}, hx[i]);
    ['time', 'amt'].forEach(k => { if (!same(se[k], pe[k]) && se[k] !== undefined) { o[k] = se[k]; hch = true; } });
    if (se.d && !pe.d && !o.d) { o.d = true; hch = true; }
    if ((se.sd || 0) > (pe.sd || 0) && (se.sd || 0) > (o.sd || 0)) { o.sd = se.sd; hch = true; }
    if (weights === 'same' && !same(se.load, pe.load) && se.load !== undefined) { o.load = se.load; hch = true; }
    hx[i] = o;
  });
  if (hch) d.hx = hx;
  return d;
}
function tgMirror(pid, date, src, prev) { // after pid's log changed: fill in everyone else who joined (prev given: only what changed)
  if (TG_BUSY) return; const g = tgActive(pid, date); if (!g || g.joined.length < 2) return;
  TG_BUSY = true;
  try {
    g.joined.forEach(u => {
      if (u === pid || !(isAdmin() || tgCanWrite(u, date))) return;
      const id = logKey(u, date), dst = S.logs[id] || { pid: u, date }, out = prev !== undefined ? tgCopyDiff(prev, src, dst, g.weights) : tgCopy(src, dst, g.weights);
      if (tgShared(out) === tgShared(dst)) return;
      out.tg = { by: S.uid, at: Date.now() };
      put('logs', id, out);
    });
  } finally { TG_BUSY = false; }
}
function tgTidy() { // join a group you were put in; switch off old days' groups
  if (!S.uid || !ownProfile()) return; const t = todayISO();
  const mine = tgDoc(S.uid, t), cur = mine && mine.st === 'in' ? tgMaker(mine.g, t) : null;
  if (!cur) {
    const c = tgGroupOf(S.uid, t);
    if (c && c.uid !== S.uid) put('together', tgId(S.uid, t), { uid: S.uid, date: t, from: c.uid, g: c.g, group: c.group || [], st: 'in', allow: [], at: Date.now() });
    else if (mine && mine.st === 'in') put('together', tgId(S.uid, t), Object.assign({}, mine, { st: 'left', at: Date.now() }));
  }
  Object.values(S.together || {}).forEach(d => { if (d && d.uid === S.uid && d.st === 'in' && d.date && d.date < t) put('together', tgId(d.uid, d.date), Object.assign({}, d, { st: 'left', at: Date.now() })); });
}
function togetherCard(date, p) {
  if (!S.pid || !p || p.rest || date !== todayISO()) return '';
  const pid = S.pid, g = tgActive(pid, date), l = getLog(date) || {};
  const own = canWriteDoc('together', tgId(pid, date));
  const name = u => u === S.uid ? pname(u) + ' (you)' : pname(u);
  if (g) {
    const stTxt = { in: '✓', left: 'left', off: 'turned off' };
    const chips = g.members.map(m => { const can = m.st === 'in' && (m.uid === S.uid || isAdmin() || tgCanWrite(m.uid, date)); return '<button class="chip tg-mem' + (m.uid === pid ? ' cur' : '') + '" data-a="tg-view" data-v="' + m.uid + '" aria-pressed="' + (m.uid === pid) + '"' + (can ? '' : ' disabled') + '><span class="dot" style="--pc:' + pcolor(m.uid) + '"></span>' + esc(name(m.uid)) + ' <small>' + stTxt[m.st] + '</small></button>'; }).join('');
    const maker = g.from === pid;
    const wSeg = maker && own ? '<div class="seg tg-w"><button data-a="tg-weights" data-v="same" aria-pressed="' + (g.weights === 'same') + '">Same weights</button><button data-a="tg-weights" data-v="own" aria-pressed="' + (g.weights === 'own') + '">Own weights</button></div>'
      : '<p class="small muted">' + (g.weights === 'same' ? 'Same weights for everyone.' : 'Each person keeps their own weights.') + '</p>';
    const by = l.tg && l.tg.by && l.tg.by !== S.uid ? '<p class="small muted tg-by">Filled in together with ' + esc(pname(l.tg.by)) + '</p>' : '';
    const viewing = pid !== S.uid && !isAdmin() ? '<p class="small">You’re filling in <b>' + esc(pname(pid)) + '</b>’s log. <button class="linkbtn tg-back" data-a="tg-view" data-v="' + S.uid + '">Back to mine</button></p>' : '';
    return '<section class="card o2 tg-card"><div class="card-h"><h3>Training together</h3></div>' + (maker ? '' : '<p class="small" style="margin:-4px 0 8px">' + esc(pname(g.from)) + ' added ' + (pid === S.uid ? 'you' : esc(pname(pid))) + ' to today’s group.</p>') +
      '<div class="chips tg-chips">' + chips + '</div>' + viewing +
      '<p class="small muted">Whatever anyone logs fills in everyone in the group: ticks, reps, runs, stations, minutes and Completed. Effort, notes and nutrition stay your own.' + (g.weights === 'own' ? ' Tap a name to fill in their weights.' : '') + '</p>' + wSeg + by +
      (own ? '<div class="tg-foot"><button class="btn sm ghost" data-a="tg-leave">' + (maker ? 'End for everyone' : 'Leave the group') + '</button></div>' : '') + '</section>';
  }
  if (!own || peopleIds().length < 2) return '';
  return '<div class="o2 tg-start"><button class="btn tg-open" data-a="tg-open">' + I.people + 'Train with…</button><span class="small muted">Log once for everyone you train with today</span></div>';
}
function tgListHTML() {
  const f = TGF || { picks: [], q: '' }, q = (f.q || '').trim().toLowerCase();
  const ids = peopleIds().filter(u => u !== S.pid && !S.profiles[u].removed && (!q || pname(u).toLowerCase().includes(q)));
  return ids.length ? ids.map(u => '<button class="check tg-pick" data-a="tg-pick" data-v="' + u + '" aria-pressed="' + f.picks.includes(u) + '"><span class="box">' + I.check + '</span><span class="dot" style="--pc:' + pcolor(u) + '"></span><span class="lbl">' + esc(pname(u)) + '</span></button>').join('') : '<p class="empty">Nobody matches.</p>';
}
function sheetTg() {
  const f = TGF || { picks: [], q: '', weights: 'own' };
  return {
    title: 'Train with…',
    body: '<p class="small muted">Pick who you’re training with today. They’re in the group straight away: whatever anyone logs fills in everyone.</p>' +
      (peopleIds().length > 8 ? '<input class="inp" id="tg-q" placeholder="Search members" value="' + esc(f.q || '') + '" data-in="tgq" autocomplete="off" style="margin-top:10px">' : '') +
      '<div class="checks" id="tg-list" style="margin-top:8px">' + tgListHTML() + '</div>' +
      '<div class="field" style="margin-top:12px"><span>Weights</span><div class="seg"><button data-a="tg-wpick" data-v="own" aria-pressed="' + (f.weights !== 'same') + '">Each person’s own</button><button data-a="tg-wpick" data-v="same" aria-pressed="' + (f.weights === 'same') + '">Same for everyone</button></div>' +
      '<span class="small muted" style="font-weight:400;text-transform:none;letter-spacing:0">' + (f.weights === 'same' ? 'The kg you log is copied to everyone.' : 'Reps and ticks copy; each person’s kg stays theirs. Tap their name on Today to fill in their weights.') + '</span></div>' +
      '<button class="btn primary lg block" data-a="tg-send" style="margin-top:14px"' + (f.picks.length ? '' : ' disabled') + '>' + I.people + (f.picks.length ? 'Start with ' + esc(f.picks.map(pname).join(', ')) : 'Pick someone first') + '</button>'
  };
}
function tgPrefsCard() { // Settings: the one switch
  if (!S.uid || !ownProfile() || S.pid !== S.uid) return '';
  const on = tgOpen(S.uid);
  return '<section class="card" id="tg-prefs"><div class="card-h"><h3>Training together</h3></div><button class="check" data-a="tg-prefs" aria-pressed="' + on + '"><span class="box">' + I.check + '</span><span class="lbl tg-pl">Others can add me to their group</span></button>' +
    '<p class="small muted" style="margin-top:6px">When someone adds you on Train with…, what they log fills in your log for that day. You can always leave the group' + (on ? '' : ', and with this off nobody can add you') + '.</p></section>';
}
const TOGETHER_ACT = {
  'tg-open': () => { TGF = { picks: [], q: '', weights: 'own' }; openSheet('tg'); },
  'tg-pick': el => { const u = el.dataset.v, a = TGF.picks; const i = a.indexOf(u); if (i >= 0) a.splice(i, 1); else a.push(u); renderSheet(); },
  'tg-wpick': el => { TGF.weights = el.dataset.v === 'same' ? 'same' : 'own'; renderSheet(); },
  'tg-send': () => {
    if (!TGF || !TGF.picks.length || !S.pid) return; const t = todayISO(), at = Date.now(), pid = S.pid, picks = TGF.picks.filter(tgOpen), weights = TGF.weights;
    const off = TGF.picks.filter(u => !tgOpen(u));
    if (!picks.length) { toast(off.map(pname).join(', ') + ' switched off being added to groups.'); return; }
    if (!put('together', tgId(pid, t), { uid: pid, date: t, from: pid, g: pid + ':' + at, group: [pid].concat(picks), st: 'in', weights, allow: picks.slice(), at })) return;
    // start everyone from the same place: what anyone has done so far
    let m = S.logs[logKey(pid, t)] || {};
    picks.forEach(u => { if (isAdmin() || tgCanWrite(u, t)) m = tgMerge(m, S.logs[logKey(u, t)]); });
    const id = logKey(pid, t), mine = S.logs[id] || { pid, date: t }, out = tgCopy(m, mine, weights);
    if (tgShared(out) !== tgShared(mine)) put('logs', id, out);
    tgMirror(pid, t, S.logs[id] || out);
    toast('Training together with ' + picks.map(pname).join(', ') + (off.length ? ' (' + off.map(pname).join(', ') + ' switched this off)' : ''));
    TGF = null; closeSheet(); render();
  },
  'tg-leave': () => { const pid = S.pid, t = todayISO(), g = tgActive(pid, t); if (!g) return; const d = tgDoc(pid, t) || { uid: pid, date: t, from: g.from, g: g.g, group: [] }; put('together', tgId(pid, t), Object.assign({}, d, { g: g.g, from: g.from, st: 'left', allow: [], at: Date.now() })); if (S.pid !== S.uid && !isAdmin()) S.pid = S.uid; toast(g.from === pid ? 'Ended for everyone' : 'You left today’s group'); render(); },
  'tg-weights': el => { const pid = S.pid, t = todayISO(), d = tgDoc(pid, t); if (!d || d.from !== pid) return; put('together', tgId(pid, t), Object.assign({}, d, { weights: el.dataset.v === 'same' ? 'same' : 'own' })); render(); },
  'tg-view': el => { const u = el.dataset.v; if (u === S.uid || isAdmin() || tgCanWrite(u, todayISO())) { S.pid = u; render(); window.scrollTo(0, 0); } },
  'tg-prefs': () => { const on = tgOpen(S.uid); put('together', S.uid + '_prefs', { uid: S.uid, st: on ? 'off' : 'in', allow: [], at: Date.now() }); toast(on ? 'Nobody can add you to a group now' : 'Others can add you to their group'); render(); }
};
const TG_IN = { tgq: el => { if (!TGF) return; TGF.q = el.value; const box = $('#tg-list'); if (box) box.innerHTML = tgListHTML(); } };

