/* ================= State & shared storage ================= */
const COLS = { plan_days: 'days', plan_weeks: 'weeks', plan_meta: 'metaDocs', profiles: 'profiles', logs: 'logs', bench: 'bench', weekly: 'weekly', niggles: 'niggles', together: 'together', body: 'body', myex: 'myex' };
/* The plan ships inside the app (plan-data.js). Firebase only stores edits to it, which override the built-in version. */
const PLAN_COLS = ['plan_days', 'plan_weeks', 'plan_meta'];
const DEFAULTS = window.PLAN_DEFAULTS || {};
function withDefaults(col, docs) { return PLAN_COLS.includes(col) ? Object.assign(clone(DEFAULTS[col] || {}), docs) : docs; }
function canon(o) { if (Array.isArray(o)) return '[' + o.map(canon).join(',') + ']'; if (o && typeof o === 'object') return '{' + Object.keys(o).filter(k => k !== '_u').sort().map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}'; return JSON.stringify(o); }
const S = {
  db: null, userNs: null, dl: null, assets: null,
  uid: null, viewerName: '', email: '', isOwner: false, canWrite: null, readOnly: false, noDb: false, denied: false, user: null,
  days: {}, weeks: {}, metaDocs: {}, profiles: {}, logs: {}, bench: {}, weekly: {}, niggles: {}, together: {}, body: {}, myex: {},
  order: [], meta: null,
  loaded: {},
  pid: null,
  route: { view: 'today', date: null, sub: 'week', arg: null },
  sync: 'saved'
};
const CACHE_KEY = 'hx.cache.v2', OUTBOX_KEY = 'hx.outbox.v2';
const pending = new Map();

function rebuildDerived() {
  S.order = Object.keys(S.days).sort();
  S.meta = S.metaDocs.program || null;
  PLANCACHE.clear();
}

/* ---- local cache so the page opens fast on bad gym Wi-Fi ---- */
function loadCache() {
  const c = LS.get(CACHE_KEY, null);
  for (const col of Object.keys(COLS)) { const k = COLS[col]; if (PLAN_COLS.includes(col)) S[k] = withDefaults(col, {}); else if (c && c[k]) S[k] = c[k]; } // plan edits arrive from Firebase
  if (c) S.fromCache = true;
  const ob = LS.get(OUTBOX_KEY, []);
  for (const it of ob) { pending.set(it.col + '/' + it.id, it); S[COLS[it.col]][it.id] = it.data; }
  rebuildDerived();
}
const saveCache = debounce(() => {
  if (LS.noCache) return; // turned off for this session after the phone ran out of room
  const c = {}; for (const k of Object.values(COLS)) c[k] = S[k];
  LS.set(CACHE_KEY, c);
}, 2500);
function saveOutbox() { LS.set(OUTBOX_KEY, Array.from(pending.values())); }

/* ---- writes: optimistic local update, queued, retried ---- */
function put(col, id, data) {
  if (S.readOnly) { toast(S.user ? "This Google account can't save to the tracker." : 'Sign in with Google to save.'); return false; }
  if (S.user && !canWriteDoc(col, id)) { toast(col === 'plan_days' ? PT_NO : PLAN_COLS.includes(col) ? 'Only the admin can change the plan.' : 'You can only change your own profile and logs.'); return false; }
  data = Object.assign({}, data, { _u: Date.now() });
  S[COLS[col]][id] = data;
  if (col === 'plan_days' || col === 'plan_meta' || col === 'plan_weeks') rebuildDerived();
  pending.set(col + '/' + id, { col, id, data });
  saveOutbox(); saveCache(); setSync('saving'); scheduleFlush();
  return true;
}
function del(col, id) {
  delete S[COLS[col]][id];
  pending.set(col + '/' + id, { col, id, data: null });
  saveOutbox(); saveCache(); setSync('saving'); scheduleFlush();
}
/* ---- Firebase (Firestore) adapter ----
   Each document is stored as { j: "<json>" } so any shape the tracker saves is accepted as-is. */
const FS = {
  enc: (data, col) => col === 'together' ? { j: JSON.stringify(data), allow: (data.allow || []).slice(0, 30), g: String(data.g || ''), in: data.st === 'in', group: (data.group || []).slice(0, 30) } : { j: JSON.stringify(data) },
  dec: raw => { if (raw && typeof raw.j === 'string') { try { return JSON.parse(raw.j); } catch (e) { return null; } } return raw || null; },
  code: e => {
    const c = (e && e.code) || '';
    if (c === 'permission-denied' || c === 'unauthenticated') return 'not_granted';
    if (c === 'unavailable' || c === 'deadline-exceeded') return 'unavailable';
    return c.replace(/-/g, '_');
  }
};
function withTimeout(p, ms) {
  return new Promise((res, rej) => { const t = setTimeout(() => rej({ code: 'unavailable' }), ms); Promise.resolve(p).then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); }); });
}
let flushTimer = null, flushing = false, backoff = 0;
function scheduleFlush(ms = 650) { clearTimeout(flushTimer); flushTimer = setTimeout(flush, ms); }
async function flush() {
  flushTimer = null;
  if (flushing || !S.db || S.denied || !pending.size) { if (!pending.size) setSync(S.readOnly ? 'ro' : S.db ? 'saved' : S.sync); return; }
  flushing = true; let transient = false;
  for (const [path, item] of Array.from(pending.entries())) {
    try {
      const ref = S.db.collection(item.col).doc(item.id);
      await withTimeout(item.data === null ? ref.delete() : ref.set(FS.enc(item.data, item.col)), 15000);
      if (pending.get(path) === item) pending.delete(path);
    } catch (e) {
      const code = FS.code(e);
      if (code === 'not_granted') {
        if (ownerOfDoc(item.col, item.id) === S.uid) { flushing = false; saveOutbox(); onDenied(); return; }
        if (item.col === 'logs' && !isAdmin()) { pending.delete(path); toast(pname(ownerOfDoc('logs', item.id)) + '’s log wasn’t updated: they’re no longer training with you today.'); continue; }
        pending.delete(path); toast('Firebase refused that change. Only admins listed in firestore.rules can change the plan or other people\'s logs.'); continue;
      }
      if (code === 'invalid_argument') { pending.delete(path); toast("That change couldn't be saved (" + code + ")."); continue; }
      transient = true; break;
    }
  }
  flushing = false; saveOutbox();
  if (transient) { backoff = Math.min(60000, backoff ? backoff * 2 : 2000); setSync('offline'); flushTimer = setTimeout(flush, backoff); }
  else { backoff = 0; if (pending.size) scheduleFlush(300); else setSync(S.readOnly ? 'ro' : 'saved'); }
}
window.addEventListener('online', () => scheduleFlush(100));

function setSync(s) {
  S.sync = s;
  const el = $('#sync'); if (!el) return;
  el.dataset.s = s;
  el.lastChild.textContent = s === 'saving' ? 'Saving…' : s === 'offline' ? 'Offline · ' + pending.size + ' to sync' : s === 'ro' ? 'View only' : s === 'local' ? 'Not connected' : s === 'out' ? 'Signed out' : 'Saved';
}

/* ---- subscriptions ---- */
const UNSUB = [];
function subscribe(col) {
  const key = COLS[col];
  const un = S.db.collection(col).onSnapshot(snap => {
    // Offline with nothing cached yet: keep what's on screen and wait for the server.
    if (snap.fromCache && !snap.docs.length) return;
    const next = {};
    if (snap.fromCache) for (const id of Object.keys(S[key] || {})) if (!PLAN_COLS.includes(col) || !(DEFAULTS[col] || {})[id]) next[id] = S[key][id];
    snap.docs.forEach(d => {
      const v = FS.dec(d.data); if (!v) return;
      if (col === 'logs' || col === 'weekly') { v.pid = d.id.split('_')[0]; if (col === 'logs') v.date = d.id.slice(v.pid.length + 1); }
      next[d.id] = v;
    });
    // keep our own unsent edits on screen
    for (const it of pending.values()) if (it.col === col) { if (it.data === null) delete next[it.id]; else next[it.id] = it.data; }
    S[key] = withDefaults(col, next);
    S.loaded[col] = true;
    if (PLAN_COLS.includes(col)) rebuildDerived();
    saveCache();
    onData(col);
  }, err => {
    const code = FS.code(err);
    if (code === 'not_granted') onDenied();
    else setTimeout(() => { if (S.db && S.user && !S.denied) subscribe(col); }, 5000);
  });
  UNSUB.push(un);
}
function unsubscribeAll() { while (UNSUB.length) { const u = UNSUB.pop(); try { u && u(); } catch (e) { } } }
function subscribeAll() { unsubscribeAll(); for (const col of Object.keys(COLS)) subscribe(col); }

/* ---- identity: Google sign-in through Firebase ---- */
function onDenied() {
  if (S.denied) return;
  S.denied = true; S.readOnly = true; unsubscribeAll(); setSync('ro');
  showGate('denied');
}
/* ---- one Google account = one profile (the profile id is the account's uid) ----
   Everyone can see everyone's data; people change only their own. Admins (config.js + firestore.rules) can change anything. */
const ADMINS = (window.TRACKER_ADMINS || []).map(e => String(e).trim().toLowerCase());
const isAdmin = () => !!(S.user && S.email && ADMINS.includes(String(S.email).toLowerCase()));
const isPerson = id => !!(S.profiles[id] && S.profiles[id].uid === id);
const ownProfile = () => !!(S.uid && S.profiles[S.uid] && !S.profiles[S.uid].removed);
const adminOnly = () => isAdmin() && !ownProfile(); // an admin account that doesn't train
function resolveMe() {
  if (!S.uid) return null;
  const pick = S.pid || (adminOnly() ? LS.get('hx.as', null) : null);
  if (isAdmin() && pick && pick !== S.uid && isPerson(pick) && !S.profiles[pick].removed) return pick; // admin looking at someone else
  if (pick && pick !== S.uid && isPerson(pick) && tgCanWrite(pick, todayISO())) return pick; // filling in a training partner's log
  if (ownProfile()) return S.uid;
  if (isAdmin()) return peopleIds()[0] || null; // admin-only account: look after someone's log
  return null;
}
function choosePerson(pid) { // admins only: open someone else's log
  if (pid !== S.uid && !isAdmin()) return;
  S.pid = pid; if (adminOnly()) LS.set('hx.as', pid); closeSheet(); render();
}
function ownerOfDoc(col, id) { if (PLAN_COLS.includes(col)) return null; if (col === 'logs' || col === 'weekly' || col === 'together') return String(id).split('_')[0]; return id; }
function canWriteDoc(col, id) {
  if (isAdmin() || (!!S.uid && ownerOfDoc(col, id) === S.uid)) return true;
  if (col === 'plan_days') return ownProfile(); // v32: a member changes the shared plan's days (not the weeks or the programme)
  if (col === 'logs') { const o = ownerOfDoc(col, id); return tgCanWrite(o, String(id).slice(o.length + 1)); } // training together today
  return false;
}
function ensureMe() {
  if (!S.user) return;
  if (adminOnly() && S.loaded.profiles && peopleIds().length) { // never asked to set up a profile of its own
    if (SHEET && SHEET.kind === 'setup') closeSheet();
    const was = S.pid; S.pid = resolveMe(); if (S.pid !== was) renderSoon();
    return;
  }
  const mine = S.profiles[S.uid];
  if (mine && !mine.removed) {
    S.pid = resolveMe();
    if (!raceComplete(mine.race)) { if (!SHEET || SHEET.kind !== 'setup') openSheet('setup'); return; }
    if (SHEET && SHEET.kind === 'setup') closeSheet();
    return;
  }
  const L = S.loaded;
  if (!(L.profiles && L.logs && L.bench && L.weekly && L.niggles)) return; // wait until everything has arrived
  if (!S.migrated) {
    const legacy = Object.keys(S.profiles).find(id => id !== S.uid && S.profiles[id] && S.profiles[id].uid === S.uid && !S.profiles[id].removed);
    if (legacy) { migrateProfile(legacy); return; }
  }
  S.pid = null;
  if (!SHEET || SHEET.kind !== 'setup') openSheet('setup');
}
function migrateProfile(legacyId) { // a profile made before one-account-one-profile: move it (and its logs) under the account
  S.migrated = true;
  const L = clone(S.profiles[legacyId]);
  put('profiles', S.uid, Object.assign({}, L, { uid: S.uid }));
  ['logs', 'weekly'].forEach(col => Object.keys(S[COLS[col]]).filter(k => k.startsWith(legacyId + '_')).forEach(k => put(col, S.uid + k.slice(legacyId.length), Object.assign(clone(S[COLS[col]][k]), { pid: S.uid }))));
  if (S.bench[legacyId]) put('bench', S.uid, clone(S.bench[legacyId]));
  if (S.niggles[legacyId]) put('niggles', S.uid, clone(S.niggles[legacyId]));
  if (isAdmin()) put('profiles', legacyId, Object.assign({}, L, { removed: true, movedTo: S.uid }));
  S.pid = S.uid; if (SHEET && SHEET.kind === 'setup') closeSheet(); render();
}
const me = () => S.profiles[S.pid] || null;
const pname = pid => (S.profiles[pid] && S.profiles[pid].name) || 'Someone';
const PCOLORS = ['blue', 'orange', 'aqua', 'magenta', 'violet', 'yellow'];
const pcolor = pid => 'var(--p-' + ((S.profiles[pid] && S.profiles[pid].color) || 'blue') + ')';
const peopleIds = () => Object.keys(S.profiles).filter(id => isPerson(id) && !S.profiles[id].removed).sort((a, b) => ((S.profiles[a].created || '') + a).localeCompare((S.profiles[b].created || '') + b));

/* ---- log helpers ---- */
const logKey = (pid, date) => pid + '_' + date;
const getLog = (date, pid = S.pid) => S.logs[logKey(pid, date)] || null;
function editLog(date, fn, opts = {}) {
  if (!S.pid) { openWho(); return; }
  const id = logKey(S.pid, date);
  const cur = clone(S.logs[id]) || { pid: S.pid, date }, prev = S.logs[id] ? clone(S.logs[id]) : null;
  fn(cur);
  if (put('logs', id, cur)) tgMirror(S.pid, date, S.logs[id] || cur, prev);
  if (opts.render !== false) renderSoon(); else refreshScore();
}
function editProfile(fn, pid = S.pid) {
  const cur = clone(S.profiles[pid]) || {};
  fn(cur); put('profiles', pid, cur);
}
function editBench(fn, pid = S.pid) {
  const cur = clone(S.bench[pid]) || { results: {} };
  if (!cur.results) cur.results = {};
  fn(cur); put('bench', pid, cur);
}

