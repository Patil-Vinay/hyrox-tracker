/* ================= Settings & data ================= */
const APP_VERSION = 'v36';
function appInfo() { // version and how much this device keeps, to check an update arrived
  let n = 0; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); n += k.length + (localStorage.getItem(k) || '').length; } } catch (e) { }
  return '<p class="small muted" id="app-ver" style="text-align:center;margin-top:18px">HYROX Training Tracker ' + APP_VERSION + ' · saved on this device: ' + Math.max(1, Math.round(n * 2 / 1024)) + ' KB' + (LS.failed ? '<br>This device’s storage for the app was full, so the offline copy was cleared to make room.' : '') + '</p>';
}
function viewSettings() {
  const p = me();
  const theme = LS.get('hx.theme', 'system'), lookStyle = LS.get('hx.style', 'classic'), lookInk = LS.get('hx.ink', 'default');
  const you = p ? '<section class="card"><div class="card-h"><h3>' + (S.pid !== S.uid ? esc(pname(S.pid)) : 'You') + '</h3><span class="sp"></span>' + (isAdmin() ? '<button class="btn sm" data-a="who">View or edit as…</button>' : '') + '</div><div class="stack">' +
    '<label class="field"><span>Name</span><input class="inp" id="set-name" value="' + esc(p.name || '') + '" data-in="prof" data-k="name"></label>' +
    '<div class="field"><span>Colour</span><div class="swatches">' + PCOLORS.map(c => '<button class="swatch" style="--pc:var(--p-' + c + ')" data-a="prof-color" data-v="' + c + '" aria-pressed="' + (p.color === c) + '" aria-label="' + c + '"></button>').join('') + '</div></div>' +
    racePickerHTML(p.race, 'rc') +
    '<div class="field"><span>Race plan (sets race pace, targets and splits)</span><div class="seg">' + ['A', 'B', 'C'].map(k => '<button data-a="set-plan" data-v="' + k + '" aria-pressed="' + (planOf(S.pid) === k) + '">Plan ' + k + ' · ' + ((S.meta && S.meta.plans[k].finish) || '') + '</button>').join('') + '</div></div>' +
    '<div class="fgrid"><label class="field"><span>Reminder if today isn\'t logged by (IST)</span><input class="inp mono" type="time" id="set-remind" value="' + esc(p.remind === undefined ? '19:00' : p.remind || '') + '" data-in="prof" data-k="remind"></label></div>' +
    '<p class="small muted">The reminder shows at the top of Today when you open the tracker after this time. Clear the time to turn it off.</p></div></section>'
    : '<section class="card"><p>Set up your profile to see your settings.</p><button class="btn primary" data-a="who" style="margin-top:10px">Set up profile</button></section>';
  const removed = Object.keys(S.profiles).filter(id => isPerson(id) && S.profiles[id].removed);
  const people = '<section class="card"><div class="card-h"><h3>Members</h3><span class="sp"></span>' + (isAdmin() ? '<span class="pill">You\'re the admin</span>' : '') + '</div><div class="stack">' + peopleIds().map(pid => '<div class="row" style="flex-wrap:nowrap"><span class="dot" style="--pc:' + pcolor(pid) + '"></span><span style="flex:1;min-width:0"><b>' + esc(pname(pid)) + '</b><br><span class="small muted">' + (raceOf(pid) ? esc(raceLabel(raceOf(pid))) + ' · ' : '') + 'Plan ' + planOf(pid) + (pid === S.uid ? ' · you' : '') + '</span></span>' + (isAdmin() ? '<button class="btn sm" data-a="mem-edit" data-v="' + pid + '">Edit</button>' : '') + '</div>').join('') + '</div>' +
    (removed.length && isAdmin() ? '<details style="margin-top:8px"><summary class="small">Removed members (' + removed.length + ')</summary>' + removed.map(pid => '<div class="row"><span class="small" style="flex:1">' + esc(S.profiles[pid].name) + '</span><button class="btn sm" data-a="mem-restore" data-v="' + pid + '">Restore</button></div>').join('') + '</details>' : '') +
    '<p class="small muted" style="margin-top:10px">Everyone follows the same plan with their own log. To add someone, send them the link: they sign in with Google and set up their profile once. Everyone can see everyone\'s logs, but only ' + (isAdmin() ? 'you, as admin,' : 'the admin') + ' can change other people\'s logs or the plan.</p></section>';
  const look = '<section class="card"><div class="card-h"><h3>Display</h3></div><div class="stack"><div class="field"><span>Theme</span><div class="seg">' + [['system', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']].map(t => '<button data-a="theme" data-v="' + t[0] + '" aria-pressed="' + (theme === t[0]) + '">' + t[1] + '</button>').join('') + '</div></div>' +
    '<div class="field"><span>Colours</span><div class="seg">' + [['classic', 'Classic'], ['colourful', 'Colourful']].map(t => '<button data-a="look-style" data-v="' + t[0] + '" aria-pressed="' + (lookStyle === t[0]) + '">' + t[1] + '</button>').join('') + '</div></div>' +
    '<div class="field"><span>Text colour</span><div class="seg inkseg">' + INK_NAMES.map(t => '<button data-a="look-ink" data-v="' + t[0] + '" aria-pressed="' + (lookInk === t[0]) + '"><i class="inkdot" style="--dot:var(--inkp-' + t[0] + ')"></i>' + t[1] + '</button>').join('') + '</div></div>' +
    '<p class="small muted">Theme, colours and text colour are saved on this device. Each text colour has a deep shade for the light theme and a soft one for dark, so it’s always easy to read.</p>' +
    '<div class="field"><span>Timer sounds</span><div class="seg"><button data-a="sound" data-v="1" aria-pressed="' + (LS.get('hx.sound', true) !== false) + '">On</button><button data-a="sound" data-v="0" aria-pressed="' + (LS.get('hx.sound', true) === false) + '">Off</button></div></div></div></section>';
  const plan = '<section class="card"><div class="card-h"><h3>Plan</h3></div>' + (isAdmin()
    ? '<p class="small">The plan (all ' + planLen() + ' days) is shared by everyone. As admin you can open any day and tap <b>Edit</b> to change its workout; it updates for everyone straight away.</p><div class="row" style="margin-top:10px">' + (S.days[todayISO()] ? '<button class="btn sm" data-a="edit-plan" data-d="' + todayISO() + '">' + I.edit + 'Edit today</button>' : '') + '<button class="btn sm" data-a="gym-swap">' + I.edit + 'Change exercises</button><button class="btn sm" data-a="nav" data-v="calendar">Pick a day</button></div>'
    : '<p class="small">The plan (all ' + planLen() + ' days) is shared by everyone. On a day you can add an exercise, change its sets with − and +, edit its exercises, move the session or catch up a missed one. Every change is for everyone.</p><div class="row" style="margin-top:10px">' + (canEditPlan() ? '<button class="btn sm" data-a="gym-swap">' + I.edit + 'Change exercises</button>' : '') + '<button class="btn sm" data-a="nav" data-v="calendar">See the calendar</button></div>') + '</section>';
  const data = '<section class="card"><div class="card-h"><h3>Your data</h3><span class="sp"></span><span class="sync" data-s="' + S.sync + '"><i></i>' + esc({ saving: 'Saving…', offline: 'Offline', ro: 'View only', local: 'Not connected' }[S.sync] || 'Saved') + '</span></div>' +
    (S.dl ? '<div class="toolgrid"><button class="toolbtn" data-a="csv" data-v="sessions">Sessions (CSV)</button><button class="toolbtn" data-a="csv" data-v="detail">Sets, runs &amp; stations (CSV)</button><button class="toolbtn" data-a="dl-week" data-n="' + currentWeekN() + '">This week, printable</button><button class="toolbtn" data-a="backup">Full backup (JSON)</button></div>' : '<p class="small muted">File downloads aren\'t available in this view.</p>') +
    (!isAdmin() ? '' : '<div class="row" style="margin-top:10px"><label class="btn sm">Restore from backup<input type="file" accept=".json,application/json" id="restore-file" data-in="restore" hidden></label><span class="small muted">Replaces documents with the ones in the file.</span></div><div id="restore-box">' + restoreBoxHTML() + '</div>') +
    '<p class="small muted" style="margin-top:10px">Logs are saved to Firebase as you type. On weak gym Wi-Fi, changes wait on this device and sync when the connection returns.</p>' +
    (S.user ? '<div class="row" style="margin-top:12px;border-top:1px solid var(--line);padding-top:12px"><span class="small" style="flex:1;min-width:0;overflow-wrap:anywhere">Signed in as <b>' + esc(S.email || S.viewerName) + '</b></span><button class="btn sm" data-a="signout">Sign out</button></div>' : '') + '</section>';
  return '<h2 class="disp" style="font-size:34px;text-transform:uppercase">Settings</h2><div class="grid2"><div class="stack" style="gap:14px">' + you + nutSettingsCard() + tgPrefsCard() + '</div><div class="stack" style="gap:14px">' + look + people + plan + '</div></div>' + data + appInfo();
}
const INK_NAMES = [['default', 'Default'], ['blue', 'Navy'], ['green', 'Green'], ['purple', 'Purple'], ['brown', 'Brown']];
function applyLook() {
  const r = document.documentElement, st = LS.get('hx.style', 'classic'), ink = LS.get('hx.ink', 'default');
  if (st === 'colourful') r.setAttribute('data-style', 'colourful'); else r.removeAttribute('data-style');
  if (ink !== 'default' && INK_NAMES.some(x => x[0] === ink)) r.setAttribute('data-ink', ink); else r.removeAttribute('data-ink');
  const g = getComputedStyle(r).getPropertyValue('--ground').trim(); // phone status bar matches the page
  if (g) document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', g));
}
function applyTheme() {
  const t = LS.get('hx.theme', 'system'), r = document.documentElement;
  if (S._hostTheme === undefined) S._hostTheme = window.__HOST_THEME !== undefined ? window.__HOST_THEME : r.getAttribute('data-theme'); // what the page had before this device's setting
  if (t === 'light' || t === 'dark') r.setAttribute('data-theme', t);
  else if (S._hostTheme) r.setAttribute('data-theme', S._hostTheme); else r.removeAttribute('data-theme');
  applyLook();
}
try { const mq = window.matchMedia('(prefers-color-scheme: dark)'); const f = () => applyLook(); if (mq.addEventListener) mq.addEventListener('change', f); else mq.addListener(f); } catch (e) { }

/* ---- CSV ---- */
function csvCell(v) { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function toCSV(rows) { return rows.map(r => r.map(csvCell).join(',')).join('\n') + '\n'; }
function sessionsCSV() {
  const rows = [['date', 'day', 'week', 'person', 'session', 'status', 'reason', 'session_rpe', 'session_minutes', 'run_km', 'run_time', 'avg_pace_per_km', 'planned_km', 'notes']];
  peopleIds().forEach(pid => S.order.forEach(d => {
    const l = getLog(d, pid); const st = dayState(pid, d); if (!l && (st === 'future')) return;
    const runs = (l && l.runs) || []; const km = sum(runs.map(r => r.dist || 0)); const tm = sum(runs.map(r => r.time || 0)); const kmT = sum(runs.filter(r => r.time && r.dist).map(r => r.dist));
    rows.push([d, DOWS[dowOf(d)], S.days[d].week, pname(pid), S.days[d].heading, STATE_LABEL[st], l && l.reason, l && l.rpe, l && l.time, km ? km.toFixed(2) : '', tm ? fmtTime(tm) : '', kmT ? fmtPace(tm / kmT) : '', S.days[d].km, l && l.notes]);
  }));
  return toCSV(rows);
}
function detailCSV() {
  const rows = [['date', 'person', 'type', 'item', 'set', 'reps_or_amount', 'unit', 'load_kg', 'time', 'rpe', 'done', 'notes']];
  peopleIds().forEach(pid => logsOf(pid).forEach(l => {
    const p = P(l.date); const n = pname(pid);
    Object.keys(l.str || {}).forEach(i => { const ex = p.strength[+i]; (l.str[i].s || []).forEach((x, k) => { if (x) rows.push([l.date, n, 'set', ex ? ex.name : l.str[i].n, k + 1, x.r, ex ? unitLbl(ex) : '', x.w, '', k === (ex ? ex.sets - 1 : -1) ? l.str[i].rpe : '', x.d ? 'yes' : 'no', '']); }); });
    (l.runs || []).forEach(r => { rows.push([l.date, n, 'run', runTypeName(r.type || 'other'), '', r.dist, 'km', '', r.time ? fmtTime(r.time) : '', r.rpe, 'yes', r.notes]); (r.reps || []).forEach((t, k) => t && rows.push([l.date, n, 'rep', runTypeName(r.type || 'other'), k + 1, r.repDist, 'km', '', t, '', 'yes', ''])); });
    Object.keys(l.hx || {}).forEach(i => { const row = p.hyrox.rows[+i]; const e = l.hx[i]; if (!row || !e) return; rows.push([l.date, n, row.kind === 'run' ? 'split' : 'station', row.kind === 'run' ? row.label : row.title, '', e.amt != null ? e.amt : row.amount, row.kind === 'run' ? 'km' : row.unit, e.load != null ? e.load : row.load, e.time, e.rpe, e.d ? 'yes' : 'no', '']); });
    (l.xh || []).forEach(e => rows.push([l.date, n, 'station', stName(e.st || 'other'), '', e.amt, '', e.load, e.time, e.rpe, 'yes', 'extra']));
    (l.wb || []).forEach((x, k) => rows.push([l.date, n, 'wall balls', 'Wall-ball counter', k + 1, x, 'reps', 6, '', '', 'yes', '']));
    if (l.sim && l.sim.segs) Object.keys(l.sim.segs).forEach(k => rows.push([l.date, n, 'sim split', segLabel(k), '', '', '', '', fmtTime(l.sim.segs[k].t), '', 'yes', l.sim.label]));
  }));
  peopleIds().forEach(pid => { const r = (S.bench[pid] || {}).results || {}; ((S.meta && S.meta.benchmarks) || []).forEach(b => { if (r[b.id] && r[b.id].v) rows.push([b.date, pname(pid), 'test', b.name, '', b.kind === 'reps' ? r[b.id].v : '', b.kind === 'reps' ? 'reps' : '', '', b.kind === 'time' ? r[b.id].v : '', '', 'yes', r[b.id].note || '']); }); });
  return toCSV(rows);
}
function backupJSON() {
  const o = { app: 'hyrox-16-week-tracker', version: 1, exported: new Date().toISOString() };
  Object.keys(COLS).forEach(c => { o[c] = S[COLS[c]]; });
  return JSON.stringify(o, null, 1);
}
let RESTORE = null;
function restoreFrom(text) {
  let o; try { o = JSON.parse(text); } catch (e) { toast("That file isn't valid JSON."); return; }
  if (!o || o.app !== 'hyrox-16-week-tracker') { toast("That file isn't a backup from this tracker."); return; }
  RESTORE = o;
  const box = $('#restore-box'); if (box) box.innerHTML = restoreBoxHTML();
}
function restoreBoxHTML() {
  const o = RESTORE; if (!o) return '';
  let n = 0; Object.keys(COLS).forEach(c => { if (!PLAN_COLS.includes(c)) n += Object.keys(o[c] || {}).length; });
  return '<div class="warnbox" style="margin-top:10px"><div><b>Restore ' + n + ' profiles and logs from ' + esc(o.exported ? o.exported.slice(0, 10) : 'this file') + '?</b>Documents with the same name are replaced for everyone. Nothing is deleted.<div class="row" style="margin-top:8px"><button class="btn sm primary" data-a="restore-go">Restore</button><button class="btn sm" data-a="restore-cancel">Cancel</button></div></div></div>';
}
function restoreGo() {
  const o = RESTORE; if (!o) return; let n = 0;
  Object.keys(COLS).forEach(c => { Object.keys(o[c] || {}).forEach(id => {
    const d = Object.assign({}, o[c][id]); delete d._u;
    if (PLAN_COLS.includes(c) && DEFAULTS[c] && DEFAULTS[c][id] && canon(DEFAULTS[c][id]) === canon(d)) return; // same as the built-in plan
    if (c === 'profiles') delete d.uid; // old profile ids don't carry over; each person taps their name once
    if (put(c, id, d)) n++;
  }); });
  RESTORE = null; toast('Restoring ' + n + ' items. They sync in the background.'); render(); if (SHEET && SHEET.kind === 'who') renderSheet();
}
function weekSummaryHTML(n) {
  const w = weekDoc(n);
  const rows = peopleIds().map(pid => { const s = weekStats(pid, n); return '<tr><td>' + esc(pname(pid)) + '</td><td>' + fmtKm(s.km) + ' / ' + fmtKm(s.pkm) + ' km</td><td>' + s.runs + ' / ' + s.pruns + '</td><td>' + s.done + ' / ' + s.planned + '</td><td>' + s.hard + ' / ' + s.phard + '</td><td>' + fmtMin(s.min) + ' / ' + (s.pmin ? fmtMin(s.pmin) : '–') + '</td></tr>'; }).join('');
  const days = weekDates(n).map(d => { const p = P(d); return '<tr><td>' + esc(fmtDate(d)) + '</td><td>' + esc(p.day.heading) + '</td>' + peopleIds().map(pid => { const l = getLog(d, pid) || {}; return '<td>' + esc(STATE_LABEL[dayState(pid, d)]) + (kmOn(pid, d) ? ' · ' + fmtKm(kmOn(pid, d), 2) + ' km' : '') + (l.rpe ? ' · RPE ' + l.rpe : '') + (l.notes ? '<br><small>' + esc(l.notes) + '</small>' : '') + '</td>'; }).join('') + '</tr>'; }).join('');
  return '<!doctype html><html><head><meta charset="utf-8"><title>HYROX week ' + n + ' summary</title><style>body{font:14px/1.45 -apple-system,Segoe UI,Roboto,sans-serif;color:#14171A;margin:32px;max-width:900px}h1{font-size:28px;margin:0 0 4px}p{color:#5E656D;margin:0 0 18px}table{border-collapse:collapse;width:100%;margin:12px 0 24px}th,td{border-bottom:1px solid #D8DCD4;padding:6px 8px;text-align:left;vertical-align:top}th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#5E656D}small{color:#5E656D}@media print{body{margin:12mm}}</style></head><body>' +
    '<h1>' + weekName(n) + ' · ' + esc(w ? w.label : '') + '</h1><p>' + esc(w ? w.dates : '') + ' · 16 Weeks to HYROX · printed ' + esc(fmtDate(todayISO())) + '</p>' +
    '<h2>Planned vs actual</h2><table><thead><tr><th>Person</th><th>Running</th><th>Runs</th><th>Sessions</th><th>Hard sessions</th><th>Training time</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<h2>Day by day</h2><table><thead><tr><th>Day</th><th>Session</th>' + peopleIds().map(pid => '<th>' + esc(pname(pid)) + '</th>').join('') + '</tr></thead><tbody>' + days + '</tbody></table>' +
    (w ? '<h2>This week in the plan</h2><p>' + esc(w.lead) + '</p><p>' + esc(w.pace) + '</p>' : '') + '</body></html>';
}
async function compressImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const max = 1600; const sc = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(r, 'image/jpeg', 0.84));
  } finally { URL.revokeObjectURL(url); }
}

