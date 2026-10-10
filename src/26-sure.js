/* ---------- v34: "Are you sure?" for a value that looks like a typing slip ----------
   A wrong test time silently bent everyone's paces: a 1 km time trial saved as 1:00 (typed "1", read as one minute)
   gave a 400 m target of 1:10–1:20/km. Now a value far outside what is plausible opens a small box when you leave the
   field: what the app read ("1 km time trial: 1:00"), why it looks off, and two buttons: "Change it" (the field is
   emptied and the cursor put back in it) or "Yes, keep it" (not asked again for that value).
   Checked: a test result (a time under 0.4× or over 3.5× the test's target; reps over 6× and over 100), a run or a
   rep time (faster than 2:30/km or slower than 20:00/km, or more than 60 km), a set's weight (over 2.5× the plan's or
   last time's weight and at least 40 kg more, or over 400 kg) and reps (over 3× the plan's and at least 20 more; holds
   and distances over 5×). On the day page, in Gym mode (when you tap Done) and in HYROX mode (typed test results).
   Also here: a time trial logged in the Running card on its test day fills in that test's result, as HYROX mode
   already did, so the run log and the test can't disagree (sureLinkTT). */
const SURE_OK = new Set(); // what was answered "Yes, keep it" on this phone: key|value
let SURE = null;
function sureShow(o) { // { key, title, msg, yes(), no() }
  if (SURE_OK.has(o.key)) { if (o.yes) o.yes(); return; }
  SURE = o;
  let el = $('#sure'); if (!el) { el = document.createElement('div'); el.id = 'sure'; el.className = 'sure'; document.body.appendChild(el); }
  el.innerHTML = '<div class="sure-box" role="alertdialog" aria-modal="true" aria-labelledby="sure-t"><h3 id="sure-t">Are you sure?</h3><p class="sure-v">' + esc(o.title) + '</p><p class="small">' + esc(o.msg) + '</p>' +
    '<div class="sure-btns"><button class="btn" data-a="sure-no">Change it</button><button class="btn primary" data-a="sure-yes">Yes, keep it</button></div></div>';
  el.hidden = false; const b = el.querySelector('[data-a=sure-no]'); if (b) b.focus();
}
function sureClose() { SURE = null; const el = $('#sure'); if (el) { el.hidden = true; el.innerHTML = ''; } }

/* ---- what looks off ---- */
const sureBm = id => ((S.meta && S.meta.benchmarks) || []).find(x => x.id === id) || null;
function sureTimeRef(t) { // the test's target time in seconds
  const re = /(?:\d+:)?\d+:\d\d/, m = String(t.ok || '').match(re) || String(t.target || '').match(re); if (m) return parseTime(m[0]);
  const mm = String(t.target || '').match(/(\d+)\s*(?:[–-]\s*\d+\s*)?min/); return mm ? +mm[1] * 60 : null;
}
function sureBench(t, v) { // a test result
  if (!t || v == null || String(v).trim() === '') return null;
  if (t.kind === 'reps') { const n = num(v), ref = t.okReps || num((String(t.target || '').match(/\d+/) || [])[0]); if (n == null || !ref || n <= Math.max(100, ref * 6)) return null; return { key: 'b:' + t.id + '|' + n, title: t.name + ': ' + n + ' reps', msg: 'That is far more than the target (' + t.target + ').' }; }
  const sec = parseTime(v), ref = sureTimeRef(t); if (!sec || !ref) return null;
  const fast = sec < ref * 0.4, slow = sec > ref * 3.5; if (!fast && !slow) return null;
  return { key: 'b:' + t.id + '|' + sec, title: t.name + ': ' + fmtTime(sec), msg: 'That is much ' + (fast ? 'faster' : 'slower') + ' than the target (' + t.target + '). Times are typed as minutes:seconds, for example ' + fmtTime(Math.round(ref * 1.2 / 5) * 5) + '. A number on its own is read as minutes.' };
}
function surePace(dist, sec, what) { // a run: km and seconds
  if (dist > 60) return { key: 'r:' + dist, title: fmtKm(dist, 2) + ' km', msg: 'That is a very long run. Check the distance: it is in km.' };
  if (!dist || !sec) return null;
  const p = sec / dist, fast = p < 150, slow = p > 1200; if (!fast && !slow) return null;
  return { key: 'r:' + dist + '|' + sec, title: (what || fmtKm(dist, 2) + ' km') + ' in ' + fmtTime(sec) + ' = ' + fmtPace(p) + ' per km', msg: 'That pace looks too ' + (fast ? 'fast' : 'slow') + '. Check the distance (km) and the time: minutes:seconds, for example 10:00. A number on its own is read as minutes.' };
}
function sureSet(date, i, s, k, v) { // a set's reps (k 'r') or weight (k 'w')
  const p = P(date), ex = p && p.strength[i]; v = num(v); if (!ex || v == null) return null;
  const nm = ex.name.replace(/\s*\(.*?\)/, '') + ', set ' + (s + 1) + ': ';
  if (k === 'w') {
    const lw = gymLastW(gymLastWeights(S.pid, ex.name, date), s), ref = ex.load != null ? num(ex.load) : lw;
    if (!(v > 400 || (ref > 0 && v > Math.max(ref * 2.5, ref + 40)))) return null;
    return { key: 'w:' + date + ':' + i + ':' + s + '|' + v, title: nm + v + ' ' + loadLbl(ex), msg: ref > 0 ? 'That is far more than ' + (ex.load != null ? 'the plan’s ' : 'last time’s ') + ref + ' ' + loadLbl(ex) + '.' : 'That is a very heavy weight.' };
  }
  const ref = num(ex.reps), unit = unitLbl(ex), plain = ex.unit !== 's' && ex.unit !== 'm' && ex.unit !== 'min';
  if (!(ref > 0 ? v > (plain ? Math.max(ref * 3, ref + 20) : ref * 5) : v > 200)) return null;
  return { key: 'r:' + date + ':' + i + ':' + s + '|' + v, title: nm + v + ' ' + unit, msg: ref > 0 ? 'The plan has ' + ref + ' ' + unit + '.' : 'That is a lot.' };
}

/* ---- a time trial logged in the Running card fills in that day's test, like HYROX mode does ---- */
function sureLinkTT(date, j, k) {
  if (j !== 0 || (k !== 'time' && k !== 'dist')) return;
  const tt = testMap(date).run, tD = tt ? ttDist(tt) : null, r = ((getLog(date) || {}).runs || [])[0]; if (!tt || !tD || !r || !r.time) return;
  if ((r.type || P(date).run.type) !== 'tt' || (r.dist != null && Math.abs(r.dist - tD) > tD * 0.05)) return; // only the trial itself, not the whole day's running
  const v = fmtTime(r.time), cur = benchVal(S.pid, tt.id); if (cur && cur.v === v) return;
  benchSave(tt, v); const b = $('#b-' + tt.id); if (b && document.activeElement !== b) b.value = v;
}

/* ---- where it asks ---- */
function sureClear(el) { el.value = ''; const f = IN[el.dataset.in]; if (f) f(el, 'change'); setTimeout(() => { const n = el.id && document.getElementById(el.id); if (n) { n.value = ''; n.focus(); } }, 150); }
function sureOnChange(e) {
  const el = e.target.closest && e.target.closest('[data-in]'); if (!el || !S.pid || SURE) return;
  const kind = el.dataset.in, k = el.dataset.k; let q = null, after = null;
  if (kind === 'bench' && k === 'v') q = sureBench(sureBm(el.dataset.id), el.value);
  else if (kind === 'run' && (k === 'dist' || k === 'time')) {
    const j = +el.dataset.j, date = curDate(), d = num(($('#rd-' + j) || {}).value), t = parseTime(($('#rtm-' + j) || {}).value);
    q = surePace(d, t);
    if (q && j === 0) { const tt = testMap(date).run; if (tt && t) after = () => { const cur = benchVal(S.pid, tt.id); if (cur && cur.v === fmtTime(t)) { benchSave(tt, ''); const b = $('#b-' + tt.id); if (b) b.value = ''; } }; } // the slip reached the test result too
  } else if (kind === 'mdrun' && (k === 'dist' || k === 'time') && MODE) {
    const tt = testMap(MODE.date).run, tD = tt ? ttDist(tt) : null, t = parseTime(($('#md-rt') || {}).value), d = num(($('#md-rd') || {}).value) || tD;
    q = surePace(d, t);
    if (q && tt && t) after = () => { const cur = benchVal(S.pid, tt.id); if (cur && cur.v === fmtTime(t)) benchSave(tt, ''); };
  } else if (kind === 'rep') { const rd = +el.dataset.rd, t = parseTime(el.value.trim()); if (rd && t) q = surePace(rd, t, Math.round(rd * 1000) + ' m'); }
  else if (kind === 'str' && (k === 'r' || k === 'w')) q = sureSet(curDate(), +el.dataset.ex, +el.dataset.set, k, el.value);
  if (!q) return;
  sureShow(Object.assign(q, { no: () => { sureClear(el); if (after) after(); } }));
}
function sureWrap() { // actions that save a typed value straight away
  const done = ACT['md-done'];
  ACT['md-done'] = el => { // Gym mode: Done · set n
    if (!MODE || MODE.kind !== 'gym') return done(el);
    gymCapture(); const q = sureSet(MODE.date, MODE.i, MODE.s, 'w', MODE.w) || sureSet(MODE.date, MODE.i, MODE.s, 'r', MODE.r);
    if (!q) return done(el);
    const isW = q.key[0] === 'w';
    sureShow(Object.assign(q, { yes: () => done(el), no: () => { const n = $(isW ? '#md-w' : '#md-r'); if (n) { n.value = ''; n.focus(); } if (isW) MODE.w = ''; else MODE.r = ''; } }));
  };
  [['hx-ttype', '#md-tt'], ['hx-treps', '#md-tr']].forEach(([a, sel]) => { // HYROX mode: a test's time or reps typed at a station
    const f = ACT[a]; if (!f) return;
    ACT[a] = el => {
      const inp = $(sel), s = MODE && hxSteps(MODE.date)[MODE.k], bt = s && s.r ? testMap(MODE.date).row[s.r.i] : null, q = bt && inp ? sureBench(bt, inp.value) : null;
      if (!q) return f(el);
      sureShow(Object.assign(q, { yes: () => f(el), no: () => { const n = $(sel); if (n) { n.value = ''; n.focus(); } } }));
    };
  });
}
const SURE_ACT = {
  'sure-yes': () => { const o = SURE; if (!o) return; SURE_OK.add(o.key); sureClose(); if (o.yes) o.yes(); },
  'sure-no': () => { const o = SURE; sureClose(); if (o && o.no) o.no(); }
};

