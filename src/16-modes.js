/* ---------- Gym mode and HYROX mode (full screen, today only) ----------
   Both record into the same log as the Today page (l.str sets, l.hx rows, l.start, l.simTotal), so the two views always agree.
   MODE lives in memory. The HYROX clock's running state is saved in the log as l.hxc = { id, t0, ts, rest?, solo? },
   so a reload, a locked phone or another device picks it up. */
let MODE = null, MODE_INT = null;
const modeAvail = p => ({ gym: !!(p && !p.rest && p.strength.length), hx: !!(p && !p.rest && !p.hyrox.none) });
function openMode(kind, stage) {
  if (!S.pid) { openWho(); return; }
  const date = todayISO(), p = P(date); if (!p || !modeAvail(p)[kind]) return;
  if (SHEET) closeSheet();
  audioInit();
  const was = !!MODE;
  MODE = { kind, date, passed: {} };
  const l = getLog(date);
  if (!(l && (l.start || l.status))) editLog(date, x => { x.start = Date.now(); }, { render: false });
  sessInit(stage);
  document.body.classList.add('inmode'); keepAwake(true);
  clearInterval(MODE_INT); MODE_INT = setInterval(modeTick, 250);
  if (!was) { try { history.pushState({ hxmode: 1 }, ''); } catch (e) { } }
  renderMode(); const el = $('#mode'); if (el) el.scrollTop = 0;
  render();
}
function closeMode(fromHistory) {
  if (!MODE) return;
  MODE = null; clearInterval(MODE_INT); MODE_INT = null;
  document.body.classList.remove('inmode');
  const el = $('#mode'); if (el) { el.hidden = true; el.innerHTML = ''; }
  if (!RT.int && !RW.int) keepAwake(false);
  if (!fromHistory) { try { if (history.state && history.state.hxmode) history.back(); } catch (e) { } }
  render();
}
window.addEventListener('popstate', () => { if (MODE) closeMode(true); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && MODE) { keepAwake(true); renderMode(); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && MODE && !SHEET) closeMode(); });
function modeHead(title, sub) {
  return '<div class="md-top"><button class="btn sm md-endb" data-a="md-end" aria-label="End ' + title + '">' + I.close + 'End</button><div class="md-ttl"><b>' + title + '</b><span>' + esc(sub) + '</span></div><span class="md-clock mono" id="md-clock" title="Session time"></span></div>';
}
function renderMode() {
  const el = $('#mode'); if (!el) return;
  if (!MODE || !S.days[MODE.date]) { if (MODE) closeMode(); else el.hidden = true; return; }
  let h = '';
  try { h = modeHTML(); } catch (e) { console.error(e); h = modeHead(modeTitle(), '') + '<div class="md-card">Something went wrong drawing this screen. Close it and log on the Today page.</div>'; }
  el.innerHTML = '<div class="md-in">' + h + '</div>'; keepOpen(el); el.hidden = false;
  const bar = el.querySelector('.md-stages'), cur = bar && bar.querySelector('.md-stg.c');
  if (cur) { const over = cur.offsetLeft + cur.offsetWidth - (bar.scrollLeft + bar.clientWidth) + 16; if (over > 0) bar.scrollLeft += over; else if (cur.offsetLeft - 16 < bar.scrollLeft) bar.scrollLeft = Math.max(0, cur.offsetLeft - 16); }
  MODE.shown = restKey();
  modeTick(true);
}
const restKey = () => (RT.int && !RT.over ? 'rest' : RT.over ? 'over' : 'idle');
function modeTick(fromRender) {
  if (!MODE) return;
  const l = getLog(MODE.date) || {}, now = Date.now();
  const c = $('#md-clock'); if (c) c.textContent = l.start ? fmtTime(Math.floor((now - l.start) / 1000)) : '';
  if (MODE.view === 'hx' || l.hxc) {
    const hc = l.hxc;
    if (hc && hc.rest && now >= hc.rest && !fromRender) { hxAfterRest(hc.rest); return; }
    if (MODE.restFor && (!RT.int || RT.over) && !fromRender) { MODE.passed[MODE.restFor] = true; MODE.restFor = null; MODE.k = hxFirst(MODE.date); renderMode(); return; }
    if (hc) {
      const a = $('#md-total'); if (a) a.textContent = fmtTime(Math.floor((now - hc.t0) / 1000));
      const b = $('#md-seg'); if (b) { const sec = Math.floor((now - hc.ts) / 1000), tg = +b.dataset.tg; b.textContent = fmtTime(sec); if (tg) b.classList.toggle('bad', sec > tg); }
      const r = $('#md-crest'); if (r && hc.rest) { const left = Math.max(0, Math.ceil((hc.rest - now) / 1000)); r.textContent = fmtTime(left); }
    }
  }
  const rk = restKey();
  if (!fromRender && MODE.shown !== rk) {
    if (MODE.shown === 'over' && rk === 'idle') { MODE.shown = rk; const bn = $('#mode .md-banner'); if (bn) bn.remove(); } // don't redraw (and close the keyboard) just to drop the banner
    else { if (MODE.view === 'set') gymCapture(); renderMode(); return; }
  }
  if (RT.int && !RT.over) {
    const left = Math.max(0, Math.ceil((RT.end - now) / 1000));
    const r = $('#md-rest'); if (r) r.textContent = fmtTime(left);
    const bar = $('#md-restbar'); if (bar) bar.style.width = Math.max(0, Math.min(100, 100 - left / RT.dur * 100)) + '%';
  }
}
function restHTML(upNext, extra) {
  const left = Math.max(0, Math.ceil((RT.end - Date.now()) / 1000));
  return '<div class="md-rest"><p class="eyebrow">Rest</p><div class="md-big" id="md-rest">' + fmtTime(left) + '</div><div class="md-bar"><i id="md-restbar"></i></div><p class="small muted" style="margin-top:10px">The screen stays on. It beeps when rest is over.</p></div>' +
    '<div class="md-row"><button class="btn lg" data-a="rest-add" data-v="-15" aria-label="Take 15 seconds off">−15 s</button><button class="btn lg" data-a="rest-add" data-v="15" aria-label="Add 15 seconds">+15 s</button></div>' +
    (extra || '') + (upNext ? '<div class="md-card"><span class="eyebrow">Up next</span><div style="font-weight:700;font-size:17px;margin-top:2px">' + upNext + '</div></div>' : '') +
    '<div class="md-sp"></div><button class="btn primary lg block md-go" data-a="md-skip">Skip rest</button>';
}

/* ---- Gym mode ---- */
const gymSets = (l, i) => ((((l && l.str) || {})[i] || {}).s || []);
function gymNext(date) { // first unticked set, in this person's order
  const p = P(date), l = getLog(date) || {};
  for (const i of exOrder(date, l)) { const s = gymSets(l, i); for (let k = 0; k < p.strength[i].sets; k++) if (!(s[k] && s[k].d)) return { i, s: k }; }
  return null;
}
/* Both modes walk the whole session in stages (v20 Gym, v21 both):
   Warm-up → Strength → Run (when the stations start after it) → HYROX work → Run → Core → Cooldown → summary.
   Only the stages the day has are shown. Lists have Tick all; the run is typed in (no timer); the HYROX stage is the
   step-by-step flow (clock, sets, stopwatch). Gym mode and HYROX mode differ only in the title and where they open. */
const GYM_NAME = { wu: 'Warm-up', set: 'Strength', hx: 'HYROX', run: 'Run', acc: 'Core', cd: 'Cooldown', summary: 'Summary' };
const LIST_TITLE = { wu: 'Warm-up', cd: 'Cooldown', acc: 'Accessory & core' };
const modeTitle = () => MODE.kind === 'gym' ? 'Gym mode' : 'HYROX mode';
const listItems = (p, g) => g === 'wu' ? p.wu : g === 'cd' ? p.cd : p.acc.map(t => ({ t }));
function listState(date, g) { // warm-up / core / cooldown ticks, including your own items
  const v = listView(S.pid, date, g); return { n: v.n, d: v.done }; // v29: what's left after your edits (v20: accessory & core too)
}
function tickAll(date, g) { // Tick all / Untick all for a list
  const p = P(date), items = listItems(p, g), all = (() => { const st = listState(date, g); return st.n && st.d >= st.n; })();
  const v = listView(S.pid, date, g); // v29: only what's left in the list; every-day additions too
  editLog(date, l => {
    l[g] = {}; if (!all) items.forEach((it, i) => { if (!it.h && (!v || v.rows.some(r => r.k === 'plan' && r.i === i))) l[g][i] = true; });
    if (l.xl && l.xl[g]) l.xl[g] = l.xl[g].map((x, i) => v.adds.some(a => a.k === 'xl' && a.i === i) ? Object.assign({}, x, { d: !all }) : x);
    if (v) { const xe = v.adds.filter(a => a.k === 'xe'); l.xe = Object.assign({}, l.xe); if (all || !xe.length) delete l.xe[g]; else { l.xe[g] = {}; xe.forEach(a => { l.xe[g][a.key] = true; }); } if (!Object.keys(l.xe).length) delete l.xe; }
    if (!all && !l.start && !l.status && date === todayISO()) l.start = Date.now();
  }, { render: false });
}
const hxRowsOf = p => p.hyrox.rows.filter(r => r.kind !== 'note');
// the run comes first when the plan says the stations start after it ("start 8 min after the time trial", "5 min after the last rep", "Part 1: …")
const runFirst = p => /after the (time trial|last rep|tempo|last km|intervals|run)/i.test(p.hyrox.qual || '') || /^part 1/i.test(p.run.text || '');
/* ---- tests: each of the day's tests is recorded where it happens, and copied into Today's tests (S.bench) ---- */
const TEST_ST = [[/ski/i, 'ski'], [/\brow/i, 'row'], [/sled push/i, 'push'], [/sled pull/i, 'pull'], [/lunge/i, 'lunge'], [/wall ?ball/i, 'wb'], [/farmer/i, 'farm'], [/burpee/i, 'bbj']];
const testSt = t => (TEST_ST.find(x => x[0].test(t.name)) || [])[1];
const ttDist = t => { const m = String(t.name).match(/(\d+(?:\.\d+)?)\s*km/i); return m ? +m[1] : null; };
function testMap(date) { // row: {row index: test} done at a station; run: the time trial; clock: simulations (the clock total); type: the rest
  const p = P(date), used = new Set(), out = { row: {}, run: null, clock: [], type: [] };
  if (!p) return out;
  p.hyrox.rows.filter(r => r.test).forEach(r => { const t = p.tests.find(x => !used.has(x.id) && testSt(x) === r.st); if (t) { used.add(t.id); out.row[r.i] = t; } });
  p.tests.forEach(t => {
    if (used.has(t.id)) return;
    if (!out.run && /time trial/i.test(t.name) && !p.run.none && ttDist(t)) out.run = t;
    else if (/simulation/i.test(t.name) && !p.hyrox.none && hxSteps(date).some(x => x.b != null)) out.clock.push(t);
    else out.type.push(t);
  });
  return out;
}
function benchSave(t, v) { const today = todayISO(); editBench(b => { b.results[t.id] = Object.assign({}, b.results[t.id], { v: String(v), date: t.date && t.date <= today ? t.date : today }); }); }
const stageLabel = (date, k) => k === 'run' && testMap(date).run ? 'Time trial' : GYM_NAME[k];
function gymStages(date) {
  const p = P(date), out = [], L = k => listState(date, k).n > 0, rn = !p.run.none, hx = !p.hyrox.none, rf = rn && hx && runFirst(p);
  if (L('wu')) out.push('wu');
  if (p.strength.length) out.push('set');
  if (rf) out.push('run');
  if (hx) out.push('hx');
  if (rn && !rf) out.push('run');
  if (L('acc')) out.push('acc');
  if (L('cd')) out.push('cd');
  return out.map(k => [k, stageLabel(date, k)]);
}
function gymStageState(date, k) { // [started, done]
  const l = getLog(date) || {}, p = P(date);
  if (k === 'set') { const any = Object.values(l.str || {}).some(e => e && (e.s || []).some(x => x && x.d)); return [any, !gymNext(date)]; }
  if (k === 'hx') { const rows = hxRowsOf(p), hx = l.hx || {}, dn = rows.filter(r => hxRowDone(hx, r)).length; return [dn > 0 || !!l.hxc, rows.length > 0 && dn >= rows.length]; }
  if (k === 'run') { const any = (l.runs || []).some(r => r.dist || r.time); return [any, any]; }
  const st = listState(date, k); return [st.d > 0, st.n > 0 && st.d >= st.n];
}
function gymAfter(k) { const st = gymStages(MODE.date).map(x => x[0]); const i = st.indexOf(k); return st[i + 1] || 'summary'; }
function strengthStart() {
  if (!P(MODE.date).strength.length) return;
  const n = gymNext(MODE.date); if (n) { MODE.i = n.i; MODE.s = n.s; } else { MODE.i = exOrder(MODE.date, getLog(MODE.date))[0]; MODE.s = 0; }
  gymVals();
}
function gymGo(k) {
  const prev = MODE.view;
  if (prev === 'set') gymCapture();
  MODE.view = k; MODE.stopAsk = false;
  if (k !== prev) stopRest();
  if (k === 'set' && prev !== 'set') strengthStart();
  if (k === 'hx' && prev !== 'hx') hxInit();
  renderMode(); const el = $('#mode'); if (el) el.scrollTop = 0;
}
function sessInit(stage) { // open at the asked stage, the running HYROX clock, or where you left off
  const date = MODE.date, st = gymStages(date).map(x => x[0]), l = getLog(date) || {};
  let v;
  if (stage && st.includes(stage)) v = stage;
  else if (l.hxc && st.includes('hx')) v = 'hx';
  else { const ss = st.map(k => gymStageState(date, k)); let from = 0; ss.forEach((x, i) => { if (x[0]) from = i; }); v = st.find((x, i) => i >= from && !ss[i][1]) || 'summary'; }
  MODE.view = v;
  strengthStart();
  if (v === 'hx') hxInit();
}
function gymStageBar() {
  return '<div class="md-stages" role="tablist">' + gymStages(MODE.date).map(([k, n]) => { const dn = gymStageState(MODE.date, k)[1]; return '<button class="md-stg' + (MODE.view === k ? ' c' : '') + (dn ? ' d' : '') + '" data-a="md-stage" data-v="' + k + '" role="tab" aria-selected="' + (MODE.view === k) + '">' + (dn ? I.check : '') + n + '</button>'; }).join('') + '</div>';
}
const gymNextBtn = k => { const nx = gymAfter(k); return '<button class="btn primary lg block md-go" data-a="md-stage" data-v="' + nx + '">' + (nx === 'summary' ? I.check + 'Finish workout' : 'Next: ' + stageLabel(MODE.date, nx) + ' ' + I.right) + '</button>'; };
const skipTo = k => k === 'summary' ? 'Skip to the summary' : 'Skip to ' + (k === 'hx' ? 'HYROX' : stageLabel(MODE.date, k).toLowerCase());
function modeHTML() {
  const v = MODE.view, T = modeTitle(), bar = gymStageBar(), p = P(MODE.date), l = getLog(MODE.date) || {};
  if (v === 'summary') return modeHead(T, 'Workout summary') + bar + gymSummaryHTML(p, l, exOrder(MODE.date, l));
  if (v === 'wu' || v === 'cd' || v === 'acc') return modeHead(T, LIST_TITLE[v]) + bar + gymListHTML(v);
  if (v === 'run') return modeHead(T, stageLabel(MODE.date, 'run')) + bar + gymRunHTML();
  if (v === 'hx') return hxHTML(bar);
  return gymHTML(bar);
}
function gymListHTML(g) {
  const date = MODE.date, p = P(date), l = getLog(date) || {}, items = listItems(p, g), on = l[g] || {}, own = ((l.xl || {})[g]) || [], st = listState(date, g);
  let body = '';
  const chk = (it, i, d) => '<button class="check" data-a="md-chk" data-g="' + g + '" data-k="' + i + '" aria-pressed="' + !!d + '"><span class="box">' + I.check + '</span><span class="lbl">' + esc(it.t) + '</span></button>';
  const head = it => '<div class="grp">' + esc(it.h) + '</div>' + (it.note ? '<p class="small muted">+ ' + esc(it.note) + '</p>' : '');
  { // v29: the list as you edited it on Today (items taken out are gone, your additions are in); v20: accessory & core too
    const v = listView(S.pid, date, g);
    v.rows.forEach(r => { if (r.k !== 'h') body += chk(r, r.i, r.d); }); // v30: no WU-S / CD-1 headings
    if (v.adds.length) body += '<div class="grp">Your additions</div>' + v.adds.map(a => '<button class="check" data-a="' + (a.k === 'xe' ? 'md-xe' : 'md-xl') + '" data-g="' + g + '"' + (a.k === 'xe' ? ' data-key="' + esc(a.key) + '"' : ' data-i="' + a.i + '"') + ' aria-pressed="' + !!a.d + '"><span class="box">' + I.check + '</span><span class="lbl">' + esc(a.t) + '</span></button>').join('');
  }
  const all = st.n && st.d >= st.n, sub = ''; // v30: no "WU-S." / "CD-1, …" line
  return '<div><h2 class="md-name md-left">' + esc(LIST_TITLE[g]) + '</h2>' + (sub ? '<p class="md-meta">' + esc(sub) + '</p>' : '') + '</div>' +
    '<div class="md-card"><div class="md-listbar"><span class="mono small muted">' + st.d + '/' + st.n + ' done</span><button class="btn sm" data-a="md-chk-all" data-g="' + g + '">' + (all ? 'Untick all' : I.check + 'Tick all') + '</button></div><div class="checks">' + body + '</div></div>' +
    '<div class="md-sp"></div>' + gymNextBtn(g);
}
function gymRunHTML() { // no timer: the run is typed in. On a time-trial day the time also goes into Today's tests.
  const date = MODE.date, p = P(date), l = getLog(date) || {}, run = p.run, r = (l.runs || [])[0] || {}, tt = testMap(date).run, tD = tt ? ttDist(tt) : null;
  const zones = S.pid ? zonesFor(S.pid) : [], z = run.zone ? zones.find(x => x.key === run.zone) : null;
  const tgt = tt ? tt.target : run.pace ? fmtPace(run.pace.lo) + '–' + fmtPace(run.pace.hi) + '/km' : z ? z.txt : '';
  const pace = r.dist && r.time ? fmtPace(r.time / r.dist) + '/km' : '–';
  const easyKm = tt && p.day.km && p.day.km > tD ? p.day.km - tD : 0, r1 = (l.runs || [])[1] || {};
  return '<div>' + (tt ? '<p class="eyebrow">Test</p>' : '') + '<h2 class="md-name md-left">' + (tt ? esc(tt.name) : 'Run') + '</h2><p class="md-meta">' + esc(run.text) + '</p></div>' +
    ((tgt || p.day.km) ? '<div class="md-card md-runt">' + (tgt ? '<div><span class="eyebrow">' + (tt ? 'Target' : 'Target pace') + '</span><b>' + esc(tgt) + '</b></div>' : '') + (p.day.km ? '<div><span class="eyebrow">' + (tt ? 'Running today' : 'Planned') + '</span><b>≈' + fmtKm(p.day.km) + ' km</b></div>' : '') + '</div>' : '') +
    '<div class="md-card"><div class="fgrid"><label class="field"><span>' + (tt ? 'Time trial (km)' : 'Distance (km)') + '</span><input class="inp mono" id="md-rd" inputmode="decimal" value="' + esc(r.dist != null ? r.dist : '') + '" placeholder="' + esc(tt ? fmtKm(tD) : p.day.km ? fmtKm(p.day.km) : '0.0') + '" data-in="mdrun" data-k="dist"></label>' +
    '<label class="field"><span>Time (mm:ss)</span><input class="inp mono" id="md-rt" value="' + esc(r.time ? fmtTime(r.time) : '') + '" placeholder="' + (tt ? '5:30' : '20:00') + '" data-in="mdrun" data-k="time"></label></div>' +
    '<p class="small" style="margin-top:8px">Pace <b id="md-rp">' + pace + '</b></p>' +
    (easyKm ? '<label class="field" style="margin-top:10px"><span>Easy running around it (km): warm-up jog, strides and the jog at the end</span><input class="inp mono" id="md-re" inputmode="decimal" value="' + esc(r1.dist != null ? r1.dist : '') + '" placeholder="≈' + esc(fmtKm(easyKm)) + '" data-in="mdrun" data-k="easy"></label>' : '') +
    '<div class="field" style="margin-top:10px"><span>How hard was it (RPE)</span><div class="chips rpe">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => '<button class="chip" data-a="md-run-rpe" data-v="' + v + '" aria-pressed="' + (r.rpe === v) + '">' + v + '</button>').join('') + '</div></div></div>' +
    '<p class="small muted">' + (tt ? 'No timer here: run it, then type the time from your watch. It goes into Today’s tests too.' : 'No timer here: run, then type the distance and time from your watch or the treadmill.') + '</p>' +
    '<div class="md-sp"></div>' + gymNextBtn('run');
}
function gymVals() { // stepper values for MODE.i / MODE.s: what's logged, else the plan; the load carries over from the last ticked set
  const ex = P(MODE.date).strength[MODE.i], s = gymSets(getLog(MODE.date), MODE.i), x = s[MODE.s] || {};
  let prev = null, pk = -1; for (let k = MODE.s - 1; k >= 0; k--) if (s[k] && s[k].d) { prev = s[k]; pk = k; break; }
  MODE.r = x.r != null ? x.r : ex.reps != null ? ex.reps : '';
  // v32: last time's weight for this set; the set before carries over unless you're following last time's weights
  const lwa = ex.load == null && !ex.bw ? gymLastWeights(S.pid, ex.name, MODE.date) : null, lw = gymLastW(lwa, MODE.s);
  const follows = lw != null && prev && prev.w != null && gymLastW(lwa, pk) === num(prev.w);
  MODE.w = x.w != null ? x.w : follows ? lw : prev && prev.w != null ? prev.w : ex.load != null ? ex.load : lw != null ? lw : '';
}
function gymCapture() { const r = $('#md-r'), w = $('#md-w'); if (r) MODE.r = r.value; if (w) MODE.w = w.value; }
function gymMeta(ex) { return [ex.sets + ' × ' + (ex.reps != null ? ex.reps : '') + (ex.unit === 's' ? ' s' : ex.unit === 'm' ? ' m' : '') + (ex.per || ''), ex.loadText, ex.restText ? 'rest ' + ex.restText : ''].filter(Boolean).join(' · '); }
function gymHTML(bar) {
  const date = MODE.date, p = P(date), l = getLog(date) || {}, ord = exOrder(date, l);
  const doneEx = i => { const s = gymSets(l, i); for (let k = 0; k < p.strength[i].sets; k++) if (!(s[k] && s[k].d)) return false; return true; };
  const pos = ord.indexOf(MODE.i);
  const prog = '<div class="md-prog" aria-hidden="true">' + ord.map(i => '<i class="' + (doneEx(i) ? 'd' : i === MODE.i && MODE.view === 'set' ? 'c' : '') + '"></i>').join('') + '</div>';
  const ex = p.strength[MODE.i];
  const head = modeHead(modeTitle(), 'Exercise ' + (pos + 1) + ' of ' + ord.length) + bar;
  if (RT.int && !RT.over) {
    const n = gymNext(date); const nx = n ? p.strength[n.i] : null;
    const up = nx ? esc(nx.name) + '<div class="small muted" style="font-weight:400">Set ' + (n.s + 1) + ' of ' + nx.sets + '</div>' : '';
    return head + prog + restHTML(up);
  }
  const s = gymSets(l, MODE.i), cur = s[MODE.s] || {};
  const chips = '<div class="md-sets">' + Array.from({ length: ex.sets }, (_, k) => '<button class="md-set' + (s[k] && s[k].d ? ' d' : '') + (k === MODE.s ? ' c' : '') + '" data-a="md-set" data-v="' + k + '" aria-label="Set ' + (k + 1) + (s[k] && s[k].d ? ', done' : '') + '">' + (k + 1) + (s[k] && s[k].d ? I.check : '') + '</button>').join('') + (canEditPlan() ? '<button class="md-set md-pm" data-a="set-pm" data-d="' + date + '" data-ex="' + MODE.i + '" data-v="-1"' + (ex.sets > 1 ? '' : ' disabled') + ' aria-label="One set fewer">−</button><button class="md-set md-pm" data-a="set-pm" data-d="' + date + '" data-ex="' + MODE.i + '" data-v="1" aria-label="One more set">+</button>' : '') + '</div>';
  const step = (k, lab, val, ph, hint) => '<div class="md-card md-step"><div class="lbl"><span>' + lab + '</span><span>' + hint + '</span></div><div class="md-stepper"><button data-a="md-inc" data-k="' + k + '" data-v="-1" aria-label="Less">−</button><input class="md-num" id="md-' + k + '" inputmode="decimal" autocomplete="off" value="' + esc(val) + '" placeholder="' + ph + '" aria-label="' + lab + '"><button data-a="md-inc" data-k="' + k + '" data-v="1" aria-label="More">+</button></div></div>';
  const n = (() => { for (let q = pos + 1; q < ord.length; q++) if (!doneEx(ord[q])) return p.strength[ord[q]]; return null; })();
  return head + prog + (RT.over ? '<div class="md-banner" role="status">Rest done. Go.</div>' : '') +
    '<div class="md-exh"><button class="iconbtn" data-a="md-ex" data-v="-1" aria-label="Previous exercise"' + (pos > 0 ? '' : ' disabled') + '>' + I.left + '</button><div><h2 class="md-name">' + esc(ex.name) + '</h2></div><button class="iconbtn" data-a="md-ex" data-v="1" aria-label="Next exercise"' + (pos < ord.length - 1 ? '' : ' disabled') + '>' + I.right + '</button></div>' +
    chips +
    step('r', unitLbl(ex).replace(/^reps/, 'Reps'), MODE.r, '0', 'target ' + (ex.reps != null ? ex.reps : '–')) +
    step('w', ex.bw || ex.added ? 'Added weight (' + loadLbl(ex).replace('+', '') + ')' : 'Weight (' + loadLbl(ex) + ')', MODE.w, ex.bw ? 'BW' : '0', ex.load != null ? 'plan ' + ex.load : ex.bw ? 'bodyweight' : (() => { const v = gymLastW(gymLastWeights(S.pid, ex.name, date), MODE.s); return v != null ? 'last time ' + v : ''; })()) +
    gymTgModeRows(date, MODE.i, MODE.s) + '<div class="md-sp"></div>' +
    '<button class="btn primary lg block md-go" data-a="md-done">' + I.check + (cur.d ? 'Save set ' + (MODE.s + 1) : 'Done · set ' + (MODE.s + 1) + ' of ' + ex.sets) + '</button>' +
    (cur.d ? '<button class="linkbtn" data-a="md-untick">Untick set ' + (MODE.s + 1) + '</button>' : n ? '<p class="md-next">Then: ' + esc(n.name) + '</p>' : '<p class="md-next">Last exercise</p>') +
    (() => { const nx = gymAfter('set'); return '<button class="linkbtn" data-a="md-stage" data-v="' + nx + '">' + (nx === 'summary' ? 'Finish workout' : skipTo(nx)) + '</button>'; })();
}
function gymSummaryHTML(p, l, ord) {
  let sets = 0, done = 0, vol = 0; const prs = [];
  ord.forEach(i => {
    const ex = p.strength[i], s = gymSets(l, i); sets += ex.sets; let top = null;
    s.forEach(x => { if (!x || !x.d) return; done++; const w = num(x.w), r = num(x.r); if (w > 0) { top = top == null ? w : Math.max(top, w); if (r && ex.unit !== 's' && ex.unit !== 'm' && ex.unit !== 'min') vol += r * w * (ex.dual ? 2 : 1); } });
    const best = top != null && S.pid ? bestLoadBefore(S.pid, ex.name, MODE.date) : null;
    if (best != null && top > best) prs.push(ex.name.replace(/\s*\(.*?\)/, '') + ' ' + top + ' kg');
  });
  const stages = gymStages(MODE.date), allDone = stages.every(([k]) => gymStageState(MODE.date, k)[1]);
  const tests = p.tests || [];
  const testsH = tests.length && S.pid ? '<div class="md-card md-tests"><span class="eyebrow">Today’s tests</span>' + tests.map(t => { const bv = benchVal(S.pid, t.id); return '<label class="field"><span>' + esc(t.name) + ' · target ' + esc(t.target) + '</span><input class="inp mono" id="mb-' + t.id + '" inputmode="' + (t.kind === 'reps' ? 'numeric' : 'text') + '" placeholder="' + (t.kind === 'reps' ? 'reps' : 'm:ss') + '" value="' + esc(bv ? bv.v : '') + '" data-in="bench" data-id="' + t.id + '" data-k="v"></label>'; }).join('') + '<p class="small muted">Filled in from the session. Fix anything here; it’s the same as the Tests card on Today.</p></div>' : '';
  const run = (l.runs || [])[0] || {};
  const line = (k, txt) => { const dn = gymStageState(MODE.date, k)[1]; return '<div class="r"><span>' + stageLabel(MODE.date, k) + '</span><span class="' + (dn ? 'good' : 'muted') + '">' + txt + (dn ? ' ' + I.check : '') + '</span></div>'; };
  const rows = stages.map(([k]) => k === 'set' ? line(k, done + '/' + sets + ' sets' + (vol ? ' · ' + Math.round(vol).toLocaleString('en-IN') + ' kg' : ''))
    : k === 'run' ? line(k, run.dist || run.time ? [run.dist ? (Math.round(run.dist * 100) / 100) + ' km' : '', run.time ? fmtTime(run.time) : '', run.dist && run.time ? fmtPace(run.time / run.dist) + '/km' : ''].filter(Boolean).join(' · ') : 'not logged')
    : k === 'hx' ? (() => { const rs = hxRowsOf(p), hx = l.hx || {}; return line(k, rs.filter(r => hxRowDone(hx, r)).length + '/' + rs.length + ' done'); })()
    : (() => { const st = listState(MODE.date, k); return line(k, st.d + '/' + st.n); })()).join('');
  return '<div class="md-rest"><div class="md-trophy">' + I.medal + '</div><h2 class="md-name" style="margin-top:10px">' + (allDone ? 'Workout done' : 'Workout so far') + '</h2></div>' +
    '<div class="md-card md-splits">' + rows + '</div>' + testsH +
    (prs.length ? '<div class="md-card"><span class="eyebrow">New personal records</span>' + prs.map(x => '<div style="font-weight:700;margin-top:4px">' + esc(x) + '</div>').join('') + '</div>' : '') +
    '<div class="md-sp"></div><p class="md-next">End workout takes you to Finish session, to rate it and mark it done.</p>' +
    '<button class="btn primary lg block md-go" data-a="md-end">' + I.check + 'End workout</button>' +
    '<button class="linkbtn" data-a="md-stage" data-v="' + stages[0][0] + '">Review from the start</button>';
}
function gymDone() {
  const date = MODE.date, i = MODE.i, s = MODE.s, ex = P(date).strength[i];
  gymCapture(); const r = num(MODE.r), w = num(MODE.w);
  let wasDone = false;
  editLog(date, l => {
    l.str = l.str || {}; const e = l.str[i] = l.str[i] || { n: ex.name, s: [] }; e.n = ex.name; e.s = e.s || [];
    wasDone = !!(e.s[s] && e.s[s].d);
    e.s[s] = Object.assign({}, e.s[s], { r, w, d: true });
    for (let k = 0; k < e.s.length; k++) if (!e.s[k]) e.s[k] = null;
    if (!l.start && !l.status) l.start = Date.now();
  }, { render: false });
  if (!wasDone) { const best = bestLoadBefore(S.pid, ex.name, date); if (w > 0 && best != null && w > best) toast('New PR: ' + ex.name.replace(/\s*\(.*?\)/, '') + ' ' + w + ' kg', 'pr'); }
  try { navigator.vibrate && navigator.vibrate(40); } catch (e) { }
  const n = gymNext(date);
  if (wasDone) { toast('Set ' + (s + 1) + ' saved'); if (n) { MODE.i = n.i; MODE.s = n.s; gymVals(); } }
  else if (!n) { stopRest(); beep(2, 990); gymGo(gymAfter('set')); render(); return; }
  else {
    const nx = P(date).strength[n.i];
    startRest(ex.restSec || 90, 'Next: ' + nx.name + ' · set ' + (n.s + 1) + ' of ' + nx.sets);
    MODE.i = n.i; MODE.s = n.s; gymVals();
  }
  renderMode(); render();
}

/* ---- HYROX mode ---- */
function hxItems(p) { const f = field(p.day, 'HYROX WORK'); return f ? ((f.items && f.items.length) ? f.items : (!isNone(f.text) ? [f.text] : [])) : []; }
function hxSteps(date) { // the day's HYROX work as steps; continuous runs/stations ("1 km → Sled push") form clock blocks (s.b)
  const p = P(date), rows = p.hyrox.rows, items = hxItems(p), out = [];
  rows.forEach((r, n) => {
    if (r.kind === 'note') { const m = r.text.match(/(\d+)\s*min/i); out.push({ t: 'rest', sec: m ? +m[1] * 60 : 60, text: r.text, id: 'n' + r.i }); return; }
    if (r.chain) {
      out.push({ t: 'seg', r, id: 'r' + r.i });
      const nx = rows[n + 1]; const m = (!nx || nx.src !== r.src) && String(items[r.src] || '').match(/→\s*(\d+)\s*s rest\s*\.?\s*$/i);
      if (m) out.push({ t: 'crest', sec: +m[1], id: 'c' + r.i });
      return;
    }
    out.push({ t: r.test ? 'timed' : r.sets > 1 ? 'sets' : (r.st !== 'other' && r.amount) ? 'timed' : 'done', r, id: 'r' + r.i });
  });
  let b = -1, prev = false;
  out.forEach(s => { const inClock = s.t === 'seg' || s.t === 'crest'; if (inClock && !prev) b++; if (inClock) s.b = b; prev = inClock; });
  return out;
}
const hxRowDone = (hx, r) => { const e = hx[r.i]; return !!(e && (e.d || e.time)); };
function hxFirst(date) { // the step to show: the running clock's, else the first one not done
  const steps = hxSteps(date), l = getLog(date) || {}, hx = l.hx || {};
  if (l.hxc) { const k = steps.findIndex(s => s.id === l.hxc.id); if (k >= 0) return k; }
  for (let k = 0; k < steps.length; k++) {
    const s = steps[k];
    if (s.t === 'crest') continue;
    if (s.t === 'rest') { const nx = steps[k + 1]; if ((MODE && MODE.passed[s.id]) || !nx || (nx.r && hxRowDone(hx, nx.r))) continue; return k; }
    if (!hxRowDone(hx, s.r)) return k;
  }
  return steps.length;
}
function hxInit() { MODE.k = hxFirst(MODE.date); MODE.hsub = 'step'; }
const segName = r => r.kind === 'run' ? r.label : r.title;
const segSub = r => r.kind !== 'run' ? r.sub : [/km|\bm\b/.test(r.label) ? '' : r.dist ? fmtKm(r.dist) + ' km' : '', r.tag === 'rp' || r.tag === 'race' ? 'race pace ' + fmtPace(rpPace(S.pid)) + '/km' : r.tag === 'tempo' ? 'tempo' : r.tag === 'easy' ? 'easy' : ''].filter(Boolean).join(' · ');
function segTarget(r) { // clock targets: stations include their share of the Roxzone, because the split runs from the end of the run
  if (!S.pid) return null;
  if (r.kind === 'run') return runTarget(S.pid, r);
  if (r.st === 'other') return null;
  const t = stationTarget(S.pid, r.st, r.amount); if (t == null) return null;
  const sp = planSplits(S.pid); return t + (sp && sp.rox ? parseTime(sp.rox) / 8 : 0); // unrounded, so 8 stations add up to the plan exactly
}
function stepName(s) { return !s ? '' : s.t === 'rest' ? esc(s.text) : s.t === 'crest' ? 'Rest ' + s.sec + ' s' : esc(segName(s.r)) + (s.t === 'seg' && s.r.kind === 'station' && s.r.sub ? ' <span class="small muted" style="font-weight:400">' + esc(s.r.sub) + '</span>' : ''); }
function hxHTML(bar) {
  const date = MODE.date, p = P(date), l = getLog(date) || {}, hx = l.hx || {}, hc = l.hxc, steps = hxSteps(date);
  if (hc) { const k = steps.findIndex(s => s.id === hc.id); if (k >= 0) MODE.k = k; }
  const vis = steps.filter(s => s.t !== 'crest'); const cur = steps[MODE.k];
  const pos = vis.indexOf(cur && cur.t === 'crest' ? steps[MODE.k - 1] : cur);
  const doneStep = s => s.r ? hxRowDone(hx, s.r) : !!MODE.passed[s.id] || steps.indexOf(s) < MODE.k;
  const head = modeHead(modeTitle(), MODE.k >= steps.length ? 'HYROX work done' : 'HYROX · step ' + (pos + 1) + ' of ' + vis.length) + (bar || '');
  const prog = '<div class="md-prog" aria-hidden="true">' + vis.map(s => '<i class="' + (doneStep(s) ? 'd' : s === cur ? 'c' : '') + '"></i>').join('') + '</div>';
  if (MODE.hsub === 'blocksum') return head + prog + hxBlockSum(steps, l, hx);
  if (MODE.k >= steps.length) return head + prog + hxFinishHTML(p, l);
  if (!hc && RT.int && !RT.over) {
    const un = cur.t === 'rest' ? steps[MODE.k + 1] : cur, ue = un && un.r ? (hx[un.r.i] || {}) : {};
    return head + prog + restHTML(stepName(un) + (un && un.t === 'sets' ? ' · set ' + Math.min((ue.sd || 0) + 1, un.r.sets) + ' of ' + un.r.sets : ''));
  }
  const nav = !hc ? '<div class="md-row md-nav"><button class="btn sm ghost" data-a="hx-nav" data-v="-1"' + (pos > 0 ? '' : ' disabled') + '>' + I.left + 'Back</button><button class="btn sm ghost" data-a="hx-nav" data-v="1"' + (pos < vis.length - 1 ? '' : ' disabled') + '>Skip ' + I.right + '</button></div>' : '';
  if (cur.b != null) return head + prog + hxClockHTML(steps, cur, l, hx, hc, p) + nav;
  const r = cur.r, e = cur.r ? (hx[r.i] || {}) : {}, bt = r ? testMap(date).row[r.i] : null;
  const title = t => '<div class="md-exh"><div><p class="eyebrow">' + esc(bt ? (r.grp && /test/i.test(r.grp) ? r.grp : 'Test') + ' · ' + bt.name : r && r.grp ? r.grp : cur.t === 'rest' ? 'Rest' : 'Station') + '</p><h2 class="md-name">' + t + '</h2>' + (r && r.sub ? '<p class="md-meta">' + esc(r.sub) + '</p>' : '') + '</div></div>';
  if (cur.t === 'rest') return head + prog + '<div class="md-rest"><p class="eyebrow">Rest</p><div class="md-big">' + fmtTime(cur.sec) + '</div><p class="md-meta">' + esc(cur.text) + '</p></div>' + (steps[MODE.k + 1] ? '<div class="md-card"><span class="eyebrow">Then</span><div style="font-weight:700;margin-top:2px">' + stepName(steps[MODE.k + 1]) + '</div></div>' : '') + '<div class="md-sp"></div><button class="btn primary lg block md-go" data-a="hx-rest" data-v="' + cur.sec + '">' + I.timer + 'Start rest</button>' + nav;
  if (cur.t === 'sets') {
    const sd = Math.min(r.sets, e.d ? r.sets : (e.sd || 0));
    const chips = '<div class="md-sets">' + Array.from({ length: r.sets }, (_, k) => '<span class="md-set' + (k < sd ? ' d' : '') + (k === sd ? ' c' : '') + '">' + (k + 1) + (k < sd ? I.check : '') + '</span>').join('') + '</div>';
    return head + prog + title(esc(r.title)) + chips +
      '<div class="md-card" style="text-align:center"><span class="eyebrow">Set ' + Math.min(sd + 1, r.sets) + ' of ' + r.sets + '</span><div class="md-seg" style="margin-top:6px">' + (r.each != null ? r.each + (r.unit === 'reps' ? '' : ' m') : '') + '</div><div class="md-meta">' + (r.unit === 'reps' ? 'reps' : '') + (r.load != null ? (r.unit === 'reps' ? ' · ' : '') + (r.dual ? '2 × ' : '') + r.load + ' kg' : '') + (r.restSec ? ' · rest ' + fmtTime(r.restSec) : '') + '</div></div>' +
      '<div class="md-sp"></div><button class="btn primary lg block md-go" data-a="hx-set">' + I.check + 'Done · set ' + Math.min(sd + 1, r.sets) + ' of ' + r.sets + '</button>' + (sd ? '<button class="linkbtn" data-a="hx-unset">Undo last set</button>' : '') + nav;
  }
  if (cur.t === 'timed' && bt && bt.kind === 'reps') { // a max-reps test: count, don't time
    if (MODE.trFor !== cur.id) { const bv = benchVal(S.pid, bt.id); MODE.tr = e.amt != null ? e.amt : bv && bv.v ? bv.v : ''; MODE.trFor = cur.id; }
    return head + prog + title(esc(r.title)) +
      '<div class="md-card md-step"><div class="lbl"><span>Reps</span><span>target ' + esc(bt.target) + '</span></div><div class="md-stepper"><button data-a="md-inc" data-k="tr" data-step="1" data-v="-1" aria-label="Fewer reps">−</button><input class="md-num" id="md-tr" inputmode="numeric" autocomplete="off" value="' + esc(MODE.tr) + '" placeholder="0" aria-label="Reps"><button data-a="md-inc" data-k="tr" data-step="1" data-v="1" aria-label="More reps">+</button></div></div>' +
      '<p class="small muted" style="text-align:center;margin:0">Count the good reps and stop at the first no-rep. It goes into Today’s tests.</p>' +
      '<div class="md-sp"></div><button class="btn primary lg block md-go" data-a="hx-treps">' + I.check + 'Save reps</button>' + nav;
  }
  if (cur.t === 'timed') {
    const tg = S.pid && r.st !== 'other' ? stationTarget(S.pid, r.st, r.amount) : null;
    const run = hc && hc.id === cur.id;
    return head + prog + title(esc(r.title)) +
      '<div class="md-card" style="text-align:center"><span class="eyebrow">' + (r.test ? 'For time' : 'Time it') + '</span><div class="md-seg" id="md-seg" data-tg="' + (tg || '') + '" style="font-size:72px;margin-top:6px">' + (e.time && !run ? esc(e.time) : '0:00') + '</div>' + (bt ? '<div class="md-meta">Test target: ' + esc(bt.target) + '</div>' : tg ? '<div class="md-meta">Race target (Plan ' + planOf(S.pid) + '): ' + fmtTime(tg) + '</div>' : '') + '</div>' +
      (run ? '' : '<div class="md-card"><div class="field"><span>Or type the time from your watch</span><span class="md-typed"><input class="inp mono" id="md-tt" placeholder="m:ss" aria-label="Time from your watch" value="' + esc(e.time || '') + '"><button class="btn" data-a="hx-ttype">Save time</button></span></div></div>') +
      '<div class="md-sp"></div>' + (run ? '<button class="btn primary lg block md-go" data-a="hx-tstop">' + I.check + 'Stop and save</button><button class="linkbtn" data-a="hx-tcancel">Cancel timing</button>'
        : '<button class="btn primary lg block md-go" data-a="hx-tstart">' + I.play + 'Start</button><button class="linkbtn" data-a="hx-mark">Mark done without timing</button>') + (run ? '' : nav);
  }
  return head + prog + title(esc(r.title)) + (r.raw && r.raw !== r.title ? '<div class="md-card">' + esc(r.raw) + '</div>' : '') + '<div class="md-sp"></div><button class="btn primary lg block md-go" data-a="hx-mark">' + I.check + 'Done</button>' + nav;
}
function hxClockHTML(steps, cur, l, hx, hc, p) {
  const blk = steps.filter(s => s.b === cur.b), segs = blk.filter(s => s.t === 'seg');
  const doneSegs = segs.filter(s => hx[s.r.i] && hx[s.r.i].time && (!hc || steps.indexOf(s) < steps.indexOf(cur)));
  const qual = p.hyrox.qual ? '<p class="small" style="color:var(--ink-2)"><b>How:</b> ' + esc(p.hyrox.qual) + '</p>' : '';
  if (!hc) {
    const from = steps.indexOf(cur);
    return '<div><p class="eyebrow">' + (blk.length === steps.length ? 'Race clock' : 'Continuous block') + '</p><h2 class="md-name">' + segs.length + ' segments</h2></div>' + qual +
      '<div class="md-card md-splits">' + segs.map(s => { const tg = segTarget(s.r), e = hx[s.r.i]; return '<div class="r' + (steps.indexOf(s) < from ? ' muted' : '') + '"><span>' + esc(segName(s.r)) + (s.r.kind === 'station' && s.r.sub ? ' <span class="small muted">' + esc(s.r.sub) + '</span>' : '') + '</span><span class="mono">' + (e && e.time ? esc(e.time) : tg ? fmtTime(tg) : '') + '</span></div>'; }).join('') + '</div>' +
      '<p class="small muted">Tap once at the end of each run and each station. Station targets include your transition, like the race clock.</p><div class="md-sp"></div><button class="btn primary lg block md-go" data-a="hx-start">' + I.play + (doneSegs.length ? 'Restart the clock from ' + esc(segName(cur.r)) : 'Start the clock') + '</button>';
  }
  const now = Date.now();
  let act = 0, plan = 0; doneSegs.forEach(s => { const tg = segTarget(s.r); if (tg) { act += parseTime(hx[s.r.i].time); plan += tg; } });
  const ahead = plan ? act - plan : null;
  const aheadH = ahead == null ? '<span class="muted">On the clock</span>' : '<span class="' + (ahead <= 0 ? 'good' : 'bad') + '">' + fmtTime(Math.abs(ahead)) + (ahead <= 0 ? ' ahead of plan' : ' behind plan') + '</span>';
  const last = doneSegs.slice(-3).map(s => { const t = parseTime(hx[s.r.i].time), tg = segTarget(s.r); return '<div class="r"><span>' + esc(segName(s.r)) + '</span><span class="mono">' + fmtTime(t) + (tg ? ' <span class="' + (t <= tg ? 'good' : 'bad') + '">' + fmtDelta(t - tg) + '</span>' : '') + '</span></div>'; }).join('');
  const top = '<div style="text-align:center"><p class="eyebrow">Total</p><div class="md-total" id="md-total">' + fmtTime(Math.floor((now - hc.t0) / 1000)) + '</div><p class="small" style="margin-top:4px">' + aheadH + '</p></div>';
  const lastH = '<div class="md-card md-splits"><span class="eyebrow">Last splits</span>' + (last || '<p class="small muted" style="margin-top:4px">Your first split appears here.</p>') + '</div>';
  const k = steps.indexOf(cur), nx = steps[k + 1] && steps[k + 1].b === cur.b ? steps[k + 1] : null;
  const prevSeg = (() => { for (let j = k - 1; j >= 0 && steps[j].b === cur.b; j--) if (steps[j].t === 'seg') return steps[j]; return null; })();
  const tools = '<div class="md-row">' + (prevSeg ? '<button class="btn" data-a="hx-undo">Undo last split</button>' : '') + '<button class="btn" data-a="hx-stop">' + (MODE.stopAsk ? 'Tap again to stop' : 'Stop clock') + '</button></div>';
  if (cur.t === 'crest') {
    const nseg = steps[k + 1] && steps[k + 1].b === cur.b ? steps[k + 1] : null;
    return top + '<div class="md-rest"><p class="eyebrow">Rest</p><div class="md-big" id="md-crest">' + fmtTime(Math.max(0, Math.ceil((hc.rest - now) / 1000))) + '</div><p class="small muted">The next split starts when the rest ends.</p></div>' +
      (nseg ? '<div class="md-card"><span class="eyebrow">Up next</span><div style="font-weight:700;font-size:17px;margin-top:2px">' + stepName(nseg) + '</div></div>' : '') + lastH + '<div class="md-sp"></div><button class="btn primary lg block md-go" data-a="hx-rest-skip">Start now</button>' + tools;
  }
  const r = cur.r, tg = segTarget(r), segSec = Math.floor((now - hc.ts) / 1000);
  const runNo = r.kind === 'run' ? segs.filter(s => s.r.kind === 'run').indexOf(cur) + 1 : segs.filter(s => s.r.kind === 'station').indexOf(cur) + 1;
  const nOf = segs.filter(s => s.r.kind === r.kind).length;
  const btn = nx ? (nx.t === 'crest' ? 'Done → rest ' + nx.sec + ' s' : 'Done → ' + esc(segName(nx.r))) : 'Finish';
  return top + '<div class="md-card md-cur"><p class="eyebrow">' + (r.kind === 'run' ? 'Run' : 'Station') + ' ' + runNo + ' of ' + nOf + '</p><h2 class="md-name" style="font-size:30px">' + esc(segName(r)) + '</h2><p class="md-meta">' + esc(segSub(r)) + '</p>' +
    '<div class="md-segrow"><span class="md-seg' + (tg && segSec > tg ? ' bad' : '') + '" id="md-seg" data-tg="' + (tg || '') + '">' + fmtTime(segSec) + '</span>' + (tg ? '<span class="small muted">target ' + fmtTime(tg) + (r.kind === 'station' ? '<br>incl. transition' : '') + '</span>' : '') + '</div></div>' +
    lastH + '<div class="md-sp"></div><button class="btn primary lg block md-go md-split" data-a="hx-split">' + btn + '</button>' + tools;
}
function hxBlockSum(steps, l, hx) {
  const segs = steps.filter(s => s.b === MODE.sumB && s.t === 'seg' && hx[s.r.i] && hx[s.r.i].time);
  let plan = 0, all = true; segs.forEach(s => { const tg = segTarget(s.r); if (tg) plan += tg; else all = false; });
  const tot = parseTime(l.simTotal) || sum(segs.map(s => parseTime(hx[s.r.i].time)));
  const worst = segs.map(s => ({ s, d: segTarget(s.r) != null ? parseTime(hx[s.r.i].time) - segTarget(s.r) : null })).filter(x => x.d != null && x.d >= 1).sort((a, b) => b.d - a.d).slice(0, 3);
  const nx = steps[MODE.k]; const sim = (P(MODE.date).day.badges || []).includes('sim');
  return '<div class="md-rest"><p class="eyebrow">Clock stopped</p><div class="md-total">' + fmtTime(tot, tot >= 3600) + '</div>' + (all && plan ? '<p class="md-meta"><span class="' + (tot <= plan ? 'good' : 'bad') + '">' + fmtTime(Math.abs(tot - plan)) + (tot <= plan ? ' faster' : ' slower') + '</span> than Plan ' + planOf(S.pid) + ' (' + fmtTime(plan, plan >= 3600) + ')</p>' : '') + '</div>' +
    (worst.length ? '<div class="md-card md-splits"><span class="eyebrow">Where you lost the most time</span>' + worst.map(x => '<div class="r"><span>' + esc(segName(x.s.r)) + '</span><span class="mono bad">' + fmtDelta(x.d) + '</span></div>').join('') + '</div>' : segs.length ? '<div class="md-card" style="text-align:center"><b>Every segment on or under target.</b></div>' : '') +
    '<p class="small muted" style="text-align:center">' + segs.length + ' splits saved' + (sim ? ' to Progress → Race → Simulation history' : ' to today’s HYROX work') + '.</p><div class="md-sp"></div>' +
    (nx ? '<button class="btn primary lg block md-go" data-a="hx-cont">Next: ' + stepName(nx) + '</button>' : '<button class="btn primary lg block md-go" data-a="hx-cont">Done</button>');
}
function hxFinishHTML(p, l) {
  const sim = (p.day.badges || []).includes('sim');
  return '<div class="md-rest"><div class="md-trophy">' + I.medal + '</div><h2 class="md-name" style="margin-top:10px">HYROX work done</h2>' + (l.simTotal ? '<p class="md-meta">Clock: ' + esc(l.simTotal) + (sim ? ' · saved to Simulation history' : '') + '</p>' : '') + '</div>' +
    '<div class="md-sp"></div>' + gymNextBtn('hx') + '<button class="linkbtn" data-a="hx-review">Review steps</button>';
}
function hxRowSave(x, r, extra) { x.hx = x.hx || {}; const e = x.hx[r.i] = Object.assign({}, x.hx[r.i], extra); if (r.kind === 'station') { if (e.amt == null && r.amount != null) e.amt = r.amount; if (e.load == null && r.load != null) e.load = r.load; } return e; }
function hxAdvance() { MODE.k = hxFirst(MODE.date); MODE.stopAsk = false; }
function hxSplit() {
  const date = MODE.date, steps = hxSteps(date), l = getLog(date) || {}, hc = l.hxc; if (!hc) return;
  const k = steps.findIndex(s => s.id === hc.id), s = steps[k]; if (!s || !s.r) return;
  const now = Date.now(), sec = Math.max(1, Math.round((now - hc.ts) / 1000));
  const nx = steps[k + 1] && steps[k + 1].b === s.b ? steps[k + 1] : null;
  editLog(date, x => {
    hxRowSave(x, s.r, { time: fmtTime(sec), d: true });
    if (nx) x.hxc = nx.t === 'crest' ? { id: nx.id, t0: hc.t0, ts: now, rest: now + nx.sec * 1000 } : { id: nx.id, t0: hc.t0, ts: now };
    else { delete x.hxc; x.simTotal = fmtTime(Math.round((now - hc.t0) / 1000), true); }
  }, { render: false });
  if (!nx) testMap(date).clock.forEach(t => benchSave(t, fmtTime(Math.round((now - hc.t0) / 1000), true)));
  try { navigator.vibrate && navigator.vibrate(60); } catch (e) { }
  MODE.stopAsk = false;
  if (nx && nx.t === 'crest') { startRest(nx.sec, 'Next: ' + (steps[k + 2] && steps[k + 2].r ? segName(steps[k + 2].r) : 'next segment')); beep(1, 880, 0.08); }
  else if (nx) beep(1, 880, 0.08);
  else { beep(3, 990); MODE.hsub = 'blocksum'; MODE.sumB = s.b; }
  MODE.k = k + 1; renderMode(); render();
}
function hxAfterRest(at) {
  const date = MODE.date, steps = hxSteps(date), l = getLog(date) || {}, hc = l.hxc; if (!hc) return;
  const k = steps.findIndex(s => s.id === hc.id), s = steps[k], nx = steps[k + 1] && s && steps[k + 1].b === s.b ? steps[k + 1] : null;
  editLog(date, x => { if (nx) x.hxc = { id: nx.id, t0: hc.t0, ts: at }; else { delete x.hxc; x.simTotal = fmtTime(Math.round((at - hc.t0) / 1000), true); } }, { render: false });
  if (!nx) testMap(date).clock.forEach(t => benchSave(t, fmtTime(Math.round((at - hc.t0) / 1000), true)));
  stopRest(); beep(2, 990);
  if (!nx) { MODE.hsub = 'blocksum'; MODE.sumB = s ? s.b : null; }
  MODE.k = k + 1; renderMode(); render();
}

/* ---- actions ---- */
const MODE_ACT = {
  'md-open': el => openMode(el.dataset.v, el.dataset.s),
  'md-close': () => closeMode(),
  'md-end': () => {
    const clock = MODE && (getLog(MODE.date) || {}).hxc;
    stopRest(); closeMode();
    setTimeout(() => { const f = $('#finish'); if (f) f.scrollIntoView({ block: 'start', behavior: 'smooth' }); toast(clock ? 'The HYROX clock is still running: tap Back to clock to finish it.' : 'Rate the session and mark it done in Finish session.'); }, 80);
  },
  'md-stage': el => gymGo(el.dataset.v),
  'md-chk': el => { const g = el.dataset.g, k = el.dataset.k; editLog(MODE.date, l => { l[g] = l[g] || {}; l[g][k] = !l[g][k]; if (!l[g][k]) delete l[g][k]; if (!l.start && !l.status) l.start = Date.now(); }, { render: false }); renderMode(); render(); },
  'md-xl': el => { const g = el.dataset.g, i = +el.dataset.i; editLog(MODE.date, l => { const a = ((l.xl || {})[g] || []); if (a[i]) a[i].d = !a[i].d; }, { render: false }); renderMode(); render(); },
  'md-xe': el => { const g = el.dataset.g, k = el.dataset.key; editLog(MODE.date, l => { l.xe = l.xe || {}; const o = l.xe[g] = Object.assign({}, l.xe[g]); if (o[k]) delete o[k]; else o[k] = true; if (!Object.keys(o).length) delete l.xe[g]; if (!Object.keys(l.xe).length) delete l.xe; if (!l.start && !l.status) l.start = Date.now(); }, { render: false }); renderMode(); render(); },
  'md-chk-all': el => { tickAll(MODE.date, el.dataset.g); renderMode(); render(); },
  'md-run-rpe': el => { const v = +el.dataset.v, p = P(MODE.date); editLog(MODE.date, l => { l.runs = l.runs || []; const r = l.runs[0] = Object.assign({ type: p.run.type }, l.runs[0]); r.rpe = r.rpe === v ? null : v; }, { render: false }); renderMode(); render(); },
  'chk-all': el => { tickAll(curDate(), el.dataset.g); render(); },
  'md-skip': () => { stopRest(); if (MODE && MODE.restFor) { MODE.passed[MODE.restFor] = true; MODE.restFor = null; hxAdvance(); } renderMode(); },
  'md-inc': el => {
    if (!MODE) return; const k = el.dataset.k, inp = $('#md-' + k); if (!inp) return; const ex = P(MODE.date).strength[MODE.i] || {};
    const step = el.dataset.step ? +el.dataset.step : k === 'r' ? (ex.unit === 's' ? 5 : 1) : (ex.dual ? 2 : 2.5);
    const v = Math.max(0, Math.round(((num(inp.value) || 0) + step * (+el.dataset.v)) * 100) / 100);
    inp.value = v; MODE[k] = v;
  },
  'md-use': el => { const inp = $('#md-w'); if (inp) inp.value = el.dataset.w; MODE.w = +el.dataset.w; },
  'md-done': () => gymDone(),
  'md-set': el => { gymCapture(); MODE.s = +el.dataset.v; gymVals(); renderMode(); },
  'md-ex': el => {
    const ord = exOrder(MODE.date, getLog(MODE.date)), q = ord.indexOf(MODE.i) + (+el.dataset.v); if (q < 0 || q >= ord.length) return;
    MODE.i = ord[q]; const s = gymSets(getLog(MODE.date), MODE.i), ex = P(MODE.date).strength[MODE.i];
    MODE.s = 0; for (let k = 0; k < ex.sets; k++) if (!(s[k] && s[k].d)) { MODE.s = k; break; }
    gymVals(); renderMode();
  },
  'md-untick': () => { const i = MODE.i, s = MODE.s; editLog(MODE.date, l => { const e = ((l.str || {})[i] || {}); if (e.s && e.s[s]) e.s[s] = Object.assign({}, e.s[s], { d: false }); }, { render: false }); renderMode(); render(); },
  'md-review': () => { MODE.view = 'set'; MODE.i = exOrder(MODE.date, getLog(MODE.date))[0]; MODE.s = 0; gymVals(); renderMode(); },
  'hx-treps': () => {
    const inp = $('#md-tr'), v = num(inp && inp.value); if (v == null || v < 0) { toast('Type the number of reps first'); return; }
    const s = hxSteps(MODE.date)[MODE.k]; if (!s || !s.r) return; const bt = testMap(MODE.date).row[s.r.i];
    editLog(MODE.date, l => { hxRowSave(l, s.r, { amt: v, d: true }); if (!l.start && !l.status) l.start = Date.now(); }, { render: false });
    if (bt) benchSave(bt, v);
    try { navigator.vibrate && navigator.vibrate(40); } catch (e) { }
    toast(s.r.title + ': ' + v + ' reps' + (bt ? ', saved to Today’s tests' : '')); MODE.trFor = null; hxAdvance(); renderMode(); render();
  },
  'hx-ttype': () => {
    const inp = $('#md-tt'), sec = parseTime(inp && inp.value); if (!sec) { toast('Type the time as m:ss'); return; }
    const s = hxSteps(MODE.date)[MODE.k]; if (!s || !s.r) return; const bt = testMap(MODE.date).row[s.r.i];
    editLog(MODE.date, l => { hxRowSave(l, s.r, { time: fmtTime(sec), d: true }); if (!l.start && !l.status) l.start = Date.now(); }, { render: false });
    if (bt) benchSave(bt, fmtTime(sec));
    toast(s.r.title + ': ' + fmtTime(sec) + (bt ? ', saved to Today’s tests' : '')); hxAdvance(); renderMode(); render();
  },
  'hx-nav': el => {
    const steps = hxSteps(MODE.date); let k = MODE.k + (+el.dataset.v);
    while (k >= 0 && k < steps.length && steps[k].t === 'crest') k += +el.dataset.v;
    if (k < 0 || k >= steps.length) return; if (steps[MODE.k] && steps[MODE.k].t === 'rest' && +el.dataset.v > 0) MODE.passed[steps[MODE.k].id] = true;
    MODE.k = k; MODE.hsub = 'step'; renderMode();
  },
  'hx-start': () => { const s = hxSteps(MODE.date)[MODE.k]; if (!s) return; audioInit(); const now = Date.now(); editLog(MODE.date, l => { l.hxc = { id: s.id, t0: now, ts: now }; if (!l.start && !l.status) l.start = now; }, { render: false }); beep(1, 990); renderMode(); render(); },
  'hx-split': () => hxSplit(),
  'hx-rest-skip': () => hxAfterRest(Date.now()),
  'hx-undo': () => {
    const date = MODE.date, steps = hxSteps(date), l = getLog(date) || {}, hc = l.hxc; if (!hc) return;
    const k = steps.findIndex(s => s.id === hc.id); let j = k - 1; while (j >= 0 && steps[j].t !== 'seg') j--;
    if (j < 0 || steps[j].b !== steps[k].b) return; const pr = steps[j], sec = parseTime(((l.hx || {})[pr.r.i] || {}).time) || 0;
    editLog(date, x => { const e = (x.hx || {})[pr.r.i]; if (e) { delete e.time; e.d = false; } x.hxc = { id: pr.id, t0: hc.t0, ts: hc.ts - sec * 1000 }; }, { render: false });
    stopRest(); MODE.k = j; renderMode(); render();
  },
  'hx-stop': () => { if (!MODE.stopAsk) { MODE.stopAsk = true; renderMode(); return; } editLog(MODE.date, l => { delete l.hxc; }, { render: false }); stopRest(); MODE.stopAsk = false; hxAdvance(); renderMode(); render(); },
  'hx-cont': () => { MODE.hsub = 'step'; hxAdvance(); renderMode(); },
  'hx-review': () => { MODE.hsub = 'step'; MODE.k = 0; renderMode(); },
  'hx-rest': el => { const s = hxSteps(MODE.date)[MODE.k]; MODE.restFor = s.id; startRest(+el.dataset.v, 'Then: ' + stripTags(stepName(hxSteps(MODE.date)[MODE.k + 1]))); renderMode(); },
  'hx-set': () => {
    const steps = hxSteps(MODE.date), s = steps[MODE.k], r = s.r; let fin = false;
    editLog(MODE.date, l => { const e = hxRowSave(l, r, {}); e.sd = Math.min(r.sets, (e.sd || 0) + 1); if (e.sd >= r.sets) { e.d = true; fin = true; } if (!l.start && !l.status) l.start = Date.now(); }, { render: false });
    try { navigator.vibrate && navigator.vibrate(40); } catch (e) { }
    if (fin) hxAdvance();
    const nxt = steps[MODE.k];
    if (r.restSec && (!fin || (nxt && nxt.t !== 'rest' && nxt.t !== 'crest'))) startRest(r.restSec, fin ? 'Next: ' + stripTags(stepName(nxt)) : 'Next: ' + r.title + ' · set ' + Math.min(((((getLog(MODE.date) || {}).hx || {})[r.i] || {}).sd || 0) + 1, r.sets) + ' of ' + r.sets);
    renderMode(); render();
  },
  'hx-unset': () => { const r = hxSteps(MODE.date)[MODE.k].r; editLog(MODE.date, l => { const e = hxRowSave(l, r, {}); e.sd = Math.max(0, (e.d ? r.sets : (e.sd || 0)) - 1); e.d = false; }, { render: false }); stopRest(); renderMode(); render(); },
  'hx-tstart': () => { const s = hxSteps(MODE.date)[MODE.k]; audioInit(); const now = Date.now(); editLog(MODE.date, l => { l.hxc = { id: s.id, t0: now, ts: now, solo: true }; if (!l.start && !l.status) l.start = now; }, { render: false }); beep(1, 990); renderMode(); },
  'hx-tstop': () => {
    const l = getLog(MODE.date) || {}, hc = l.hxc; if (!hc) return; const s = hxSteps(MODE.date)[MODE.k]; const sec = Math.max(1, Math.round((Date.now() - hc.ts) / 1000));
    editLog(MODE.date, x => { hxRowSave(x, s.r, { time: fmtTime(sec), d: true }); delete x.hxc; }, { render: false }); beep(2, 990);
    const bt = testMap(MODE.date).row[s.r.i]; if (bt) benchSave(bt, fmtTime(sec));
    toast(s.r.title + ': ' + fmtTime(sec) + (bt ? ', saved to Today’s tests' : '')); hxAdvance(); renderMode(); render();
  },
  'hx-tcancel': () => { editLog(MODE.date, l => { delete l.hxc; }, { render: false }); renderMode(); },
  'hx-mark': () => { const s = hxSteps(MODE.date)[MODE.k]; editLog(MODE.date, l => { hxRowSave(l, s.r, { d: true }); if (!l.start && !l.status) l.start = Date.now(); }, { render: false }); hxAdvance(); renderMode(); render(); }
};
const stripTags = h => String(h || '').replace(/<[^>]*>/g, '');

const MODE_IN = {
  mdrun: (el, ev) => {
    const k = el.dataset.k;
    deferSave('md-run-' + k, () => {
      if (!MODE) return; const p = P(MODE.date), tt = testMap(MODE.date).run, tD = tt ? ttDist(tt) : null;
      editLog(MODE.date, l => {
        l.runs = l.runs || []; const r = l.runs[0] = Object.assign({ type: p.run.type }, l.runs[0]);
        if (k === 'easy') { const v = num(el.value); if (v) l.runs[1] = Object.assign({ type: 'easy' }, l.runs[1], { dist: v }); else if (l.runs[1]) { l.runs[1] = Object.assign({}, l.runs[1], { dist: null }); if (!l.runs[1].time && !l.runs[1].notes) l.runs.splice(1, 1); } }
        else if (k === 'dist') r.dist = num(el.value);
        else { r.time = parseTime(el.value); if (tt && r.time && r.dist == null && tD) r.dist = tD; }
        if (!l.start && !l.status) l.start = Date.now();
      }, { render: false });
      if (tt && k === 'time') { const sec = parseTime(el.value); if (sec) benchSave(tt, fmtTime(sec)); }
      const a = $('#md-rp'), r = ((getLog(MODE.date) || {}).runs || [])[0] || {}; if (a) a.textContent = r.dist && r.time ? fmtPace(r.time / r.dist) + '/km' : '–';
      if (ev === 'change') render();
    }, ev === 'change' ? 0 : 500);
  }
};

