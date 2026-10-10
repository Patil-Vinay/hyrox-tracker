/* ---------- rest timer ---------- */
const RT = { end: 0, dur: 0, label: '', int: null, over: false };
function startRest(sec, label) {
  audioInit(); RT.dur = sec; RT.end = Date.now() + sec * 1000; RT.label = label; RT.over = false;
  clearInterval(RT.int); RT.int = setInterval(restTick, 250); keepAwake(true);
  const el = $('#restbar');
  el.innerHTML = '<span class="t" id="rt-t"></span><div class="l"><b id="rt-h">Rest</b><span id="rt-l"></span><div class="bar"><i id="rt-b"></i></div></div><button data-a="rest-add" data-v="-15" aria-label="Take 15 seconds off">−15</button><button data-a="rest-add" data-v="15" aria-label="Add 15 seconds">+15</button><button data-a="rest-stop" aria-label="Stop rest timer">✕</button>';
  el.hidden = false; restTick();
}
function restTick() {
  const left = Math.ceil((RT.end - Date.now()) / 1000);
  if (left <= 0 && !RT.over) { RT.over = true; beep(3, 990); setTimeout(() => { if (RT.over) stopRest(); }, 8000); }
  const el = $('#restbar'); el.classList.toggle('over', RT.over);
  $('#rt-t').textContent = RT.over ? 'GO' : fmtTime(Math.max(0, left));
  $('#rt-h').textContent = RT.over ? 'Rest done' : 'Rest';
  $('#rt-l').textContent = RT.label;
  $('#rt-b').style.width = (RT.over ? 100 : Math.max(0, Math.min(100, 100 - left / RT.dur * 100))) + '%';
}
function stopRest() { clearInterval(RT.int); RT.int = null; RT.over = false; $('#restbar').hidden = true; if (!RW.int && !MODE) keepAwake(false); }

/* ---------- click actions ---------- */
const ACT = {
  nav: el => { const v = el.dataset.v; if (SHEET) closeSheet(); go({ view: v, sub: S.route.sub, pv: S.route.pv }); },
  'go-day': el => { const d = el.dataset.d; if (!d) return; if (SHEET) closeSheet(); go(d === todayISO() ? { view: 'today' } : { view: 'day', date: d }); },
  sub: el => { if (SHEET) closeSheet(); go({ view: el.dataset.v, sub: el.dataset.s, pv: S.route.pv, wk: S.route.wk }); },
  calmode: el => { LS.set('hx.calmode', el.dataset.v); render(); },
  calmonth: el => { if (el.dataset.v) { S.route.arg = el.dataset.v; render(); } },
  wk: el => { const n = +el.dataset.v; if (n >= minWeek() && n <= weekCount()) { S.route.wk = n; render(); } },
  pv: el => { S.route.pv = el.dataset.v; render(); },
  who: () => openWho(),
  choose: el => choosePerson(el.dataset.v),
  'nf-color': el => { const i = $('#nf-name'); if (i) S.newForm.name = i.value; S.newForm.color = el.dataset.v; renderSheet(); },
  'nf-plan': el => { const i = $('#nf-name'); if (i) S.newForm.name = i.value; S.newForm.plan = el.dataset.v; renderSheet(); },
  'create-person': () => {
    const name = ($('#nf-name') ? $('#nf-name').value : (S.newForm || {}).name || '').trim();
    if (!name) { toast('Type your name first.'); return; }
    if (!S.uid) return;
    const old = clone(S.profiles[S.uid]) || {}; delete old.removed;
    const nf = S.newForm || {};
    if (!raceComplete(nf.race)) { toast(nf.race && nf.race.div === 'X' ? 'Choose whether you race as a woman or a man.' : 'Pick your race format and division.'); return; }
    const race = { fmt: nf.race.fmt, div: nf.race.div }; if (race.div === 'X') race.sex = nf.race.sex;
    if (put('profiles', S.uid, Object.assign(old, { name, color: nf.color || 'blue', plan: nf.plan || 'A', race, bar: old.bar || 20, created: old.created || (todayISO() + 'T' + Date.now()), uid: S.uid }))) {
      S.newForm = null; S.pid = S.uid; closeSheet(); render(); toast('Welcome, ' + name + '.');
    }
  },
  close: () => closeSheet(),
  exfold: el => { const k = el.dataset.k; const on = !FOLDS()[k]; setFold(k, on); const ex = el.closest('.ex'); if (ex) ex.classList.toggle('folded', on); el.setAttribute('aria-expanded', String(!on)); syncExAll(); },
  'exfold-all': el => { const d = el.dataset.d, n = +el.dataset.n; const f = FOLDS(); let all = true; for (let i = 0; i < n; i++) if (!f['ex:' + d + ':' + i]) all = false; for (let i = 0; i < n; i++) setFold('ex:' + d + ':' + i, !all); $$('#view .ex .exfold').forEach(h => { h.closest('.ex').classList.toggle('folded', !all); h.setAttribute('aria-expanded', String(all)); }); syncExAll(); },
  'fold-all': el => { const pre = el.dataset.p; const secs = $$('#view section[data-fold^="' + pre + '"]'); const all = secs.length > 0 && secs.every(x => x.classList.contains('folded')); secs.forEach(x => { setFold(x.dataset.fold, !all); x.classList.toggle('folded', !all); const h = x.querySelector('.foldh'); if (h) h.setAttribute('aria-expanded', String(all)); }); el.textContent = all ? 'Hide all' : 'Show all'; },
  fold: el => { const k = el.dataset.k; const f = LS.get('hx.fold', {}) || {}; f[k] = !f[k]; if (!f[k]) delete f[k]; LS.set('hx.fold', f); const sec = el.closest('section'); if (sec) { sec.classList.toggle('folded', !!f[k]); el.setAttribute('aria-expanded', String(!f[k])); } syncFoldAll(); },
  'xl-add': el => { const g = el.dataset.g; const i = $('#xl-in-' + g); const v = i && i.value.trim(); if (!v) { if (i) i.focus(); return; } i.blur(); editLog(curDate(), l => { l.xl = l.xl || {}; l.xl[g] = (l.xl[g] || []).concat([{ t: v.slice(0, 120), d: false }]); }); setTimeout(() => { const j = $('#xl-in-' + g); if (j) j.focus(); }, 60); },
  'xl-chk': el => { const g = el.dataset.g, i = +el.dataset.i; editLog(curDate(), l => { const a = ((l.xl || {})[g] || []); if (a[i]) a[i].d = !a[i].d; }); },
  'xl-del': el => { const g = el.dataset.g, i = +el.dataset.i; editLog(curDate(), l => { const a = ((l.xl || {})[g] || []); a.splice(i, 1); }); },
  'rest-act': el => { const v = el.dataset.v; editLog(curDate(), l => { const r = l.rest = l.rest || {}; const a = r.acts || []; r.acts = a.includes(v) ? a.filter(x => x !== v) : (v === 'rest' ? ['rest'] : a.filter(x => x !== 'rest').concat([v])); }); },
  'photo-open': el => { S.phDel = null; const pid = el.dataset.p || S.pid, d = el.dataset.d; const l = getLog(d, pid); S.phCtx = ((l && l.photos) || []).map((_, i) => ({ pid, date: d, i })); openSheet('phview', { k: +el.dataset.i }); },
  'gal-open': el => { S.phDel = null; S.phCtx = (S.gal || []).slice(); openSheet('phview', { k: +el.dataset.k }); },
  'ph-nav': el => { S.phDel = null; if (SHEET) { SHEET.opts.k = +el.dataset.k; renderSheet(); } },
  pf: el => { S.route.pf = el.dataset.v; render(); },
  'photo-del-ask': el => { S.phDel = el.dataset.v; renderSheet(); },
  'photo-rm': el => deletePhoto(+el.dataset.k),
  'nf-fmt': el => { const i = $('#nf-name'); if (i) S.newForm.name = i.value; S.newForm.race = defaultRace(el.dataset.v, S.newForm.race); renderSheet(); },
  'nf-div': el => { const i = $('#nf-name'); if (i) S.newForm.name = i.value; const r = S.newForm.race = S.newForm.race || {}; r.div = el.dataset.v; if (r.div !== 'X') delete r.sex; renderSheet(); },
  'nf-sex': el => { const i = $('#nf-name'); if (i) S.newForm.name = i.value; const r = S.newForm.race = S.newForm.race || {}; r.sex = el.dataset.v; renderSheet(); },
  'rc-fmt': el => { editProfile(p => { const r = defaultRace(el.dataset.v, p.race); if (!r.div) r.div = RACE_FORMATS[r.fmt].divs.includes('M') ? 'M' : 'W'; p.race = r; }); render(); },
  'rc-div': el => { editProfile(p => { const r = Object.assign({}, p.race); r.div = el.dataset.v; if (r.div === 'X') { if (!r.sex) r.sex = (p.race && (p.race.div === 'W' || p.race.div === 'WP')) ? 'W' : 'M'; } else delete r.sex; p.race = r; }); render(); },
  'rc-sex': el => { editProfile(p => { p.race = Object.assign({}, p.race, { sex: el.dataset.v }); }); render(); },
  signin: () => startSignIn(),
  signout: () => doSignOut(),
  tool: el => { const t = el.dataset.t; const o = {}; if (el.dataset.mode) o.mode = el.dataset.mode; openSheet(t, o); },
  'edit-plan': el => { if (!canEditPlan()) { toast(PT_NO); return; } ED = null; openSheet('editor', { date: el.dataset.d, focus: el.dataset.f }); if (el.dataset.f === 'add-ex') setTimeout(() => { const n = ED ? ED.ex.length - 1 : -1; const i = $('#ed-ex-' + n + '-name'); if (i) { i.scrollIntoView({ block: 'center' }); i.focus(); } }, 60); },
  'ed-add': el => { const g = el.dataset.g; if (!ED) return; if (g === 'ex') ED.ex.push({ name: '', sets: '3', reps: '10', load: '', rest: '90 s' }); else ED[g].push(''); renderSheet(); const n = ED[g].length - 1; const i = $('#ed-' + g + '-' + n + '-' + (g === 'ex' ? 'name' : 't')); if (i) { i.scrollIntoView({ block: 'center' }); i.focus(); } },
  'ed-del': el => { if (!ED) return; ED[el.dataset.g].splice(+el.dataset.i, 1); renderSheet(); },
  'ed-mv': el => { if (!ED) return; edMove(ED[el.dataset.g], +el.dataset.i, +el.dataset.v); renderSheet(); },
  'ed-hb': () => { if (ED) edAddStation(); },
  'mem-add': () => { S.memForm = null; S.memConfirm = null; openSheet('member', {}); },
  'mem-edit': el => { if (!isAdmin()) return; S.memForm = null; S.memConfirm = null; openSheet('member', { pid: el.dataset.v }); },
  'mem-color': el => { const i = $('#mem-name'); if (i && S.memForm) S.memForm.name = i.value; if (S.memForm) S.memForm.color = el.dataset.v; renderSheet(); },
  'mem-plan': el => { const i = $('#mem-name'); if (i && S.memForm) S.memForm.name = i.value; if (S.memForm) S.memForm.plan = el.dataset.v; renderSheet(); },
  'mem-save': el => saveMember(el.dataset.v),
  'mem-remove-ask': el => { const i = $('#mem-name'); if (i && S.memForm) S.memForm.name = i.value; S.memConfirm = el.dataset.v; renderSheet(); },
  'mem-remove': el => { const pid = el.dataset.v; const cur = clone(S.profiles[pid]); if (!cur) return; cur.removed = true; if (put('profiles', pid, cur)) { toast(cur.name + ' removed'); if (pid === S.pid) S.pid = resolveMe(); closeSheet(); render(); if (!S.pid) openWho(); } },
  'mem-unlink': el => { const pid = el.dataset.v; const cur = clone(S.profiles[pid]); if (!cur) return; cur.uid = null; if (S.memForm) S.memForm.uid = null; put('profiles', pid, cur); toast('Unlinked. They pick their name again next time they open the tracker.'); renderSheet(); },
  'mem-restore': el => { const pid = el.dataset.v; const cur = clone(S.profiles[pid]); if (!cur) return; delete cur.removed; put('profiles', pid, cur); render(); },
  'editor-save': el => {
    const dup = gymEdDup(); if (dup) { toast(gymDupMsg(dup, 'Main strength')); return; }
    const bl = ptEditBlocked(el.dataset.d); if (bl.length) { toast(ptNames([...new Set(bl)]).replace(/^y/, 'Y') + (bl.length === 1 ? ' has' : ' have') + ' logged this day, so its exercises can’t be renamed, removed or put in another order. You can still add exercises; the admin can change the rest.'); return; }
    saveEditor(el.dataset.d);
  },
  chk: el => { const g = el.dataset.g, k = el.dataset.k; editLog(curDate(), l => { l[g] = l[g] || {}; l[g][k] = !l[g][k]; if (!l[g][k]) delete l[g][k]; }, { render: false }); render(); },
  set: el => {
    const date = curDate(), i = +el.dataset.ex, s = +el.dataset.set, ex = P(date).strength[i];
    let done = false, w = null;
    editLog(date, l => {
      l.str = l.str || {}; const e = l.str[i] = l.str[i] || { n: ex.name, s: [] }; e.n = ex.name; e.s = e.s || [];
      const x = Object.assign({}, e.s[s] || {});
      const rIn = $('#r-' + i + '-' + s), wIn = $('#w-' + i + '-' + s);
      x.r = rIn ? num(rIn.value) : (x.r != null ? x.r : ex.reps); x.w = wIn ? num(wIn.value) : (x.w != null ? x.w : ex.load);
      x.d = !x.d; e.s[s] = x; done = x.d; w = x.w;
      for (let k = 0; k < e.s.length; k++) if (!e.s[k]) e.s[k] = null;
      if (!l.start && !l.status && date === todayISO()) l.start = Date.now();
    }, { render: false });
    if (done) {
      if (s < ex.sets - 1 || exOrder(date, getLog(date)).indexOf(i) < P(date).strength.length - 1) startRest(ex.restSec, ex.name + ' · set ' + (s + 1) + ' of ' + ex.sets);
      const best = bestLoadBefore(S.pid, ex.name, date);
      if (w > 0 && best != null && w > best) toast('New PR: ' + ex.name.replace(/\s*\(.*?\)/, '') + ' ' + w + ' kg', 'pr');
    }
    render();
  },
  'ex-mv': el => {
    if (!S.pid) { openWho(); return; }
    const date = curDate(), i = +el.dataset.ex, d = +el.dataset.v;
    const o = exOrder(date, getLog(date)); const k = o.indexOf(i), j = k + d;
    if (k < 0 || j < 0 || j >= o.length) return;
    const y0 = el.getBoundingClientRect().top;
    o[k] = o[j]; o[j] = i;
    editLog(date, l => { if (o.every((x, q) => x === q)) delete l.ord; else l.ord = o; }, { render: false });
    render();
    const box = $('#ex-' + i); if (!box) return;
    const nb = box.querySelector('[data-a=ex-mv][data-v="' + d + '"]');
    if (nb) window.scrollBy(0, nb.getBoundingClientRect().top - y0); // keep the arrow under the finger
    const f = nb && !nb.disabled ? nb : box.querySelector('[data-a=ex-mv]:not([disabled])'); if (f) f.focus({ preventScroll: true });
    box.classList.add('moved');
  },
  'ex-mv-reset': () => { if (!S.pid) { openWho(); return; } editLog(curDate(), l => { delete l.ord; }, { render: false }); render(); toast('Back to the plan order'); },
  'use-load': el => { const date = curDate(), i = +el.dataset.ex, v = +el.dataset.w, ex = P(date).strength[i]; editLog(date, l => { l.str = l.str || {}; const e = l.str[i] = l.str[i] || { n: ex.name, s: [] }; for (let s = 0; s < ex.sets; s++) { const x = e.s[s] || {}; if (!x.d) e.s[s] = Object.assign({}, x, { w: v, r: x.r != null ? x.r : ex.reps }); } }); },
  'ex-rpe': el => { const date = curDate(), i = +el.dataset.ex, v = +el.dataset.v; editLog(date, l => { l.str = l.str || {}; l.str[i] = l.str[i] || { s: [] }; l.str[i].rpe = l.str[i].rpe === v ? null : v; }); },
  'run-add': () => { const date = curDate(); const p = P(date); editLog(date, l => { l.runs = l.runs || []; if (!l.runs.length) l.runs.push({ type: p.run.type }); l.runs.push({ type: 'easy' }); }); },
  'run-del': el => { const j = +el.dataset.j; editLog(curDate(), l => { (l.runs || []).splice(j, 1); }); },
  'run-rpe': el => { const j = +el.dataset.j, v = +el.dataset.v; const p = P(curDate()); editLog(curDate(), l => { l.runs = l.runs || []; l.runs[j] = l.runs[j] || { type: p.run.type }; l.runs[j].rpe = l.runs[j].rpe === v ? null : v; }); },
  'hx-tick': el => { const i = el.dataset.i; editLog(curDate(), l => { l.hx = l.hx || {}; const e = l.hx[i] = Object.assign({}, l.hx[i]); e.d = !e.d; const a = $('#hxa-' + i), ld = $('#hxl-' + i); if (e.d) { if (a && e.amt == null) e.amt = num(a.value); if (ld && e.load == null) e.load = num(ld.value); } if (!l.start && !l.status && curDate() === todayISO()) l.start = Date.now(); }); },
  'xh-add': () => editLog(curDate(), l => { l.xh = l.xh || []; l.xh.push({ st: (P(curDate()).stations[0]) || 'wb' }); }),
  'xh-del': el => editLog(curDate(), l => { (l.xh || []).splice(+el.dataset.k, 1); }),
  rpe: el => { const v = +el.dataset.v; editLog(curDate(), l => { l.rpe = l.rpe === v ? null : v; }); },
  'use-elapsed': el => editLog(curDate(), l => { l.time = +el.dataset.v; }),
  status: el => {
    const v = el.dataset.v; let now = null;
    editLog(curDate(), l => { l.status = l.status === v ? null : v; now = l.status; if (now && now !== 'skipped' && !l.time && l.start) l.time = Math.max(1, Math.round((Date.now() - l.start) / 60000)); const n = $('#notes-' + curDate()); if (n) l.notes = n.value; });
    if (now === 'complete') toast('Session logged. Nice work.');
    if (now === 'complete' || now === 'skipped') stopRest();
  },
  reason: el => { const v = el.dataset.v; editLog(curDate(), l => { const cur = l.reason || ''; const rest = cur.includes(':') ? cur.slice(cur.indexOf(':') + 1).trim() : (REASONS.includes(cur) ? '' : cur); l.reason = rest ? v + ': ' + rest : v; }); },
  start: () => { audioInit(); editLog(todayISO(), l => { l.start = Date.now(); }); },
  'start-reset': () => editLog(todayISO(), l => { delete l.start; }),
  scroll: (el, e) => { e.preventDefault(); const t = document.getElementById(el.dataset.t); if (t && t.classList.contains('folded')) { const h = t.querySelector('.foldh'); if (h) ACT.fold(h); } if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  'bag-add': () => { const i = $('#bag-new'); const v = i && i.value.trim(); if (!v || !S.pid) return; editProfile(p => { p.bagExtra = (p.bagExtra || []).concat([v]); }); render(); },
  'niggle-add': () => go({ view: 'progress', sub: 'body' }),
  nig: el => { S.nigForm = S.nigForm || { part: '', side: '', sev: 3 }; const k = el.dataset.k; S.nigForm[k] = k === 'sev' ? +el.dataset.v : el.dataset.v; render(); },
  'nig-save': () => {
    const f = S.nigForm || {}; if (!f.part || !S.pid) return;
    const doc = clone(S.niggles[S.pid]) || { items: [] }; doc.items = doc.items || [];
    doc.items.push({ t: Date.now(), date: todayISO(), part: f.part, side: f.side || '', sev: f.sev || 3, note: ($('#nig-note') || {}).value || '' });
    put('niggles', S.pid, doc); S.nigForm = null;
    const w = niggleWarnings(S.pid).find(x => x.part === f.part);
    toast(w ? f.part + ' flagged ' + w.n + ' times recently. Read the pain rule before you run.' : 'Niggle logged.'); render();
  },
  'nig-del': el => { const t = +el.dataset.t; const doc = clone(S.niggles[S.pid]) || { items: [] }; doc.items = (doc.items || []).filter(x => x.t !== t); put('niggles', S.pid, doc); render(); },
  jboth: el => { LS.set('hx.jboth', !LS.get('hx.jboth', false)); el.setAttribute('aria-pressed', LS.get('hx.jboth', false)); $('#jres').innerHTML = journalResults(S.route.q || ''); },
  'set-plan': el => { if (!S.pid) return; editProfile(p => { p.plan = el.dataset.v; }); render(); if (SHEET) renderSheet(); },
  'prof-color': el => { editProfile(p => { p.color = el.dataset.v; }); render(); },
  theme: el => { LS.set('hx.theme', el.dataset.v); applyTheme(); render(); },
  'look-style': el => { LS.set('hx.style', el.dataset.v); applyLook(); render(); },
  'look-ink': el => { LS.set('hx.ink', el.dataset.v); applyLook(); render(); },
  sound: el => { LS.set('hx.sound', el.dataset.v === '1'); render(); if (el.dataset.v === '1') beep(1); },
  csv: el => saveFile(el.dataset.v === 'sessions' ? 'hyrox-sessions.csv' : 'hyrox-sets-runs-stations.csv', el.dataset.v === 'sessions' ? sessionsCSV() : detailCSV()),
  backup: () => saveFile('hyrox-backup-' + todayISO() + '.json', backupJSON()),
  'restore-go': () => restoreGo(),
  'restore-cancel': () => { RESTORE = null; const b = $('#restore-box'); if (b) b.innerHTML = ''; },
  'dl-week': el => saveFile('hyrox-week-' + el.dataset.n + '-summary.html', weekSummaryHTML(+el.dataset.n)),
  'recap-png': el => recapPNG(+el.dataset.n),
  'photo-del': async el => {
    const id = S.pid + '_w' + String(el.dataset.n).padStart(2, '0'); const doc = clone(S.weekly[id]) || {}; const old = doc.photo; delete doc.photo;
    put('weekly', id, doc); render(); if (old && S.assets) { try { await S.assets.delete(old); } catch (e) { } }
  },
  'rw-tab': el => { RW.tab = el.dataset.v; renderSheet(); },
  'rw-start': () => rwStart(), 'rw-split': () => rwSplit(),
  'rw-undo': () => { RW.splits.pop(); renderSheet(); },
  'rw-stop': () => { RW.running = false; clearInterval(RW.int); RW.int = null; keepAwake(false); renderSheet(); },
  'rw-reset': () => { RW.splits = []; RW.running = false; renderSheet(); },
  'rw-save': () => rwSave(), 'sl-save': () => slSave(),
  rchk: el => { const k = el.dataset.k; editLog(RACE(), l => { l.raceChk = l.raceChk || {}; l.raceChk[k] = !l.raceChk[k]; }, { render: false }); renderSheet(); },
  'rest-add': el => { const v = +el.dataset.v; if (RT.over) { RT.over = false; RT.end = Date.now() + Math.max(0, v) * 1000; RT.dur = Math.max(RT.dur, v); } else { RT.end += v * 1000; RT.dur = Math.max(RT.dur + v, 1); } restTick(); },
  'rest-stop': () => stopRest()
};
Object.assign(ACT, MODE_ACT);
Object.assign(ACT, NUT_ACT);
Object.assign(ACT, SHARE_ACT);
Object.assign(ACT, TOGETHER_ACT);
ACT0_XL_ADD = ACT['xl-add'];
Object.assign(ACT, LIST_ACT);
Object.assign(ACT, PICK_ACT, PT_ACT, BODY_ACT, IB_ACT);
Object.assign(ACT, SURE_ACT); sureWrap();
function openWho() {
  if (!S.user) return;
  if (isAdmin() && (ownProfile() || peopleIds().length)) openSheet('who');
  else if (!ownProfile()) openSheet('setup');
  else go({ view: 'settings' });
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el || el.disabled) return;
  const a = el.dataset.a; const f = ACT[a]; if (!f) return;
  if (el.tagName === 'A') e.preventDefault();
  f(el, e);
});

/* ---------- input handlers ---------- */
const saveTimers = new Map();
function deferSave(key, fn, ms = 450) { clearTimeout(saveTimers.get(key)); saveTimers.set(key, setTimeout(() => { saveTimers.delete(key); fn(); }, ms)); }
const IN = {
  str: (el, ev) => { const date = curDate(), i = +el.dataset.ex, s = +el.dataset.set, k = el.dataset.k; const ex = P(date).strength[i]; deferSave(el.id, () => editLog(date, l => { l.str = l.str || {}; const e = l.str[i] = l.str[i] || { n: ex.name, s: [] }; e.s = e.s || []; const x = Object.assign({}, e.s[s] || {}); x[k] = num(el.value); if (k === 'r' && x.w == null) { const wi = $('#w-' + i + '-' + s); x.w = ex.load != null ? ex.load : wi && wi.value !== '' ? num(wi.value) : ex.load; } if (k === 'w' && x.r == null) x.r = ex.reps; e.s[s] = x; for (let q = 0; q < e.s.length; q++) if (!e.s[q]) e.s[q] = null; }, { render: false }), ev === 'change' ? 0 : 500); },
  bench: (el, ev) => { const id = el.dataset.id, k = el.dataset.k; deferSave(el.id, () => { editBench(b => { b.results[id] = Object.assign({}, b.results[id], { [k]: el.value.trim(), date: curDate() <= todayISO() ? curDate() : todayISO() }); const bm = ((S.meta && S.meta.benchmarks) || []).find(x => x.id === id); if (bm) b.results[id].date = bm.date <= todayISO() ? bm.date : todayISO(); }); if (ev === 'change') renderSoon(); }, ev === 'change' ? 0 : 600); },
  notes: el => { const date = curDate(); deferSave(el.id, () => editLog(date, l => { l.notes = el.value; }, { render: false }), 600); },
  run: (el, ev) => {
    const date = curDate(), j = +el.dataset.j, k = el.dataset.k; const p = P(date);
    const box = el.closest('[data-run]');
    if (box && (k === 'dist' || k === 'time')) { const d = num($('#rd-' + j).value), t = parseTime($('#rtm-' + j).value); $('#rp-' + j).textContent = d && t ? fmtPace(t / d) + '/km' : '–'; }
    deferSave(el.id, () => { editLog(date, l => { l.runs = l.runs || []; l.runs[j] = Object.assign({ type: p.run.type }, l.runs[j]); const r = l.runs[j]; if (k === 'dist') r.dist = num(el.value); else if (k === 'time') r.time = parseTime(el.value); else r[k] = el.value; }, { render: k === 'type' }); sureLinkTT(date, j, k); }, ev === 'change' ? 0 : 500);
  },
  rep: (el, ev) => { const date = curDate(), j = +el.dataset.j, k = +el.dataset.k; const p = P(date); deferSave(el.id, () => editLog(date, l => { l.runs = l.runs || []; l.runs[j] = Object.assign({ type: p.run.type }, l.runs[j]); const r = l.runs[j]; r.reps = (r.reps || []).slice(); while (r.reps.length <= k) r.reps.push(''); r.reps[k] = el.value.trim(); if (el.dataset.rd) r.repDist = +el.dataset.rd; }, { render: false }), ev === 'change' ? 0 : 500); },
  hx: (el, ev) => { const date = curDate(), i = el.dataset.i, k = el.dataset.k; deferSave(el.id, () => editLog(date, l => { l.hx = l.hx || {}; const e = l.hx[i] = Object.assign({}, l.hx[i]); e[k] = k === 'time' ? el.value.trim() : k === 'rpe' ? (num(el.value) || null) : num(el.value); if (k === 'time' && parseTime(el.value)) e.d = true; }, { render: false }), ev === 'change' ? 0 : 500); },
  xh: (el, ev) => { const date = curDate(), k = +el.dataset.k, f = el.dataset.k2; deferSave(el.id, () => editLog(date, l => { l.xh = l.xh || []; l.xh[k] = Object.assign({}, l.xh[k]); l.xh[k][f] = f === 'st' || f === 'time' ? el.value : num(el.value); }, { render: f === 'st' }), ev === 'change' ? 0 : 500); },
  lg: (el, ev) => { const date = curDate(), k = el.dataset.k; deferSave(el.id, () => editLog(date, l => { l[k] = el.dataset.num ? num(el.value) : el.value; }, { render: false }), ev === 'change' ? 0 : 500); },
  wnote: el => { const id = S.pid + '_w' + String(el.dataset.n).padStart(2, '0'); deferSave(el.id, () => { const doc = clone(S.weekly[id]) || {}; doc.note = el.value; doc.pid = S.pid; doc.week = +el.dataset.n; put('weekly', id, doc); }, 600); },
  photo: async (el, ev) => {
    if (ev !== 'change' || !el.files || !el.files[0] || !S.assets) return;
    const n = el.dataset.n; const id = S.pid + '_w' + String(n).padStart(2, '0');
    toast('Uploading photo…');
    try {
      const blob = await compressImage(el.files[0]);
      const res = await S.assets.upload(blob, { type: 'image/jpeg' });
      const doc = clone(S.weekly[id]) || {}; const old = doc.photo; doc.photo = res.id; doc.pid = S.pid; doc.week = +n;
      put('weekly', id, doc); render(); toast('Photo added');
      if (old && old !== res.id) { try { await S.assets.delete(old); } catch (e) { } }
    } catch (e) { toast(e && e.code === 'too_large' ? 'That photo is too large.' : e && e.code === 'quota_or_state' ? 'Photo storage is full.' : "Couldn't upload the photo" + (e && e.code ? ' (' + e.code + ')' : '') + '.'); }
  },
  nf: el => { if (S.newForm) S.newForm[el.dataset.k] = el.value; },
  prof: (el, ev) => { if (ev !== 'change' && el.dataset.k === 'remind') return; deferSave(el.id, () => { editProfile(p => { p[el.dataset.k] = el.value.trim(); }); if (el.dataset.k === 'name') $('#topbar').innerHTML = topbarHTML(), setSync(S.sync); }, ev === 'change' ? 0 : 700); },
  jq: el => { S.route.q = el.value; $('#jres').innerHTML = journalResults(el.value); },
  ed: el => { if (!ED) return; const g = el.dataset.g, k = el.dataset.k, i = +el.dataset.i;
    if (g === 'ex') ED.ex[i][k] = el.value; else if (g === 'hx' || g === 'acc') ED[g][i] = el.value; else if (g === 'f') ED.txt[k] = el.value;
    else if (g === 'd') { if (ED.d[k] !== el.value) { ED.d[k] = el.value; if (k === 'kind') renderSheet(); } } else if (g === 'q') ED.qual = el.value; else if (g === 'hb') ED.hb[k] = el.value; },
  mem: el => { if (S.memForm) S.memForm[el.dataset.k] = el.value; },
  pc: (el, ev) => {
    if (ev !== 'change') return; const k = el.dataset.k;
    if (k === 'pace') { const v = parseTime(el.value); if (v) PC.pace = v; }
    if (k === 'kmh') { const v = num(el.value); if (v) PC.pace = 3600 / v; }
    if (k === 'dist') PC.dist = +el.value;
    if (k === 'time') { const v = parseTime(el.value); if (v) PC.pace = v / PC.dist; }
    renderSheet();
  },
  restmin: (el, ev) => { deferSave(el.id, () => editLog(curDate(), l => { const r = l.rest = l.rest || {}; r.min = num(el.value); }, { render: false }), ev === 'change' ? 0 : 700); },
  photos: (el, ev) => { if (ev !== 'change' || !el.files || !el.files.length) return; const files = Array.from(el.files); const d = el.dataset.d; el.value = ''; addPhotos(d, files); },
  restore: (el, ev) => { if (ev !== 'change' || !el.files || !el.files[0]) return; const r = new FileReader(); r.onload = () => restoreFrom(String(r.result)); r.readAsText(el.files[0]); },
  'sl-date': el => { RW.date = el.value; renderSheet(); }
};
Object.assign(IN, NUT_IN);
Object.assign(IN, MODE_IN);
Object.assign(IN, TG_IN);
Object.assign(IN, PICK_IN, PT_IN, BODY_IN, IB_IN);
function onInput(e) { const el = e.target.closest && e.target.closest('[data-in]'); if (!el) return; const f = IN[el.dataset.in]; if (f) f(el, e.type); }
document.addEventListener('input', onInput);
document.addEventListener('change', onInput);
document.addEventListener('change', sureOnChange);

/* ---------- boot ---------- */
function navHTML() {
  const a = (v, ic, l) => '<a href="#' + v + '" data-a="nav" data-v="' + v + '">' + ic + '<span>' + l + '</span></a>';
  const t = (k, ic, l) => '<a href="#tool-' + k + '" class="side-only" data-a="tool" data-t="' + k + '">' + ic + '<span>' + l + '</span></a>';
  return '<div class="brand">HYROX<br>Tracker<small>Race day Fri 15 Jan 2027</small></div>' + a('today', I.today, 'Today') + a('nutrition', I.food, 'Nutrition') + a('calendar', I.cal, 'Calendar') + a('progress', I.chart, 'Progress') + a('together', I.people, 'Together') + a('settings', I.gear, 'Settings') +
    '<span class="sep side-only">More</span>' + '<a href="#guide" class="side-only" data-a="nav" data-v="guide">' + I.info + '<span>HYROX guide</span></a>' + '<a href="#photos" class="side-only" data-a="nav" data-v="photos">' + I.photo + '<span>Photos</span></a>' + '<a href="#progress-score" class="side-only" data-a="sub" data-v="progress" data-s="score">' + I.chart + '<span>Score history</span></a>';
}
$('#nav').innerHTML = navHTML();
setInterval(() => {
  const el = $('#elapsed'); if (el) { const l = getLog(todayISO()); if (l && l.start) el.textContent = fmtTime(Math.floor((Date.now() - l.start) / 1000)); }
  const t = todayISO(); if (t !== S._today) { const first = !S._today; S._today = t; if (!first && (S.route.view === 'today')) renderSoon(); }
}, 1000);
/* ---------- files: download, or share sheet on phones ---------- */
S.dl = {
  async save({ filename, data }) {
    const type = /\.png$/.test(filename) ? 'image/png' : /\.json$/.test(filename) ? 'application/json' : /\.csv$/.test(filename) ? 'text/csv' : /\.html$/.test(filename) ? 'text/html' : 'application/octet-stream';
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const touch = matchMedia('(pointer: coarse)').matches;
    if (touch && navigator.canShare && typeof File === 'function') {
      try {
        const file = new File([blob], filename, { type });
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: filename }); return true; }
      } catch (e) { if (e && e.name === 'AbortError') { const x = new Error('declined'); x.code = 'declined'; throw x; } }
    }
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return true;
  }
};

