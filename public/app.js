
"use strict";
/* ================= Utilities ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
const TZ = 'Asia/Kolkata';
const DOWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function todayISO() {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch (e) {
    return new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  }
}
function nowISTMinutes() {
  try {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).split(':');
    return (+p[0] % 24) * 60 + (+p[1]);
  } catch (e) { const d = new Date(Date.now() + 5.5 * 3600e3); return d.getUTCHours() * 60 + d.getUTCMinutes(); }
}
const D = s => new Date(s + 'T00:00:00Z');
const addDays = (s, n) => new Date(D(s).getTime() + n * 864e5).toISOString().slice(0, 10);
const diffDays = (a, b) => Math.round((D(b) - D(a)) / 864e5);
const dowOf = s => D(s).getUTCDay();
function fmtDate(s, withDow = true) {
  const d = D(s);
  return (withDow ? DOWS[d.getUTCDay()] + ' ' : '') + d.getUTCDate() + ' ' + MON[d.getUTCMonth()];
}
function fmtDateLong(s) {
  const d = D(s);
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MONTH_FULL[d.getUTCMonth()];
}
function mondayOf(s) { const w = dowOf(s); return addDays(s, -((w + 6) % 7)); }

/* times: "5:35" = mm:ss, "1:29:25" = h:mm:ss, "45" = minutes, "4.5" = minutes */
function parseTime(v) {
  if (v == null) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = String(v).trim().replace(/[^\d:.]/g, '');
  if (!s) return null;
  if (s.includes(':')) {
    const p = s.split(':').map(Number);
    if (p.some(x => isNaN(x))) return null;
    let t = 0; for (const x of p) t = t * 60 + x;
    return Math.round(t);
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : Math.round(n * 60);
}
function fmtTime(sec, forceH) {
  if (sec == null || !isFinite(sec)) return '–';
  const neg = sec < 0; sec = Math.round(Math.abs(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const str = (h || forceH) ? h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') : m + ':' + String(s).padStart(2, '0');
  return (neg ? '−' : '') + str;
}
function fmtDelta(sec) {
  if (sec == null || !isFinite(sec)) return '';
  if (Math.abs(sec) < 1) return '±0:00';
  return (sec > 0 ? '+' : '−') + fmtTime(Math.abs(sec));
}
const fmtPace = spk => spk ? fmtTime(spk) : '–';
function fmtKm(x, d = 1) { return (x == null || !isFinite(x)) ? '–' : (+x).toFixed(d); }
function fmtMin(min) { if (!min) return '0 min'; const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? h + ' h ' + String(m).padStart(2, '0') : m + ' min'; }
const num = v => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
const sum = a => a.reduce((x, y) => x + (y || 0), 0);
const uidGen = (p = '') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

const LS = {
  mem: new Map(), noCache: false, failed: false,
  get(k, d) {
    let v = LS.mem.has(k) ? LS.mem.get(k) : undefined;
    if (v === undefined) { try { v = localStorage.getItem(k); } catch (e) { v = null; } }
    if (v == null) return d; try { return JSON.parse(v); } catch (e) { return d; }
  },
  set(k, v) {
    const s = JSON.stringify(v);
    if (k !== 'hx.cache.v2') LS.mem.set(k, s); // this session always sees what was set, even if the phone won't save it
    try { localStorage.setItem(k, s); return true; } catch (e) { }
    // storage full or blocked: the offline copy is only a speed-up, so drop it (and older copies) to make room, then try once more
    LS.failed = true; LS.noCache = true;
    ['hx.cache.v2', 'hx.cache.v1', 'hx.cache'].forEach(x => { try { localStorage.removeItem(x); } catch (e) { } });
    if (k === 'hx.cache.v2') return false;
    try { localStorage.setItem(k, s); return true; } catch (e) { return false; }
  },
  del(k) { LS.mem.set(k, null); try { localStorage.removeItem(k); } catch (e) { } }
};

/* ---------- icons ---------- */
const I = {
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>',
  drop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3.2c3.1 3.7 6.2 7.3 6.2 10.9a6.2 6.2 0 0 1-12.4 0c0-3.6 3.1-7.2 6.2-10.9z"/></svg>',
  food: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11M17 21V3c-2.2 1.2-3.5 3.8-3.5 7v3.5H17"/></svg>',
  barbell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 12h18M6.5 7.5v9M17.5 7.5v9M3.5 9.5v5M20.5 9.5v5"/></svg>',
  stopwatch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5l3.2-3.2M9.5 2.5h5M12 2.5v3.5M18.6 6.6l1.4-1.4"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
  photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 16l-5-5-8.5 8"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5M4 19h16"/><path d="M8 15l4-5 3 3 5-6"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8.5" r="3.2"/><circle cx="16.5" cy="9.5" r="2.6"/><path d="M3.5 19c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5M14.5 14.4c.6-.3 1.3-.4 2-.4 2.2 0 3.9 1.5 4.3 4"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.5M9.5 2.5h5"/></svg>',
  ball: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.3 3.6 5.1 3.6 8.5s-1.1 6.2-3.6 8.5M12 3.5C9.5 5.8 8.4 8.6 8.4 12s1.1 6.2 3.6 8.5"/></svg>',
  plates: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12h20"/><rect x="5" y="6" width="3" height="12" rx="1"/><rect x="16" y="6" width="3" height="12" rx="1"/><rect x="8.5" y="8" width="2" height="8" rx=".8"/><rect x="13.5" y="8" width="2" height="8" rx=".8"/></svg>',
  pace: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  medal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="15" r="5"/><path d="M8.5 11L6 3h4l2 5 2-5h4l-2.5 8"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="8" width="17" height="12" rx="2.5"/><path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2"/></svg>',
  body: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4.5" r="2"/><path d="M5 9l7 1 7-1M12 10v5l-3 6M12 15l3 6"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>',
  skip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12"/><circle cx="12" cy="12" r="9"/></svg>',
  mod: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/><circle cx="12" cy="12" r="9"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>'
};

/* ---------- toasts & tooltips ---------- */
function toast(msg, cls = '') {
  const box = $('#toasts'); if (!box) return;
  const t = document.createElement('div'); t.className = 'toast ' + cls; t.textContent = msg;
  box.appendChild(t); setTimeout(() => t.remove(), cls === 'pr' ? 4200 : 3000);
}
(function tooltips() {
  let tip = null;
  function show(el, x, y) {
    if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; document.body.appendChild(tip); }
    tip.textContent = el.getAttribute('data-tip'); tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x - r.width / 2));
    let top = y - r.height - 14; if (top < 8) top = y + 18;
    tip.style.left = left + 'px'; tip.style.top = top + 'px';
  }
  function hide() { if (tip) tip.hidden = true; }
  document.addEventListener('pointermove', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el) show(el, e.clientX, e.clientY); else hide(); }, { passive: true });
  document.addEventListener('pointerdown', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el) show(el, e.clientX, e.clientY); else hide(); }, { passive: true });
  document.addEventListener('scroll', hide, { passive: true });
})();

/* ---------- sound ---------- */
let AC = null;
function audioInit() { try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { } }
function beep(n = 1, freq = 880, dur = 0.14) {
  if (LS.get('hx.sound', true) === false) return;
  try {
    audioInit(); if (!AC) return;
    for (let i = 0; i < n; i++) {
      const o = AC.createOscillator(), g = AC.createGain(); const t0 = AC.currentTime + i * (dur + 0.09);
      o.type = 'sine'; o.frequency.value = freq; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(AC.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    }
  } catch (e) { }
  try { navigator.vibrate && navigator.vibrate(n > 1 ? [180, 90, 180] : 120); } catch (e) { }
}
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { wakeLock = null; }
}

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

/* ================= Plan parsing ================= */
const PLANCACHE = new Map();
const ST_KEYS = ['ski', 'push', 'pull', 'bbj', 'row', 'farm', 'lunge', 'wb'];
const ST_FALLBACK = { ski: 'SkiErg', push: 'Sled push', pull: 'Sled pull', bbj: 'Burpee broad jumps', row: 'Rowing', farm: 'Farmers carry', lunge: 'Sandbag lunges', wb: 'Wall balls', other: 'Other' };
const ST_RACE_AMT = { ski: 1000, push: 50, pull: 50, bbj: 80, row: 1000, farm: 200, lunge: 100, wb: 100 };
function stInfo(k) { const m = S.meta && S.meta.stations && S.meta.stations.find(s => s.key === k); return m || { key: k, name: ST_FALLBACK[k] || k, amount: ST_RACE_AMT[k], unit: k === 'wb' ? 'reps' : 'm' }; }
const stName = k => stInfo(k).name;
const RUN_TYPES = [['easy', 'Easy'], ['long', 'Long'], ['tempo', 'Tempo'], ['intervals', 'Intervals'], ['rp', 'Race pace'], ['tt', 'Time trial'], ['other', 'Other']];
const runTypeName = k => (RUN_TYPES.find(x => x[0] === k) || [k, k])[1];

const isNone = t => !t || /^none\b/i.test(String(t).trim());
function field(day, label) { return day && day.fields ? day.fields.find(f => f.label === label) : null; }
function fieldText(day, label) { const f = field(day, label); if (!f) return ''; return f.text || (f.items || []).join('; '); }

function stationKey(s) {
  s = String(s).toLowerCase();
  if (/ski ?erg/.test(s)) return 'ski';
  if (/sled push/.test(s)) return 'push';
  if (/sled pull/.test(s)) return 'pull';
  if (/burpee/.test(s)) return 'bbj';
  if (/farmers/.test(s)) return 'farm';
  if (/lunge/.test(s)) return 'lunge';
  if (/wall ?balls?/.test(s)) return 'wb';
  if (/^row\b|\brow (benchmark|—)/.test(s)) return 'row';
  if (/bear crawl/.test(s)) return 'other';
  return null;
}

/* ---- strength ---- */
function parseStrength(raw) {
  const parts = raw.split(/\s+—\s+/);
  const o = { raw, name: parts[0].trim(), sets: 1, reps: null, unit: 'reps', per: '', load: null, dual: false, added: false, bw: false, loadText: '', rpeLo: null, rpeHi: null, rpeText: '', restSec: null, restText: '', note: '' };
  let iSR = -1;
  for (let i = 1; i < parts.length; i++) {
    const m = parts[i].match(/^(\d+)\s*×\s*(\d+(?:[.,]\d+)?)(?:\s*[–-]\s*\d+)?\s*(s|m|min)?\b\s*(\/side|\/leg)?/);
    if (m) {
      o.sets = +m[1]; o.reps = parseFloat(m[2].replace(',', '.'));
      o.unit = m[3] === 's' ? 's' : m[3] === 'm' ? 'm' : m[3] === 'min' ? 'min' : 'reps';
      o.per = m[4] || '';
      const rest = parts[i].slice(m[0].length).trim(); if (rest) o.note = rest.replace(/^[(]|[)]$/g, '');
      iSR = i; break;
    }
  }
  let end = parts.length;
  if (iSR !== -1 && iSR < parts.length - 1) {
    const last = parts[parts.length - 1];
    const r = last.match(/^(\d+(?:\.\d+)?)(?:\s*[–-]\s*(\d+(?:\.\d+)?))?\s*(s|min)\b/);
    const r2 = last.match(/^(\d+):(\d\d)\b/);
    if (r) { o.restSec = r[3] === 'min' ? Math.round(parseFloat(r[1]) * 60) : Math.round(parseFloat(r[1])); o.restText = last; end = parts.length - 1; }
    else if (r2) { o.restSec = (+r2[1]) * 60 + (+r2[2]); o.restText = last; end = parts.length - 1; }
  }
  const mid = iSR === -1 ? parts.slice(1).join(' — ') : parts.slice(iSR + 1, end).join(' — ');
  o.loadText = mid;
  if (/^(bodyweight|bw)\b/i.test(mid)) o.bw = true;
  const lm = mid.match(/(\d+)\s*×\s*(\d+(?:\.\d+)?)(?:\s*[–-]\s*\d+(?:\.\d+)?)?\s*kg/);
  if (lm && +lm[1] === 2) { o.load = +lm[2]; o.dual = true; }
  else {
    const l2 = mid.match(/(\+)?(\d+(?:\.\d+)?)(?:\s*[–-]\s*\d+(?:\.\d+)?)?\s*kg/);
    if (l2) { o.load = +l2[2]; o.added = !!l2[1]; }
  }
  if (o.bw && o.load == null) o.load = 0;
  const rp = mid.match(/RPE\s*(\d+(?:\.\d+)?)(?:\s*[–-]\s*(\d+(?:\.\d+)?))?/);
  const rir = mid.match(/RIR\s*(\d+)(?:\s*[–-]\s*(\d+))?/);
  if (rp) { o.rpeLo = +rp[1]; o.rpeHi = rp[2] ? +rp[2] : +rp[1]; o.rpeText = 'RPE ' + rp[1] + (rp[2] ? '–' + rp[2] : ''); }
  else if (rir) { const a = 10 - (+rir[1]), b = rir[2] ? 10 - (+rir[2]) : a; o.rpeLo = Math.min(a, b); o.rpeHi = Math.max(a, b); o.rpeText = 'RIR ' + rir[1] + (rir[2] ? '–' + rir[2] : ''); }
  if (o.restSec == null) o.restSec = /squat|deadlift|bench|press|pull-up|row/i.test(o.name) ? 120 : 60;
  return o;
}
const LIFTS = [
  { key: 'deadlift', name: 'Deadlift', re: /^(barbell )?deadlift/i },
  { key: 'squat', name: 'Back squat', re: /back squat/i },
  { key: 'bench', name: 'Bench press', re: /^barbell bench press/i },
  { key: 'ohp', name: 'Overhead press (barbell)', re: /barbell overhead press|push press|strict barbell press|military press/i },
  { key: 'pullup', name: 'Pull-up (added kg)', re: /pull-up/i },
  { key: 'legpress', name: 'Leg press', re: /leg press/i }
];
const liftKey = name => { const l = LIFTS.find(x => x.re.test(name)); return l ? l.key : null; };
function progressionFor(name, ex) {
  const rules = (S.meta && S.meta.progression) || [];
  const n = name.toLowerCase();
  for (const r of rules) { try { if (new RegExp(r.match, 'i').test(n)) return r; } catch (e) { } }
  return { lift: name, inc: ex && ex.dual ? 2 : 2.5, rule: ex && ex.dual ? 'Add 2 kg per hand when every set lands at target RPE' : '+2.5 kg when every set lands at target RPE' };
}

/* ---- simple lists ---- */
function parseList(text) {
  if (isNone(text)) return [];
  return String(text).replace(/\.\s*$/, '').split(/;\s*/).map(s => s.trim()).filter(Boolean);
}
function parseWarmup(text) {
  if (isNone(text)) return [];
  const W = (S.meta && S.meta.warmups) || {};
  const out = [];
  String(text).replace(/\.\s*$/, '').split(/\s+\+\s+/).forEach(p => {
    const code = /WU-S/.test(p) ? 'WU-S' : /WU-R/.test(p) ? 'WU-R' : /station primer/i.test(p) ? 'PRIMER' : /CD-1/.test(p) ? 'CD-1' : null;
    if (code && W[code]) {
      const w = W[code];
      let extra = p.replace(/WU-S|WU-R|CD-1|station primer/ig, '').replace(/^[\s,.]+|[\s,.]+$/g, '').replace(/^with\s+/i, '').trim();
      if (/^\(\d+\s*min\)$/.test(extra)) extra = '';
      if (/^\d+\s*min$/.test(extra) || /^drills$/i.test(extra)) extra = '';
      out.push({ h: code === 'PRIMER' ? w.name : code + ' · ' + w.name, min: w.min, note: extra });
      w.steps.forEach(t => out.push({ t }));
    } else out.push({ t: p.trim() });
  });
  return out;
}

/* ---- running ---- */
function parseRunning(day) {
  const t = fieldText(day, 'RUNNING');
  const o = { text: t, none: isNone(t), pace: null, rpe: '', reps: null, restSec: null, zone: null, type: 'easy', planKm: day ? day.km : 0 };
  if (o.none) return o;
  const pm = t.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})\s*\/\s*km/);
  if (pm) o.pace = { lo: parseTime(pm[1]), hi: parseTime(pm[2]) };
  const rm = t.match(/RPE\s*(\d+(?:\s*[–-]\s*\d+)?)/); if (rm) o.rpe = rm[1].replace(/\s/g, '');
  const reps = t.match(/(\d+)\s*×\s*(\d+(?:\.\d+)?)\s*(m|km)\b/);
  if (reps) o.reps = { n: +reps[1], dist: reps[3] === 'km' ? +reps[2] : +reps[2] / 1000 };
  const trep = t.match(/(\d+)\s*×\s*(\d+)\s*min\b/); if (!o.reps && trep) o.reps = { n: +trep[1], dur: +trep[2] * 60 };
  const rest = t.match(/(\d+)\s*s\s*(?:walk|jog|easy|rest)/i) || t.match(/(\d+)\s*min\s*(?:easy jog|walk|jog)\s*between/i);
  if (rest) o.restSec = /min/.test(rest[0]) ? +rest[1] * 60 : +rest[1];
  if (/time trial/i.test(t)) { o.type = 'tt'; o.zone = null; }
  else if (/\bRP\b|race pace|plan's split/i.test(t)) { o.type = o.reps ? 'rp' : 'rp'; o.zone = 'rp'; }
  else if (/400 m pace/i.test(t)) { o.type = 'intervals'; o.zone = 'p400'; }
  else if (/800 m pace/i.test(t)) { o.type = 'intervals'; o.zone = 'p800'; }
  else if (/threshold/i.test(t)) { o.type = 'intervals'; o.zone = 'threshold'; }
  else if (/tempo/i.test(t)) { o.type = 'tempo'; o.zone = 'tempo'; }
  else if (day && day.kind === 'long' && day.week !== 0) { o.type = 'long'; o.zone = 'easy'; }
  else { o.type = 'easy'; o.zone = 'easy'; }
  if (o.reps && o.type !== 'rp' && o.type !== 'tt') o.type = 'intervals';
  if (day && day.kind === 'long' && day.week !== 0 && o.type !== 'tt') o.type = 'long';
  return o;
}

/* ---- HYROX work ---- */
function parseStationItem(s) {
  s = s.trim().replace(/\.$/, '');
  const st = stationKey(s) || 'other';
  const parts = s.split(/\s+—\s+/);
  const r = { kind: 'station', st, raw: s, title: st === 'other' ? parts[0] : stName(st), sub: '', amount: null, unit: (st === 'wb' || (st === 'bbj' && /reps/i.test(s))) ? 'reps' : 'm', sets: null, each: null, load: null, dual: false, restSec: null, test: /benchmark|for time|max effort|^test/i.test(s) };
  let m;
  const wbN = st === 'wb' ? (s.match(/(\d+)\s+wall balls/i) || s.match(/wall balls\s+(\d+)\b(?!\s*×)/i) || s.match(/(\d+)\s*reps\b/i)) : null;
  if (wbN && !/\d+\s*×\s*\d+/.test(s)) { r.amount = +wbN[1]; r.unit = 'reps'; }
  else if ((m = s.match(/(\d+)\s*min\s*×\s*(\d+)\s*reps/i))) { r.amount = (+m[1]) * (+m[2]); r.unit = 'reps'; r.sets = +m[1]; r.each = +m[2]; }
  else if ((m = s.match(/(\d+)\s*×\s*([\d,]+(?:\.\d+)?)\s*(m\b|reps?\b)?(?![\d.]*\s*kg)/i))) {
    r.sets = +m[1]; r.each = parseFloat(m[2].replace(/,/g, ''));
    if (m[3]) r.unit = /rep/i.test(m[3]) ? 'reps' : 'm';
    r.amount = r.sets * r.each;
  }
  else if (st !== 'wb' && (m = s.match(/([\d,]+(?:\.\d+)?)\s*(m|reps?)\b/i))) { r.amount = parseFloat(m[1].replace(/,/g, '')); r.unit = /rep/i.test(m[2]) ? 'reps' : 'm'; }
  else if (st === 'wb' && (m = s.match(/wall balls\s+(\d+)/i))) { r.amount = +m[1]; r.unit = 'reps'; }
  const lm = s.match(/(\d+)\s*×\s*(\d+(?:\.\d+)?)\s*kg/);
  if (lm && +lm[1] === 2) { r.load = +lm[2]; r.dual = true; }
  else { const l2 = s.match(/(\d+(?:\.\d+)?)(?:\s*[–-]\s*\d+(?:\.\d+)?)?\s*kg/); if (l2) r.load = +l2[1]; }
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    const rr = last.match(/^(\d+(?:\.\d+)?)\s*(s|min)\b/) || last.match(/^(\d+):(\d\d)$/);
    if (rr) r.restSec = rr[2] === 'min' ? +rr[1] * 60 : rr[2] === 's' ? +rr[1] : (+rr[1]) * 60 + (+rr[2]);
    r.sub = parts.slice(1).join(' · ');
  } else {
    r.sub = st === 'other' ? '' : s.replace(/^(ski ?erg|sled push|sled pull|burpee broad jumps|farmers carry|sandbag lunges|wall balls|row(ing)?)\s*/i, '');
  }
  if (st === 'other' && parts.length === 1) r.title = s;
  return r;
}
function parseSeg(seg) {
  seg = seg.replace(/\s*\d+\s*s rest$/i, '').trim();
  if (!seg || /^\d+\s*s rest$/i.test(seg)) return null;
  let m = seg.match(/^Run (\d)\b/i);
  if (m) return { kind: 'run', label: 'Run ' + m[1], dist: 1, runNo: +m[1], tag: 'race', raw: seg };
  m = seg.match(/^([\d.]+)\s*(km|m)\b\s*(RP|tempo|easy|run)?/i);
  if (m && !stationKey(seg)) {
    const dist = m[2].toLowerCase() === 'km' ? +m[1] : +m[1] / 1000;
    const tag = (m[3] || '').toLowerCase();
    return { kind: 'run', label: seg.replace(/\s+to finish$/i, ' (finish)'), dist, tag: tag === 'rp' ? 'rp' : tag, raw: seg };
  }
  return parseStationItem(seg);
}
function parseHyrox(day) {
  const f = field(day, 'HYROX WORK');
  const out = { rows: [], qual: f ? f.qual : '', none: true, chain: false };
  if (!f) return out;
  const items = (f.items && f.items.length) ? f.items.slice() : (!isNone(f.text) ? [f.text] : []);
  items.forEach((raw, ii) => {
    let s = raw.trim().replace(/\.$/, '');
    let grp = '';
    let m = s.match(/^(Round \d+|Test \d+|Test|Then|Back-half block, continuous|Part 2 rounds as above)\s*[:—-]\s*/i);
    if (m) { grp = m[1]; s = s.slice(m[0].length); }
    m = s.match(/^(\d+ min rest), then:\s*/i);
    if (m) { out.rows.push({ kind: 'note', text: m[1], src: ii }); s = s.slice(m[0].length); }
    if (/^\d+ min rest$/i.test(s)) { out.rows.push({ kind: 'note', text: s, src: ii }); return; }
    s = s.replace(/\.?\s*Station targets and tactics:.*$/i, '');
    if (s.includes('→')) {
      out.chain = true;
      s.split('→').map(x => x.trim()).filter(Boolean).forEach(seg => { const r = parseSeg(seg); if (r) out.rows.push(Object.assign(r, { grp, chain: true, src: ii })); });
    } else if (/;\s/.test(s) && s.split(/;\s/).every(p => stationKey(p))) {
      s.split(/;\s/).forEach(p => out.rows.push(Object.assign(parseStationItem(p), { grp, src: ii })));
    } else if (/\band\b/.test(s) && s.split(/\band\b/).length === 2 && s.split(/\band\b/).every(p => stationKey(p))) {
      s.split(/\band\b/).forEach(p => out.rows.push(Object.assign(parseStationItem(p.replace(/^.*?—\s*/, '')), { grp, src: ii })));
    } else if (!stationKey(s) && /^([\d.]+\s*km\b|Run \d)/i.test(s)) { const r = parseSeg(s); if (r) out.rows.push(Object.assign(r, { grp, chain: true, src: ii })); out.chain = true; }
    else out.rows.push(Object.assign(parseStationItem(s), { grp, src: ii }));
  });
  out.rows.forEach((r, i) => r.i = i);
  out.none = !out.rows.some(r => r.kind !== 'note');
  return out;
}

/* ---- full day ---- */
function P(date) {
  if (PLANCACHE.has(date)) return PLANCACHE.get(date);
  const day = S.days[date]; if (!day) return null;
  const idx = S.order.indexOf(date);
  const week = S.weeks['w' + String(day.week).padStart(2, '0')] || null;
  const strengthF = field(day, 'MAIN STRENGTH');
  const p = {
    date, day, idx, n: idx + 1 - preDays(), week, kind: day.kind, rest: day.kind === 'rest',
    session: fieldText(day, 'SESSION') || day.session || day.heading,
    objective: fieldText(day, 'OBJECTIVE'),
    rpe: fieldText(day, 'TARGET RPE'),
    time: fieldText(day, 'TOTAL SESSION TIME'),
    notes: fieldText(day, 'KEY COACHING NOTES'),
    restText: fieldText(day, 'REST / RECOVERY'),
    strength: strengthF && strengthF.items && strengthF.items.length ? strengthF.items.map(parseStrength) : [],
    run: parseRunning(day),
    hyrox: parseHyrox(day),
    acc: parseList(fieldText(day, 'ACCESSORY/CORE')),
    wu: parseWarmup(fieldText(day, 'WARM-UP')),
    cd: parseWarmup(fieldText(day, 'COOLDOWN')),
    wuText: fieldText(day, 'WARM-UP'), cdText: fieldText(day, 'COOLDOWN')
  };
  const sts = new Set();
  p.hyrox.rows.forEach(r => { if (r.kind === 'station' && r.st !== 'other') sts.add(r.st); });
  p.stations = ST_KEYS.filter(k => sts.has(k));
  p.tests = ((S.meta && S.meta.benchmarks) || []).filter(b => b.date === date);
  p.planMin = (() => { const m = p.time.match(/(\d+)\s*h(?:\s*(\d+))?/); if (m) return (+m[1]) * 60 + (+(m[2] || 0)); const m2 = p.time.match(/(\d+)\s*min/); return m2 ? +m2[1] : null; })();
  p.rpeHi = (() => { const m = p.rpe.match(/(\d+)(?:\s*[–-]\s*(\d+))?/); return m ? +(m[2] || m[1]) : null; })();
  PLANCACHE.set(date, p);
  return p;
}
const weekOf = date => { const d = S.days[date]; return d ? d.week : null; };
const weekDoc = n => S.weeks['w' + String(n).padStart(2, '0')] || (n === 0 ? kickoffWeek() : null);
function kickoffWeek() { // a stand-in "week" for the days before Week 1
  const ds = S.order.filter(d => S.days[d].week === 0); if (!ds.length) return null;
  const km = ds.reduce((a, d) => a + (S.days[d].km || 0), 0);
  return { n: 0, label: 'Kick-off weekend', phase: 'kickoff', phaseName: 'Kick-off', dates: fmtDate(ds[0], false) + ' – ' + fmtDate(ds[ds.length - 1], false) + ' ' + ds[ds.length - 1].slice(0, 4), km, summary: [], lead: 'The days before Week 1: an easy run to get going, then rest.' };
}
const weekName = n => n === 0 ? 'Kick-off weekend' : 'Week ' + n;
const minWeek = () => (S.order.some(d => S.days[d].week === 0) ? 0 : 1);
const pickWeek = () => Math.min(weekCount(), Math.max(minWeek(), S.route.wk != null ? S.route.wk : currentWeekN()));
const weekDates = n => S.order.filter(d => S.days[d].week === n);
const weekCount = () => Object.keys(S.weeks).length || 16;
function weekSummaryVal(w, key) { if (!w || !w.summary) return ''; const r = w.summary.find(x => x.k === key); return r ? r.v : ''; }

/* ================= Derived stats ================= */
const START = () => (S.meta && S.meta.start) || S.order[0] || '2026-09-28';
const preDays = () => S.order.filter(d => d < START()).length; // optional pre-week days before Day 1
const planLen = () => S.order.length - preDays();
const RACE = () => (S.meta && S.meta.race) || S.order[S.order.length - 1] || '2027-01-15';
const planOf = pid => ((S.profiles[pid] || {}).plan) || 'A';
const planSplits = pid => (S.meta && S.meta.plans && S.meta.plans[planOf(pid)]) || null;
const rpPace = pid => parseTime(((S.meta && S.meta.rp) || {})[planOf(pid)] || '5:52');

function logsOf(pid) { return Object.values(S.logs).filter(l => l && l.pid === pid && S.days[l.date]).sort((a, b) => a.date.localeCompare(b.date)); }
function hasActivity(l) {
  if (!l) return false;
  if (l.status) return true;
  if (l.str && Object.values(l.str).some(e => e && e.s && e.s.some(x => x && x.d))) return true;
  if (l.runs && l.runs.some(r => r.dist || r.time)) return true;
  if (l.hx && Object.values(l.hx).some(e => e && (e.d || e.time))) return true;
  if (l.wb && l.wb.length) return true;
  return false;
}
function dayState(pid, date) {
  const d = S.days[date]; if (!d) return 'none';
  const l = getLog(date, pid), t = todayISO();
  if (d.kind === 'rest') { if (l && l.rest && (l.rest.walk || l.rest.mob || (l.rest.acts || []).some(a => a !== 'rest'))) return 'restdone'; return date > t ? 'future' : 'rest'; }
  if (l && l.status) return l.status;
  if (date > t) return 'future';
  if (date === t) return hasActivity(l) ? 'partial' : 'today';
  return hasActivity(l) ? 'partial' : 'missed';
}
const doneStates = new Set(['complete', 'modified', 'partial']);
const STATE_LABEL = { complete: 'Completed', modified: 'Modified', skipped: 'Skipped', partial: 'Logged, not marked', missed: 'Not logged', rest: 'Rest day', restdone: 'Rest day · walk/mobility done', future: 'Upcoming', today: 'Not logged yet', none: '' };

function runsOf(pid) {
  const out = [];
  logsOf(pid).forEach(l => (l.runs || []).forEach((r, i) => { if (r && r.dist && r.time) out.push(Object.assign({ date: l.date, i, pace: r.time / r.dist }, r)); }));
  return out;
}
function kmOn(pid, date) { const l = getLog(date, pid); return l ? sum((l.runs || []).map(r => r.dist || 0)) : 0; }
function parseHM(txt) { if (!txt) return null; const m = String(txt).match(/(\d+)\s*h\s*(\d+)?/); if (m) return (+m[1]) * 60 + (+(m[2] || 0)); const m2 = String(txt).match(/(\d+)\s*min/); return m2 ? +m2[1] : null; }

function weekStats(pid, n) {
  const dates = weekDates(n), w = weekDoc(n);
  const o = { n, dates, km: 0, runs: 0, done: 0, planned: 0, hard: 0, min: 0, skipped: 0, modified: 0, logged: 0,
    pkm: w ? w.km : 0, pruns: parseInt(weekSummaryVal(w, 'Number of runs')) || 0, phard: parseInt(weekSummaryVal(w, 'Hard sessions')) || 0, pmin: parseHM(weekSummaryVal(w, 'Approximate training time')) };
  const t = todayISO();
  dates.forEach(d => {
    const day = S.days[d]; const l = getLog(d, pid); const st = dayState(pid, d);
    if (day.kind !== 'rest') o.planned++;
    if (doneStates.has(st)) o.done++;
    if (st === 'skipped') o.skipped++;
    if (st === 'modified') o.modified++;
    if (l) {
      (l.runs || []).forEach(r => { if (r.dist) { o.km += r.dist; o.runs++; } });
      if ((l.rpe || 0) >= 7 && doneStates.has(st)) o.hard++;
      if (l.time) o.min += l.time;
    }
  });
  o.plannedToDate = dates.filter(d => d <= t && S.days[d].kind !== 'rest').length;
  o.pkmToDate = sum(dates.filter(d => d <= t).map(d => S.days[d].km || 0));
  return o;
}

function streaks(pid) {
  const t = todayISO(); let cur = 0, best = 0, run = 0;
  const ok = st => doneStates.has(st) || st === 'rest' || st === 'restdone';
  for (const d of S.order) {
    if (d > t) break;
    const st = dayState(pid, d);
    if (ok(st)) { run++; best = Math.max(best, run); }
    else if (d === t && (st === 'today')) { /* not yet */ }
    else run = 0;
  }
  cur = run;
  // a streak made only of rest days is not a streak
  if (!logsOf(pid).some(l => doneStates.has(dayState(pid, l.date)))) { cur = 0; best = 0; }
  return { cur, best };
}
function completion(pid) {
  const t = todayISO(); let planned = 0, done = 0;
  S.order.forEach(d => { if (d > t || S.days[d].kind === 'rest') return; const st = dayState(pid, d); if (d === t && st === 'today') return; planned++; if (doneStates.has(st)) done++; });
  return { planned, done, pct: planned ? Math.round(100 * done / planned) : 0 };
}

/* ---- strength ---- */
function exName(date, idx, entry) { const p = P(date); return (p && p.strength[idx] && p.strength[idx].name) || (entry && entry.n) || ''; }
const normEx = n => n.toLowerCase().replace(/\(.*?\)/g, '').replace(/,.*$/, '').trim();
function strengthEntries(pid) {
  const out = [];
  logsOf(pid).forEach(l => {
    if (!l.str) return;
    Object.keys(l.str).forEach(idx => {
      const e = l.str[idx]; if (!e || !e.s) return;
      const name = exName(l.date, +idx, e);
      const sets = e.s.filter(x => x && x.d);
      if (!sets.length) return;
      const loads = sets.map(x => num(x.w)).filter(x => x != null);
      const top = loads.length ? Math.max(...loads) : null;
      const topSet = sets.find(x => num(x.w) === top) || sets[0];
      out.push({ date: l.date, idx: +idx, name, key: normEx(name), lift: liftKey(name), top, reps: num(topSet.r), sets: sets.length, rpe: e.rpe || null });
    });
  });
  return out;
}
function liftHistory(pid, key) { return strengthEntries(pid).filter(e => e.lift === key && e.top != null); }
function bestLoadBefore(pid, name, date) {
  const k = normEx(name); let best = null;
  strengthEntries(pid).forEach(e => { if (e.key === k && e.date < date && e.top != null) best = best == null ? e.top : Math.max(best, e.top); });
  return best;
}

/* ---- stations & sims ---- */
function stationTarget(pid, st, amount) {
  const sp = planSplits(pid); if (!sp || !sp.stations[st]) return null;
  const base = parseTime(sp.stations[st]); const ra = ST_RACE_AMT[st];
  if (!amount || !ra) return base;
  return Math.round(base * amount / ra);
}
function runTarget(pid, row) {
  const sp = planSplits(pid);
  if (row.tag === 'race' && sp && row.runNo) return parseTime(sp.runs[row.runNo - 1]);
  if (row.tag === 'rp') return Math.round(rpPace(pid) * (row.dist || 1));
  if (row.tag === 'tempo') { const z = zonesFor(pid).find(z => z.key === 'tempo'); return z && z.lo ? Math.round((z.lo + z.hi) / 2 * (row.dist || 1)) : null; }
  return null;
}
function stationEntries(pid, st) {
  const out = [];
  logsOf(pid).forEach(l => {
    const p = P(l.date); if (!p) return;
    if (l.hx) p.hyrox.rows.forEach(r => {
      if (r.kind !== 'station' || r.st !== st) return;
      const e = l.hx[r.i]; if (!e || !(e.d || e.time)) return;
      out.push({ date: l.date, amount: num(e.amt != null ? e.amt : r.amount), unit: r.unit, load: num(e.load != null ? e.load : r.load), time: parseTime(e.time), rpe: e.rpe || null, raw: r.raw, src: 'session', cont: !(r.sets > 1) });
    });
    (l.xh || []).forEach(e => { if (e.st === st && (e.time || e.amt)) out.push({ date: l.date, amount: num(e.amt), unit: stInfo(st).unit, load: num(e.load), time: parseTime(e.time), rpe: e.rpe || null, raw: 'Extra entry', src: 'extra', cont: true }); });
    if (l.sim && l.sim.segs && l.sim.segs[st] && l.sim.segs[st].t) out.push({ date: l.date, amount: ST_RACE_AMT[st], unit: stInfo(st).unit, load: null, time: l.sim.segs[st].t, rpe: null, raw: l.sim.label || 'Simulation', src: 'sim', cont: true });
  });
  return out;
}
/* ---- HYROX formats and divisions (official 26/27 rulebooks, checked 25 Sep 2026) ---- */
const LOADS = {
  W: { name: 'Women', push: 102, pull: 78, farm: 16, bag: 10, wb: 4, tgt: '2.70' },
  WP: { name: 'Women Pro', push: 152, pull: 103, farm: 24, bag: 20, wb: 6, tgt: '2.70' },
  M: { name: 'Men', push: 152, pull: 103, farm: 24, bag: 20, wb: 6, tgt: '3.00' },
  MP: { name: 'Men Pro', push: 202, pull: 153, farm: 32, bag: 30, wb: 9, tgt: '3.00' }
};
const RACE_FORMATS = {
  singles: { name: 'Singles', divs: ['W', 'WP', 'M', 'MP'], how: 'You run all 8 km and do all 8 stations yourself.' },
  doubles: { name: 'Doubles', divs: ['W', 'WP', 'M', 'MP', 'X'], how: 'Two of you run every 1 km together and split each station however you like.' },
  relay: { name: 'Relay', divs: ['W', 'M', 'X'], how: 'A team of four: each of you runs 2 × 1 km and does the 2 stations that follow.' }
};
function divName(fmt, d) { return fmt === 'singles' ? ({ W: 'Women Open', WP: 'Women Pro', M: 'Men Open', MP: 'Men Pro' })[d] : ({ W: 'Women', WP: 'Women Pro', M: 'Men', MP: 'Men Pro', X: 'Mixed' })[d]; }
const raceComplete = r => !!(r && RACE_FORMATS[r.fmt] && RACE_FORMATS[r.fmt].divs.includes(r.div) && (r.div !== 'X' || r.sex === 'W' || r.sex === 'M'));
function raceOf(pid) { const p = S.profiles[pid]; return p && raceComplete(p.race) ? p.race : null; }
function raceLabel(r) { return r ? RACE_FORMATS[r.fmt].name + ' ' + divName(r.fmt, r.div) : ''; }
function loadClass(r) { // which column of weights applies
  if (!r) return 'M'; // the plan was written for Men Open
  if (r.div !== 'X') return r.div;
  if (r.fmt === 'doubles') return r.sex === 'W' ? 'WP' : 'M'; // mixed doubles: Men Open loads, target height by who throws
  return r.sex === 'W' ? 'W' : 'M';
}
function loadsLabel(r) {
  if (r && r.div === 'X') return r.fmt === 'doubles' ? 'Mixed doubles' : (r.sex === 'W' ? 'Women\'s' : 'Men\'s') + ' (mixed relay)';
  return ({ W: 'Women Open', WP: 'Women Pro', M: 'Men Open', MP: 'Men Pro' })[loadClass(r)];
}
function loadsSummary(c) { const L = LOADS[c]; return 'sled push ' + L.push + ' kg · sled pull ' + L.pull + ' kg · farmers 2 × ' + L.farm + ' kg · sandbag ' + L.bag + ' kg · wall ball ' + L.wb + ' kg to ' + L.tgt + ' m'; }
function loadText(key, pid) {
  const L = LOADS[loadClass(pid ? raceOf(pid) : null)];
  if (key === 'push') return L.push + ' kg including sled';
  if (key === 'pull') return L.pull + ' kg including sled';
  if (key === 'farm') return '2 × ' + L.farm + ' kg kettlebells';
  if (key === 'lunge') return L.bag + ' kg sandbag';
  if (key === 'wb') return L.wb + ' kg ball to a ' + L.tgt + ' m target';
  const s = stInfo(key); return (s && s.load) || '';
}
function raceLoad(pid, st) { const L = LOADS[loadClass(raceOf(pid))]; return ({ push: L.push, pull: L.pull, farm: L.farm, lunge: L.bag, wb: L.wb })[st] || 0; }
function defaultRace(fmt, prev) { // switching format keeps the closest division
  prev = prev || {}; const divs = RACE_FORMATS[fmt].divs; const r = { fmt };
  const sex = prev.sex || (prev.div === 'W' || prev.div === 'WP' ? 'W' : prev.div ? 'M' : null);
  if (divs.includes(prev.div)) r.div = prev.div;
  else if (prev.div === 'WP') r.div = 'W';
  else if (prev.div === 'MP') r.div = 'M';
  else if (prev.div === 'X' && sex) r.div = sex;
  if (r.div === 'X' && sex) r.sex = sex;
  return r;
}
function racePickerHTML(r, prefix) {
  r = r || {};
  let h = '<div class="field"><span>Your race: format</span><div class="seg">' + Object.keys(RACE_FORMATS).map(f => '<button data-a="' + prefix + '-fmt" data-v="' + f + '" aria-pressed="' + (r.fmt === f) + '">' + RACE_FORMATS[f].name + '</button>').join('') + '</div>' + (r.fmt ? '<span class="small muted" style="font-weight:400">' + esc(RACE_FORMATS[r.fmt].how) + '</span>' : '') + '</div>';
  if (r.fmt) h += '<div class="field"><span>Division</span><div class="seg">' + RACE_FORMATS[r.fmt].divs.map(d => '<button data-a="' + prefix + '-div" data-v="' + d + '" aria-pressed="' + (r.div === d) + '">' + esc(divName(r.fmt, d)) + '</button>').join('') + '</div></div>';
  if (r.div === 'X') h += '<div class="field"><span>You race as</span><div class="seg"><button data-a="' + prefix + '-sex" data-v="W" aria-pressed="' + (r.sex === 'W') + '">Woman</button><button data-a="' + prefix + '-sex" data-v="M" aria-pressed="' + (r.sex === 'M') + '">Man</button></div><span class="small muted" style="font-weight:400">' + (r.fmt === 'doubles' ? 'Mixed doubles uses the same loads for both of you; only the wall-ball target height differs.' : 'Sets which weights the guide shows you.') + '</span></div>';
  if (raceComplete(r)) h += '<p class="small" style="margin:0;color:var(--ink-2)">Your weights: <b>' + esc(loadsSummary(loadClass(r))) + '</b></p>';
  return h;
}
function stationBest(pid, st) {
  const e = stationEntries(pid, st);
  const full = e.filter(x => x.time && x.cont && x.amount >= ST_RACE_AMT[st] * 0.999 && (x.load == null || !raceLoad(pid, st) || x.load >= raceLoad(pid, st)));
  const best = full.length ? full.reduce((a, b) => (b.time < a.time ? b : a)) : null;
  const loads = e.map(x => x.load).filter(x => x != null);
  return { entries: e, best, heaviest: loads.length ? Math.max(...loads) : null, volume: sum(e.map(x => x.amount || 0)) };
}
function simsOf(pid) {
  const out = [];
  logsOf(pid).forEach(l => {
    const p = P(l.date); if (!p) return;
    if (l.sim && l.sim.segs && Object.values(l.sim.segs).some(x => x && x.t)) {
      out.push({ date: l.date, label: l.sim.label || p.session, segs: l.sim.segs, rox: l.sim.rox || null, total: l.sim.total || null, src: 'sim' });
      return;
    }
    const isSim = (p.day.badges || []).includes('sim') || p.kind === 'race';
    if (!isSim || !p.hyrox.chain || !l.hx) return;
    const segs = {}; let rn = 0, any = false;
    p.hyrox.rows.forEach(r => {
      const e = l.hx[r.i];
      if (r.kind === 'run') { rn = r.runNo || rn + 1; if (e && e.time) { segs['r' + rn] = { t: parseTime(e.time), target: runTarget(pid, r), dist: r.dist }; any = true; } }
      else if (r.kind === 'station' && r.st !== 'other' && e && e.time && !segs[r.st]) { const amt = num(e.amt != null ? e.amt : r.amount); segs[r.st] = { t: parseTime(e.time), target: stationTarget(pid, r.st, amt), amt }; any = true; }
    });
    if (any) out.push({ date: l.date, label: p.session.replace(/^Core \+ HYROX [AB] · /, ''), segs, rox: l.rox ? parseTime(l.rox) : null, total: l.simTotal ? parseTime(l.simTotal) : null, src: 'chain' });
  });
  out.forEach(s => {
    ST_KEYS.forEach((k, i) => {
      const rk = 'r' + (i + 1);
      if (s.segs[rk] && s.segs[rk].target == null) s.segs[rk].target = runTarget(pid, { tag: 'race', runNo: i + 1 });
      if (s.segs[k] && s.segs[k].target == null) s.segs[k].target = stationTarget(pid, k, s.segs[k].amt);
    });
    if (!s.total) { const t = sum(Object.values(s.segs).map(x => x.t || 0)) + (s.rox || 0); s.total = t || null; s.totalCalc = true; }
  });
  return out;
}
const SEG_ORDER = () => { const o = []; ST_KEYS.forEach((k, i) => { o.push('r' + (i + 1)); o.push(k); }); return o; };
const segLabel = k => k[0] === 'r' && /^r\d$/.test(k) ? 'Run ' + k.slice(1) : stName(k);

/* ---- running fitness ---- */
function benchVal(pid, id) { const b = S.bench[pid]; return b && b.results && b.results[id] ? b.results[id] : null; }
function currentP5(pid) {
  const c = [];
  ['gate1', 'tt5k1'].forEach(id => { const r = benchVal(pid, id); const t = r && parseTime(r.v); if (t) c.push({ sec: t / 5, from: (id === 'gate1' ? '5 km TT (Gate 1)' : '5 km TT') + ' ' + fmtTime(t), date: r.date || '' }); });
  const r1 = benchVal(pid, 'tt1k'); const t1 = r1 && parseTime(r1.v);
  if (t1) c.push({ sec: t1 + 45, from: '1 km TT ' + fmtTime(t1) + ' + 0:45', date: r1.date || '2026-09-29' });
  runsOf(pid).filter(r => r.type === 'tt' && r.dist >= 4.9 && r.dist <= 5.3).forEach(r => c.push({ sec: r.time / r.dist, from: '5 km run on ' + fmtDate(r.date), date: r.date }));
  if (!c.length) return null;
  c.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return c[0];
}
function zonesFor(pid) {
  const Z = (S.meta && S.meta.zones) || []; const p5 = currentP5(pid);
  return Z.map(z => {
    if (z.key === 'rp') { const rp = rpPace(pid); return Object.assign({}, z, { lo: rp, hi: rp, txt: fmtPace(rp) + '/km (Plan ' + planOf(pid) + ')' }); }
    if (!p5) { const m = String(z.def).match(/(\d:\d\d)\s*[–-]\s*(\d:\d\d)/); return Object.assign({}, z, { lo: m ? parseTime(m[1]) : null, hi: m ? parseTime(m[2]) : null, txt: z.def + (m ? '/km' : ''), dflt: true }); }
    const lo = Math.round(p5.sec + z.lo), hi = Math.round(p5.sec + z.hi);
    return Object.assign({}, z, { lo, hi, txt: fmtPace(lo) + '–' + fmtPace(hi) + '/km' });
  });
}
function oneKmSplits(pid) {
  const out = [];
  logsOf(pid).forEach(l => {
    (l.runs || []).forEach(r => { if (r.reps && r.repDist && Math.abs(r.repDist - 1) < 0.01) r.reps.forEach(t => { const s = parseTime(t); if (s) out.push({ date: l.date, t: s, src: 'reps' }); }); });
    const p = P(l.date);
    if (p && l.hx) p.hyrox.rows.forEach(r => { if (r.kind === 'run' && Math.abs((r.dist || 0) - 1) < 0.01 && l.hx[r.i] && l.hx[r.i].time) out.push({ date: l.date, t: parseTime(l.hx[r.i].time), src: r.tag === 'race' ? 'sim' : 'chain', rp: r.tag === 'rp' || r.tag === 'race' }); });
    if (l.sim && l.sim.segs) for (let i = 1; i <= 8; i++) { const s = l.sim.segs['r' + i]; if (s && s.t) out.push({ date: l.date, t: s.t, src: 'sim', rp: true }); }
  });
  const tt = benchVal(pid, 'tt1k'); if (tt && parseTime(tt.v)) out.push({ date: tt.date || '2026-09-29', t: parseTime(tt.v), src: 'tt' });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/* ---- race-time predictor ---- */
function predict(pid) {
  const M = S.meta; if (!M) return null;
  const sept = M.plans.S, t = todayISO();
  const out = { runs: null, runFrom: '', stations: {}, rox: null, roxFrom: '', total: 0, dataPoints: 0 };
  const recentRP = oneKmSplits(pid).filter(x => x.rp && diffDays(x.date, t) <= 42);
  const p5 = currentP5(pid);
  if (recentRP.length >= 3) { const a = sum(recentRP.map(x => x.t)) / recentRP.length; out.runs = a * 8; out.runFrom = 'Average of your last ' + recentRP.length + ' race-pace kilometres (' + fmtPace(a) + '/km)'; out.dataPoints++; }
  else if (p5) { const a = p5.sec + 32; out.runs = a * 8; out.runFrom = p5.from + ' → P5 ' + fmtPace(p5.sec) + ' + 0:32 for compromised running = ' + fmtPace(a) + '/km'; out.dataPoints++; }
  else { out.runs = sum(sept.runs.map(parseTime)); out.runFrom = 'No run test yet: September estimate (7:30/km)'; }
  const benchEst = {
    ski: [['ski2', 15, 'SkiErg max test + 0:15 race fatigue'], ['ski1', 10, 'SkiErg RPE 8 test + 0:10']],
    row: [['row2', 20, 'Row max test + 0:20 race fatigue'], ['row1', 15, 'Row RPE 8 test + 0:15']],
    push: [['push152', 10, 'Sled push 152 kg test + 0:10']],
    pull: [['pull103', 10, 'Sled pull 103 kg test + 0:10']],
    wb: [['wb100', 20, '100 wall balls test + 0:20']],
    farm: [['farm200', 5, 'Farmers carry test + 0:05']],
    lunge: [['lunge50', 'x2', '50 m lunge test × 2 + 0:30']]
  };
  ST_KEYS.forEach(st => {
    const b = stationBest(pid, st).best;
    if (b && diffDays(b.date, t) <= 75) { out.stations[st] = { t: b.time, from: 'Your best race-standard ' + stName(st).toLowerCase() + ' (' + fmtDate(b.date, false) + ')' }; out.dataPoints++; return; }
    for (const [id, add, label] of (benchEst[st] || [])) {
      const r = benchVal(pid, id); const v = r && parseTime(r.v);
      if (v) { out.stations[st] = { t: add === 'x2' ? v * 2 + 30 : v + add, from: label }; out.dataPoints++; return; }
    }
    out.stations[st] = { t: parseTime(sept.stations[st]), from: 'No data yet: September estimate' };
  });
  const sims = simsOf(pid).filter(s => s.rox);
  if (sims.length) { const s = sims[sims.length - 1]; const passes = Math.max(1, Object.keys(s.segs).filter(k => !/^r\d$/.test(k)).length); out.rox = Math.round(s.rox / passes * 8); out.roxFrom = 'From your ' + fmtDate(s.date, false) + ' simulation'; }
  else { out.rox = parseTime(M.plans.B.rox); out.roxFrom = 'Plan B assumption (7:15)'; }
  out.stTotal = sum(Object.values(out.stations).map(x => x.t));
  out.total = Math.round(out.runs + out.stTotal + out.rox);
  return out;
}
function gatePlan(pid) {
  const B = (S.meta && S.meta.benchmarks) || [];
  for (const id of ['gate3', 'gate2', 'gate1']) {
    const b = B.find(x => x.id === id); const r = benchVal(pid, id); const v = r && parseTime(r.v);
    if (b && v) return { plan: v <= parseTime(b.a) ? 'A' : v <= parseTime(b.b) ? 'B' : 'C', from: b.name };
  }
  return null;
}
function benchStatus(b, r) {
  if (!r || r.v == null || r.v === '') return null;
  if (b.kind === 'reps') { const v = num(r.v); if (v == null) return null; return v >= b.okReps ? { cls: 'ok', txt: 'On target' } : { cls: 'bad', txt: 'Below target' }; }
  const v = parseTime(r.v); if (!v) return null;
  if (b.a) { if (v <= parseTime(b.a)) return { cls: 'ok', txt: 'Plan A' }; if (v <= parseTime(b.b)) return { cls: 'warn', txt: 'Plan B' }; return { cls: 'bad', txt: b.gate ? 'Plan C' : 'Over B target' }; }
  if (b.ok) return v <= parseTime(b.ok) ? { cls: 'ok', txt: 'On target' } : { cls: 'bad', txt: 'Over target' };
  return null;
}

/* ---- records & badges ---- */
function records(pid) {
  const R = [];
  const byEx = {};
  strengthEntries(pid).forEach(e => { if (e.top == null || e.top <= 0) return; if (!byEx[e.key] || e.top > byEx[e.key].top) byEx[e.key] = e; });
  Object.values(byEx).sort((a, b) => (a.lift ? 0 : 1) - (b.lift ? 0 : 1) || b.top - a.top).forEach(e => R.push({ group: 'Strength', label: e.name.replace(/\s*\(.*?\)/, ''), value: e.top + ' kg' + (e.reps ? ' × ' + e.reps : ''), date: e.date }));
  const runs = runsOf(pid);
  if (runs.length) {
    const lr = runs.reduce((a, b) => b.dist > a.dist ? b : a); R.push({ group: 'Running', label: 'Longest run', value: fmtKm(lr.dist) + ' km', date: lr.date });
    const five = runs.filter(r => r.type === 'tt' && r.dist >= 4.95 && r.dist <= 5.3).map(r => ({ date: r.date, t: r.time * 5 / r.dist }));
    const tt5 = [benchVal(pid, 'tt5k1'), benchVal(pid, 'gate1')].filter(x => x && parseTime(x.v)).map(x => ({ date: x.date || '', t: parseTime(x.v) }));
    const f5 = five.concat(tt5); if (f5.length) { const b = f5.reduce((a, c) => c.t < a.t ? c : a); R.push({ group: 'Running', label: 'Fastest 5 km', value: fmtTime(b.t), date: b.date }); }
  }
  const k1 = oneKmSplits(pid); if (k1.length) { const b = k1.reduce((a, c) => c.t < a.t ? c : a); R.push({ group: 'Running', label: 'Fastest 1 km', value: fmtTime(b.t), date: b.date }); }
  ST_KEYS.forEach(st => { const b = stationBest(pid, st).best; if (b) R.push({ group: 'Stations', label: stName(st) + ' (race standard)', value: fmtTime(b.time), date: b.date }); });
  let wbMax = null; logsOf(pid).forEach(l => (l.wb || []).forEach(n => { if (!wbMax || n > wbMax.n) wbMax = { n, date: l.date }; }));
  const wbb = benchVal(pid, 'wbmax'); if (wbb && num(wbb.v) && (!wbMax || num(wbb.v) > wbMax.n)) wbMax = { n: num(wbb.v), date: wbb.date || '2026-09-29' };
  if (wbMax) R.push({ group: 'Stations', label: 'Wall balls unbroken', value: wbMax.n + ' reps', date: wbMax.date });
  return R;
}
function badges(pid) {
  const runs = runsOf(pid), logs = logsOf(pid), t = todayISO();
  const first = (arr, f) => { const x = arr.filter(f); return x.length ? x[0].date : null; };
  const totalKm = sum(runs.map(r => r.dist));
  let cum = 0, km100 = null, km250 = null; runs.forEach(r => { cum += r.dist; if (!km100 && cum >= 100) km100 = r.date; if (!km250 && cum >= 250) km250 = r.date; });
  const rp = rpPace(pid); const k1 = oneKmSplits(pid);
  const st = streaks(pid);
  const streakDate = n => { let run = 0; for (const d of S.order) { if (d > t) break; const s = dayState(pid, d); if (doneStates.has(s) || s === 'rest' || s === 'restdone') { run++; if (run >= n) return d; } else if (!(d === t && s === 'today')) run = 0; } return null; };
  const hasSt = k => stationEntries(pid, k).length > 0;
  const wbDay = logs.find(l => sum(l.wb || []) + sum(Object.keys(l.hx || {}).map(i => { const p = P(l.date); const r = p && p.hyrox.rows[+i]; return r && r.st === 'wb' && (l.hx[i].d || l.hx[i].time) ? (num(l.hx[i].amt != null ? l.hx[i].amt : r.amount) || 0) : 0; })) >= 100);
  const perfect = (() => { for (let n = 1; n <= weekCount(); n++) { const w = weekStats(pid, n); if (w.dates.length && w.dates[w.dates.length - 1] <= t && w.done >= w.planned && w.planned) return w.dates[w.dates.length - 1]; } return null; })();
  const pushRace = stationEntries(pid, 'push').find(e => e.load >= raceLoad(pid, 'push')), pullRace = stationEntries(pid, 'pull').find(e => e.load >= raceLoad(pid, 'pull'));
  const onTarget = ((S.meta && S.meta.benchmarks) || []).find(b => { const s = benchStatus(b, benchVal(pid, b.id)); return s && (s.txt === 'Plan A' || s.txt === 'On target'); });
  const longest = runs.length ? runs.reduce((a, b) => b.dist > a.dist ? b : a) : null;
  const full = simsOf(pid).find(s => Object.keys(s.segs).length >= 14);
  const B = [
    { id: 'first', name: 'First session in the book', desc: 'Log your first completed session', on: first(logs, l => doneStates.has(dayState(pid, l.date))) },
    { id: '5k', name: 'First 5 km', desc: 'A single run of 5 km or more', on: first(runs, r => r.dist >= 5) },
    { id: '10k', name: 'Double digits', desc: 'A single run of 10 km or more', on: first(runs, r => r.dist >= 10) },
    { id: 'long', name: 'Longest run', desc: longest ? 'Your longest so far: ' + fmtKm(longest.dist) + ' km' : 'Log a run to start the record', on: longest ? longest.date : null },
    { id: 'rpkm', name: 'Race-pace kilometre', desc: 'A 1 km split at or under ' + fmtPace(rp) + ' (Plan ' + planOf(pid) + ')', on: (k1.find(x => x.t <= rp) || {}).date || null },
    { id: 's7', name: '7-day streak', desc: 'Seven days in a row on plan (rest days count)', on: streakDate(7), prog: Math.min(7, st.best) + '/7' },
    { id: 's30', name: '30-day streak', desc: 'Thirty days in a row on plan', on: streakDate(30), prog: Math.min(30, st.best) + '/30' },
    { id: 'perfect', name: 'Perfect week', desc: 'Every planned session in a week done', on: perfect },
    { id: 'wb100', name: 'Century', desc: '100 wall balls in one day', on: wbDay ? wbDay.date : null },
    { id: 'race', name: 'Race loads', desc: 'Sled push at ' + raceLoad(pid, 'push') + ' kg and sled pull at ' + raceLoad(pid, 'pull') + ' kg', on: pushRace && pullRace ? (pushRace.date > pullRace.date ? pushRace.date : pullRace.date) : null },
    { id: 'all8', name: 'All eight stations', desc: 'Log every HYROX station at least once', on: ST_KEYS.every(hasSt) ? t : null, prog: ST_KEYS.filter(hasSt).length + '/8' },
    { id: 'target', name: 'On target', desc: 'A benchmark at Plan A or target standard', on: onTarget ? (benchVal(pid, onTarget.id).date || onTarget.date) : null },
    { id: 'fullsim', name: 'Dress rehearsal', desc: 'Log a full simulation', on: full ? full.date : null },
    { id: 'km100', name: '100 km club', desc: '100 km of logged running', on: km100, prog: fmtKm(Math.min(totalKm, 100), 0) + '/100 km' },
    { id: 'km250', name: '250 km club', desc: '250 km of logged running', on: km250, prog: fmtKm(Math.min(totalKm, 250), 0) + '/250 km' },
    { id: 'finish', name: 'HYROX finisher', desc: 'Complete race day', on: (() => { const l = getLog(RACE(), pid); return l && l.status === 'complete' ? RACE() : null; })() }
  ];
  return B;
}

/* ---- niggles ---- */
const BODY = ['Foot', 'Ankle', 'Achilles', 'Calf', 'Shin', 'Knee', 'Hamstring', 'Quad', 'Hip', 'Glute', 'Groin', 'Lower back', 'Upper back', 'Shoulder', 'Elbow', 'Wrist / hand', 'Neck', 'Other'];
function niggleItems(pid) { return ((S.niggles[pid] && S.niggles[pid].items) || []).slice().sort((a, b) => b.date.localeCompare(a.date) || (b.t || 0) - (a.t || 0)); }
function niggleWarnings(pid) {
  const t = todayISO(), items = niggleItems(pid), out = [];
  const parts = [...new Set(items.map(x => x.part))];
  parts.forEach(part => {
    const xs = items.filter(x => x.part === part && diffDays(x.date, t) <= 21);
    if (!xs.length || diffDays(xs[0].date, t) > 10) return;
    const high = xs.filter(x => x.sev >= 4);
    if (xs.length >= 3 || high.length >= 2 || xs.some(x => x.sev >= 6 && diffDays(x.date, t) <= 7))
      out.push({ part, n: xs.length, max: Math.max(...xs.map(x => x.sev || 0)), last: xs[0].date });
  });
  return out;
}

/* ================= Charts (hand-drawn SVG, measured to fit) ================= */
const CHARTS = new Map(); let chartSeq = 0;
function chartBox(spec, h = 200) {
  const id = 'c' + (++chartSeq); CHARTS.set(id, spec);
  const leg = spec.legend !== false && spec.series.filter(s => s.name).length > 1
    ? '<div class="legend">' + spec.series.filter(s => s.name).map(s => '<span><i class="' + (s.ghost ? 'gh' : spec.type === 'line' ? 'ln' : '') + '" style="--c:' + s.color + '"></i>' + esc(s.name) + '</span>').join('') + '</div>' : '';
  return leg + '<div class="chart" data-chart="' + id + '" style="height:' + h + 'px" role="img" aria-label="' + esc(spec.label || '') + '"></div>';
}
function drawCharts() {
  $$('.chart[data-chart]').forEach(el => {
    const spec = CHARTS.get(el.dataset.chart); if (!spec) return;
    const w = Math.floor(el.clientWidth), h = el.clientHeight; if (!w) return;
    el.innerHTML = spec.type === 'bar' ? barSVG(spec, w, h) : lineSVG(spec, w, h);
  });
}
function niceTicks(lo, hi, n = 4) {
  if (lo === hi) { lo -= 1; hi += 1; }
  const span = hi - lo, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const err = step0 / mag; const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step; const t = [];
  for (let v = a; v <= b + step * 1e-6; v += step) t.push(+v.toFixed(6));
  return t;
}
function timeTicks(lo, hi, n = 4) {
  const steps = [5, 10, 15, 20, 30, 60, 120, 300, 600, 900, 1800, 3600];
  const span = Math.max(1, hi - lo); let step = steps.find(s => span / s <= n) || 3600;
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step; const t = [];
  for (let v = a; v <= b; v += step) t.push(v); return t;
}
function xLabelsEvery(n, W) { const max = Math.max(2, Math.floor(W / 46)); return Math.max(1, Math.ceil(n / max)); }
function lineSVG(sp, W, H) {
  const L = sp.padL || 46, R = 14, T = 12, B = 26, iw = W - L - R, ih = H - T - B;
  const vals = []; sp.series.forEach(s => s.vals.forEach(v => { if (v != null) vals.push(v); })); (sp.refs || []).forEach(r => vals.push(r.v));
  if (!vals.length) return '<svg width="' + W + '" height="' + H + '"><text x="' + (W / 2) + '" y="' + (H / 2) + '" text-anchor="middle">No data yet</text></svg>';
  let lo = sp.yMin != null ? sp.yMin : Math.min(...vals), hi = sp.yMax != null ? sp.yMax : Math.max(...vals);
  const pad = (hi - lo) * 0.12 || (sp.time ? 15 : 1); if (sp.yMin == null) lo -= pad; if (sp.yMax == null) hi += pad;
  if (sp.zero) lo = Math.min(0, lo);
  const ticks = sp.time ? timeTicks(lo, hi) : niceTicks(lo, hi); lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]);
  const n = sp.x.length; const xs = i => L + (n === 1 ? iw / 2 : i * iw / (n - 1));
  const ys = v => sp.invert ? T + (v - lo) / (hi - lo) * ih : T + ih - (v - lo) / (hi - lo) * ih;
  const f = sp.yFmt || (v => String(v));
  let g = '';
  ticks.forEach(t => { const y = ys(t); if (y < T - 1 || y > T + ih + 1) return; g += '<line class="ax" x1="' + L + '" x2="' + (L + iw) + '" y1="' + y + '" y2="' + y + '"/><text x="' + (L - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + esc(f(t)) + '</text>'; });
  const every = xLabelsEvery(n, iw);
  sp.x.forEach((lb, i) => { if (i % every && i !== n - 1) return; g += '<text x="' + xs(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(lb) + '</text>'; });
  (sp.refs || []).forEach(r => { const y = ys(r.v); g += '<line x1="' + L + '" x2="' + (L + iw) + '" y1="' + y + '" y2="' + y + '" stroke="var(--line-2)" stroke-width="1"/><text x="' + (L + iw) + '" y="' + (y - 5) + '" text-anchor="end" class="lbl-strong">' + esc(r.label) + '</text>'; });
  let lines = '', dots = '', hits = '';
  sp.series.forEach(s => {
    let d = '', pen = false;
    s.vals.forEach((v, i) => { if (v == null) { pen = sp.connect ? pen : false; return; } d += (pen ? 'L' : 'M') + xs(i).toFixed(1) + ' ' + ys(v).toFixed(1); pen = true; });
    if (s.area && d) { const first = s.vals.findIndex(v => v != null), last = s.vals.length - 1 - [...s.vals].reverse().findIndex(v => v != null); lines += '<path d="' + d + 'L' + xs(last) + ' ' + (T + ih) + 'L' + xs(first) + ' ' + (T + ih) + 'Z" fill="' + s.color + '" opacity=".1"/>'; }
    if (d) lines += '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"' + (s.muted ? ' opacity=".55"' : '') + '/>';
    const lastI = s.vals.length - 1 - [...s.vals].reverse().findIndex(v => v != null);
    s.vals.forEach((v, i) => {
      if (v == null) return;
      if (s.dots !== false || i === lastI) dots += '<circle cx="' + xs(i) + '" cy="' + ys(v) + '" r="' + (s.hl && s.hl[i] ? 6 : 4) + '" fill="' + (s.hl && s.hl[i] ? 'var(--accent)' : s.color) + '" stroke="var(--surface)" stroke-width="2"/>';
      const tip = (s.tips && s.tips[i]) || (sp.x[i] + (s.name ? ' · ' + s.name : '') + ': ' + f(v));
      hits += '<circle cx="' + xs(i) + '" cy="' + ys(v) + '" r="13" fill="transparent" data-tip="' + esc(tip) + '"/>';
    });
  });
  return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' + g + lines + dots + hits + '</svg>';
}
function barSVG(sp, W, H) {
  const L = sp.padL || 40, R = 10, T = 12, B = 26, iw = W - L - R, ih = H - T - B;
  const vals = []; sp.series.forEach(s => s.vals.forEach(v => { if (v != null) vals.push(v); }));
  const hi0 = vals.length ? Math.max(...vals) : 1; const ticks = niceTicks(0, hi0 || 1); const hi = ticks[ticks.length - 1] || 1;
  const n = sp.x.length, band = iw / n; const ys = v => T + ih - (v / hi) * ih; const f = sp.yFmt || (v => String(v));
  let g = '';
  ticks.forEach(t => { const y = ys(t); g += '<line class="ax" x1="' + L + '" x2="' + (L + iw) + '" y1="' + y + '" y2="' + y + '"/><text x="' + (L - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + esc(f(t)) + '</text>'; });
  const every = xLabelsEvery(n, iw);
  sp.x.forEach((lb, i) => { if (i % every && i !== n - 1) return; g += '<text x="' + (L + band * i + band / 2) + '" y="' + (H - 6) + '" text-anchor="middle"' + (sp.hlX === i ? ' class="lbl-strong"' : '') + '>' + esc(lb) + '</text>'; });
  const ghost = sp.series.filter(s => s.ghost), real = sp.series.filter(s => !s.ghost);
  const bw = Math.max(3, Math.min(24, (band * 0.72 - 2 * (real.length - 1)) / Math.max(1, real.length)));
  const gw = Math.min(band * 0.86, Math.max(bw * real.length + 2 * (real.length - 1) + 10, bw + 10));
  const rr = (x, y, w, h, c, extra) => { if (h <= 0.5) return ''; const r = Math.min(4, w / 2, h); return '<path d="M' + x + ' ' + (y + h) + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (y + h) + 'Z" fill="' + c + '"' + (extra || '') + '/>'; };
  let bars = '', hits = '';
  for (let i = 0; i < n; i++) {
    const cx = L + band * i + band / 2;
    ghost.forEach(s => { const v = s.vals[i]; if (v == null) return; bars += rr(cx - gw / 2, ys(v), gw, T + ih - ys(v), 'var(--plan-bar)'); });
    const tot = real.length * bw + (real.length - 1) * 2; let x = cx - tot / 2;
    real.forEach(s => { const v = s.vals[i]; if (v != null) bars += rr(x, ys(v), bw, T + ih - ys(v), s.color, sp.fade && sp.fade[i] ? ' opacity=".45"' : ''); x += bw + 2; });
    const tip = sp.tips ? sp.tips[i] : sp.x[i] + '\n' + sp.series.map(s => (s.name || '') + ': ' + (s.vals[i] == null ? '–' : f(s.vals[i]))).join('\n');
    hits += '<rect x="' + (L + band * i) + '" y="' + T + '" width="' + band + '" height="' + ih + '" fill="transparent" data-tip="' + esc(tip) + '"/>';
  }
  return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' + g + bars + hits + '</svg>';
}
let _rw = 0;
window.addEventListener('resize', debounce(() => { if (window.innerWidth !== _rw) { _rw = window.innerWidth; drawCharts(); } }, 150));

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
/* ---------- Session photos: the original file is kept at full quality; a small preview makes browsing fast ---------- */
const UPL = {}; // uploads in progress, by date
function photoErr(e) {
  const c = (e && e.code) || '';
  if (c === 'storage/unauthorized') return 'Firebase refused the upload. Check that photo storage is set up and its rules are published (setup guide, "Photos").';
  if (c === 'storage/unknown' || c === 'storage/bucket-not-found' || c === 'storage/project-not-found' || c === 'storage/no-default-bucket') return 'Photo storage isn\'t set up in Firebase yet. Follow the "Photos" part of the setup guide.';
  if (c === 'storage/quota-exceeded') return 'Photo storage is over its limit.';
  if (c === 'storage/retry-limit-exceeded') return 'The connection dropped during the upload. Try again with better signal.';
  return 'Couldn\'t upload the photo' + (c ? ' (' + c + ')' : '') + '.';
}
function makeThumb(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const max = 480, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => { URL.revokeObjectURL(url); resolve({ blob: b, w: img.naturalWidth, h: img.naturalHeight }); }, 'image/jpeg', 0.8);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ blob: null, w: 0, h: 0 }); };
    img.src = url;
  });
}
async function addPhotos(date, files) {
  if (!S.pid || !window.FBX || !FBX.storage) return;
  const pid = S.pid, lid = logKey(pid, date);
  if (!canWriteDoc('logs', lid)) { toast('You can only add photos to your own log.'); return; }
  if (navigator.onLine === false) { toast('You\'re offline. Add photos when you have signal.'); return; }
  const list = Array.from(files || []).filter(f => /^image\//.test(f.type) || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name));
  for (const f of list) {
    if (f.size > 25 * 1024 * 1024) { toast(f.name + ' is over 25 MB, so it was skipped.'); continue; }
    const id = uidGen('p');
    const ext = ((f.name.match(/\.([a-z0-9]+)$/i) || [])[1] || (f.type.split('/')[1] || 'jpg')).toLowerCase();
    const type = f.type || (ext === 'heic' || ext === 'heif' ? 'image/' + ext : 'image/jpeg');
    const base = 'photos/' + pid + '/' + date + '_' + id;
    const u = { id, pct: 0 }; (UPL[date] = UPL[date] || []).push(u); renderSoon();
    try {
      const th = await makeThumb(f);
      let tpath = null, turl = null;
      if (th.blob) { tpath = base + '_t.jpg'; turl = (await FBX.storage.upload(tpath, th.blob, 'image/jpeg')).url; }
      const up = await FBX.storage.upload(base + '.' + ext, f, type, (a, b) => { u.pct = b ? Math.round(100 * a / b) : 0; const el = document.getElementById('upl-' + id); if (el) el.textContent = u.pct + '%'; });
      const cur = clone(S.logs[lid]) || { pid, date };
      cur.photos = (cur.photos || []).concat([{ id, path: base + '.' + ext, url: up.url, tpath, turl, w: th.w, h: th.h, bytes: f.size, at: Date.now() }]);
      put('logs', lid, cur);
    } catch (e) { toast(photoErr(e)); }
    UPL[date] = (UPL[date] || []).filter(x => x !== u); renderSoon();
  }
}
async function deletePhoto(k) {
  const c = (S.phCtx || [])[k]; if (!c) return;
  const lid = logKey(c.pid, c.date); const cur = clone(S.logs[lid]);
  if (!cur || !cur.photos || !cur.photos[c.i]) return;
  const ph = cur.photos.splice(c.i, 1)[0];
  if (!put('logs', lid, cur)) return;
  S.phDel = null; closeSheet(); render(); toast('Photo deleted.');
  try { await FBX.storage.remove(ph.path); } catch (e) { }
  if (ph.tpath) { try { await FBX.storage.remove(ph.tpath); } catch (e) { } }
}
function photosHTML(date, l) {
  const own = !!S.pid && canWriteDoc('logs', logKey(S.pid, date));
  const ph = (l && l.photos) || [], up = UPL[date] || [];
  let h = '';
  if (ph.length || up.length || own) h += '<div class="field"><span>Photos</span><div class="phgrid">' +
    ph.map((x, i) => '<button class="phtile" data-a="photo-open" data-p="' + S.pid + '" data-d="' + date + '" data-i="' + i + '" aria-label="Open photo ' + (i + 1) + '"><img src="' + esc(x.turl || x.url) + '" alt="" loading="lazy"></button>').join('') +
    up.map(x => '<div class="phtile up"><span id="upl-' + x.id + '">' + x.pct + '%</span><span class="small">Uploading</span></div>').join('') +
    (own ? '<label class="phtile add">' + I.plus + '<span>Add photo</span><input type="file" accept="image/*" multiple hidden data-in="photos" data-d="' + date + '"></label>' : '') +
    '</div>' + (own && !ph.length && !up.length ? '<span class="small muted" style="font-weight:400">Saved at full quality. Everyone in the tracker can see them.</span>' : '') + '</div>';
  const others = peopleIds().filter(p => p !== S.pid).map(p => ({ p, l: getLog(date, p) })).filter(x => x.l && x.l.photos && x.l.photos.length);
  if (others.length) h += '<div class="field"><span>Everyone else\'s photos from this day</span><div class="phgrid">' +
    others.map(x => x.l.photos.map((y, i) => '<button class="phtile" data-a="photo-open" data-p="' + x.p + '" data-d="' + date + '" data-i="' + i + '" aria-label="Photo by ' + esc(pname(x.p)) + '"><img src="' + esc(y.turl || y.url) + '" alt="" loading="lazy">' + whoTag(x.p) + '</button>').join('')).join('') + '</div></div>';
  return h;
}
function sheetPhoto(o) {
  const ctx = S.phCtx || []; const c = ctx[o.k];
  const l = c ? getLog(c.date, c.pid) : null; const ph = l && l.photos && l.photos[c.i];
  if (!ph) return { title: 'Photo', body: '<p class="muted">This photo has been removed.</p>' };
  const own = canWriteDoc('logs', logKey(c.pid, c.date)); const n = ctx.length;
  const nav = n > 1 ? '<button class="btn" data-a="ph-nav" data-k="' + ((o.k - 1 + n) % n) + '" aria-label="Previous photo">' + I.left + '</button><button class="btn" data-a="ph-nav" data-k="' + ((o.k + 1) % n) + '" aria-label="Next photo">' + I.right + '</button>' : '';
  const del = own ? (S.phDel === ph.id ? '<button class="btn" style="border-color:var(--miss);color:var(--miss)" data-a="photo-rm" data-k="' + o.k + '">Yes, delete</button>' : '<button class="btn ghost" style="color:var(--miss)" data-a="photo-del-ask" data-v="' + esc(ph.id) + '">Delete</button>') : '';
  return { title: esc(pname(c.pid)) + ' · ' + esc(fmtDate(c.date)) + (n > 1 ? ' · ' + (o.k + 1) + '/' + n : ''), body: '<div class="phview"><img src="' + esc(ph.url) + '" alt="Photo by ' + esc(pname(c.pid)) + '">' +
    '<div class="row">' + nav + '<a class="btn" href="' + esc(ph.url) + '" target="_blank" rel="noopener">Open full size</a><span class="sp" style="flex:1"></span>' + del + '</div>' +
    '<p class="small muted">' + (ph.w ? ph.w + ' × ' + ph.h + ' px' : '') + (ph.bytes ? ' · ' + (ph.bytes / 1048576).toFixed(1) + ' MB original' : '') + '</p></div>' };
}
function allPhotos(onlyPid) {
  const order = peopleIds(); const out = [];
  Object.values(S.logs).forEach(l => {
    if (!l || !l.photos || !l.photos.length || !order.includes(l.pid)) return;
    if (onlyPid && l.pid !== onlyPid) return;
    l.photos.forEach((ph, i) => out.push({ pid: l.pid, date: l.date, i, ph }));
  });
  return out.sort((a, b) => b.date.localeCompare(a.date) || order.indexOf(a.pid) - order.indexOf(b.pid) || (a.ph.at || 0) - (b.ph.at || 0));
}
const whoTag = pid => peopleIds().length > 1 ? '<span class="phwho" style="--pc:' + pcolor(pid) + '"><i></i>' + esc(pname(pid)) + '</span>' : '';
function galTile(x, k) { return '<button class="phtile" data-a="gal-open" data-k="' + k + '" aria-label="Photo by ' + esc(pname(x.pid)) + ', ' + esc(fmtDate(x.date)) + '"><img src="' + esc(x.ph.turl || x.ph.url) + '" alt="" loading="lazy">' + whoTag(x.pid) + '</button>'; }
function viewPhotos() {
  const ids = peopleIds(); const f = ids.includes(S.route.pf) ? S.route.pf : 'all';
  const items = allPhotos(f === 'all' ? null : f);
  S.gal = items.map(x => ({ pid: x.pid, date: x.date, i: x.i }));
  const days = []; items.forEach(x => { if (!days.includes(x.date)) days.push(x.date); });
  const filt = ids.length > 1 ? '<div class="seg" role="group" aria-label="Whose photos">' + [['all', 'Everyone']].concat(ids.map(p => [p, pname(p)])).map(([v, t]) => '<button data-a="pf" data-v="' + v + '" aria-pressed="' + (f === v) + '">' + (v === 'all' ? '' : '<span class="dot" style="--pc:' + pcolor(v) + ';margin-right:6px;width:10px;height:10px"></span>') + esc(t) + '</button>').join('') + '</div>' : '';
  const head = '<div class="row"><h2 class="disp" style="font-size:34px;text-transform:uppercase;flex:1">Photos</h2>' + filt + '</div>' +
    (items.length ? '<p class="small muted" style="margin-top:-6px">' + items.length + ' photo' + (items.length > 1 ? 's' : '') + ' · ' + days.length + ' day' + (days.length > 1 ? 's' : '') + '</p>' : '');
  if (!items.length) return head + '<section class="card"><p class="empty">' + (f === 'all' ? 'No photos yet. Add them in <b>Finish session</b> on any day, and everyone\'s show up here.' : esc(pname(f)) + ' hasn\'t added any photos yet.') + '</p><div class="row" style="margin-top:8px"><button class="btn" data-a="nav" data-v="today">Go to today</button></div></section>';
  return head + days.map(d => {
    const p = S.days[d] ? P(d) : null;
    return '<section class="card"><div class="card-h"><h3 style="font-size:20px">' + esc(fmtDate(d)) + '</h3><span class="small muted">' + (p ? 'Day ' + p.n + ' · ' + esc(p.day.heading) : '') + '</span><span class="sp"></span><button class="btn sm ghost" data-a="go-day" data-d="' + d + '">Open day</button></div>' +
      '<div class="phgrid">' + items.map((x, k) => x.date === d ? galTile(x, k) : '').join('') + '</div></section>';
  }).join('');
}
const BADGE_GENERIC = { long: 'Longest single run so far', rpkm: 'A 1 km split at your race pace', race: 'Sled push and pull at your race weights' };
function achievementsCard() {
  const ids = peopleIds(); if (!ids.length) return '';
  const per = ids.map(pid => ({ pid, B: badges(pid) })); const defs = per[0].B;
  const feed = [];
  per.forEach(x => x.B.forEach(b => { if (b.on && b.id !== 'long') feed.push({ pid: x.pid, b }); }));
  feed.sort((a, b) => b.b.on.localeCompare(a.b.on) || ids.indexOf(a.pid) - ids.indexOf(b.pid));
  const chip = (pid, extra) => '<span class="pill"><span class="dot" style="--pc:' + pcolor(pid) + '"></span>' + esc(pname(pid)) + (extra ? ' ' + extra : '') + '</span>';
  const tally = '<div class="row" style="gap:8px">' + per.map(x => chip(x.pid, '<b class="mono">' + x.B.filter(b => b.on).length + '/' + x.B.length + '</b>')).join('') + '</div>';
  const latest = feed.length
    ? '<div class="stack" style="gap:8px;margin-top:14px">' + feed.slice(0, 6).map(f => '<div class="row" style="flex-wrap:nowrap;align-items:flex-start;gap:10px"><span class="medal-sm" style="color:' + pcolor(f.pid) + '">' + I.medal + '</span><span class="small" style="flex:1;min-width:0"><b>' + esc(pname(f.pid)) + '</b> earned <b>' + esc(f.b.name) + '</b><br><span class="muted">' + esc(fmtDate(f.b.on)) + '</span></span></div>').join('') + '</div>'
    : '<p class="empty" style="margin-top:10px">No achievements yet. The first one comes with your first completed session.</p>';
  const all = '<details style="margin-top:12px"><summary class="small">All achievements (' + defs.length + ')</summary><div class="stack" style="gap:12px;margin-top:8px">' + defs.map((d, i) => {
    const got = per.filter(x => x.B[i].on);
    return '<div><b class="small">' + esc(d.name) + '</b><br><span class="small muted">' + esc(BADGE_GENERIC[d.id] || d.desc) + '</span><div class="row" style="gap:6px;margin-top:6px">' +
      (got.length ? got.map(x => chip(x.pid, '· ' + esc(d.id === 'long' ? fmtKm((runsOf(x.pid).reduce((a, r) => r.dist > a ? r.dist : a, 0))) + ' km' : fmtDate(x.B[i].on, false)))).join('') : '<span class="small muted">Nobody yet</span>') + '</div></div>';
  }).join('') + '</div></details>';
  return '<section class="card"><div class="card-h"><h3>Achievements</h3><span class="sp"></span><button class="btn sm ghost" data-a="sub" data-v="progress" data-s="badges">' + I.medal + 'Badges</button></div>' + tally + latest + all + '</section>';
}
function togetherPhotos() {
  const items = allPhotos(null); if (!items.length) return '';
  S.gal = items.map(x => ({ pid: x.pid, date: x.date, i: x.i }));
  return '<section class="card"><div class="card-h"><h3>Latest photos</h3><span class="sp"></span><button class="btn sm" data-a="nav" data-v="photos">' + I.photo + 'See all ' + items.length + '</button></div><div class="phgrid">' + items.slice(0, 8).map((x, k) => galTile(x, k)).join('') + '</div></section>';
}
function finishCard(date, p, l) {
  const el = l.start && !l.time ? Math.round((Date.now() - l.start) / 60000) : null;
  return '<section class="card finish o9" id="finish"><div class="card-h"><h3>Finish session</h3></div><div class="stack">' +
    '<div class="field"><span>Session RPE' + (p.rpe ? ' · target ' + esc(p.rpe.split(/[ ,(]/)[0]) : '') + '</span><div class="chips rpe">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => '<button class="chip" data-a="rpe" data-v="' + v + '" aria-pressed="' + (l.rpe === v) + '">' + v + '</button>').join('') + '</div></div>' +
    '<div class="fgrid" style="grid-template-columns:minmax(0,1fr) auto;align-items:end"><label class="field"><span>Total session time (min)</span><input class="inp mono" id="sess-time" inputmode="numeric" placeholder="' + (p.planMin || '') + '" value="' + esc(l.time || '') + '" data-in="lg" data-k="time" data-num="1"></label>' +
    (el ? '<button class="btn" data-a="use-elapsed" data-v="' + el + '">Use ' + el + ' min</button>' : '<span></span>') + '</div>' +
    '<label class="field"><span>Notes / journal</span><textarea class="inp" id="notes-' + date + '" data-in="notes" placeholder="What went well, what felt off, anything to remember">' + esc(l.notes || '') + '</textarea></label>' +
    photosHTML(date, l) +
    '<div class="statusbtns"><button class="btn c" data-a="status" data-v="complete" aria-pressed="' + (l.status === 'complete') + '">' + I.check + 'Complete</button><button class="btn s" data-a="status" data-v="skipped" aria-pressed="' + (l.status === 'skipped') + '">Skipped</button></div>' +
    (l.status === 'modified' || l.status === 'skipped' ? '<div class="field"><span>Reason</span><div class="chips">' + REASONS.map(r => '<button class="chip" data-a="reason" data-v="' + r + '" aria-pressed="' + (l.reason === r || (l.reason || '').startsWith(r + ':')) + '">' + r + '</button>').join('') + '</div><input class="inp" id="reason" style="margin-top:6px" placeholder="What changed and why" value="' + esc(l.reason || '') + '" data-in="lg" data-k="reason"></div>' : '') +
    '</div></section>';
}

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

/* ================= Calendar & list ================= */
function stDots(date) {
  return peopleIds().slice(0, 4).map(pid => {
    const st = dayState(pid, date);
    const cls = doneStates.has(st) || st === 'restdone' ? 'f' : st === 'skipped' ? 'x' : '';
    if (!cls && st !== 'missed') return '';
    return '<i class="' + cls + '" style="--pc:' + pcolor(pid) + '" title="' + esc(pname(pid) + ': ' + STATE_LABEL[st]) + '"></i>';
  }).join('');
}
function stMark(pid, date) {
  const st = dayState(pid, date);
  const map = { complete: 's-complete', modified: 's-modified', partial: 's-modified', skipped: 's-skipped', missed: 's-missed', restdone: 's-complete' };
  if (!map[st]) return '';
  return '<span class="stmark ' + map[st] + '"><i></i>' + (peopleIds().length > 1 ? esc(pname(pid)) : esc(STATE_LABEL[st])) + '</span>';
}
function listRow(d) {
  const p = P(d); const t = todayISO();
  const marks = peopleIds().map(pid => stMark(pid, d)).filter(Boolean).join(' ');
  return '<button class="lrow k-' + p.kind + (d === t ? ' today' : '') + '" data-a="go-day" data-d="' + d + '"><span class="d">' + DOWS[dowOf(d)] + '<b>' + D(d).getUTCDate() + ' ' + MON[D(d).getUTCMonth()] + '</b></span>' +
    '<span class="s"><b>' + esc(p.day.heading) + '</b><small>' + esc(kindLabel(p)) + (p.day.km ? ' · ' + fmtKm(p.day.km) + ' km' : '') + ((p.day.badges || []).length ? ' · ' + (p.day.badges.includes('test') ? 'Benchmark' : 'Simulation') : '') + '</small></span><span class="row" style="gap:6px;justify-content:flex-end">' + marks + '</span></button>';
}
const CAL_MONTHS = ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01'];
function viewCalendar() {
  if (!S.order.length) return loadingView();
  const mode = LS.get('hx.calmode', 'month');
  const t = todayISO();
  let month = S.route.arg && /^\d{4}-\d{2}$/.test(S.route.arg) ? S.route.arg : (t < START() ? '2026-10' : t > RACE() ? '2027-01' : t.slice(0, 7));
  let h = '<div class="row"><div class="seg" role="group" aria-label="Calendar view"><button data-a="calmode" data-v="month" aria-pressed="' + (mode === 'month') + '">Month</button><button data-a="calmode" data-v="list" aria-pressed="' + (mode === 'list') + '">List</button></div><span style="flex:1"></span>' +
    (S.days[t] ? '<button class="btn sm" data-a="nav" data-v="today">Today</button>' : '') + '</div>';
  if (mode === 'list') {
    let body = '';
    const w0 = weekDates(0);
    if (w0.length) body += '<div class="wkh" id="wk-0"><b>Kick-off weekend</b><span class="muted small">' + esc(fmtDate(w0[0], false) + ' – ' + fmtDate(w0[w0.length - 1], false)) + '</span></div>' + w0.map(listRow).join('');
    for (let n = 1; n <= weekCount(); n++) {
      const w = weekDoc(n); if (!w) continue;
      body += '<div class="wkh" id="wk-' + n + '"><b>Week ' + n + '</b><span class="muted small">' + esc(w.dates) + ' · ' + esc(w.label) + ' · ' + fmtKm(w.km) + ' km</span></div>' + weekDates(n).map(listRow).join('');
    }
    return h + '<div class="list-w">' + body + '</div>';
  }
  const idx = CAL_MONTHS.indexOf(month);
  const y = +month.slice(0, 4), m = +month.slice(5, 7) - 1;
  h += '<section class="card calcard"><div class="cal-h"><button class="iconbtn" data-a="calmonth" data-v="' + (CAL_MONTHS[idx - 1] || '') + '" ' + (idx > 0 ? '' : 'disabled') + ' aria-label="Previous month">' + I.left + '</button><h2>' + MONTH_FULL[m] + ' <span class="muted" style="font-size:20px">' + y + '</span></h2><button class="iconbtn" data-a="calmonth" data-v="' + (CAL_MONTHS[idx + 1] || '') + '" ' + (idx < CAL_MONTHS.length - 1 ? '' : 'disabled') + ' aria-label="Next month">' + I.right + '</button></div>' +
    '<div class="mgrid" style="margin-top:12px">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => '<div class="dow">' + d + '</div>').join('');
  const first = month + '-01';
  let cur = mondayOf(first);
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
  while (cur <= lastDay || dowOf(cur) !== 1) {
    const inMonth = cur.slice(0, 7) === month;
    const p = S.days[cur] ? P(cur) : null;
    if (!p) h += '<div class="dc none"><span class="dn">' + D(cur).getUTCDate() + '</span></div>';
    else h += '<button class="dc k-' + p.kind + (cur === t ? ' today' : '') + (inMonth ? '' : ' out') + '" data-a="go-day" data-d="' + cur + '" aria-label="' + esc(fmtDate(cur) + ': ' + p.day.short) + '"><span class="dn">' + D(cur).getUTCDate() + '</span><span class="st">' + stDots(cur) + '</span>' +
      '<span class="kl f">' + esc(p.day.short) + '</span><span class="kl t">' + esc(p.day.tiny) + '</span>' + (p.day.km ? '<span class="km">' + fmtKm(p.day.km) + '</span>' : '') + '</button>';
    cur = addDays(cur, 1);
    if (cur > lastDay && dowOf(cur) === 1) break;
  }
  h += '</div><div class="hleg" style="margin-top:12px"><span><i class="dot" style="--pc:var(--k-strength)"></i>Strength</span><span><i class="dot" style="--pc:var(--k-hyrox)"></i>HYROX</span><span><i class="dot" style="--pc:var(--k-long)"></i>Long run</span><span><i class="dot" style="--pc:var(--k-race)"></i>Race</span>' +
    peopleIds().map(pid => '<span><i class="dot" style="--pc:' + pcolor(pid) + '"></i>' + esc(pname(pid)) + ' done</span>').join('') + '<span class="muted">Numbers = planned km</span></div></section>';
  return h;
}

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

/* ================= HYROX guide ================= */
function viewGuide() {
  const M = S.meta; if (!M) return loadingView();
  const G = M.info || {}; const sts = M.stations || [];
  const pid = S.pid; const r = pid ? raceOf(pid) : null; const lc = loadClass(r);
  const solo = !r || r.fmt === 'singles';
  const sp = pid ? planSplits(pid) : M.plans.A;
  const strip = sts.map((s, i) => '<span class="seg-run">1 km</span><span class="seg-st"><b>' + (i + 1) + '</b> ' + esc(s.name) + '</span>').join('');
  const stRows = sts.map((s, i) => '<tr><td class="mono">' + (i + 1) + '</td><td><b>' + esc(s.name) + '</b></td><td class="mono">' + esc(s.amount.toLocaleString('en-IN') + (s.unit === 'reps' ? ' reps' : ' m')) + '</td><td>' + esc(loadText(s.key, pid)) + '</td><td class="wrap">' + esc(s.standard) + '</td>' + (solo ? '<td class="num mono">' + (sp ? esc(sp.stations[s.key]) : '') + '</td>' : '') + '</tr>').join('');
  const L = k => LOADS[k];
  const wrow = (key, name, used, l, tgt, mine) => '<tr' + (mine ? ' class="cell-good"' : '') + '><td><b>' + esc(name) + '</b>' + (mine ? ' <span class="pill ok">Your race</span>' : '') + '<br><span class="small muted">' + esc(used) + '</span></td><td class="mono">' + l.push + ' kg</td><td class="mono">' + l.pull + ' kg</td><td class="mono">2 × ' + l.farm + ' kg</td><td class="mono">' + l.bag + ' kg</td><td class="mono">' + l.wb + ' kg · ' + tgt + '</td></tr>';
  const isMix = r && r.div === 'X';
  const wRows = wrow('W', 'Women', 'Singles Women Open · Doubles Women · Relay Women', L('W'), '2.70 m', r && !isMix && lc === 'W') +
    wrow('WP', 'Women Pro', 'Singles Women Pro · Doubles Women Pro', L('WP'), '2.70 m', r && !isMix && lc === 'WP') +
    wrow('M', 'Men', 'Singles Men Open · Doubles Men · Relay Men', L('M'), '3.00 m', !r || (!isMix && lc === 'M')) +
    wrow('MP', 'Men Pro', 'Singles Men Pro · Doubles Men Pro', L('MP'), '3.00 m', r && !isMix && lc === 'MP') +
    wrow('X', 'Mixed doubles', 'Doubles Mixed (one woman, one man)', L('M'), '2.70 m her · 3.00 m him', r && isMix && r.fmt === 'doubles') +
    '<tr' + (r && isMix && r.fmt === 'relay' ? ' class="cell-good"' : '') + '><td><b>Mixed relay</b>' + (r && isMix && r.fmt === 'relay' ? ' <span class="pill ok">Your race</span>' : '') + '<br><span class="small muted">Relay Mixed (two women, two men)</span></td><td colspan="5" class="small">The relay rulebook lists only Women and Men loads. Check your event\'s athlete guide for which weights mixed teams use.</td></tr>';
  const formats = [
    ['Singles', 'Women Open · Women Pro · Men Open · Men Pro', ['You run all 8 km and do all 8 stations yourself.', 'Open is the standard entry; Pro uses heavier loads (see the table).', 'Results are also ranked by age group, from 16–24 upwards in five-year bands.']],
    ['Doubles', 'Women · Women Pro · Men · Men Pro · Mixed', ['You run every 1 km together. Running ahead of your partner is a 1-minute penalty, and more than 3 of those puts you out of the competition.', 'Split each station however you like: one works while the other rests on their feet in the station area.', 'Burpee broad jumps: the next person starts with hands where the other\'s feet landed.', 'Sandbag lunges: pass the bag sideways or backwards, never forwards.', 'Wall balls: 100 reps in total, shared any way you choose.']],
    ['Relay', 'Women · Men · Mixed (2 women + 2 men)', ['A team of four. Each member runs 1 km and does the station after it, twice, so each person covers 2 of the 8 legs.', 'You can go in a fixed rotation or back to back; hand over in the Roxzone.', 'There\'s no Pro relay. Age groups go by the team\'s average age: under 40, or 40 and over.']],
    ['Adaptive', 'Thirteen divisions', ['For athletes with an impairment, with adjusted reps, loads and distances. See the adaptive rulebook on hyrox.com for your division.']],
    ['Elite 15 and Challenger', 'Invite only', ['The fastest 15 men and women race the Elite series. New for 2026/27: a Challenger division for athletes ranked 16–30.']]
  ];
  const fmtCards = formats.map(f => '<div class="' + (r && RACE_FORMATS[r.fmt] && RACE_FORMATS[r.fmt].name === f[0] ? 'note' : '') + '" style="' + (r && RACE_FORMATS[r.fmt] && RACE_FORMATS[r.fmt].name === f[0] ? '' : 'padding:2px 0') + '"><b>' + esc(f[0]) + '</b>' + (r && RACE_FORMATS[r.fmt] && RACE_FORMATS[r.fmt].name === f[0] ? ' <span class="pill ok">Yours</span>' : '') + '<br><span class="small muted">' + esc(f[1]) + '</span><ul class="small" style="margin:6px 0 0;padding-left:18px;color:var(--ink-2)">' + f[2].map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>').join('');
  const sources = [
    { t: 'HYROX Singles rulebook 2026/27', u: 'https://maintain.hyrox.com/rulebooks/HYROX_RulebookSingles_EN.pdf' },
    { t: 'HYROX Doubles rulebook 2026/27', u: 'https://maintain.hyrox.com/rulebooks/HYROX_RulebookDoubles_EN.pdf' },
    { t: 'HYROX Relay rulebook 2026/27', u: 'https://hyrox.mx/wp-content/uploads/2026/07/26_27_HYROX_RulebookRelay_EN_Final_240626.pdf' },
    { t: 'HYROX: The fitness race (formats and divisions)', u: 'https://hyrox.com/the-fitness-race/' }
  ];
  const title = r ? 'HYROX ' + raceLabel(r) : (M.title || 'HYROX');
  const canEdit = pid && (pid === S.uid || isAdmin());
  return '<div><span class="eyebrow">Reference</span><h2 class="disp" style="font-size:40px;text-transform:uppercase;margin-top:4px">HYROX guide</h2><p style="max-width:62ch;margin-top:8px;font-size:16px;color:var(--ink-2)">' + esc(G.lead || '') + '</p></div>' +
    '<section class="card k-race" style="background:var(--k-race-tint);border-color:transparent"><div class="row"><div style="flex:1;min-width:220px"><span class="eyebrow" style="color:var(--k-race)">' + (pid && pid !== S.uid ? esc(pname(pid)) + '\'s race' : 'Your race') + '</span><h3 class="disp" style="font-size:30px;text-transform:uppercase;margin:6px 0 4px">' + esc(title) + '</h3><p class="small">Friday 15 January 2027' + (pid ? ' · Plan ' + planOf(pid) + ' (' + esc(sp.finish) + ')' : '') + '</p><p class="small" style="margin-top:4px;color:var(--ink-2)">' + esc(loadsSummary(lc)) + '</p></div><div class="row"><button class="btn" data-a="tool" data-t="race">' + I.flag + 'Race-day mode</button>' + (canEdit ? '<button class="btn" data-a="nav" data-v="settings">Change race</button>' : '') + '</div></div></section>' +
    '<section class="card"><div class="card-h"><h3>The format</h3><span class="sp"></span><span class="small muted">8 km running · 8 stations · one order, every event</span></div><div class="course">' + strip + '<span class="seg-fin">Finish</span></div>' +
    '<p class="small muted" style="margin-top:10px">' + esc(G.roxzone || '') + '</p></section>' +
    '<section class="card"><div class="card-h"><h3>Stations</h3><span class="sp"></span><span class="small muted">' + esc(loadsLabel(r)) + ' loads' + (solo ? ' · target for your plan' : '') + '</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Station</th><th>Distance</th><th>Load</th><th>Standard that costs time</th>' + (solo ? '<th class="num">Target</th>' : '') + '</tr></thead><tbody>' + stRows + '</tbody></table></div>' +
    '<div class="cues" style="margin-top:12px">' + sts.map(s => '<details class="cue"><summary>' + esc(s.name) + ' tips</summary><p>' + esc(s.cue) + '</p></details>').join('') + '</div></section>' +
    '<section class="card"><div class="card-h"><h3>Ways to race</h3><span class="sp"></span><span class="small muted">Same course and stations in every format</span></div><div class="stack">' + fmtCards + '</div></section>' +
    '<section class="card"><div class="card-h"><h3>Weights by division</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Loads</th><th>Sled push</th><th>Sled pull</th><th>Farmers carry</th><th>Sandbag</th><th>Wall ball · target</th></tr></thead><tbody>' + wRows + '</tbody></table></div>' +
    '<p class="small muted" style="margin-top:8px">Sled weights include the sled. SkiErg and row are 1,000 m, burpee broad jumps 80 m and wall balls 100 reps in every division. Doubles and relay teams share the same totals; the loads don\'t get lighter.</p></section>' +
    '<section class="card"><div class="card-h"><h3>Rules that cost time</h3></div><ul class="small stack" style="padding-left:18px;margin:0">' + (G.rules || []).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></section>' +
    '<section class="card"><div class="card-h"><h3>Race-day timeline</h3></div><div class="stack">' + ((M.raceWeek && M.raceWeek.timeline) || []).map(x => '<div class="row" style="align-items:flex-start;flex-wrap:nowrap"><b class="mono" style="min-width:86px">' + esc(x.t) + '</b><span class="small">' + esc(x.what) + '</span></div>').join('') + '</div><p class="small muted" style="margin-top:10px">' + esc((M.raceWeek && M.raceWeek.rules) || '') + '</p></section>' +
    nutRaceCard() + '<section class="card"><div class="card-h"><h3>Sources</h3><span class="sp"></span><span class="small muted">Checked 25 Sep 2026</span></div><ul class="small stack" style="padding-left:18px;margin:0">' + sources.map(s => '<li><a href="' + esc(s.u) + '" target="_blank" rel="noopener">' + esc(s.t) + '</a></li>').join('') + '</ul></section>';
}

/* ================= Together ================= */
function weekHighlights(pid, n) {
  const ds = weekDates(n); const out = [];
  strengthEntries(pid).filter(e => ds.includes(e.date) && e.top > 0).forEach(e => { const b = bestLoadBefore(pid, e.name, e.date); if (b != null && e.top > b) out.push('PR ' + e.name.replace(/\s*\(.*?\)/, '') + ' ' + e.top + ' kg'); });
  const rs = runsOf(pid).filter(r => ds.includes(r.date));
  if (rs.length) { const lr = rs.reduce((a, b) => b.dist > a.dist ? b : a); out.push('Longest run ' + fmtKm(lr.dist) + ' km'); }
  const B = (S.meta && S.meta.benchmarks) || []; const res = (S.bench[pid] || {}).results || {};
  B.filter(b => ds.includes(b.date) && res[b.id] && res[b.id].v).forEach(b => { const st = benchStatus(b, res[b.id]); out.push(b.name + ': ' + res[b.id].v + (st ? ' (' + st.txt + ')' : '')); });
  return out.slice(0, 3);
}
function wkDotsHTML(pid, n) {
  const t = todayISO();
  const col = { complete: 'var(--done)', modified: 'var(--mod)', partial: 'var(--mod)', skipped: 'repeating-linear-gradient(45deg,var(--skip) 0 3px,var(--skip-tint) 3px 6px)', rest: 'var(--k-rest-tint)', restdone: 'var(--k-rest-tint)', missed: 'var(--surface)', future: 'var(--surface-2)', today: 'var(--surface)' };
  return '<div class="wkdots">' + weekDates(n).map(d => {
    const st = dayState(pid, d);
    const ring = st === 'missed' ? 'box-shadow:inset 0 0 0 2px var(--miss)' : st === 'today' ? 'box-shadow:inset 0 0 0 2px var(--accent)' : st === 'restdone' ? 'box-shadow:inset 0 0 0 2px var(--done)' : (st === 'future' || st === 'rest') ? 'box-shadow:inset 0 0 0 1px var(--line)' : '';
    return '<div><i style="background:' + col[st] + ';' + ring + '" data-tip="' + esc(pname(pid) + ' · ' + fmtDate(d) + '\n' + S.days[d].short + ': ' + STATE_LABEL[st]) + '"></i>' + DOWS[dowOf(d)][0] + '</div>';
  }).join('') + '</div>';
}
function viewTogether() {
  if (!S.order.length) return loadingView();
  const ids = peopleIds(); const t = todayISO();
  const n = pickWeek();
  const w = weekDoc(n);
  const tp = S.days[t] ? P(t) : null;
  let headline;
  if (!tp) headline = t < START() ? 'Training starts Monday. Pick your profiles and get your bags ready.' : 'Season complete. Well trained, both of you.';
  else if (tp.rest) headline = 'Rest day for everyone. A walk counts as a win.';
  else {
    const done = ids.filter(pid => doneStates.has(dayState(pid, t)));
    if (ids.length > 1 && done.length === ids.length) headline = 'Everyone has trained today. Nice work.';
    else if (done.length) headline = done.map(pname).join(' and ') + (done.length > 1 ? ' have' : ' has') + ' trained today. ' + ids.filter(x => !done.includes(x)).map(pname).join(' and ') + ', your session is ' + tp.day.heading + '.';
    else headline = 'Today is ' + tp.day.heading + '. Nobody has logged it yet.';
  }
  const stats = ids.map(pid => ({ pid, ws: weekStats(pid, n), st: streaks(pid), hl: weekHighlights(pid, n) }));
  const combKm = sum(stats.map(s => s.ws.km));
  const cards = stats.map(s => {
    const today = tp ? dayState(s.pid, t) : null;
    return '<section class="card person" style="--pc:' + pcolor(s.pid) + '"><div class="row"><span class="nm">' + esc(pname(s.pid)) + '</span>' + (s.pid === S.pid ? '<span class="pill">You</span>' : '') + '<span class="sp" style="flex:1"></span>' +
      (today ? '<span class="pill ' + (doneStates.has(today) ? 'ok' : today === 'skipped' ? '' : today === 'rest' || today === 'restdone' ? '' : 'warn') + '">Today: ' + esc(STATE_LABEL[today]) + '</span>' : '') + (tp ? (() => { const sc = dayScore(s.pid, t); return sc && sc.score != null && (sc.score > 0 || tp.rest) ? '<span class="pill">Score ' + sc.score + '</span>' : ''; })() : '') + '</div>' +
      wkDotsHTML(s.pid, n) +
      '<div class="tiles" style="margin-top:12px;grid-template-columns:repeat(3,minmax(0,1fr))"><div class="tile" style="border:0;background:var(--surface-2)"><span>Running</span><b>' + fmtKm(s.ws.km) + '<small>km</small></b>' + (s.ws.pkm ? '<span class="pl">of ' + fmtKm(s.ws.pkm) + '</span>' : '') + '</div>' +
      '<div class="tile" style="border:0;background:var(--surface-2)"><span>Sessions</span><b>' + s.ws.done + '<small>/ ' + s.ws.planned + '</small></b></div><div class="tile" style="border:0;background:var(--surface-2)"><span>Streak</span><b>' + s.st.cur + '<small>days</small></b></div></div>' +
      (s.hl.length ? '<ul class="small" style="margin:10px 0 0;padding-left:18px">' + s.hl.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') + '</section>';
  }).join('');
  const invite = '<section class="card flat"><p class="small">' + (ids.length < 2 ? 'Training with someone? ' : '') + 'Send them the link. They sign in with Google, set up their profile once, and log on their own phone. Everyone\'s progress shows up here.</p></section>';
  const weeks = []; for (let i = 1; i <= Math.min(weekCount(), Math.max(currentWeekN(), 1)); i++) weeks.push(i);
  const chart = ids.length && S.order[0] <= t ? '<section class="card"><div class="card-h"><h3>Weekly running</h3></div>' + chartBox({ type: 'bar', label: 'Weekly running per person', x: weeks.map(i => 'W' + i), series: [{ name: 'Planned', ghost: true, vals: weeks.map(i => (weekDoc(i) || {}).km || 0) }].concat(ids.map(pid => ({ name: pname(pid), color: pcolor(pid), vals: weeks.map(i => +weekStats(pid, i).km.toFixed(1)) }))), yFmt: v => v + '' }, 220) + '</section>' : '';
  return '<h2 class="disp" style="font-size:34px;text-transform:uppercase">Together</h2><div class="row" style="flex-wrap:nowrap"><button class="iconbtn" data-a="wk" data-v="' + (n - 1) + '" ' + (n > minWeek() ? '' : 'disabled') + ' aria-label="Previous week">' + I.left + '</button><span class="small" style="flex:1;text-align:center"><b>' + weekName(n) + '</b>' + (w ? '<br><span class="muted">' + esc(w.dates) + '</span>' : '') + '</span><button class="iconbtn" data-a="wk" data-v="' + (n + 1) + '" ' + (n < weekCount() ? '' : 'disabled') + ' aria-label="Next week">' + I.right + '</button></div>' +
    '<p style="font-size:17px;max-width:60ch">' + esc(headline) + (ids.length > 1 && combKm ? ' Together you\'ve run <b>' + fmtKm(combKm) + ' km</b> ' + (n === 0 ? 'over the kick-off weekend' : 'in week ' + n) + '.' : '') + '</p>' +
    '<div class="people">' + cards + '</div>' + achievementsCard() + togetherPhotos() + invite + chart +
    '<section class="card"><div class="card-h"><h3>Weekly recap</h3><span class="sp"></span>' + (S.dl ? '<button class="btn sm" data-a="recap-png" data-n="' + n + '">Save as image</button>' : '') + '</div>' + recapCard(n, stats, w) + '<p class="small muted" style="margin-top:10px">Screenshot it or save the image to share in your chat.</p></section>';
}
function recapCard(n, stats, w) {
  const comb = sum(stats.map(s => s.ws.km));
  return '<div class="recap" id="recap"><div class="rh"><b>' + weekName(n) + '</b><span>' + esc(w ? w.dates : '') + '<br>' + esc(w ? w.label : '') + '</span></div>' +
    '<div class="rp">' + stats.map(s => '<div style="--pc:' + pcolor(s.pid) + '"><div class="n">' + esc(pname(s.pid)) + '</div><div class="k">' + fmtKm(s.ws.km) + '</div><small>km run of ' + fmtKm(s.ws.pkm) + ' planned</small><small>' + s.ws.done + '/' + s.ws.planned + ' sessions · ' + s.st.cur + '-day streak</small>' + (s.hl[0] ? '<small>' + esc(s.hl[0]) + '</small>' : '') + '</div>').join('') + '</div>' +
    (stats.length > 1 ? '<div class="hl">' + fmtKm(comb) + ' km together this week.</div>' : '') + '<div class="brand">16 Weeks to HYROX · Race day Fri 15 Jan 2027</div></div>';
}
async function recapPNG(n) {
  const ids = peopleIds(); const stats = ids.map(pid => ({ pid, ws: weekStats(pid, n), st: streaks(pid), hl: weekHighlights(pid, n) })); const w = weekDoc(n);
  try { await document.fonts.load('800 60px "Big Shoulders Display"'); await document.fonts.load('600 20px "IBM Plex Sans"'); } catch (e) { }
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const cs = getComputedStyle(document.documentElement); const v = k => cs.getPropertyValue(k).trim();
  g.fillStyle = '#14171A'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#C24D17'; g.fillRect(0, 0, W, 14);
  g.fillStyle = '#FFFFFF'; g.font = '800 170px "Big Shoulders Display", Impact, sans-serif'; g.textBaseline = 'alphabetic';
  g.fillText(n === 0 ? 'KICK-OFF' : 'WEEK ' + n, 72, 250);
  g.font = '600 34px "IBM Plex Sans", sans-serif'; g.fillStyle = 'rgba(255,255,255,.72)';
  g.fillText((w ? w.dates + ' · ' + w.label : '').toUpperCase(), 76, 312);
  const colW = (W - 144 - (stats.length - 1) * 40) / Math.max(1, stats.length);
  stats.slice(0, 3).forEach((s, i) => {
    const x = 72 + i * (colW + 40), y = 420;
    const pc = v('--p-' + ((S.profiles[s.pid] || {}).color || 'blue')) || '#2a78d6';
    g.fillStyle = pc; g.fillRect(x, y, colW, 10);
    g.fillStyle = '#FFFFFF'; g.font = '700 40px "IBM Plex Sans", sans-serif'; g.fillText(pname(s.pid), x, y + 70);
    g.font = '800 190px "Big Shoulders Display", Impact, sans-serif'; g.fillText(fmtKm(s.ws.km), x, y + 250);
    g.font = '500 32px "IBM Plex Sans", sans-serif'; g.fillStyle = 'rgba(255,255,255,.75)';
    const lines = [s.ws.pkm ? 'km of ' + fmtKm(s.ws.pkm) + ' planned' : 'km run', s.ws.done + '/' + s.ws.planned + ' sessions', s.st.cur + '-day streak'].concat(s.hl.slice(0, 2));
    lines.forEach((ln, k) => { let t = ln; while (g.measureText(t).width > colW && t.length > 4) t = t.slice(0, -2); if (t !== ln) t += '…'; g.fillText(t, x, y + 310 + k * 46); });
  });
  if (stats.length > 1) { g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(72, 1090, W - 144, 2); g.fillStyle = '#FFFFFF'; g.font = '600 40px "IBM Plex Sans", sans-serif'; g.fillText(fmtKm(sum(stats.map(s => s.ws.km))) + ' km together this week', 72, 1160); }
  g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '600 26px "IBM Plex Sans", sans-serif'; g.fillText('16 WEEKS TO HYROX · RACE DAY FRI 15 JAN 2027', 72, 1270);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  if (!blob) { toast("Couldn't draw the image. Take a screenshot instead."); return; }
  saveFile('hyrox-week-' + n + '-recap.png', blob);
}

/* ================= Sheets & tools ================= */
let SHEET = null; // {kind, opts}
function openSheet(kind, opts = {}) { SHEET = { kind, opts }; renderSheet(); }
function closeSheet() { PICK = null; if (SHEET && SHEET.kind === 'gswap') S.swapForm = null; if (SHEET && SHEET.kind === 'share') SHARE = null; if (SHEET && SHEET.kind === 'editor') ED = null; if (SHEET && SHEET.kind === 'member') { S.memForm = null; S.memConfirm = null; } SHEET = null; const el = $('#sheet'); el.hidden = true; el.innerHTML = ''; document.body.style.overflow = ''; }
function renderSheet() {
  const el = $('#sheet'); if (!SHEET) { el.hidden = true; return; }
  const f = { phview: sheetPhoto, who: sheetWho, setup: sheetSetup, editor: sheetEditor, member: sheetMember, pace: sheetPace, race: sheetRace, tools: sheetTools, share: sheetShare, tg: sheetTg, gmove: sheetMove, gcatch: sheetCatch, gswap: sheetSwap, pick: sheetPick }[SHEET.kind];
  if (!f) return;
  const r = PICK ? sheetPick() : f(SHEET.opts);
  const scroll = el.querySelector('.panel') ? el.querySelector('.panel').scrollTop : 0, tabsWas = tabsSave(el, SHEET.kind);
  el.innerHTML = '<div class="panel' + (r.full ? ' full' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(r.title) + '"><div class="sheet-h"><h2>' + r.title + '</h2>' + (r.noClose ? '' : '<button class="iconbtn" data-a="close" aria-label="Close">' + I.close + '</button>') + '</div>' + r.body + '</div>';
  keepOpen(el); el.hidden = false; document.body.style.overflow = 'hidden'; tabsRestore(el, tabsWas, SHEET.kind);
  const p = el.querySelector('.panel'); if (p) p.scrollTop = scroll;
  drawCharts();
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && SHEET && SHEET.kind !== 'setup') { if (PICK) gymPickClose(null); else closeSheet(); }
  if (e.key === 'Enter' && e.target && e.target.dataset && e.target.dataset.xl) { e.preventDefault(); ACT['xl-add']({ dataset: { g: e.target.dataset.xl } }); }
  if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.classList && (e.target.classList.contains('foldh') || e.target.classList.contains('exfold'))) { e.preventDefault(); ACT[e.target.dataset.a](e.target); }
});
async function saveFile(filename, data) {
  if (!S.dl) { toast("Saving files isn't available in this view."); return false; }
  try { await S.dl.save({ filename, data }); return true; }
  catch (e) { if (e && e.code === 'declined') return false; if (e && e.code === 'rate_limited') toast('A save is already waiting for your answer.'); else toast("Couldn't save the file" + (e && e.code ? ' (' + e.code + ')' : '') + '.'); return false; }
}

/* ---------- more menu ---------- */
function sheetTools() {
  const b = (a, t, ic, label, sub) => '<button class="toolbtn" data-a="' + a + '" ' + t + '>' + ic + '<span>' + label + (sub ? '<br><span class="small muted" style="font-weight:500">' + sub + '</span>' : '') + '</span></button>';
  return { title: 'More', body: '<div class="toolgrid">' + b('nav', 'data-v="guide"', I.info, 'HYROX guide', 'Format, stations, weights, rules, race day') + b('nav', 'data-v="photos"', I.photo, 'Photos', 'Everyone’s session photos') + b('sub', 'data-v="progress" data-s="score"', I.chart, 'Score history', 'Your daily scores, week by week') + b('sub', 'data-v="progress" data-s="badges"', I.medal || I.chart, 'Achievements', 'What you have earned so far') + '</div>' };
}

/* ---------- first sign-in: set up your profile ---------- */
function sheetSetup() {
  const ids = peopleIds();
  const old = S.profiles[S.uid] || {};
  const nf = S.newForm || { name: old.name || (S.viewerName ? S.viewerName.split(' ')[0] : ''), color: old.color || PCOLORS.find(c => !ids.some(id => S.profiles[id].color === c)) || 'blue', plan: old.plan || 'A', race: clone(old.race) || {} };
  if (!nf.race) nf.race = {};
  S.newForm = nf;
  return { title: 'Set up your profile', noClose: true, body: (old.name ? '<div class="warnbox" style="margin-bottom:10px"><div><b>One new question: which race are you doing?</b>Pick your format and division so the guide and targets show your weights.</div></div>' : '') + '<p class="small muted">You only do this once. After this, signing in with <b>' + esc(S.email || 'this Google account') + '</b> opens your own log straight away.</p><div class="stack">' +
    '<label class="field"><span>Your name</span><input class="inp" id="nf-name" value="' + esc(nf.name) + '" placeholder="First name" data-in="nf" data-k="name" autocomplete="given-name"></label>' +
    '<div class="field"><span>Your colour</span><div class="swatches">' + PCOLORS.map(c => '<button class="swatch" style="--pc:var(--p-' + c + ')" data-a="nf-color" data-v="' + c + '" aria-pressed="' + (nf.color === c) + '" aria-label="' + c + '"></button>').join('') + '</div></div>' +
    '<section class="card" style="padding:14px"><div class="stack">' + racePickerHTML(nf.race, 'nf') + '</div></section>' +
    '<div class="field"><span>Race plan</span><div class="seg">' + ['A', 'B', 'C'].map(k => '<button data-a="nf-plan" data-v="' + k + '" aria-pressed="' + (nf.plan === k) + '">Plan ' + k + '</button>').join('') + '</div><span class="small muted" style="font-weight:400">A 1:29 goal · B 1:34 base case · C 1:40. You can change it any time in Settings.</span></div>' +
    '<button class="btn primary lg" data-a="create-person">Start tracking</button></div>' };
}
/* ---------- admins: open anyone's log ---------- */
function sheetWho() {
  const ids = peopleIds();
  const list = ids.map(pid => '<button class="toolbtn" style="min-height:64px" data-a="choose" data-v="' + pid + '"><span class="dot" style="--pc:' + pcolor(pid) + ';width:20px;height:20px"></span><span style="flex:1"><b style="font-size:18px">' + esc(pname(pid)) + '</b>' + (pid === S.uid ? '<br><span class="small muted">You</span>' : '') + '</span>' + (pid === S.pid ? '<span class="pill ok">Showing</span>' : '') + '</button>').join('');
  return { title: 'View or edit as', body: (adminOnly() ? '<p class="small">This admin account doesn\'t train, so it has no log of its own. Pick whose log to open.</p>' : '') + '<p class="small muted">As admin you can open anyone\'s log and change it. Everyone else can only change their own, and sees other people in Together and Progress.</p><div class="stack">' + list + '</div>' };
}

/* ---------- members ---------- */
function sheetMember(o) {
  const isNew = !o.pid; const ids = peopleIds();
  if (!S.memForm) S.memForm = isNew ? { name: '', color: PCOLORS.find(c => !ids.some(id => S.profiles[id].color === c)) || 'blue', plan: 'A' } : clone(S.profiles[o.pid]);
  const f = S.memForm; const p = o.pid ? S.profiles[o.pid] : null;
  return { title: isNew ? 'Add member' : 'Edit ' + esc(p ? p.name : 'member'), body: '<div class="stack">' +
    '<label class="field"><span>Name</span><input class="inp" id="mem-name" value="' + esc(f.name || '') + '" placeholder="First name" data-in="mem" data-k="name"></label>' +
    '<div class="field"><span>Colour</span><div class="swatches">' + PCOLORS.map(c => '<button class="swatch" style="--pc:var(--p-' + c + ')" data-a="mem-color" data-v="' + c + '" aria-pressed="' + (f.color === c) + '" aria-label="' + c + '"></button>').join('') + '</div></div>' +
    '<div class="field"><span>Race plan</span><div class="seg">' + ['A', 'B', 'C'].map(k => '<button data-a="mem-plan" data-v="' + k + '" aria-pressed="' + ((f.plan || 'A') === k) + '">Plan ' + k + '</button>').join('') + '</div></div>' +
    (isNew ? '<p class="small muted">They pick their name the first time they sign in, and it links to their Google account from then on.</p>' : '') +
    '<div class="flexend">' + (!isNew ? (S.memConfirm === o.pid ? '<span class="small" style="align-self:center">Their logs are kept and come back if you restore them.</span><button class="btn" style="border-color:var(--miss);color:var(--miss)" data-a="mem-remove" data-v="' + o.pid + '">Yes, remove</button>' : '<button class="btn ghost" style="color:var(--miss)" data-a="mem-remove-ask" data-v="' + o.pid + '">Remove member</button>') : '') +
    '<button class="btn primary" data-a="mem-save" data-v="' + (o.pid || '') + '">' + (isNew ? 'Add member' : 'Save') + '</button></div></div>' };
}
function saveMember(pid) {
  const f = S.memForm || {}; const name = ($('#mem-name') ? $('#mem-name').value : f.name || '').trim();
  if (!name) { toast('Type a name first.'); return; }
  if (!pid) {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) + '-' + Math.random().toString(36).slice(2, 6);
    if (put('profiles', id, { name, color: f.color || 'blue', plan: f.plan || 'A', created: new Date().toISOString() })) toast(name + ' added. Share the tracker with them so they can log.');
  } else {
    const cur = clone(S.profiles[pid]) || {}; cur.name = name; cur.color = f.color || cur.color; cur.plan = f.plan || cur.plan; delete cur.removed;
    if (put('profiles', pid, cur)) toast('Saved');
  }
  S.memForm = null; closeSheet(); render();
}

/* ---------- plan editor (structured) ---------- */
let ED = null;
const STD_FIELDS = ['SESSION', 'OBJECTIVE', 'WARM-UP', 'MAIN STRENGTH', 'RUNNING', 'HYROX WORK', 'ACCESSORY/CORE', 'COOLDOWN', 'TOTAL SESSION TIME', 'TARGET RPE', 'KEY COACHING NOTES'];
const FIELD_NAME = { 'SESSION': 'Session', 'OBJECTIVE': 'Objective', 'WARM-UP': 'Warm-up', 'RUNNING': 'Running', 'COOLDOWN': 'Cooldown', 'TOTAL SESSION TIME': 'Total session time', 'TARGET RPE': 'Target RPE', 'KEY COACHING NOTES': 'Coaching notes', 'REST / RECOVERY': 'Rest / recovery' };
function splitEx(item) {
  const parts = item.split(/\s+—\s+/); const o = { name: parts[0].trim(), sets: '', reps: '', load: '', rest: '' }; let iSR = -1;
  for (let i = 1; i < parts.length; i++) { const m = parts[i].match(/^(\d+)\s*×\s*(.+)$/); if (m) { o.sets = m[1]; o.reps = m[2].trim(); iSR = i; break; } }
  let end = parts.length;
  if (iSR > -1 && iSR < parts.length - 1 && /^(\d+(?:\.\d+)?(?:\s*[–-]\s*\d+(?:\.\d+)?)?\s*(s|min)\b|\d+:\d\d)/.test(parts[parts.length - 1])) { o.rest = parts[parts.length - 1]; end = parts.length - 1; }
  o.load = parts.slice(iSR === -1 ? 1 : iSR + 1, end).join(' — ');
  return o;
}
function joinEx(e) { const sr = e.sets && e.reps ? e.sets + ' × ' + e.reps : (e.reps || (e.sets ? e.sets + ' sets' : '')); return [e.name.trim(), sr, (e.load || '').trim(), (e.rest || '').trim()].filter(Boolean).join(' — '); }
function edInit(date, focus) {
  const d = clone(S.days[date]); const fl = n => d.fields.find(x => x.label === n);
  const sf = fl('MAIN STRENGTH'), hf = fl('HYROX WORK'), af = fl('ACCESSORY/CORE');
  const txt = {}; d.fields.forEach(f => { if (!['MAIN STRENGTH', 'HYROX WORK', 'ACCESSORY/CORE'].includes(f.label)) txt[f.label] = f.text || (f.items || []).join('; '); });
  ED = { date, d, txt, qual: hf ? hf.qual || '' : '', ex: ((sf && sf.items) || []).map(splitEx), orig: ((sf && sf.items) || []).map(x => x.split(/\s+—\s+/)[0].trim()),
    hx: hf ? ((hf.items && hf.items.length) ? hf.items.slice() : (!isNone(hf.text) ? [hf.text] : [])) : [], acc: af ? parseList(af.text || (af.items || []).join('; ')) : [], hb: { st: 'push', sets: '4', amt: '12.5', unit: 'm', load: '', rest: '90 s' } };
  if (focus === 'add-ex') ED.ex.push({ name: '', sets: '3', reps: '10', load: '', rest: '90 s' });
}
function edMove(arr, i, d) { const j = i + d; if (j < 0 || j >= arr.length) return; const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
function sheetEditor(o) {
  if (!ED || ED.date !== o.date) edInit(o.date, o.focus);
  const d = ED.d; if (!d) return { title: 'Edit plan', body: '<p>Day not found.</p>' };
  const inp = (g, i, k, v, ph, cls) => '<input class="inp' + (cls ? ' ' + cls : '') + '" id="ed-' + g + '-' + i + '-' + k + '" value="' + esc(v) + '" placeholder="' + esc(ph || '') + '" data-in="ed" data-g="' + g + '" data-i="' + i + '" data-k="' + k + '">';
  const mv = (g, i, n) => '<div class="row" style="gap:6px"><button class="btn sm" data-a="ed-mv" data-g="' + g + '" data-i="' + i + '" data-v="-1"' + (i ? '' : ' disabled') + ' aria-label="Move up">↑</button><button class="btn sm" data-a="ed-mv" data-g="' + g + '" data-i="' + i + '" data-v="1"' + (i < n - 1 ? '' : ' disabled') + ' aria-label="Move down">↓</button><button class="btn sm ghost" style="color:var(--miss)" data-a="ed-del" data-g="' + g + '" data-i="' + i + '">Remove</button></div>';
  const exRows = ED.ex.map((e, i) => '<div class="entry"><label class="field"><span>Exercise ' + (i + 1) + '</span>' + inp('ex', i, 'name', e.name, 'e.g. Back squat') + '</label>' +
    '<div class="fgrid" style="grid-template-columns:70px minmax(0,1fr)"><label class="field"><span>Sets</span>' + inp('ex', i, 'sets', e.sets, '3', 'mono') + '</label><label class="field"><span>Reps (or 30 s, 50 m, 10/side)</span>' + inp('ex', i, 'reps', e.reps, '10', 'mono') + '</label></div>' +
    '<div class="fgrid" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr)"><label class="field"><span>Load / effort</span>' + inp('ex', i, 'load', e.load, '50 kg, RPE 7 · 2 × 24 kg · bodyweight') + '</label><label class="field"><span>Rest</span>' + inp('ex', i, 'rest', e.rest, '90 s') + '</label></div>' + mv('ex', i, ED.ex.length) + '</div>').join('');
  const hxRows = ED.hx.map((t, i) => '<div class="entry">' + inp('hx', i, 't', t, 'Sled push — 4 × 12.5 m — 100 kg — 90 s') + mv('hx', i, ED.hx.length) + '</div>').join('');
  const accRows = ED.acc.map((t, i) => '<div class="row" style="flex-wrap:nowrap">' + inp('acc', i, 't', t, 'Dead bug — 3 × 10/side') + '<button class="btn sm ghost" style="color:var(--miss)" data-a="ed-del" data-g="acc" data-i="' + i + '" aria-label="Remove">' + I.close + '</button></div>').join('');
  const hb = ED.hb;
  const tfield = lab => '<label class="field"><span>' + esc(FIELD_NAME[lab] || lab) + '</span><textarea class="inp" id="ed-f-' + lab.replace(/[^A-Z]/g, '') + '" rows="' + (lab === 'RUNNING' || lab === 'KEY COACHING NOTES' ? 3 : 2) + '" data-in="ed" data-g="f" data-k="' + esc(lab) + '">' + esc(ED.txt[lab] || '') + '</textarea></label>';
  const labels = STD_FIELDS.filter(l => !['MAIN STRENGTH', 'HYROX WORK', 'ACCESSORY/CORE'].includes(l));
  const restTxt = d.kind === 'rest' || ED.txt['REST / RECOVERY'] != null ? tfield('REST / RECOVERY') : '';
  return { title: 'Edit ' + esc(fmtDate(o.date)), full: true, body: '<div class="warnbox"><div><b>Changes apply to everyone on this tracker.</b>Anything already logged stays with its exercise, even if you reorder or rename others.</div></div>' +
    '<section class="card"><div class="card-h"><h3>Day</h3></div><div class="fgrid"><label class="field"><span>Heading</span><input class="inp" id="ed-heading" value="' + esc(d.heading) + '" data-in="ed" data-g="d" data-k="heading"></label><label class="field"><span>Calendar label</span><input class="inp" id="ed-short" value="' + esc(d.short) + '" data-in="ed" data-g="d" data-k="short"></label><label class="field"><span>Planned km</span><input class="inp mono" id="ed-km" inputmode="decimal" value="' + esc(d.km) + '" data-in="ed" data-g="d" data-k="km"></label>' +
    '<label class="field"><span>Type</span><select class="inp" id="ed-kind" data-in="ed" data-g="d" data-k="kind">' + ['pull', 'push', 'legs', 'hyrox', 'long', 'rest', 'race'].map(k => '<option value="' + k + '"' + (d.kind === k ? ' selected' : '') + '>' + esc(KIND_LABEL[k]) + '</option>').join('') + '</select></label></div>' + (d.kind === 'rest' ? '<p class="small muted" style="margin-top:8px">Rest days show the rest screen. Change the type to plan a workout on this day.</p>' : '') + '</section>' +
    '<section class="card" id="ed-strength"><div class="card-h"><h3>Main strength</h3><span class="sp"></span><span class="small muted">' + ED.ex.length + ' exercises</span></div><div class="stack">' + (exRows || '<p class="empty">No exercises on this day.</p>') + '</div><div class="row" style="margin-top:10px"><button class="btn" data-a="ed-pick" data-g="ex">' + I.plus + 'Add exercise</button></div></section>' +
    '<section class="card"><div class="card-h"><h3>HYROX work</h3></div><div class="stack">' + (hxRows || '<p class="empty">No HYROX work on this day.</p>') + '</div>' +
    '<div class="entry" style="margin-top:10px;background:var(--surface-2)"><b class="small">Add a station</b><div class="fgrid" style="grid-template-columns:repeat(auto-fit,minmax(96px,1fr))"><label class="field"><span>Station</span><select class="inp" id="hb-st" data-in="ed" data-g="hb" data-k="st">' + ST_KEYS.map(k => '<option value="' + k + '"' + (hb.st === k ? ' selected' : '') + '>' + esc(stName(k)) + '</option>').join('') + '</select></label>' +
    '<label class="field"><span>Sets</span><input class="inp mono" id="hb-sets" value="' + esc(hb.sets) + '" data-in="ed" data-g="hb" data-k="sets"></label><label class="field"><span>Each (m or reps)</span><input class="inp mono" id="hb-amt" value="' + esc(hb.amt) + '" data-in="ed" data-g="hb" data-k="amt"></label>' +
    '<label class="field"><span>Load</span><input class="inp mono" id="hb-load" value="' + esc(hb.load) + '" placeholder="100 kg" data-in="ed" data-g="hb" data-k="load"></label><label class="field"><span>Rest</span><input class="inp mono" id="hb-rest" value="' + esc(hb.rest) + '" data-in="ed" data-g="hb" data-k="rest"></label></div>' +
    '<div class="row"><button class="btn sm" data-a="ed-hb">' + I.plus + 'Add station</button><button class="btn sm ghost" data-a="ed-add" data-g="hx">Add a free-text line</button></div></div>' +
    '<label class="field" style="margin-top:10px"><span>How to run it (e.g. "continuous", "5 min after the tempo")</span><input class="inp" id="ed-qual" value="' + esc(ED.qual) + '" data-in="ed" data-g="q" data-k="qual"></label></section>' +
    '<section class="card"><div class="card-h"><h3>Accessory &amp; core</h3></div><div class="stack">' + (accRows || '<p class="empty">None.</p>') + '</div><div class="row" style="margin-top:10px"><button class="btn sm" data-a="ed-pick" data-g="acc">' + I.plus + 'Add exercise</button></div></section>' +
    '<section class="card"><div class="card-h"><h3>Details</h3></div><div class="stack">' + labels.map(tfield).join('') + restTxt + '</div></section>' +
    '<div class="flexend"><button class="btn" data-a="close">Cancel</button><button class="btn primary" data-a="editor-save" data-d="' + o.date + '">Save for everyone</button></div>' };
}
function edAddStation() {
  const b = ED.hb; const st = stInfo(b.st); const unit = b.st === 'wb' || (b.st === 'bbj' && /rep/i.test(b.amt)) ? '' : ' m';
  const amt = String(b.amt || '').replace(/\s*m$/, '');
  const sr = b.sets && +b.sets > 1 ? b.sets + ' × ' + amt + unit : amt + unit;
  ED.hx.push([st.name, sr, b.load, b.rest].filter(x => x && String(x).trim()).join(' — '));
  renderSheet();
}
function saveEditor(date) {
  if (!ED) return; const d = clone(ED.d);
  d.heading = (d.heading || '').trim() || S.days[date].heading; d.short = (d.short || '').trim() || d.heading; d.tiny = d.short.split(/[ +·]/)[0];
  d.km = num(d.km) || 0;
  const exItems = ED.ex.filter(e => e.name.trim()).map(joinEx);
  const hxItems = ED.hx.map(x => x.trim()).filter(Boolean);
  const oldAcc = ptAccOf(S.days[date]), newAcc = ED.acc.map(x => x.trim()).filter(Boolean);
  const accTxt = newAcc.join('; ');
  const labels = d.kind === 'rest' ? d.fields.map(f => f.label) : STD_FIELDS.concat(d.fields.map(f => f.label).filter(l => !STD_FIELDS.includes(l)));
  d.fields = labels.map(lab => {
    const old = S.days[date].fields.find(f => f.label === lab) || { label: lab, qual: '', text: '', items: [] };
    const nf = Object.assign({}, old, { label: lab });
    if (lab === 'MAIN STRENGTH') { nf.items = exItems; nf.text = exItems.length ? '' : 'None.'; }
    else if (lab === 'HYROX WORK') { nf.items = hxItems; nf.text = hxItems.length ? '' : 'None.'; nf.qual = ED.qual.trim(); }
    else if (lab === 'ACCESSORY/CORE') { nf.text = accTxt ? accTxt + '.' : 'None.'; nf.items = []; }
    else { nf.text = ED.txt[lab] != null ? ED.txt[lab] : (old.text || ''); nf.items = []; }
    return nf;
  });
  const sf = d.fields.find(f => f.label === 'SESSION'); if (sf) d.session = sf.text;
  if (!put('plan_days', date, d)) return;
  ptRelogAll(date, ED.orig, exItems.map(ptName), oldAcc, newAcc); // v32: logged sets, own order and accessory ticks stay with their item (plantools.js)
  ED = null; toast('Plan updated for ' + fmtDate(date) + (isAdmin() ? '' : ', for everyone')); closeSheet(); render();
}

/* ---------- pace calculator ---------- */
const PC = { pace: 360, dist: 5 };
function sheetPace() {
  const kmh = 3600 / PC.pace; const tt = PC.pace * PC.dist;
  const dists = [[0.4, '400 m'], [1, '1 km'], [5, '5 km'], [8, '8 km (HYROX running)'], [10, '10 km'], [21.0975, 'Half marathon']];
  const zones = S.pid ? zonesFor(S.pid) : [];
  return { title: 'Pace calculator', body: '<div class="fgrid"><label class="field"><span>Pace (min/km)</span><input class="inp mono" id="pc-pace" value="' + fmtPace(PC.pace) + '" data-in="pc" data-k="pace"></label><label class="field"><span>Speed (km/h)</span><input class="inp mono" id="pc-kmh" inputmode="decimal" value="' + kmh.toFixed(2) + '" data-in="pc" data-k="kmh"></label></div>' +
    '<div class="fgrid"><label class="field"><span>Distance</span><select class="inp" id="pc-dist" data-in="pc" data-k="dist">' + dists.map(d => '<option value="' + d[0] + '"' + (PC.dist === d[0] ? ' selected' : '') + '>' + d[1] + '</option>').join('') + '</select></label><label class="field"><span>Finish time</span><input class="inp mono" id="pc-time" value="' + fmtTime(tt) + '" data-in="pc" data-k="time"></label></div>' +
    '<section class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Distance</th><th class="num">Time at ' + fmtPace(PC.pace) + '/km</th></tr></thead><tbody>' + dists.map(d => '<tr><td>' + d[1] + '</td><td class="num mono">' + fmtTime(PC.pace * d[0]) + '</td></tr>').join('') + '</tbody></table></div></section>' +
    (zones.length ? '<section class="card"><div class="card-h"><h3>Your zones</h3></div><div class="tbl-wrap"><table class="tbl"><tbody>' + zones.map(z => '<tr><td>' + esc(z.name) + '</td><td class="mono">' + esc(z.txt) + '</td><td>RPE ' + esc(z.rpe) + '</td></tr>').join('') + '</tbody></table></div></section>' : '') };
}

/* ---------- race-day mode ---------- */
const RW = { running: false, t0: 0, splits: [], int: null, segs: null, date: null, tab: 'splits' };
function raceSegs(o) {
  if (o.mode === 'watch') {
    const t = todayISO(); const p = S.days[t] ? P(t) : null;
    if (p && p.hyrox.chain) return p.hyrox.rows.filter(r => r.kind !== 'note').map(r => ({ key: 'hx' + r.i, i: r.i, label: r.kind === 'run' ? r.label : r.title + (r.amount ? ' ' + r.amount + (r.unit === 'reps' ? '' : ' m') : ''), target: r.kind === 'run' ? runTarget(S.pid, r) : stationTarget(S.pid, r.st, r.amount), chain: true }));
  }
  const sp = planSplits(S.pid) || (S.meta && S.meta.plans.A);
  const out = []; ST_KEYS.forEach((k, i) => { out.push({ key: 'r' + (i + 1), label: 'Run ' + (i + 1), target: parseTime(sp.runs[i]) }); out.push({ key: k, label: stName(k), target: parseTime(sp.stations[k]) }); });
  return out;
}
function sheetRace(o) {
  if (!o._init) { o._init = true; RW.tab = o.mode === 'watch' ? 'watch' : o.mode === 'log' ? 'log' : 'splits'; if (!RW.running) { RW.segs = raceSegs(o); RW.splits = []; } }
  const tabs = [['splits', 'Targets'], ['watch', 'Stopwatch'], ['log', 'Log splits'], ['check', 'Checklist'], ['pacing', 'Pacing']];
  const nav = '<div class="scrollx"><div class="subnav">' + tabs.map(t => '<button data-a="rw-tab" data-v="' + t[0] + '" aria-pressed="' + (RW.tab === t[0]) + '">' + t[1] + '</button>').join('') + '</div></div>';
  const M = S.meta; if (!M) return { title: 'Race day', body: '<p>Loading…</p>' };
  const plan = planOf(S.pid); const sp = M.plans[plan];
  let body = '';
  if (RW.tab === 'splits') {
    let cum = 0;
    const rr = raceOf(S.pid);
    body = (rr && rr.fmt !== 'singles' ? '<div class="note" style="margin-bottom:8px">These targets assume one person racing the whole course. ' + (rr.fmt === 'doubles' ? 'In doubles your station times will be quicker because you share the work; keep the run targets.' : 'In a relay, use the rows for your 2 legs.') + '</div>' : '') + '<p class="small">Plan ' + plan + ' · finish ' + esc(sp.finish) + ' · halfway ≈ ' + esc(sp.halfway) + '. ' + esc(M.raceWeek.rules) + '</p><div class="splits">' + ST_KEYS.map((k, i) => {
      cum += parseTime(sp.runs[i]); const a = '<div class="split"><b>Run ' + (i + 1) + '</b><span class="mono">' + sp.runs[i] + '</span><span class="mono muted small">' + fmtTime(cum, true) + '</span></div>';
      cum += parseTime(sp.stations[k]) + parseTime(sp.rox) / 8; return a + '<div class="split st"><b>' + esc(stName(k)) + '</b><span class="mono">' + sp.stations[k] + '</span><span class="mono muted small">' + fmtTime(cum, true) + '</span></div>';
    }).join('') + '</div><p class="small muted">Clock includes about ' + fmtTime(parseTime(sp.rox) / 8) + ' of Roxzone per station.</p>';
  } else if (RW.tab === 'watch') {
    const segs = RW.segs || raceSegs(o); const cur = RW.splits.length; const now = Date.now();
    const el = RW.running ? Math.floor((now - RW.t0) / 1000) : (RW.splits.length ? sum(RW.splits) : 0);
    const tcum = sum(segs.slice(0, cur).map(s => s.target || 0)); const acum = sum(RW.splits);
    body = '<div class="timerface"><span class="ph" id="rw-seg">' + (cur < segs.length ? esc(segs[cur].label) : 'Finished') + '</span><span class="tm" id="rw-time">' + fmtTime(el) + '</span><small id="rw-sub">' + (cur ? (acum <= tcum ? fmtDelta(acum - tcum).replace('−', '') + ' ahead of plan' : fmtDelta(acum - tcum) + ' behind plan') : 'Phones aren\'t allowed on the course: use this in simulations, or let your partner time you from the stands.') + '</small></div>' +
      (!RW.running && cur === 0 ? '<button class="btn primary lg block" data-a="rw-start">' + I.play + 'Start</button>' : RW.running ? '<button class="btn accent lg block" style="min-height:88px;font-size:24px" data-a="rw-split">' + (cur < segs.length - 1 ? 'Next: ' + esc(segs[cur + 1].label) : 'Finish') + '</button><div class="row"><button class="btn" style="flex:1" data-a="rw-undo"' + (cur ? '' : ' disabled') + '>Undo split</button><button class="btn" style="flex:1" data-a="rw-stop">Stop</button></div>' : '<div class="row"><button class="btn primary" style="flex:1" data-a="rw-save">Save splits to ' + (segs[0] && segs[0].chain ? 'today\'s session' : 'a simulation today') + '</button><button class="btn" data-a="rw-reset">Reset</button></div>') +
      '<div class="splits">' + segs.map((s, i) => { const t = RW.splits[i]; return '<div class="split' + (i === cur && RW.running ? ' cur' : '') + (/^Run|km/.test(s.label) ? '' : ' st') + '"><b>' + esc(s.label) + '</b><span class="mono">' + (t != null ? fmtTime(t) : '') + '</span><span class="mono small ' + (t != null && s.target ? (t <= s.target ? 'delta good' : 'delta bad') : 'muted') + '">' + (t != null && s.target ? fmtDelta(t - s.target) : s.target ? fmtTime(s.target) : '') + '</span></div>'; }).join('') + '</div>';
  } else if (RW.tab === 'log') {
    const date = RW.date || todayISO(); const l = getLog(date) || {}; const sim = l.sim || {};
    body = '<p class="small muted">Enter each split from your watch or the official results. Saved as a simulation on the date you pick, and compared with Plan ' + plan + '.</p><div class="fgrid"><label class="field"><span>Date</span><select class="inp" id="sl-date" data-in="sl-date">' + S.order.filter(d => d <= todayISO() || d === date).slice().reverse().map(d => '<option value="' + d + '"' + (d === date ? ' selected' : '') + '>' + esc(fmtDate(d)) + '</option>').join('') + '</select></label><label class="field"><span>Label</span><input class="inp" id="sl-label" value="' + esc(sim.label || (S.days[date] ? S.days[date].heading : 'Simulation')) + '"></label></div>' +
      '<div class="fgrid" style="grid-template-columns:repeat(2,minmax(0,1fr))">' + SEG_ORDER().map(k => { const s = (sim.segs || {})[k]; const tg = /^r\d$/.test(k) ? parseTime(sp.runs[+k.slice(1) - 1]) : parseTime(sp.stations[k]); return '<label class="field"><span>' + esc(segLabel(k)) + ' · target ' + fmtTime(tg) + '</span><input class="inp mono" id="sl-' + k + '" placeholder="m:ss" value="' + esc(s && s.t ? fmtTime(s.t) : '') + '"></label>'; }).join('') +
      '<label class="field"><span>Roxzone total</span><input class="inp mono" id="sl-rox" placeholder="m:ss" value="' + esc(sim.rox ? fmtTime(sim.rox) : '') + '"></label><label class="field"><span>Official total (optional)</span><input class="inp mono" id="sl-total" placeholder="h:mm:ss" value="' + esc(sim.total && !sim.totalCalc ? fmtTime(sim.total, true) : '') + '"></label></div>' +
      '<div class="flexend"><button class="btn primary" data-a="sl-save">Save simulation</button></div>';
  } else if (RW.tab === 'check') {
    const l = getLog(RACE()) || {}; const on = l.raceChk || {};
    body = '<section class="card"><div class="card-h"><h3>Race bag</h3></div><div class="checks">' + M.raceWeek.checklist.map((x, i) => '<button class="check" data-a="rchk" data-k="' + i + '" aria-pressed="' + (!!on[i]) + '"><span class="box">' + I.check + '</span><span class="lbl">' + esc(x) + '</span></button>').join('') + '</div></section>' +
      '<section class="card"><div class="card-h"><h3>Race-day timeline</h3></div><div class="stack">' + M.raceWeek.timeline.map(x => '<div class="row" style="align-items:flex-start;flex-wrap:nowrap"><b class="mono" style="min-width:86px">' + esc(x.t) + '</b><span class="small">' + esc(x.what) + '</span></div>').join('') + '</div></section>' +
      '<section class="card"><div class="card-h"><h3>Race week</h3></div><p class="small">' + esc(M.raceWeek.rules) + '</p></section>';
  } else {
    body = '<section class="card"><div class="card-h"><h3>Running</h3></div><ul class="small stack" style="padding-left:18px;margin:0">' + M.raceWeek.pacing.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></section>' +
      '<section class="card"><div class="card-h"><h3>Stations</h3></div><div class="stack">' + ST_KEYS.map(k => { const s = stInfo(k); return '<div><b>' + esc(s.name) + '</b> <span class="mono small">' + esc(sp.stations[k]) + '</span><p class="small muted">' + esc(s.cue) + '</p></div>'; }).join('') + '<div><b>Roxzone</b> <span class="mono small">' + esc(sp.rox) + '</span><p class="small muted">' + esc(M.raceWeek.roxzone) + '</p></div></div></section>' +
      '<section class="card"><div class="card-h"><h3>When things go wrong</h3></div><ul class="small stack" style="padding-left:18px;margin:0">' + M.raceWeek.wrong.concat(M.raceWeek.breathing).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></section>';
  }
  return { title: 'Race day', full: true, body: nav + body };
}
function rwTick() { const a = $('#rw-time'); if (a && RW.running) a.textContent = fmtTime(Math.floor((Date.now() - RW.t0) / 1000)); }
function rwStart() { audioInit(); RW.running = true; RW.t0 = Date.now(); RW.splits = []; RW.segStart = RW.t0; clearInterval(RW.int); RW.int = setInterval(rwTick, 250); keepAwake(true); beep(1, 990); renderSheet(); }
function rwSplit() {
  const now = Date.now(); const segs = RW.segs; const acc = sum(RW.splits);
  RW.splits.push(Math.round((now - RW.t0) / 1000) - acc); beep(1, 880, 0.08);
  if (RW.splits.length >= segs.length) { RW.running = false; clearInterval(RW.int); RW.int = null; keepAwake(false); beep(3, 990); }
  renderSheet();
}
function rwSave() {
  const segs = RW.segs; const t = todayISO();
  if (segs[0] && segs[0].chain) {
    editLog(t, l => { l.hx = l.hx || {}; segs.forEach((s, i) => { if (RW.splits[i] != null) { l.hx[s.i] = Object.assign({}, l.hx[s.i], { time: fmtTime(RW.splits[i]), d: true }); } }); l.simTotal = fmtTime(sum(RW.splits), true); });
  } else {
    editLog(t, l => { const g = {}; segs.forEach((s, i) => { if (RW.splits[i] != null) g[s.key] = { t: RW.splits[i] }; }); l.sim = { label: (S.days[t] ? S.days[t].heading : 'Simulation'), segs: g, total: sum(RW.splits), rox: null }; });
  }
  toast('Splits saved'); RW.splits = []; closeSheet(); render();
}
function slSave() {
  const date = $('#sl-date').value; const segs = {};
  SEG_ORDER().forEach(k => { const v = parseTime($('#sl-' + k).value); if (v) segs[k] = { t: v }; });
  const rox = parseTime($('#sl-rox').value); const tot = parseTime($('#sl-total').value);
  if (!Object.keys(segs).length) { toast('Enter at least one split.'); return; }
  const prevPid = S.pid;
  editLog(date, l => { l.sim = { label: $('#sl-label').value.trim() || 'Simulation', segs, rox: rox || null, total: tot || null, totalCalc: !tot }; if (!tot) l.sim.total = sum(Object.values(segs).map(x => x.t)) + (rox || 0); });
  toast('Simulation saved for ' + fmtDate(date)); closeSheet(); S.route = { view: 'progress', sub: 'race' }; render();
}

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

/* ================= Routing, rendering, events ================= */
const curDate = () => (S.route.view === 'day' && S.route.date) ? S.route.date : todayISO();
function isTyping() { const a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'file' && $('#view').contains(a)); }
let renderQueued = false, pendingRender = false;
function renderSoon() { if (renderQueued) return; renderQueued = true; requestAnimationFrame(() => { renderQueued = false; if (isTyping()) { pendingRender = true; return; } render(); }); }
document.addEventListener('focusout', () => { if (pendingRender) setTimeout(() => { if (!isTyping() && pendingRender) { pendingRender = false; render(); } }, 80); });

function topbarHTML() {
  const p = me();
  const other = !!(S.pid && S.uid && S.pid !== S.uid);
  return '<button class="who" data-a="who" style="--pc:' + (p ? pcolor(S.pid) : 'var(--muted)') + (other ? ';border-color:var(--accent)' : '') + '" aria-label="' + (isAdmin() ? 'View or edit as someone else' : 'Your profile') + '"><span class="dot"></span>' + (p ? (other ? 'Editing ' : '') + esc(p.name) : 'Set up profile') + '</button>' +
    (other && ownProfile() ? '<button class="btn sm" data-a="choose" data-v="' + S.uid + '">Back to me</button>' : isAdmin() ? '<span class="pill">Admin</span>' : '') +
    '<span class="sync" id="sync" data-s="' + S.sync + '"><i></i><span></span></span><span class="sp"></span>' +
    '<button class="iconbtn" data-a="tool" data-t="tools" aria-label="More: HYROX guide, score history, achievements">' + I.more + '</button>';
}
function render() {
  pendingRender = false;
  CHARTS.clear(); chartSeq = 0;
  const v = S.route.view;
  let html = '';
  try {
    html = v === 'day' ? viewDay(S.route.date) : v === 'calendar' ? viewCalendar() : v === 'progress' ? viewProgress() : v === 'together' ? viewTogether() : v === 'settings' ? viewSettings() : v === 'guide' ? viewGuide() : v === 'nutrition' ? viewNutrition() : v === 'photos' ? viewPhotos() : viewToday();
  } catch (e) { console.error(e); html = '<div class="card"><b>Something went wrong drawing this screen.</b><p class="small muted">' + esc(e && e.message) + '</p></div>'; }
  $('#topbar').innerHTML = topbarHTML();
  const fa = document.activeElement, fmv = fa && fa.dataset && fa.dataset.a === 'ex-mv' && $('#view').contains(fa) ? '#ex-' + fa.dataset.ex + ' [data-a=ex-mv][data-v="' + fa.dataset.v + '"]' : null;
  const tabsWas = tabsSave($('#view'), v);
  $('#view').innerHTML = html; keepOpen($('#view')); tabsRestore($('#view'), tabsWas, v);
  if (fmv) { const n = $(fmv), box = n && n.closest('.ex'); const f = n && !n.disabled ? n : box && box.querySelector('[data-a=ex-mv]:not([disabled])'); if (f) f.focus({ preventScroll: true }); }
  setSync(S.sync);
  const cur = v === 'day' ? (S.route.date === todayISO() ? 'today' : 'calendar') : v;
  $$('#nav a[data-v]').forEach(a => a.setAttribute('aria-current', a.dataset.v === cur ? 'page' : 'false'));
  drawCharts();
  if (SHEET && SHEET.kind === 'who') renderSheet();
}
function go(route) { S.route = route; window.scrollTo(0, 0); render(); }
function onData(col) {
  if (!PLAN_COLS.includes(col)) ensureMe();
  if (col === 'together' || col === 'profiles') tgTidy();
  if (col === 'plan_days' && S.route.view !== 'day') { /* plan edits by others */ }
  renderSoon();
}

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

/* ---------- Nutrition ----------
   Calories: Mifflin-St Jeor BMR (weight, height, age, sex; v32: the BMR from their latest InBody scan when there is one) × an activity factor for that day's training, ± 300 kcal for
   Lose slowly / Gain slowly. Protein 1.8 g/kg (2.0 on Lose; above BMI 30 it uses the weight at BMI 27.5), fat 25 % of
   energy (min 0.8 g/kg), carbs make up the rest but never below the sports-nutrition minimum for the day (NUT_CMIN).
   Without height, age and sex it falls back to per-kg targets (NUT_CARBS). Under BMI 18.5, Lose slowly is turned off.
   Guidance: Academy of Nutrition and Dietetics / Dietitians of Canada / ACSM (2016); ISSN protein and nutrient-timing
   position stands (2017); ISSN caffeine (2021).
   Settings: profile.nut = { kg, cm, by (year of birth), sex: 'm'|'f', diet: 'veg'|'egg'|'nonveg', goal: 'keep'|'lose'|'gain' }
   (edited in Settings). Ticks: log.fuel = { w: 500 ml bottles, p: ~30 g protein servings, pre, post, kcal, pg: protein g, kg: weigh-in }.
   Fuel is worth 15 of the day's 100 points from each person's first nutrition entry (profile.fuelFrom), so older scores never change. */
const NUT_CARBS = { rest: 3.5, strength: 5, long: 6, hyrox: 6, sim: 7, load1: 7, load2: 8, race: 6 }; // g/kg when height/age/sex are missing
const NUT_CMIN = { rest: 3, strength: 5, long: 5.5, hyrox: 5.5, sim: 6, load1: 7, load2: 8, race: 6 }; // g/kg floor for the day
const NUT_PAL = { rest: 1.45, strength: 1.7, long: 1.75, hyrox: 1.75, sim: 1.85, load1: 1.6, load2: 1.55, race: 1.8 }; // BMR × this
const NUT_DAY = {
  rest: ['Rest day', 'Lighter carbs: you’re recovering, not burning much fuel.'],
  strength: ['Strength day', 'Moderate carbs to fuel the lifts and the run.'],
  long: ['Long run', 'Higher carbs: top up before, refuel after.'],
  hyrox: ['HYROX day', 'Higher carbs for the runs and stations.'],
  sim: ['Simulation day', 'High carbs: fuel it like race day, and rehearse your race breakfast.'],
  load1: ['2 days to race', 'Carb loading starts: extra rice, roti, potatoes and fruit.'],
  load2: ['Day before the race', 'Carb loading: high carbs, and less fibre, fat and spice from lunch on.'],
  race: ['Race day', 'Race breakfast about 3 hours before, then refuel after.']
};
const NUT_SHORT = { rest: 'Rest', strength: 'Strength', long: 'Long run', hyrox: 'HYROX', sim: 'Simulation', load1: 'Carb load', load2: 'Carb load', race: 'Race' };
const NUT_DIETS = [['veg', 'Veg'], ['egg', 'Egg'], ['nonveg', 'Non-veg']];
const NUT_GOALS = [['keep', 'Maintain'], ['lose', 'Lose slowly'], ['gain', 'Gain slowly']];
const NUT_RANK = { veg: 0, egg: 1, nonveg: 2 };
const NUT_PROTEIN = [ // each ≈ 30 g protein; the first value is the lowest diet it belongs to
  ['veg', '1 scoop whey + 250 ml milk'], ['veg', '150 g paneer'], ['veg', '60 g soya chunks (dry weight)'], ['veg', '300 g hung curd or Greek yogurt'],
  ['veg', '200 g firm tofu'], ['veg', '2 bowls dal + 1 bowl curd'], ['egg', '3 whole eggs + 4 egg whites'], ['nonveg', '100 g cooked chicken breast'], ['nonveg', '130 g cooked fish']
];
const NUT_SOURCES = [
  ['Nutrition and Athletic Performance (AND, DC and ACSM, 2016)', 'https://pubmed.ncbi.nlm.nih.gov/26891166/'],
  ['ISSN: protein and exercise (2017)', 'https://link.springer.com/article/10.1186/s12970-017-0177-8'],
  ['ISSN: nutrient timing (2017)', 'https://link.springer.com/article/10.1186/s12970-017-0189-4']
];
function raceSex(pid) { const r = raceOf(pid); if (!r) return null; if (r.div === 'X') return r.sex === 'W' ? 'f' : 'm'; return r.div === 'W' || r.div === 'WP' ? 'f' : 'm'; }
const nutOf = pid => Object.assign({ kg: null, cm: null, by: null, sex: null, diet: null, goal: 'keep' }, ((S.profiles[pid] || {}).nut) || {});
const nutFoods = (list, diet) => list.filter(x => !diet || NUT_RANK[x[0]] <= NUT_RANK[diet]).map(x => x[1]);
function nutBody(pid) { // weight, height, age, sex and BMI as the formula uses them
  const n = nutOf(pid), kg = num(n.kg), cm = num(n.cm), by = num(n.by);
  const age = by ? (+todayISO().slice(0, 4)) - by : null, sex = n.sex || raceSex(pid);
  const bmi = kg && cm ? kg / Math.pow(cm / 100, 2) : null;
  return { n, kg, cm, age, sex, bmi, under: bmi != null && bmi < 18.5, full: !!(kg && cm && age && sex) };
}
const bmiWord = b => b < 18.5 ? 'under the healthy range' : b < 25 ? 'healthy range' : b < 30 ? 'above the healthy range' : 'well above the healthy range';
function fuelDayType(date) {
  const p = P(date); const race = RACE(); const d = diffDays(date, race);
  if (d === 0) return 'race'; if (d === 1) return 'load2'; if (d === 2) return 'load1';
  if (!p || p.rest) return 'rest';
  if ((p.day.badges || []).includes('sim')) return 'sim';
  if (p.kind === 'hyrox') return 'hyrox';
  if (p.kind === 'long') return 'long';
  return 'strength';
}
function fuelTargets(pid, date) {
  const B = nutBody(pid), kg = B.kg || 70, t = fuelDayType(date), p = P(date);
  const goal = B.n.goal === 'lose' && B.under ? 'keep' : (B.n.goal || 'keep');
  const key = ['sim', 'load1', 'load2', 'race'].includes(t), load = t === 'load1' || t === 'load2';
  const refKg = B.bmi != null && B.bmi >= 30 ? 27.5 * Math.pow(B.cm / 100, 2) : kg;
  let pro = refKg * (goal === 'lose' ? 2.0 : 1.8), carb, fat;
  const IB = typeof gymIbBmr === 'function' ? gymIbBmr(pid) : null; // v32: the BMR measured by their latest InBody scan
  if (B.full || IB) {
    const bmr = IB ? IB.bmr : 10 * kg + 6.25 * B.cm - 5 * B.age + (B.sex === 'f' ? -161 : 5);
    const kcal = bmr * NUT_PAL[t] + (goal === 'lose' && !key ? -300 : goal === 'gain' ? 300 : 0);
    fat = Math.max(0.8 * kg, kcal * (load ? 0.2 : 0.25) / 9);
    carb = Math.max((kcal - pro * 4 - fat * 9) / 4, NUT_CMIN[t] * kg * (goal === 'lose' && !key ? 0.8 : 1));
  } else {
    carb = kg * NUT_CARBS[t]; fat = kg * 1.0;
    if (goal === 'lose' && !key) { carb -= 45; fat -= 20; }
    if (goal === 'gain') { carb += 40; fat += 10; }
  }
  const r5 = x => Math.round(x / 5) * 5;
  pro = r5(pro); carb = r5(carb); fat = r5(fat);
  const mins = p && !p.rest ? (p.planMin || 60) : 0;
  const water = Math.max(2, Math.round((kg * 0.035 + mins / 60 * 0.6) * 2) / 2); // litres, nearest 0.5
  return { t, kg, est: !B.kg, full: B.full || !!IB, ib: IB, bmi: B.bmi, under: B.under, goal, pro, carb, fat, kcal: Math.round((pro * 4 + carb * 4 + fat * 9) / 50) * 50, water, bottles: Math.round(water / 0.5), servings: Math.ceil(pro / 30), train: !!(p && !p.rest) || t === 'race', gkg: Math.round(carb / kg * 10) / 10 };
}
const kcalHit = (T, v) => { v = num(v); if (!v) return false; return T.goal === 'lose' ? v >= T.kcal * 0.9 && v <= T.kcal * 1.1 : v >= T.kcal * 0.9; }; // reached (Lose: within ±10 %)
const protG = f => num(f.pg) || (f.p || 0) * 30; // grams eaten: typed grams, or ticked servings × 30 g
const protHit = (T, f) => num(f.pg) ? num(f.pg) >= T.pro : (f.p || 0) >= T.servings;
const fuelOn = (pid, date) => { const f = (S.profiles[pid] || {}).fuelFrom; return !!f && date >= f; };
function fuelPts(pid, date, l) { // 15: training days water 5 + protein 5 + pre 2.5 + post 2.5; rest days water 7.5 + protein 7.5
  const f = (l && l.fuel) || {}, T = fuelTargets(pid, date);
  const water = Math.min(1, (f.w || 0) / T.bottles);
  const prot = Math.min(1, Math.max((f.p || 0) / T.servings, num(f.pg) ? num(f.pg) / T.pro : 0));
  return T.train ? 5 * water + 5 * prot + (f.pre ? 2.5 : 0) + (f.post ? 2.5 : 0) : 7.5 * water + 7.5 * prot;
}
function fuelEdit(date, fn) {
  editLog(date, l => { l.fuel = Object.assign({}, l.fuel); fn(l.fuel); }, { render: false });
  const pr = S.profiles[S.pid] || {};
  if (!pr.fuelFrom || date < pr.fuelFrom) editProfile(p => { if (!p.fuelFrom || date < p.fuelFrom) p.fuelFrom = date; });
  render();
}
function fuelTicks(kind, val, target, date, ok, icon) {
  const n = Math.min(Math.max(target, val) + 1, target * 2 + 4); // one spare after whatever you've logged, so you can always log more
  let h = '';
  for (let k = 0; k < n; k++) h += '<button class="fu-dot ' + kind + (k >= target ? ' x' : '') + '" data-a="fu-n" data-k="' + kind + '" data-v="' + (k + 1) + '" data-d="' + date + '" aria-pressed="' + (k < val) + '" aria-label="' + (k + 1) + '"' + (ok ? '' : ' disabled') + '>' + (icon || (k + 1)) + '</button>';
  return '<div class="fu-ticks">' + h + '</div>';
}
const litres = x => String(Math.round(x * 10) / 10);
function fuelBody(date, compact) {
  const pid = S.pid, T = fuelTargets(pid, date), l = getLog(date) || {}, f = l.fuel || {};
  const ok = !!pid && date <= todayISO() && canWriteDoc('logs', logKey(pid, date));
  const w = f.w || 0, pr = f.p || 0;
  const row = (lab, sub, ticks) => '<div class="fu-row"><div class="fu-l"><b>' + lab + '</b><span>' + sub + '</span></div>' + ticks + '</div>';
  const chk = (k, lab) => '<button class="chip fu-chk" data-a="fu-chk" data-k="' + k + '" data-d="' + date + '" aria-pressed="' + !!f[k] + '"' + (ok ? '' : ' disabled') + '>' + I.check + lab + '</button>';
  const inp = (k, lab, ph, mode, hit, hint) => '<label class="field"><span>' + lab + '</span><input class="inp mono' + (hit ? ' hit' : '') + '" id="fu-' + k + '" inputmode="' + mode + '" value="' + esc(f[k] != null ? f[k] : '') + '" placeholder="' + ph + '" data-in="fu" data-k="' + k + '" data-d="' + date + '"' + (ok ? '' : ' disabled') + '><small class="fu-hint' + (hit ? ' hit' : '') + '">' + hint + '</small></label>';
  const nudge = T.est ? '<a href="#settings" data-a="nutset">Add your weight</a> for your own targets (now based on 70 kg).' : !T.full ? '<a href="#settings" data-a="nutset">Add height, age and sex</a> for a more accurate calorie target.' : '';
  return row('Water', litres(w * 0.5) + ' of ' + T.water + ' L' + (w > T.bottles ? ' · +' + litres((w - T.bottles) * 0.5) + ' L extra' : ''), fuelTicks('w', w, T.bottles, date, ok, I.drop)) +
    row('Protein', pr + ' of ' + T.servings + ' servings (~30 g)' + (num(f.pg) ? ' · ' + num(f.pg) + ' g typed' : ''), fuelTicks('p', pr, T.servings, date, ok)) +
    (T.train ? '<div class="fu-checks">' + chk('pre', T.t === 'race' ? 'Race breakfast' : 'Pre-workout carbs') + chk('post', T.t === 'race' ? 'Recovery meal' : 'Post-workout meal') + '</div>' : '') +
    '<div class="fgrid fu-inputs">' + inp('kcal', 'Calories eaten', 'kcal', 'numeric', kcalHit(T, f.kcal), (kcalHit(T, f.kcal) ? '✓ ' : '') + 'target ' + T.kcal.toLocaleString('en-IN')) + inp('pg', 'Protein eaten', 'g', 'numeric', num(f.pg) >= T.pro, (num(f.pg) >= T.pro ? '✓ ' : '') + 'target ' + T.pro + ' g') + inp('kg', 'Weigh-in', 'kg', 'decimal', false, num((nutOf(pid)).kg) ? 'last ' + num(nutOf(pid).kg) + ' kg' : 'optional') + '</div>' +
    (compact ? '<p class="fu-sum">' + NUT_DAY[T.t][0] + ': about ' + T.kcal.toLocaleString('en-IN') + ' kcal · protein ' + T.pro + ' g · carbs ' + T.carb + ' g · fat ' + T.fat + ' g.' + (nudge ? ' ' + nudge : '') + '</p>' : (nudge ? '<p class="fu-sum">' + nudge + '</p>' : ''));
}
function viewNutrition() {
  const pid = S.pid; if (!pid || !S.order.length) return '<h2 class="disp" style="font-size:34px;text-transform:uppercase">Nutrition</h2><section class="card"><p>Set up your profile to see your targets.</p></section>';
  const t = todayISO(), def = S.days[t] ? t : (S.order.find(d => d >= t) || S.order[S.order.length - 1]);
  const nd = S.route.nd, date = nd && S.days[nd] && nd <= def ? nd : def; // ‹ › pick an earlier day to log or fix it
  const prev = [...S.order].reverse().find(d => d < date), next = S.order.find(d => d > date && d <= def);
  const n = nutOf(pid), T = fuelTargets(pid, date), pr = S.profiles[pid] || {};
  const tile = (lab, val, unit, sub) => '<div class="tile"><span>' + lab + '</span><b>' + val + '<small>' + unit + '</small></b><span class="pl">' + sub + '</span></div>';
  const head = '<h2 class="disp" style="font-size:34px;text-transform:uppercase">Nutrition</h2>' +
    (!T.full ? '<div class="warnbox">' + I.info.replace('<svg', '<svg width="22" height="22"') + '<div><b>' + (T.est ? 'Add your weight, height, age and sex' : 'Add your height, age and sex') + ' in Settings.</b>' + (T.est ? 'Until then, targets are worked out for 70 kg. ' : 'Until then, calories are estimated from weight only. ') + '<a href="#settings" data-a="nutset">Open settings</a></div></div>' : '') +
    '';
  const dayBtn = (d, ic, lab) => '<button class="iconbtn sm" data-a="nu-day" data-v="' + (d || '') + '" aria-label="' + lab + '"' + (d ? '' : ' disabled') + '>' + ic + '</button>';
  const today = '<section class="card" id="nu-day"><div class="card-h nu-dayh">' + dayBtn(prev, I.left, 'Previous day') + '<h3>' + (date === t ? 'Today' : esc(fmtDate(date))) + '</h3>' + dayBtn(next, I.right, 'Next day') + '<span class="pill">' + esc(NUT_DAY[T.t][0]) + '</span>' + (date !== def ? '<span class="sp"></span><button class="btn sm ghost exall" data-a="nu-day" data-v="">Back to ' + (def === t ? 'today' : 'now') + '</button>' : '') + '</div>' +
    '<p class="small" style="color:var(--ink-2);margin:-4px 0 12px">' + esc(NUT_DAY[T.t][1]) + '</p>' +
    '<div class="tiles nu-tiles">' + tile('Calories', T.kcal.toLocaleString('en-IN'), 'kcal', T.ib ? 'from your InBody BMR, ' + T.ib.bmr + ' kcal (' + fmtDate(T.ib.date, false) + ')' : T.full ? 'for your weight, height and age' : 'estimate for ' + T.kg + ' kg') + tile('Protein', T.pro, 'g', T.servings + ' servings of ~30 g') + tile('Carbs', T.carb, 'g', T.gkg + ' g per kg today') + tile('Fat', T.fat, 'g', 'about a quarter of calories') + tile('Water', T.water, 'L', T.bottles + ' bottles of 500 ml') + '</div>' +
    '<div style="margin-top:12px">' + fuelBody(date, false) + '</div>' +
    '<p class="small muted" style="margin-top:8px">Log water and protein as you go; there’s always room to log more than the target. The optional fields are for totals from another app: protein grams count towards your protein, and a weigh-in updates your weight.</p></section>';
  const diet = n.diet; const li = a => '<ul class="nu-list">' + a.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
  const protein = '<section class="card"><div class="card-h"><h3>Protein servings</h3><span class="sp"></span><span class="small muted">each about 30 g</span></div>' + li(nutFoods(NUT_PROTEIN, diet)) +
    '<p class="small muted" style="margin-top:8px">Spread servings every 3–4 hours. One before bed (milk, curd or paneer) helps overnight recovery.</p></section>';
  const dshort = d => DOWS[dowOf(d)] + ' ' + D(d).getUTCDate();
  const wk = mondayOf(date), days = Array.from({ length: 7 }, (_, i) => addDays(wk, i)).filter(d => S.days[d]);
  const week = '<section class="card"><div class="card-h"><h3>Nutrients needed this week</h3></div><div class="tbl-wrap"><table class="tbl compact nu-tbl"><thead><tr><th>Day</th><th class="num">kcal</th><th class="num">Protein g</th><th class="num">Carbs g</th><th class="num">Water L</th></tr></thead><tbody>' +
    days.map(d => { const x = fuelTargets(pid, d); return '<tr' + (d === date ? ' class="cell-good"' : '') + '><td>' + esc(dshort(d)) + '<br><span class="small muted">' + esc(NUT_SHORT[x.t]) + '</span></td><td class="num mono">' + x.kcal.toLocaleString('en-IN') + '</td><td class="num mono">' + x.pro + '</td><td class="num mono">' + x.carb + '</td><td class="num mono">' + x.water + '</td></tr>'; }).join('') + '</tbody></table></div><p class="small muted" style="margin-top:8px">Handy for planning the week’s shopping.</p></section>';
  const past = Array.from({ length: 14 }, (_, i) => addDays(t, -i)).filter(d => S.days[d]);
  const hist = '<section class="card nu-hist"><div class="card-h"><h3>Last 14 days</h3></div>' + (pr.fuelFrom ? '<div class="tbl-wrap"><table class="tbl compact nu-tbl"><thead><tr><th>Day</th><th class="num">Water</th><th class="num">Protein</th><th class="num">kcal</th><th class="num">kg</th><th class="num">Fuel</th></tr></thead><tbody>' +
    past.map(d => { const x = fuelTargets(pid, d), g = ((getLog(d, pid) || {}).fuel) || {}; const pts = d >= pr.fuelFrom ? Math.round(fuelPts(pid, d, getLog(d, pid))) : null;
      const wl = (g.w || 0) * 0.5, pOk = protHit(x, g), kOk = kcalHit(x, g.kcal);
      return '<tr' + (d === date ? ' class="cell-good"' : '') + '><td><button class="nu-dl" data-a="nu-day" data-v="' + d + '" aria-label="Log ' + esc(fmtDate(d)) + '">' + esc(dshort(d)) + '</button></td><td class="num mono"><span class="' + (wl >= x.water ? 'good' : '') + '">' + litres(wl) + '</span></td><td class="num mono"><span class="' + (pOk ? 'good' : '') + '">' + (protG(g) + ' g') + '</span></td><td class="num mono"><span class="' + (kOk ? 'good' : '') + '">' + (num(g.kcal) ? num(g.kcal).toLocaleString('en-IN') : '–') + '</span></td><td class="num mono">' + (num(g.kg) ? num(g.kg) : '–') + '</td><td class="num mono">' + (pts == null ? '–' : '<span class="' + (pts >= 12 ? 'good' : pts >= 7 ? '' : 'bad') + '">' + pts + '</span>') + '</td></tr>'; }).join('') + '</tbody></table></div><p class="small muted" style="margin-top:8px">Water in litres; protein in grams (a ticked serving counts as 30 g); Fuel out of 15. Tap a day to log or fix it. Green means you reached that day’s target (calories: at least 90 % of it' + (T.goal === 'lose' ? ', and no more than 10 % over while losing' : '') + ').</p>'
    : '<p class="empty">Tick water or protein and your history appears here.</p>') + '</section>';
  return head + '<div class="grid2 nu-top"><div class="stack" style="gap:14px">' + today + protein + '</div><div class="stack" style="gap:14px">' + week + hist + '</div></div>';
}
function nutSettingsCard() {
  const pid = S.pid; if (!pid) return '';
  const B = nutBody(pid), n = B.n, year = +todayISO().slice(0, 4), fromRace = !n.sex && B.sex;
  const inp = (k, lab, val, ph, mode) => '<label class="field"><span>' + lab + '</span><input class="inp mono" id="nut-' + k + '" inputmode="' + mode + '" value="' + esc(val != null ? val : '') + '" placeholder="' + ph + '" data-in="nut" data-k="' + k + '"></label>';
  const seg = (a, list, cur, dis) => '<div class="seg">' + list.map(x => '<button data-a="' + a + '" data-v="' + x[0] + '" aria-pressed="' + (cur === x[0]) + '"' + (dis && dis(x[0]) ? ' disabled' : '') + '>' + x[1] + '</button>').join('') + '</div>';
  const goalNote = B.under ? 'Your BMI is under 18.5, so Lose slowly is off and targets stay at maintenance or above.' : n.goal === 'lose' ? 'About 300 kcal a day under maintenance, roughly 0.25 kg a week, with protein up to 2 g per kg. Never on simulation days or race week: those days are fuelled in full.' : n.goal === 'gain' ? 'About 300 kcal a day over maintenance.' : 'Eating enough to train hard and recover. Recommended during a race build.';
  return '<section class="card" id="nut-settings"><div class="card-h"><h3>Nutrition</h3><span class="sp"></span><button class="btn sm ghost exall" data-a="nav" data-v="nutrition">' + I.food + 'Open</button></div><div class="stack">' +
    '<div class="fgrid nu-body">' + inp('kg', 'Weight (kg)', n.kg, '72', 'decimal') + inp('cm', 'Height (cm)', n.cm, '175', 'numeric') + inp('by', 'Year of birth', n.by, String(year - 30), 'numeric') + '</div>' +
    '<div class="field"><span>Sex, for the calorie formula' + (fromRace ? ' (from your race division)' : '') + '</span>' + seg('nut-sex', [['m', 'Male'], ['f', 'Female']], B.sex) + '</div>' +
    (B.bmi ? '<p class="small">BMI <b>' + B.bmi.toFixed(1) + '</b>, ' + bmiWord(B.bmi) + (B.age ? ' · age ' + B.age : '') + '.</p>' : '') +
    '<div class="field"><span>Food examples for</span>' + seg('nut-diet', NUT_DIETS, n.diet) + '</div>' +
    '<div class="field"><span>Goal</span>' + seg('nut-goal', NUT_GOALS, B.under && n.goal === 'lose' ? 'keep' : n.goal, v => v === 'lose' && B.under) + '</div>' +
    '<p class="small muted">' + goalNote + ' A weigh-in on the Nutrition page updates your weight. These details aren’t shown to anyone else; your check-ins on Progress → Body are.</p></div></section>';
}
function nutRaceCard() { // lives in the HYROX guide
  const pid = S.pid, race = RACE(), d2 = addDays(race, -2), d1 = addDays(race, -1);
  const T2 = fuelTargets(pid, d2), T1 = fuelTargets(pid, d1), kg = T1.kg;
  const sims = S.order.filter(d => d < race && (S.days[d].badges || []).includes('sim')).slice(-2);
  return '<section class="card" id="race-fuel"><div class="card-h"><h3>Race-week fuelling</h3>' + (T1.est ? '<span class="sp"></span><span class="small muted">for 70 kg until you add your weight</span>' : '') + '</div><div class="stack small">' +
    '<div><b>' + esc(fmtDate(d2)) + ' · 2 days before.</b> Carbs up to about ' + T2.carb + ' g: an extra portion of rice, roti or potatoes at each meal, and juice or fruit with snacks.</div>' +
    '<div><b>' + esc(fmtDate(d1)) + ' · day before.</b> About ' + T1.carb + ' g carbs (' + NUT_CMIN.load2 + ' g per kg). From lunch on, go easier on fibre, fat and spice. Eat dinner early and keep drinking.</div>' +
    '<div><b>Race morning.</b> About ' + Math.round(kg * 2 / 5) * 5 + ' g carbs (2 g per kg) about 3 hours before, e.g. 2 bananas, 3 slices of toast with honey and a glass of milk, or poha or idli with a banana. Drink about ' + Math.round(kg * 6 / 50) * 50 + ' ml in the 2–4 hours before, then sips.</div>' +
    '<div><b>During the race.</b> Water at the stations when you’re thirsty. For about 90 minutes, 30–45 g carbs (a gel or a sports drink) around halfway can help. Practise it first.</div>' +
    '<div><b>Caffeine (optional).</b> Only if you already use it: about ' + Math.round(kg * 3 / 10) * 10 + ' mg (3 mg per kg) roughly 60 minutes before. A strong coffee has about 100–150 mg.</div>' +
    '<div><b>After.</b> Protein and carbs within an hour or two, and plenty of fluids.</div>' +
    '<div class="warnbox" style="margin:0"><div><b>Nothing new on race day.</b>' + (sims.length ? 'Rehearse your breakfast, timing and any gel on ' + sims.map(d => esc(fmtDate(d))).join(' and ') + '.' : 'Rehearse your breakfast and any gel in your simulations.') + '</div></div>' +
    '<p class="muted">Based on ' + NUT_SOURCES.map(s => '<a href="' + s[1] + '" target="_blank" rel="noopener">' + esc(s[0]) + '</a>').join(', ') + '. General guidance for healthy adults, not medical advice.</p></div></section>';
}
const NUT_ACT = {
  'fu-n': el => { const d = el.dataset.d, k = el.dataset.k, v = +el.dataset.v; fuelEdit(d, f => { f[k] = (f[k] || 0) === v ? v - 1 : v; }); },
  'fu-chk': el => { const d = el.dataset.d, k = el.dataset.k; fuelEdit(d, f => { f[k] = !f[k]; if (!f[k]) delete f[k]; }); },
  'nut-diet': el => { editProfile(p => { p.nut = Object.assign({}, p.nut, { diet: el.dataset.v }); }); render(); },
  'nut-goal': el => { editProfile(p => { p.nut = Object.assign({}, p.nut, { goal: el.dataset.v }); }); render(); },
  'nut-sex': el => { editProfile(p => { p.nut = Object.assign({}, p.nut, { sex: el.dataset.v }); }); render(); },
  'nu-day': el => { S.route.nd = el.dataset.v || null; const fromList = !!el.closest('.nu-hist'); render(); if (fromList) { const c = $('#nu-day'); if (c) c.scrollIntoView({ block: 'start', behavior: 'smooth' }); } },
  nutset: () => { go({ view: 'settings' }); setTimeout(() => { const e = $('#nut-settings'); if (e) e.scrollIntoView({ block: 'start' }); }, 60); }
};
const NUT_LIMITS = { kg: [25, 300], cm: [120, 230], by: [1930, 2015] };
const NUT_IN = {
  fu: (el, ev) => {
    const d = el.dataset.d, k = el.dataset.k;
    deferSave(el.id, () => {
      const v = num(el.value);
      editLog(d, l => { l.fuel = Object.assign({}, l.fuel); if (v == null) delete l.fuel[k]; else l.fuel[k] = v; }, { render: false });
      if (v != null) { const pr = S.profiles[S.pid] || {}; if (!pr.fuelFrom || d < pr.fuelFrom) editProfile(p => { p.fuelFrom = d; }); }
      if (k === 'kg' && v && v >= NUT_LIMITS.kg[0] && v <= NUT_LIMITS.kg[1] && d === todayISO()) editProfile(p => { p.nut = Object.assign({}, p.nut, { kg: v }); });
      if (ev === 'change') renderSoon();
    }, ev === 'change' ? 0 : 700);
  },
  nut: (el, ev) => {
    const k = el.dataset.k;
    deferSave(el.id, () => { const v = num(el.value), L = NUT_LIMITS[k]; if (v != null && (v < L[0] || v > L[1])) return; editProfile(p => { p.nut = Object.assign({}, p.nut, { [k]: v }); }); if (ev === 'change') renderSoon(); }, ev === 'change' ? 0 : 700);
  }
};

/* ---------- Share card (v24) ----------
   One tap on a finished day makes an image: days to race, the score, the session and what you did.
   It is drawn on a canvas right here on the phone (1080 × 1920 story or 1080 × 1080 square), then handed to the phone's
   share menu (navigator.share with the file: WhatsApp, Instagram Stories, Save Image) or downloaded.
   The score on the card is the workout score by default: the day's score without Fuel, scaled to 100, because Fuel is
   logged through the day and a morning share would otherwise look low. "Full day" and "Hide" are the other choices.
   No week bars, streak or training-partner line (v25). Choices (size, look, score, exercises, my name) are remembered on the device in hx.share. Notes, body weight and
   nutrition never go on the card. */
let SHARE = null; // { date, pid, size, look, score, ex, names, url, file, tok }
const scoreWord = v => v >= 85 ? 'Crushing it' : v >= 70 ? 'Strong day' : v >= 50 ? 'Solid' : v >= 25 ? 'Getting there' : v > 0 ? 'Started' : 'Not started yet';
function workoutScore(pid, date) { // the day's score without Fuel, out of 100
  const s = dayScore(pid, date); if (!s || s.score == null) return null;
  const ps = s.parts.filter(x => x.label !== 'Fuel'), mx = sum(ps.map(x => x.max));
  const v = mx ? Math.round(100 * sum(ps.map(x => x.pts)) / mx) : s.score;
  return { score: v, label: scoreWord(v), full: s.score, fullLabel: s.label, hasFuel: s.parts.some(x => x.label === 'Fuel') };
}
const shareTitle = (p, date) => { if (p.rest) return 'Rest day'; const h = (S.days[date] || {}).heading || p.session || ''; return h.includes(' · ') ? h.split(' · ').pop() : h; };
function shareData(pid, date, o) {
  const p = P(date), l = getLog(date, pid) || {}, day = S.days[date] || {}, race = RACE(), t = todayISO();
  const ws = workoutScore(pid, date) || { score: 0, label: '', full: 0, fullLabel: '' };
  const st = dayState(pid, date);
  const d = { brand: 'HYROX Training', dateLine: (o.names ? pname(pid) + ' · ' : '') + fmtDate(date), days: diffDays(date, race), raceLine: fmtDate(race) + ' ' + race.slice(0, 4), title: shareTitle(p, date), pills: [], stats: [], lists: [] };
  d.score = o.score === 'off' ? null : o.score === 'day' ? { v: ws.full || 0, w: ws.fullLabel, lab: date === t ? 'Today’s score' : 'Day score' } : { v: ws.score || 0, w: ws.label, lab: 'Workout score' };
  // pills: how it went, tests, where in the plan
  if (doneStates.has(st)) d.pills.push({ t: '✓ ' + (st === 'complete' ? 'Completed' : st === 'modified' ? 'Modified' : 'Logged'), k: 'ok' });
  else if (st === 'restdone') d.pills.push({ t: '✓ Recovered', k: 'ok' });
  if (p.tests.length) d.pills.push({ t: p.tests.length + (p.tests.length > 1 ? ' tests' : ' test'), k: 't' });
  d.pills.push({ t: (day.week ? 'Week ' + day.week : 'Kick-off week') + ' · Day ' + (S.order.indexOf(date) + 1) + ' of ' + S.order.length, k: '' });
  // numbers
  if (p.rest) {
    const r = l.rest || {}, acts = (r.acts || []).filter(a => a !== 'rest');
    if (r.min) d.stats.push({ big: String(r.min), unit: 'min', sub: 'recovery' });
    if (l.time) d.stats.push({ big: String(l.time), unit: 'min', sub: 'active' });
    const names = Object.fromEntries(typeof REST_ACTS !== 'undefined' ? REST_ACTS : []);
    const rows = (r.acts || []).map(a => [names[a] || a, '']);
    if (rows.length) d.lists.push({ h: 'What I did', rows });
  } else {
    let tot = 0, dn = 0, vol = 0;
    p.strength.forEach((ex, i) => { tot += ex.sets || 1; ((((l.str || {})[i] || {}).s) || []).forEach(x => { if (!x || !x.d) return; dn++; const w = num(x.w), r = num(x.r); if (w > 0 && r && !['s', 'm', 'min'].includes(ex.unit)) vol += r * w * (ex.dual ? 2 : 1); }); });
    if (p.strength.length) d.stats.push({ big: String(dn), unit: '/' + tot, sub: 'sets' });
    if (vol) d.stats.push({ big: Math.round(vol).toLocaleString('en-IN'), unit: 'kg', sub: 'lifted' });
    const runs = l.runs || [], km = sum(runs.map(r => r.dist || 0)), timed = runs.filter(r => r.dist && r.time);
    const pace = timed.length ? sum(timed.map(r => r.time)) / sum(timed.map(r => r.dist)) : null;
    if (km) d.stats.push({ big: fmtKm(km), unit: 'km', sub: pace ? 'run · ' + fmtPace(pace) + '/km' : 'running' });
    if (l.simTotal) d.stats.push({ big: String(l.simTotal), unit: '', sub: 'on the clock' });
    if (l.time) d.stats.push({ big: String(l.time), unit: 'min', sub: l.rpe ? 'effort RPE ' + l.rpe : 'session' });
    else if (l.rpe) d.stats.push({ big: String(l.rpe), unit: '/10', sub: 'effort (RPE)' });
    // tests first: they are the headline of a test day
    if (p.tests.length) d.lists.push({ h: 'Tests', rows: p.tests.map(tb => { const r = benchVal(pid, tb.id), bs = benchStatus(tb, r); return [tb.name, r && r.v ? r.v + (tb.kind === 'reps' ? ' reps' : '') : '–', bs ? (bs.cls === 'ok' ? 'good' : 'bad') : '', 'target ' + tb.target]; }) });
    if (o.ex && p.strength.length) {
      const rows = [];
      exOrder(date, l).forEach(i => {
        const ex = p.strength[i], s = ((((l.str || {})[i] || {}).s) || []).filter(x => x && x.d); if (!s.length) return;
        const reps = (() => { const c = {}; s.forEach(x => { const r = num(x.r); if (r) c[r] = (c[r] || 0) + 1; }); const k = Object.keys(c).sort((a, b) => c[b] - c[a])[0]; return k != null ? k : ex.reps; })();
        const w = Math.max(0, ...s.map(x => num(x.w) || 0)), u = ex.unit === 's' ? ' s' : ex.unit === 'm' ? ' m' : '';
        rows.push([ex.name.replace(/\s*\(.*?\)/g, ''), s.length + ' × ' + (reps != null ? reps : '') + u + (w ? ' · ' + w + ' kg' : ex.bw ? ' · BW' : '')]);
      });
      if (rows.length) d.lists.push({ h: 'What I did', rows });
    }
    if (o.ex && !p.hyrox.none) {
      const hx = l.hx || {}, rows = [];
      p.hyrox.rows.forEach(r => {
        if (r.kind !== 'station' || r.test) return; const e = hx[r.i]; if (!e || !(e.d || e.time)) return;
        const sub = String(r.sub || '').split(' · ').slice(0, 2).join(' · ').replace(/\babout\s+/gi, '≈').replace(/\s+total\b/gi, '').replace(/\bbodyweight\b/gi, 'BW').replace(/\s+reps\b/gi, '');
        rows.push([r.title, e.time ? String(e.time) : sub]);
      });
      if (rows.length) d.lists.push({ h: 'Stations', rows });
    }
  }
  // v25: no week bars, streak or training-partner line on the card
  return d;
}

/* ---- drawing ---- */
const SHARE_THEME = {
  dark: { bg: '#0B1024', surface: '#141A36', surface2: '#1A2144', ink: '#EEF2FF', ink2: '#C9D2F5', muted: '#9FABD8', line: '#262E57', line2: '#3A4370', head: '#8FB5FF', done: '#4FD69C', doneT: '#10352E', doneL: 'rgba(79,214,156,.45)', test: '#FFC24F', testT: '#3A2C12', testL: 'rgba(255,194,79,.45)', miss: '#FF7C68', label: '#FF7DBE', txt: ['#FF8A4C', '#FF62B0', '#B08FFF'], empty: '#2A3366', rest: '#4FD69C' },
  light: { bg: '#EEF1FB', surface: '#FFFFFF', surface2: '#F3F6FE', ink: '#162B6E', ink2: '#2B4383', muted: '#4F6392', line: '#D5DDF1', line2: '#B3C0DE', head: '#3035C2', done: '#0E7843', doneT: '#DDF4E7', doneL: 'rgba(14,120,67,.35)', test: '#9A5A00', testT: '#FDF0D8', testL: 'rgba(154,90,0,.35)', miss: '#C0301F', label: '#B8155F', txt: ['#D8420C', '#C81769', '#6522D6'], empty: '#D5DDF1', rest: '#0E7843' }
};
const SH_FILL = ['#E0440C', '#D3196F', '#6B24DE'];
const SH_FONT = { d: '"Big Shoulders Display", "Arial Narrow", Impact, sans-serif', b: '"IBM Plex Sans", system-ui, -apple-system, sans-serif', m: '"IBM Plex Mono", ui-monospace, Menlo, monospace' };
function drawShare(d, o) {
  const T = SHARE_THEME[o.look] || SHARE_THEME.dark, sq = o.size === 'square', W = 1080, H = sq ? 1080 : 1920, k = 3;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const font = (w, px, f) => { g.font = w + ' ' + Math.round(px * k) + 'px ' + SH_FONT[f]; };
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const lin = (x0, y0, x1, y1, cols) => { const gr = g.createLinearGradient(x0, y0, x1, y1); cols.forEach((cl, i) => gr.addColorStop(i / (cols.length - 1), cl)); return gr; };
  const fit = (txt, maxW) => { let s = String(txt); if (g.measureText(s).width <= maxW) return s; while (s.length > 1 && g.measureText(s + '…').width > maxW) s = s.slice(0, -1); return s.trimEnd() + '…'; };
  const gradText = (txt, x, y, align) => { const w = g.measureText(txt).width, x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x; g.fillStyle = lin(x0, y, x0 + w, y, T.txt); g.textAlign = 'left'; g.fillText(txt, x0, y); };
  // background
  if (o.look === 'light') { g.fillStyle = lin(0, 0, W * 0.45, H, ['#E2ECFF', '#ECE8FF', '#FFEDE3']); g.fillRect(0, 0, W, H); }
  else {
    g.fillStyle = T.bg; g.fillRect(0, 0, W, H);
    const glow = (x, y, r, col) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); };
    glow(0, -0.04 * H, 1.15 * W, 'rgba(42,33,112,.95)'); glow(W * 1.05, H * 0.18, 1.0 * W, 'rgba(10,54,86,.9)');
  }
  const X = 18 * k, CW = W - 2 * X; let y = 20 * k;
  g.textBaseline = 'alphabetic';
  // top row: brand and name · date
  font(800, 17, 'd'); gradText(d.brand.toUpperCase(), X, y + 14 * k);
  font(500, 12.5, 'b'); g.fillStyle = T.ink2; g.textAlign = 'right'; g.fillText(fit(d.dateLine, CW * 0.55), X + CW, y + 13 * k); g.textAlign = 'left';
  y += 28 * k;
  // hero: days to race + score
  const HH = (sq ? 140 : 160) * k, gap = 10 * k, cw = d.score ? (CW - gap) * 1.1 / 2.1 : CW;
  rr(X, y, cw, HH, 16 * k); g.fillStyle = lin(X, y + HH, X + cw, y, SH_FILL); g.fill();
  const hl = g.createRadialGradient(X + cw * 0.2, y - HH * 0.1, 0, X + cw * 0.2, y - HH * 0.1, cw * 0.8); hl.addColorStop(0, 'rgba(255,255,255,.22)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = hl; g.fill();
  g.fillStyle = '#FFFFFF';
  const big = d.days > 0 ? String(d.days) : d.days === 0 ? 'RACE' : '✓';
  font(800, sq ? 60 : 64, 'd'); g.fillText(big, X + 14 * k, y + (sq ? 62 : 66) * k);
  font(800, 17, 'd'); g.fillText(d.days > 0 ? (d.days === 1 ? 'DAY TO RACE' : 'DAYS TO RACE') : d.days === 0 ? 'DAY. GO.' : 'RACE DONE', X + 14 * k, y + (sq ? 88 : 94) * k);
  if (!sq) { font(500, 11.5, 'b'); g.globalAlpha = 0.92; g.fillText(d.raceLine, X + 14 * k, y + 111 * k); g.globalAlpha = 1; }
  if (d.score) {
    const sx = X + cw + gap, sw = CW - cw - gap, cx = sx + sw / 2;
    rr(sx, y, sw, HH, 16 * k); g.fillStyle = T.surface; g.fill(); g.lineWidth = 1.5 * k; g.strokeStyle = lin(sx, y + HH, sx + sw, y, SH_FILL); g.stroke();
    let ry = y + HH / 2 + (sq ? -4 : 2) * k; const R = (sq ? 31 : 34) * k, th = 7.5 * k;
    if (!sq) { font(600, 11, 'b'); g.fillStyle = T.muted; g.textAlign = 'center'; g.fillText(d.score.lab.toUpperCase(), cx, y + 24 * k); g.textAlign = 'left'; }
    g.lineCap = 'round'; g.lineWidth = th; g.strokeStyle = T.line; g.beginPath(); g.arc(cx, ry, R, 0, Math.PI * 2); g.stroke();
    const frac = Math.max(0, Math.min(1, (d.score.v || 0) / 100));
    if (frac > 0) { const a0 = -Math.PI / 2; g.strokeStyle = typeof g.createConicGradient === 'function' ? (() => { const cg = g.createConicGradient(a0, cx, ry); cg.addColorStop(0, T.txt[0]); cg.addColorStop(0.45, T.txt[1]); cg.addColorStop(1, T.txt[2]); return cg; })() : lin(cx - R, ry, cx + R, ry, T.txt); g.beginPath(); g.arc(cx, ry, R, a0, a0 + Math.PI * 2 * frac); g.stroke(); }
    g.lineCap = 'butt';
    font(800, sq ? 31 : 38, 'd'); gradText(String(d.score.v), cx, ry + (sq ? 11 : 13) * k, 'center');
    font(700, 13, 'b'); g.fillStyle = T.label; g.textAlign = 'center'; g.fillText(fit(d.score.w || '', sw - 12 * k), cx, y + HH - (sq ? 14 : 16) * k); g.textAlign = 'left';
  }
  y += HH + 12 * k;
  // title: shrink to fit, then two lines if it still doesn't
  g.fillStyle = T.head; let ts = sq ? 28 : 31; const title = d.title.toUpperCase();
  font(800, ts, 'd'); while (g.measureText(title).width > CW && ts > 22) { ts -= 1; font(800, ts, 'd'); }
  if (g.measureText(title).width <= CW) { g.fillText(title, X, y + ts * 0.8 * k); y += ts * 0.9 * k; }
  else { const wds = title.split(' '); let a = ''; while (wds.length && g.measureText((a + ' ' + wds[0]).trim()).width <= CW) a = (a + ' ' + wds.shift()).trim(); g.fillText(a, X, y + ts * 0.8 * k); g.fillText(fit(wds.join(' '), CW), X, y + ts * 1.7 * k); y += ts * 1.8 * k; }
  // pills
  {
    y += 6 * k; let px = X; font(600, 11, 'b');
    d.pills.forEach(pl => {
      const w = g.measureText(pl.t).width + 16 * k, h = 20 * k; if (px + w > X + CW) { px = X; y += h + 5 * k; }
      rr(px, y, w, h, h / 2); g.fillStyle = pl.k === 'ok' ? T.doneT : pl.k === 't' ? T.testT : T.surface2; g.fill(); g.lineWidth = 1 * k; g.strokeStyle = pl.k === 'ok' ? T.doneL : pl.k === 't' ? T.testL : T.line2; g.stroke();
      g.fillStyle = pl.k === 'ok' ? T.done : pl.k === 't' ? T.test : T.ink2; g.fillText(pl.t, px + 8 * k, y + 14 * k); px += w + 6 * k;
    });
    y += 20 * k;
  }
  y += 9 * k;
  // number tiles
  const stats = d.stats.slice(0, sq ? 3 : 4), cols = sq ? Math.max(1, stats.length) : 2, tg = 8 * k, tw = (CW - (cols - 1) * tg) / cols, thh = 54 * k;
  stats.forEach((s, i) => {
    const tx = X + (i % cols) * (tw + tg), ty = y + Math.floor(i / cols) * (thh + tg);
    rr(tx, ty, tw, thh, 12 * k); g.fillStyle = T.surface; g.fill(); g.lineWidth = 1 * k; g.strokeStyle = T.line; g.stroke();
    font(800, 25, 'd'); g.fillStyle = T.ink; const bw = g.measureText(s.big).width; g.fillText(s.big, tx + 11 * k, ty + 27 * k);
    if (s.unit) { font(800, 15, 'd'); g.fillStyle = T.ink2; g.fillText(s.unit, tx + 11 * k + bw + 2 * k, ty + 27 * k); }
    font(500, 11.5, 'b'); g.fillStyle = T.muted; g.fillText(fit(s.sub, tw - 20 * k), tx + 11 * k, ty + 45 * k);
  });
  if (stats.length) y += Math.ceil(stats.length / cols) * (thh + tg) + 2 * k;
  const maxY = H - 18 * k;
  // lists (story only), cut to what fits
  if (!sq) d.lists.forEach(li => {
    const rowH = 21 * k, head = 24 * k, pad = 8 * k; const room = Math.floor((maxY - y - head - pad) / rowH);
    if (room < Math.min(2, li.rows.length)) return; // not even two rows fit: leave this list off rather than show just "+ more"
    let rows = li.rows.slice(0, room); if (li.rows.length > room) rows = li.rows.slice(0, room - 1).concat([['+ ' + (li.rows.length - room + 1) + ' more', '', 'muted']]);
    const hh = head + rows.length * rowH + pad; rr(X, y, CW, hh, 12 * k); g.fillStyle = T.surface; g.fill(); g.lineWidth = 1 * k; g.strokeStyle = T.line; g.stroke();
    font(700, 10.5, 'b'); g.fillStyle = T.muted; g.fillText(li.h.toUpperCase(), X + 12 * k, y + 17 * k);
    rows.forEach((r, i) => {
      const ry = y + head + i * rowH; if (i) { g.fillStyle = T.line; g.fillRect(X + 12 * k, ry, CW - 24 * k, 1 * k); }
      font(500, 12.5, 'm'); let right = r[1] || '', rw = g.measureText(right).width, tail = r[3] ? ' · ' + r[3] : '';
      font(500, 11, 'b'); let tw2 = tail ? g.measureText(tail).width : 0;
      font(500, 12.5, 'b'); const lw = Math.min(g.measureText(r[0]).width, CW * 0.5);
      if (lw + rw + tw2 + 34 * k > CW) { tail = ''; tw2 = 0; } // the name comes first; drop the target if both don't fit
      font(500, 12.5, 'b'); g.fillStyle = r[2] === 'muted' ? T.muted : T.ink; g.fillText(fit(r[0], CW - 24 * k - rw - tw2 - 10 * k), X + 12 * k, ry + 15 * k);
      if (tail) { font(500, 11, 'b'); g.fillStyle = T.muted; g.textAlign = 'right'; g.fillText(tail, X + CW - 12 * k, ry + 15 * k); g.textAlign = 'left'; }
      font(500, 12.5, 'm'); g.fillStyle = r[2] === 'good' ? T.done : r[2] === 'bad' ? T.miss : T.ink2; g.textAlign = 'right'; g.fillText(right, X + CW - 12 * k - tw2, ry + 15 * k); g.textAlign = 'left';
    });
    y += hh + 8 * k;
  });
  return c;
}

/* ---- the sheet ---- */
function openShare(date) {
  if (!S.pid) { openWho(); return; }
  const prev = LS.get('hx.share', {}) || {};
  SHARE = Object.assign({ size: 'story', look: 'dark', score: 'workout', ex: true, names: true }, prev, { date: date || todayISO(), pid: S.pid, url: null, file: null, tok: 0 });
  openSheet('share'); shareDraw();
}
async function shareDraw() {
  const o = SHARE; if (!o) return; const tok = o.tok = (o.tok || 0) + 1;
  try { await Promise.all(['800 60px "Big Shoulders Display"', '500 20px "IBM Plex Sans"', '700 20px "IBM Plex Sans"', '500 20px "IBM Plex Mono"'].map(f => document.fonts.load(f))); } catch (e) { }
  if (SHARE !== o || o.tok !== tok) return;
  let c; try { c = drawShare(shareData(o.pid, o.date, o), o); } catch (e) { console.error(e); toast('Couldn’t draw the image.'); return; }
  o.url = c.toDataURL('image/png'); o.file = null;
  if (SHEET && SHEET.kind === 'share') renderSheet();
  c.toBlob(b => {
    if (SHARE !== o || o.tok !== tok || !b) return;
    o.file = new File([b], 'hyrox-' + o.date + (o.size === 'square' ? '-square' : '-story') + '.png', { type: 'image/png' });
    if (SHEET && SHEET.kind === 'share') renderSheet();
  }, 'image/png');
}
function sheetShare() {
  const o = SHARE || {}, ws = o.pid ? workoutScore(o.pid, o.date) : null;
  const seg = (key, list) => '<div class="seg">' + list.map(([v, t]) => '<button data-a="sh-opt" data-k="' + key + '" data-v="' + v + '" aria-pressed="' + (o[key] === v) + '">' + t + '</button>').join('') + '</div>';
  const tog = (key, t) => '<button class="chip sh-tog" data-a="sh-opt" data-k="' + key + '" data-v="' + (o[key] ? '0' : '1') + '" aria-pressed="' + !!o[key] + '">' + I.check + t + '</button>';
  const fld = (lab, h) => '<div class="field"><span>' + lab + '</span>' + h + '</div>';
  const note = ws && ws.hasFuel ? '<p class="small muted">Workout score leaves out Fuel, which you log through the day. Now: workout ' + ws.score + ', full day ' + ws.full + '.</p>' : '';
  const ready = !!o.file;
  return {
    title: 'Share ' + (o.date === todayISO() ? 'today' : esc(fmtDate(o.date))),
    body: '<div class="sh-wrap"><div class="sh-prev' + (o.size === 'square' ? ' sq' : '') + '">' + (o.url ? '<img id="sh-img" src="' + o.url + '" alt="Preview of the image to share">' : '<div class="sh-wait">Drawing…</div>') + '</div>' +
      '<div class="sh-opts">' + fld('Size', seg('size', [['story', 'Story'], ['square', 'Square']])) + fld('Look', seg('look', [['dark', 'Dark'], ['light', 'Light']])) + fld('Score', seg('score', [['workout', 'Workout'], ['day', 'Full day'], ['off', 'Off']])) + note +
      '<div class="chips">' + tog('ex', 'Exercises') + tog('names', 'My name') + '</div></div></div>' +
      '<div class="sh-btns"><button class="btn primary lg block" data-a="sh-share"' + (ready ? '' : ' disabled') + '>' + I.share + 'Share…</button><button class="btn block" data-a="sh-save"' + (ready ? '' : ' disabled') + '>Download image</button></div>' +
      '<p class="small muted" style="text-align:center;margin-top:8px">Share opens your phone’s menu: WhatsApp, Instagram Stories, or Save Image to put it in Photos. Your notes, weight and nutrition are never on the card.</p>'
  };
}
function shareSave(f) { const url = URL.createObjectURL(f), a = document.createElement('a'); a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
const SHARE_ACT = {
  share: el => { if (MODE) closeMode(); openShare(el.dataset.d || curDate()); },
  'sh-opt': el => {
    if (!SHARE) return; const key = el.dataset.k; let v = el.dataset.v; if (key === 'ex' || key === 'names') v = v === '1';
    SHARE[key] = v; LS.set('hx.share', { size: SHARE.size, look: SHARE.look, score: SHARE.score, ex: SHARE.ex, names: SHARE.names });
    SHARE.file = null; renderSheet(); shareDraw();
  },
  'sh-share': () => { // no await before navigator.share: iPhones only allow it straight from the tap
    const f = SHARE && SHARE.file; if (!f) return;
    if (navigator.canShare && navigator.share && navigator.canShare({ files: [f] })) navigator.share({ files: [f] }).catch(e => { if (!e || e.name !== 'AbortError') toast('Couldn’t open the share menu. Use Download image instead.'); });
    else { shareSave(f); toast('Image downloaded'); }
  },
  'sh-save': () => { const f = SHARE && SHARE.file; if (f) { shareSave(f); toast('Image downloaded'); } }
};

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

/* ---------- v29: edit the warm-up and cooldown (take items out, add your own) ----------
   Each person can take items out of their warm-up and cooldown and add their own, either just for that day
   ("Just today", kept in the day's log) or for every day from then on ("Every day", kept in their profile).
     log.rm[g]            { <plan index>: true, '+<key>': true }  taken out just that day (plan items / every-day additions)
     log.xl[g]            [{ t, d }]                             added just that day (as before v29)
     log.xe[g]            { <key>: true }                        ticks on every-day additions
     profile.lists[g].rm  [{ t, from, to? }]                     plan items taken out every day (matched by their text)
     profile.lists[g].add [{ t, from, to? }]                     added to every day that has this list in the plan
   "Every day" starts on the day it's changed. Putting something back ends the change on that day rather than deleting
   it, so earlier days keep what they had (and their score).
   v20: the Accessory & core card works the same way (g = 'acc'). Its plan items change wording from week to week
   ("Plank — 3 × 30–45 s", "… 2 × …" in an easy week), so an every-day removal is kept and matched by the exercise's
   name. An item that is also in the day's Main strength is left out of the list: one exercise, one place. */
const LE = {}; // list cards in edit mode on this device: LE.wu / LE.cd / LE.acc; LE['wu:every'] = the "Every day" choice
const LE_NAME = { wu: 'warm-up', cd: 'cooldown', acc: 'accessory & core' };
const leRmT = (g, t) => g === 'acc' ? accLabel(t) : t; // what an every-day removal remembers
const leRmK = (g, t) => leKey(leRmT(g, t));
const leKey = t => String(t || '').trim().toLowerCase().replace(/\s+/g, ' ');
const leOn = (e, date) => !!e && !!e.from && e.from <= date && (!e.to || date < e.to);
const leLists = pid => ((S.profiles[pid] || {}).lists) || {};
function listView(pid, date, g) { // what this person's warm-up / cooldown shows on this day
  const p = P(date), l = getLog(date, pid) || {}, items = p ? listItems(p, g) : [], on = l[g] || {};
  const pl = leLists(pid)[g] || {}, rmT = (l.rm || {})[g] || {}, xe = (l.xe || {})[g] || {};
  const rmE = new Set((pl.rm || []).filter(e => leOn(e, date)).map(e => leKey(e.t)));
  const inMain = g === 'acc' && p ? new Set(p.strength.map(ex => glKey(ex.name))) : null, dup = t => !!inMain && inMain.has(accKey(t)); // v20
  const rows = [], adds = [], removed = []; let n = 0, done = 0, head = null;
  items.forEach((it, i) => {
    if (it.h) { head = { k: 'h', h: it.h, note: it.note }; return; }
    if (dup(it.t)) return;
    const every = rmE.has(leRmK(g, it.t));
    if (rmT[i] || every) { removed.push({ k: 'plan', i, t: it.t, every, today: !!rmT[i] }); return; }
    if (head) { rows.push(head); head = null; } // a heading only shows when something under it is left
    rows.push({ k: 'plan', i, t: it.t, d: !!on[i] }); n++; if (on[i]) done++;
  });
  const planned = items.some(it => !it.h) || (g === 'acc' && !!p && p.strength.length > 0), seen = new Set(); // accessory: any day with strength work
  if (planned) {
    (pl.add || []).forEach(e => {
      const key = leKey(e.t); if (!leOn(e, date) || seen.has(key)) return; seen.add(key);
      if (dup(e.t)) return;
      if (rmT['+' + key]) removed.push({ k: 'xe', key, t: e.t, today: true });
      else { adds.push({ k: 'xe', key, t: e.t, d: !!xe[key] }); n++; if (xe[key]) done++; }
    });
    (pl.add || []).forEach(e => { const key = leKey(e.t); if (seen.has(key) || e.to !== date) return; seen.add(key); removed.push({ k: 'xe', key, t: e.t, every: true, ended: true }); });
  }
  ((l.xl || {})[g] || []).forEach((x, i) => { if (dup(x.t)) return; adds.push({ k: 'xl', i, t: x.t, d: !!x.d }); n++; if (x.d) done++; });
  return { rows, adds, removed, n, done, planned };
}
function leEditProfile(g, fn) {
  editProfile(cur => {
    cur.lists = Object.assign({}, cur.lists); const L = cur.lists[g] = Object.assign({}, cur.lists[g]);
    fn(L);
    ['rm', 'add'].forEach(k => { if (L[k] && !L[k].length) delete L[k]; });
    if (!Object.keys(L).length) delete cur.lists[g];
    if (!Object.keys(cur.lists).length) delete cur.lists;
  }, S.pid);
}
// end an every-day entry on `date` (or drop it if it started that day); earlier days keep it
const leEnd = (arr, key, date) => (arr || []).map(e => leKey(e.t) === key && leOn(e, date) ? (e.from >= date ? null : Object.assign({}, e, { to: date })) : e).filter(Boolean);
const leCanLog = date => !!S.pid && canWriteDoc('logs', logKey(S.pid, date));
const leCanEvery = date => leCanLog(date) && canWriteDoc('profiles', S.pid); // not for a training partner's log
function editListCard(title, sub, g, o, date) {
  const v = listView(S.pid, date, g), canLog = leCanLog(date), canEvery = leCanEvery(date);
  if (!v.rows.length && !v.adds.length && !v.removed.length && !canLog) return '';
  const ed = canLog && !!LE[g], every = canEvery && !!LE[g + ':every'], dayTxt = date === todayISO() ? 'today' : fmtDate(date, false);
  const grp = (h, first) => '<div class="grp" style="margin-top:' + (first ? 0 : 12) + 'px">' + esc(h) + '</div>';
  const xBtn = (r, extra) => '<button class="iconbtn sm" data-a="le-rm" data-g="' + g + '" data-k="' + r.k + '"' + extra + ' aria-label="Remove ' + esc(r.t) + '">' + I.close + '</button>';
  const idA = r => r.k === 'xe' ? ' data-key="' + esc(r.key) + '"' : ' data-i="' + r.i + '"';
  let body = '';
  v.rows.forEach((r, q) => {
    if (r.k === 'h') return; // v30: no "WU-S · Strength warm-up" / "CD-1 · Cooldown" headings or their notes
    body += ed ? '<div class="lerow"><span class="lbl">' + esc(r.t) + '</span>' + xBtn(r, idA(r)) + '</div>' : checkBtn(g, r.i, r.d, r.t);
  });
  if (v.adds.length) body += grp('Your additions', !body) + v.adds.map(a => ed
    ? '<div class="lerow"><span class="lbl">' + esc(a.t) + '<small>' + (a.k === 'xe' ? 'Every day' : 'Just ' + dayTxt) + '</small></span>' + xBtn(a, idA(a)) + '</div>'
    : '<button class="check" data-a="' + (a.k === 'xe' ? 'le-chk' : 'xl-chk') + '" data-g="' + g + '"' + idA(a) + ' aria-pressed="' + a.d + '"><span class="box">' + I.check + '</span><span class="lbl">' + esc(a.t) + '</span></button>').join('');
  const empty = !body;
  if (empty && !ed && v.removed.length) body = '<p class="small muted">Everything is taken out.</p>';
  let foot = '';
  if (ed) {
    if (g === 'acc') foot += '<div class="row addrow"><button class="btn sm" data-a="pk-acc">' + I.plus + 'Pick from the exercise list</button></div>'; // v20
    foot += '<div class="row addrow"><input class="inp" id="xl-in-' + g + '" data-xl="' + g + '" placeholder="' + (g === 'acc' ? 'Or type your own' : 'Add an item') + (every ? ' to every day' : '') + '" style="flex:1;min-width:0"><button class="btn sm" data-a="xl-add" data-g="' + g + '">' + I.plus + 'Add</button></div>';
    if (v.removed.length) foot += grp('Taken out') + v.removed.map(r => {
      const ev = r.every || r.ended, back = ev ? canEvery : true;
      return '<div class="lerow rm"><span class="lbl">' + esc(r.t) + '<small>' + (ev ? 'Every day' : 'Just ' + dayTxt) + '</small></span>' + (back ? '<button class="btn sm" data-a="le-back" data-g="' + g + '" data-k="' + r.k + '"' + idA(r) + '>Put back</button>' : '') + '</div>';
    }).join('');
    foot += '<button class="btn block ledone2" data-a="le-edit" data-g="' + g + '">' + I.check + 'Done</button>';
  } else if (canLog || v.removed.length) foot += '<div class="lefoot">' + (canLog ? '<button class="btn sm ghost" data-a="le-edit" data-g="' + g + '">' + I.edit + 'Edit ' + title.toLowerCase() + '</button>' : '') + (v.removed.length ? '<span class="small muted">' + v.removed.length + ' taken out</span>' : '') + '</div>';
  const scope = ed ? '<div class="lescope">' + (canEvery ? '<div class="seg" role="group" aria-label="Changes apply to"><button data-a="le-scope" data-g="' + g + '" data-v="day" aria-pressed="' + !every + '">Just ' + (date === todayISO() ? 'today' : 'this day') + '</button><button data-a="le-scope" data-g="' + g + '" data-v="every" aria-pressed="' + every + '">Every day</button></div>' : '') +
    '<p class="small muted">' + (every ? 'Changes apply from ' + dayTxt + ' on, wherever the item is in your plan. Earlier days stay as they were.' : 'Changes apply to ' + (date === todayISO() ? 'today' : dayTxt) + ' only.') + ' Tap × to take an item out.</p></div>' : '';
  const allBtn = !ed && canLog && v.n ? '<button class="btn sm ghost exall" data-a="chk-all" data-g="' + g + '">' + (v.done >= v.n ? 'Untick all' : I.check + 'Tick all') + '</button>' : '';
  const edBtn = ed ? '<button class="btn sm exall ledone" data-a="le-edit" data-g="' + g + '">' + I.check + 'Done</button>' : '';
  return '<section class="card ' + o + (ed ? ' leediting' : '') + '"><div class="card-h"><h3>' + title + '</h3><span class="sp"></span><span class="mono small muted">' + (v.n ? v.done + '/' + v.n : 'Nothing planned') + '</span>' + allBtn + edBtn + '</div>' +
    (g === 'acc' && !ed ? '<p class="small muted le-what">Core and finishers. Tick when done; no weights.</p>' : '') + // v20
    scope + // v30: no "WU-S." / "CD-1, extra time on …" line under the title
    (v.n && !ed ? '<div class="progressline" style="margin-bottom:6px"><i style="width:' + Math.round(100 * v.done / v.n) + '%"></i></div>' : '') + '<div class="checks">' + body + '</div>' + foot + '</section>';
}
function leAdd(g) { // "Every day" add (the "Just today" add is the old xl-add)
  const i = $('#xl-in-' + g), v = i && i.value.trim(), date = curDate();
  if (!v) { if (i) i.focus(); return; }
  const key = leKey(v);
  if (listView(S.pid, date, g).adds.some(a => a.k === 'xe' && a.key === key)) { toast('Already in your every-day ' + LE_NAME[g]); return; }
  i.blur();
  leEditProfile(g, L => { L.add = (L.add || []).concat([{ t: v.slice(0, 120), from: date }]); });
  toast('Added to every day from ' + (date === todayISO() ? 'today' : fmtDate(date, false)));
  render(); setTimeout(() => { const j = $('#xl-in-' + g); if (j) j.focus(); }, 60);
}
let ACT0_XL_ADD = null; // the "Just today" add, kept by patch.py before LIST_ACT goes in
const LIST_ACT = {
  'le-edit': el => { const g = el.dataset.g; LE[g] = !LE[g]; if (LE[g]) setFold(g, false); render(); if (LE[g]) setTimeout(() => { const c = document.querySelector('#view section[data-fold="' + g + '"]'); if (c && c.getBoundingClientRect().top < 60) c.scrollIntoView({ block: 'start' }); }, 30); },
  'le-scope': el => { LE[el.dataset.g + ':every'] = el.dataset.v === 'every'; render(); },
  'le-chk': el => { const g = el.dataset.g, k = el.dataset.key; editLog(curDate(), l => { l.xe = l.xe || {}; const o = l.xe[g] = Object.assign({}, l.xe[g]); if (o[k]) delete o[k]; else o[k] = true; if (!Object.keys(o).length) delete l.xe[g]; if (!Object.keys(l.xe).length) delete l.xe; }, { render: false }); render(); },
  'le-rm': el => {
    const g = el.dataset.g, k = el.dataset.k, date = curDate(), every = !!LE[g + ':every'] && leCanEvery(date);
    if (k === 'xl') { const i = +el.dataset.i; editLog(date, l => { const a = (l.xl || {})[g] || []; a.splice(i, 1); }); return; }
    if (k === 'plan') {
      const i = el.dataset.i, it = listItems(P(date), g)[+i]; if (!it || it.h) return;
      if (every) { leEditProfile(g, L => { L.rm = (L.rm || []).concat([{ t: leRmT(g, it.t), from: date }]); }); toast('Taken out of every day from ' + (date === todayISO() ? 'today' : fmtDate(date, false))); render(); }
      else editLog(date, l => { l.rm = l.rm || {}; l.rm[g] = Object.assign({}, l.rm[g]); l.rm[g][i] = true; });
      return;
    }
    if (k === 'xe') {
      const key = el.dataset.key;
      if (every) { leEditProfile(g, L => { L.add = leEnd(L.add, key, date); }); render(); }
      else editLog(date, l => { l.rm = l.rm || {}; l.rm[g] = Object.assign({}, l.rm[g]); l.rm[g]['+' + key] = true; });
    }
  },
  'le-back': el => {
    const g = el.dataset.g, k = el.dataset.k, date = curDate(), lg = getLog(date) || {}, rmT = (lg.rm || {})[g] || {};
    const unRm = f => editLog(date, l => { if (!l.rm || !l.rm[g]) return; l.rm[g] = Object.assign({}, l.rm[g]); delete l.rm[g][f]; if (!Object.keys(l.rm[g]).length) delete l.rm[g]; if (!Object.keys(l.rm).length) delete l.rm; });
    if (k === 'plan') {
      const i = el.dataset.i, it = listItems(P(date), g)[+i]; if (!it) return; const key = leRmK(g, it.t);
      if (rmT[i]) unRm(i);
      if (leCanEvery(date) && ((leLists(S.pid)[g] || {}).rm || []).some(e => leKey(e.t) === key && leOn(e, date))) { leEditProfile(g, L => { L.rm = leEnd(L.rm, key, date); }); render(); }
      return;
    }
    if (k === 'xe') {
      const key = el.dataset.key;
      if (rmT['+' + key]) unRm('+' + key);
      else if (leCanEvery(date)) { leEditProfile(g, L => { let done = false; L.add = (L.add || []).map(e => { if (!done && leKey(e.t) === key && e.to === date) { done = true; const o = Object.assign({}, e); delete o.to; return o; } return e; }); }); render(); }
    }
  },
  'xl-add': el => {
    const g = el.dataset.g, date = curDate();
    if (g === 'acc') { // v20: one exercise, one place
      const i = $('#xl-in-acc'), k = accKey(i ? i.value.trim() : '');
      if (k && P(date).strength.some(e => glKey(e.name) === k)) { toast('Already in Main strength.'); return; }
      if (k && gymAccShown(date).some(r => accKey(r.t) === k)) { toast('Already in Accessory & core.'); return; }
    }
    if ((g === 'wu' || g === 'cd' || g === 'acc') && LE[g + ':every'] && leCanEvery(date)) return leAdd(g);
    if (ACT0_XL_ADD) ACT0_XL_ADD(el);
  },
};

/* ---------- v16: dropdowns stay open ----------
   A <details> you opened stays open when the screen redraws (deleting a row inside it, a sync, a tick).
   Each one is known by where it is (the page, the sheet or gym mode), its summary text with the numbers
   taken out ("All check-ins (5)" and "(4)" are the same one) and which of that name it is on the screen. */
const DOPEN = new Set();
function dScope(root) { return root.id === 'sheet' ? 'sheet:' + (typeof PICK !== 'undefined' && PICK ? 'pick' : SHEET ? SHEET.kind : '') : root.id === 'mode' ? 'mode' : 'view:' + (S.route ? S.route.view : ''); }
function dKeys(root) {
  const seen = {}, sc = dScope(root);
  return [...root.querySelectorAll('details')].map(d => {
    const s = d.querySelector(':scope > summary');
    const t = (s ? s.textContent : '').replace(/\d+([.,]\d+)?/g, '#').replace(/\s+/g, ' ').trim();
    const n = seen[t] = (seen[t] || 0) + 1;
    return [d, sc + '|' + t + '|' + n];
  });
}
function keepOpen(root) { if (!root || !DOPEN.size) return; dKeys(root).forEach(([d, k]) => { if (DOPEN.has(k) && !d.open) d.open = true; }); }
document.addEventListener('toggle', e => {
  const d = e.target; if (!d || d.tagName !== 'DETAILS') return;
  const root = d.closest('#view, #sheet, #mode'); if (!root) return; // already redrawn away
  const hit = dKeys(root).find(x => x[0] === d); if (!hit) return;
  if (d.open) DOPEN.add(hit[1]); else DOPEN.delete(hit[1]);
}, true);

/* ---------- a scrolling row of tabs keeps its place ----------
   Progress has more tabs than fit on a phone. Picking one redraws the screen, which put the row back at its start, so
   the tab you just picked (Body, Journal…) was out of sight. The row now stays where you scrolled it, and the picked
   tab is always brought into view. */
function tabsSave(root, key) { return { key, x: [...root.querySelectorAll('.scrollx')].map(e => e.scrollLeft) }; }
function tabsRestore(root, was, key) {
  [...root.querySelectorAll('.scrollx')].forEach((e, i) => {
    if (was && was.key === key && was.x[i] != null) e.scrollLeft = was.x[i];
    const on = e.querySelector('[aria-pressed="true"]'); if (!on) return;
    const r = on.getBoundingClientRect(), b = e.getBoundingClientRect();
    if (r.left < b.left) e.scrollLeft -= b.left - r.left + 12; else if (r.right > b.right) e.scrollLeft += r.right - b.right + 12;
  });
}

/* ---------- v32 (from GymFloorCoach): the exercise library, the exercise picker, your own exercises, the muscle map ----------
   - GYM_LIB: about 170 gym exercises, each with the muscles it works (primary, secondary; keys of MUSCLE_NAMES) and
     whether it's cardio / full body. The muscle groups the picker filters by come from the primary muscles.
   - The picker (gymPick): opens over any sheet (or on its own) wherever exercises are added: the day editor, "Add
     exercise" on a day, Accessory & core, Change exercises. Filter by muscle group, search, tick several,
     "Add 3 exercises". Not in the list: type it, pick its muscle group, and it goes into your own list (myex/<uid>;
     everyone can read it, because an exercise you add to the shared plan shows on everyone's day and their phone
     needs its muscle group; only you can change it).
   - Muscles worked (musclesFor in patch.py) asks gymMusclesOf(name): the library, then your own list, then the
     library without the equipment words ("Seated row" → row), then word rules (fixed in v14: rear-delt flys,
     "benchmark", back extensions, glute-ham raise, upright row, wrist curl, adductors, cardio machines…). */

const GL_GROUPS = [['chest', 'Chest'], ['back', 'Back'], ['shoulders', 'Shoulders'], ['biceps', 'Biceps & forearms'], ['triceps', 'Triceps'], ['quads', 'Quads'], ['hams', 'Hamstrings'], ['glutes', 'Glutes & hips'], ['calves', 'Calves & shins'], ['core', 'Core'], ['cardio', 'Cardio & full body']];
const GL_NAME = Object.fromEntries(GL_GROUPS);
const GL_OF = { chest: 'chest', lats: 'back', midback: 'back', lowback: 'back', traps: 'back', delts: 'shoulders', biceps: 'biceps', forearms: 'biceps', triceps: 'triceps', quads: 'quads', hams: 'hams', glutes: 'glutes', adductors: 'glutes', calves: 'calves', abs: 'core', obliques: 'core' };
const GL_MUSC = { chest: [['chest'], ['triceps', 'delts']], back: [['lats', 'midback'], ['biceps']], shoulders: [['delts'], ['triceps']], biceps: [['biceps'], ['forearms']], triceps: [['triceps'], []], quads: [['quads'], ['glutes']], hams: [['hams'], ['glutes']], glutes: [['glutes'], ['hams']], calves: [['calves'], []], core: [['abs'], ['obliques']], cardio: [['quads', 'hams', 'calves'], ['glutes']] }; // your own exercises, by the group you picked

// name | primary muscles | secondary muscles | c = cardio / full body
const GYM_LIB_SRC = `
Barbell bench press|chest|triceps,delts
Incline barbell bench press|chest|delts,triceps
Decline barbell bench press|chest|triceps
Dumbbell bench press|chest|triceps,delts
Incline dumbbell bench press|chest|delts,triceps
Incline dumbbell press|chest|delts,triceps
Dumbbell floor press|chest|triceps
Machine chest press|chest|triceps,delts
Smith machine bench press|chest|triceps,delts
Push-up|chest|triceps,delts,abs
Incline push-up|chest|triceps,delts
Chest dip|chest|triceps,delts
Cable fly|chest|delts
Dumbbell fly|chest|delts
Pec deck fly|chest|delts
Machine chest fly|chest|delts
Cable crossover|chest|delts
Dumbbell pullover|chest,lats|triceps
Landmine press|delts,chest|triceps
Pull-up|lats|biceps,midback,forearms
Chin-up|lats,biceps|midback,forearms
Assisted pull-up|lats|biceps,midback
Weighted pull-up|lats|biceps,midback,forearms
Lat pulldown|lats|biceps,midback
Neutral-grip lat pulldown|lats|biceps,midback
Close-grip lat pulldown|lats|biceps,midback
Straight-arm pulldown|lats|triceps,abs
Barbell row|lats,midback|biceps,lowback,delts
Pendlay row|lats,midback|biceps,lowback
One-arm dumbbell row|lats,midback|biceps,delts
Chest-supported dumbbell row|midback,lats|biceps,delts
Seated cable row|midback,lats|biceps,delts
T-bar row|midback,lats|biceps,lowback
Machine row|midback,lats|biceps
Inverted row|midback,lats|biceps,abs
Seal row|midback,lats|biceps,delts
Meadows row|lats,midback|biceps
High cable V-bar row|midback,lats|biceps,delts
Rack pull|lowback,traps|glutes,hams,forearms
Back extension|lowback|glutes,hams
Hyperextension|lowback|glutes,hams
Reverse hyperextension|glutes,lowback|hams
Good morning|hams,lowback|glutes
Superman|lowback|glutes
Barbell shrug|traps|forearms
Dumbbell shrug|traps|forearms
Shrug|traps|forearms
Band pull-apart|midback,delts|traps
Face pull|delts,midback|traps
Barbell overhead press|delts|triceps,traps,abs
Seated dumbbell shoulder press|delts|triceps
Dumbbell shoulder press|delts|triceps
Machine shoulder press|delts|triceps
Arnold press|delts|triceps
Push press|delts|triceps,quads,glutes
Dumbbell lateral raise|delts|traps
Cable lateral raise|delts|traps
Machine lateral raise|delts|traps
Front raise|delts|chest
Rear delt fly|delts|midback,traps
Reverse pec deck|delts|midback,traps
Rear-delt cable fly|delts|midback,traps
Upright row|delts,traps|biceps
Y-raise|delts|traps,midback
Pike push-up|delts|triceps,chest
Barbell curl|biceps|forearms
EZ-bar curl|biceps|forearms
Dumbbell curl|biceps|forearms
Hammer curl|biceps,forearms|
Incline dumbbell curl|biceps|forearms
Preacher curl|biceps|forearms
Cable curl|biceps|forearms
Concentration curl|biceps|forearms
Spider curl|biceps|forearms
Reverse curl|forearms,biceps|
Wrist curl|forearms|
Reverse wrist curl|forearms|
Dead hang|forearms|lats
Cable triceps pushdown|triceps|
Rope pushdown|triceps|
Overhead triceps extension|triceps|
Cable overhead triceps extension|triceps|
Skull crusher|triceps|
Close-grip bench press|triceps,chest|delts
Dip|triceps,chest|delts
Bench dip|triceps|chest,delts
Triceps kickback|triceps|
Diamond push-up|triceps,chest|delts
Barbell back squat|quads,glutes|adductors,hams,lowback
Back squat|quads,glutes|adductors,hams,lowback
Front squat|quads|glutes,abs,lowback
Goblet squat|quads,glutes|adductors,abs
Smith machine squat|quads,glutes|adductors
Hack squat|quads|glutes
Leg press|quads,glutes|adductors,hams
Bulgarian split squat|quads,glutes|adductors,hams
Split squat|quads,glutes|hams
Walking lunge|quads,glutes|hams,adductors,calves
Reverse lunge|quads,glutes|hams,adductors
Forward lunge|quads,glutes|hams
Step-up|quads,glutes|hams,calves
Leg extension|quads|
Sissy squat|quads|
Bodyweight squat|quads,glutes|
Jump squat|quads,glutes|calves
Pistol squat|quads,glutes|abs
Wall sit|quads|glutes
Box squat|quads,glutes|hams,lowback
Romanian deadlift|hams,glutes|lowback,forearms
Dumbbell Romanian deadlift|hams,glutes|lowback,forearms
Single-leg Romanian deadlift|hams,glutes|lowback,abs
Stiff-leg deadlift|hams|glutes,lowback
Lying leg curl|hams|calves
Seated leg curl|hams|calves
Standing leg curl|hams|calves
Nordic hamstring curl|hams|calves
Glute-ham raise|hams|glutes,calves
Swiss ball leg curl|hams|glutes
Sliding leg curl|hams|glutes
Cable pull-through|glutes,hams|lowback
Kettlebell swing|glutes,hams|lowback,delts,abs
Barbell deadlift|hams,glutes,lowback|traps,forearms,quads
Trap-bar deadlift|quads,glutes|hams,lowback,traps,forearms
Sumo deadlift|glutes,adductors,hams|quads,lowback,forearms
Kettlebell deadlift|glutes,hams|lowback,quads
Barbell hip thrust|glutes|hams
Hip thrust|glutes|hams
Glute bridge|glutes|hams
Single-leg glute bridge|glutes|hams
Cable glute kickback|glutes|hams
Hip abduction machine|glutes|
Hip adduction machine|adductors|
Banded side walk|glutes|
Frog pump|glutes|
Copenhagen plank|adductors,obliques|abs
Standing calf raise|calves|
Seated calf raise|calves|
Leg press calf raise|calves|
Single-leg calf raise|calves|
Tibialis raise|calves|
Plank|abs|obliques
Side plank|obliques|abs
Dead bug|abs|obliques
Bird dog|abs,lowback|glutes
Crunch|abs|
Decline crunch|abs|
Cable crunch|abs|obliques
Hanging leg raise|abs|obliques,forearms
Hanging knee raise|abs|obliques,forearms
Lying leg raise|abs|
Ab-wheel rollout|abs|lats,obliques
Pallof press|obliques|abs
Russian twist|obliques|abs
Cable woodchop|obliques|abs,delts
Hollow hold|abs|
Hollow rock|abs|
V-up|abs|
Sit-up|abs|
Plank shoulder taps|abs|obliques,delts
Suitcase carry|obliques|forearms,traps
Mountain climber|abs|delts,quads|c
Treadmill|quads,hams,calves|glutes|c
Incline walk|glutes,calves|hams,quads|c
Exercise bike|quads|hams,calves,glutes|c
Assault bike|quads,delts|hams,glutes|c
Rowing machine|quads,lats|midback,biceps,glutes|c
Cross-trainer|quads,glutes|hams,calves|c
Stair climber|quads,glutes|calves|c
Jump rope|calves|quads|c
SkiErg|lats,triceps|abs,delts|c
Burpee|quads,chest|delts,triceps,abs|c
Burpee broad jump|quads,glutes,chest|delts,triceps,calves|c
Box jump|quads,glutes|calves|c
Battle ropes|delts|abs,forearms|c
Farmer's carry|forearms,traps|abs,obliques|c
Sled push|quads,glutes,calves|chest,triceps|c
Sled pull|lats,hams|biceps,forearms,midback|c
Wall ball|quads,glutes,delts|triceps,abs|c
Thruster|quads,glutes,delts|triceps,abs|c
Sandbag lunge|quads,glutes|hams,adductors|c
Kettlebell clean and press|delts,glutes|hams,triceps|c
Power clean|glutes,hams,traps|quads,lowback,forearms|c
Turkish get-up|delts,abs|glutes,obliques|c
Bear crawl|delts,abs|quads,triceps|c
Jumping jacks|calves|delts|c
`;
const GYM_LIB = GYM_LIB_SRC.trim().split('\n').map(line => {
  const [n, a, b, c] = line.split('|'); const p = (a || '').split(',').filter(Boolean), s = (b || '').split(',').filter(Boolean);
  const g = [...new Set(p.map(m => GL_OF[m]).filter(Boolean))]; if (c) g.push('cardio');
  return { n, p, s, g: c ? ['cardio'] : g };
});
function glKey(n) { // "Push-ups, 2 s lowering" → "push-up"; "DB curl" → "dumbbell curl"; "Test 1: SkiErg" → "skierg"
  let s = String(n || '').split(/\s+—\s+/)[0].toLowerCase().replace(/\(.*?\)/g, '').replace(/,.*$/, '')
    .replace(/^(test\s*\d*|then|finisher|cardio|part\s*\d+)\s*:\s*/, '').replace(/\b(benchmark|technique|finisher)\b/g, '')
    .replace(/[’']/g, '').replace(/\bdb\b/g, 'dumbbell').replace(/\bbb\b/g, 'barbell').replace(/\bkb\b/g, 'kettlebell').replace(/\s+/g, ' ').trim();
  return s.split(' ').map(w => w.length > 3 && /[^s]s$/.test(w) ? w.slice(0, -1) : w).join(' ');
}
const GL_QUAL = /^(barbell|dumbbell|cable|machine|smith machine|kettlebell|ez-bar|ez bar|band|banded|weighted|assisted|seated|standing|lying|single-leg|single leg|one-arm|one arm|incline|decline|heavy|light|paused)\s+/;
function glBase(k) { let s = k, t; do { t = s; s = s.replace(GL_QUAL, ''); } while (s !== t); return s; }
const GL_BY = {}, GL_BASE = {};
GYM_LIB.forEach(x => { const k = glKey(x.n); GL_BY[k] = GL_BY[k] || x; const b = glBase(k); if (b && !GL_BASE[b]) GL_BASE[b] = x; });
const gymMyEx = () => ((S.myex || {})[S.uid] || {}).list || [];
const gymAllMyEx = () => gymMyEx().concat(...Object.keys(S.myex || {}).filter(u => u !== S.uid).map(u => (S.myex[u] || {}).list || [])); // yours first, then everyone else's (for the muscle map)

/* word rules for names in neither list (the first rule that matches wins) */
const MUSCLE_RULES2 = [
  [/rear.?delt|reverse (fly|pec)|face pull|band pull.?apart|y.?raise/, ['delts'], ['midback', 'traps']],
  [/upright row/, ['delts', 'traps'], ['biceps']],
  [/glute.?ham|nordic|leg curl|hamstring curl/, ['hams'], ['glutes', 'calves']],
  [/back extension|hyperextension|reverse hyper|superman/, ['lowback'], ['glutes', 'hams']],
  [/pull.?through/, ['glutes', 'hams'], ['lowback']],
  [/deadlift|\brdl\b|romanian|good morning/, ['hams', 'glutes', 'lowback'], ['traps', 'forearms', 'quads']],
  [/leg extension/, ['quads'], []],
  [/squat|leg press|step.?up/, ['quads', 'glutes'], ['adductors', 'hams', 'lowback']],
  [/lunge/, ['quads', 'glutes'], ['hams', 'adductors', 'calves']],
  [/adduct/, ['adductors'], []],
  [/abduct|hip thrust|glute bridge|glute|frog pump|kickback(?!.*tricep)/, ['glutes'], ['hams']],
  [/pull.?up|chin.?up|pulldown|pull-down/, ['lats', 'biceps'], ['midback', 'forearms', 'delts']],
  [/pullover/, ['chest', 'lats'], ['triceps']],
  [/\brows?\b|v-bar row/, ['lats', 'midback'], ['biceps', 'delts', 'forearms']],
  [/overhead press|shoulder press|\bohp\b|military|arnold|push press|landmine press|pike push/, ['delts'], ['triceps', 'traps']],
  [/lateral raise|front raise/, ['delts'], ['traps']],
  [/close.?grip bench|tricep|skull|pushdown|push-down|diamond push|bench dip|overhead extension/, ['triceps'], []],
  [/\bbench\b|push.?up|chest press|\bfly|flye|pec deck|crossover|\bdips?\b|floor press|\bpress\b/, ['chest'], ['triceps', 'delts']],
  [/wrist curl|reverse curl|dead hang/, ['forearms'], ['biceps']],
  [/curl/, ['biceps'], ['forearms']],
  [/calf|calves|tibialis/, ['calves'], []],
  [/side plank|oblique|pallof|woodchop|suitcase|russian twist|copenhagen/, ['obliques'], ['abs']],
  [/plank|dead ?bug|crunch|sit.?up|hollow|\bab\b|leg raise|knee raise|v-up|bird.?dog|core|rollout|mountain climber/, ['abs'], ['obliques']],
  [/farmer|carry|\bhold\b/, ['forearms', 'traps'], ['abs', 'obliques']],
  [/shrug/, ['traps'], ['forearms']],
  [/wall ?ball|thruster/, ['quads', 'glutes', 'delts'], ['triceps', 'abs']],
  [/kettlebell swing|\bswing/, ['glutes', 'hams'], ['lowback', 'delts']],
  [/burpee|broad jump|box jump|jump squat/, ['quads', 'glutes'], ['calves', 'chest']],
  [/clean|snatch|get.?up/, ['glutes', 'hams', 'delts'], ['traps', 'quads', 'abs']],
  [/skierg|ski erg|\bski\b/, ['lats', 'triceps'], ['abs', 'delts']],
  [/rowing|row erg|rower|\berg\b/, ['quads', 'lats'], ['midback', 'biceps', 'glutes']],
  [/sled push/, ['quads', 'glutes', 'calves'], ['chest', 'triceps']],
  [/sled pull|sled drag/, ['lats', 'hams'], ['biceps', 'forearms', 'midback']],
  [/battle rope|bear crawl/, ['delts', 'abs'], ['forearms']],
  [/treadmill|bike|cross.?trainer|elliptical|stair|walk|\brun\b|jog|jump rope|skipping|jumping jack/, ['quads', 'hams', 'calves'], ['glutes']]
];
function gymMusclesOf(name) { // [primary, secondary] or null
  const k = glKey(name); if (!k) return null;
  const lib = GL_BY[k]; if (lib) return [lib.p, lib.s];
  const own = gymAllMyEx().find(x => glKey(x.n) === k); if (own && GL_MUSC[own.g]) return GL_MUSC[own.g];
  const b = glBase(k), lb = GL_BASE[b] || GL_BY[b]; if (lb) return [lb.p, lb.s];
  const n = String(name).toLowerCase();
  for (const [re, a, s] of MUSCLE_RULES2) if (re.test(n)) return [a, s];
  return null;
}

/* ---- your own exercises (myex/<uid>: { list: [{ n, g }] }) ---- */
function gymMyExAdd(n, g) {
  const list = gymMyEx().slice(); n = String(n || '').trim().slice(0, 50); if (!n) return false;
  const k = glKey(n), i = list.findIndex(x => glKey(x.n) === k);
  if (i >= 0) list[i] = { n, g }; else list.push({ n, g });
  list.sort((a, b) => a.n.localeCompare(b.n));
  return put('myex', S.uid, { list });
}

/* ---- v20: one exercise, one place; holds start in seconds ----
   An exercise is in a session once: more of it is more sets. The picker greys out what the session already has
   (PICK.have: { key: label }) and says when adding to Main strength moves an item out of Accessory & core
   (PICK.note: { key: text }). Holds (plank, side plank, hollow hold, wall sit, dead hang) start at 3 × 30 s. */
const accKey = t => glKey(String(t || '').split(/\s+—\s+/)[0].replace(/\s+\d+\s*[×x]\s*\d.*$/, '')); // "Dead bug 3 × 10" and "Dead bug — 3 × 10" → "dead bug"
const accLabel = t => String(t || '').split(/\s+—\s+/)[0].replace(/\s+\d+\s*[×x]\s*\d.*$/, '').replace(/\s*\(easy this week\)\s*$/, '').trim();
const gymIsHold = n => { const k = glKey(n); return /plank|\bhold\b|wall sit|dead hang|l-sit/.test(k) && !/tap|jack|row|walk|up-down|reach|to push/.test(k); };
const gymStartReps = n => gymIsHold(n) ? (/side plank|copenhagen/.test(glKey(n)) ? '30 s/side' : '30 s') : '10';
const gymNewEx = n => ({ n, s: 3, r: gymStartReps(n) });
const gymNewEdEx = n => ({ name: n, sets: '3', reps: gymStartReps(n), load: '', rest: '90 s' });
const gymHaveMap = (names, label, key) => { const o = {}; (names || []).forEach(n => { const k = (key || glKey)(n); if (k) o[k] = label; }); return o; };
const gymDupIn = names => { const seen = new Set(); for (const n of names || []) { const k = glKey(n); if (!k) continue; if (seen.has(k)) return String(n).trim(); seen.add(k); } return ''; }; // the first name that's there twice
const gymDupMsg = (n, where) => (where ? where + ': ' : '') + '“' + n + '” is there twice. Remove one; for more of it, add sets.';
const gymFresh = (names, had) => { const seen = new Set((had || []).map(glKey)); return (names || []).filter(n => { const k = glKey(n); if (!k || seen.has(k)) return false; seen.add(k); return true; }); }; // names not there yet, each once
const IN_SESSION = 'Already in this session', IN_MAIN = 'Already in Main strength', IN_ACC = 'Already in Accessory & core', MOVE_NOTE = 'In Accessory & core. Adding it here moves it to Main strength.';
const gymAccShown = date => { const v = listView(S.pid, date, 'acc'); return v.rows.filter(r => r.k !== 'h').concat(v.adds); }; // what the Accessory & core card lists on this day
function gymEdDup() { // a name the day editor has more often than the day had before
  if (!ED) return ''; const cnt = {}, was = {};
  (ED.orig || []).forEach(n => { const k = glKey(n); was[k] = (was[k] || 0) + 1; });
  for (const e of ED.ex) { const k = glKey(e.name); if (!k) continue; cnt[k] = (cnt[k] || 0) + 1; if (cnt[k] > Math.max(1, was[k] || 0)) return e.name.trim(); }
  return '';
}

/* ---- the picker ---- */
let PICK = null;
function gymPick(o) { // o: { multi (default true), title, done(names), have { key: label } (can't be picked), note { key: text } }
  const el = $('#sheet .panel');
  PICK = Object.assign({ multi: true, q: '', grp: '', sel: [], ng: '', scroll: SHEET && el ? el.scrollTop : 0 }, o);
  if (!SHEET) SHEET = { kind: 'pick', opts: {} };
  renderSheet(); const p = $('#sheet .panel'); if (p) p.scrollTop = 0;
}
function gymPickClose(names) {
  const F = PICK; PICK = null; if (!F) return;
  if (SHEET && SHEET.kind === 'pick') closeSheet();
  if (names && names.length && F.done) F.done(names);
  if (SHEET && SHEET.kind !== 'pick') { renderSheet(); const p = $('#sheet .panel'); if (p) p.scrollTop = F.scroll || 0; }
}
function gymPickItems(grp, q) { // [{ n, sub, own }]
  const sub = g => g.map(x => GL_NAME[x]).filter(Boolean).join(' · ');
  const own = gymMyEx().map(x => ({ n: x.n, g: [x.g], sub: 'Your exercise · ' + (GL_NAME[x.g] || ''), own: true }));
  const lib = GYM_LIB.map(x => ({ n: x.n, g: x.g, sub: sub(x.g) }));
  let all = own.concat(lib.filter(x => !own.some(o => glKey(o.n) === glKey(x.n))));
  if (grp === 'mine') all = own; else if (grp) all = all.filter(x => x.g.includes(grp));
  if (q) { const w = q.toLowerCase().split(/\s+/).filter(Boolean); all = all.filter(x => { const n = x.n.toLowerCase(); return w.every(t => n.includes(t)); }); }
  return all.sort((a, b) => (b.own - a.own) || a.n.localeCompare(b.n));
}
function gymPickRow(x) {
  const F = PICK, on = F.sel.includes(x.n), k = glKey(x.n), hv = F.have && F.have[k], nt = F.note && F.note[k];
  if (hv) return '<button class="check pk-row pk-have" disabled><span class="box">' + I.check + '</span><span class="lbl"><b>' + esc(x.n) + '</b><small>' + esc(hv) + '</small></span></button>'; // v20
  return '<button class="check pk-row' + (nt ? ' pk-move' : '') + '" data-a="pk-tog" data-v="' + esc(x.n) + '" aria-pressed="' + on + '"><span class="box">' + I.check + '</span><span class="lbl"><b>' + esc(x.n) + '</b><small>' + esc(nt || x.sub) + '</small></span></button>';
}
function gymPickListHTML() {
  const F = PICK, q = F.q.trim(), items = gymPickItems(F.grp, q);
  const exact = q && (GL_BY[glKey(q)] || gymMyEx().some(x => glKey(x.n) === glKey(q)));
  const add = q && !exact ? '<div class="entry pk-new"><b class="small">Not in the list?</b><p class="small muted">Add “' + esc(q) + '” to your own exercises (only you see your list). Which muscles does it work?</p>' +
    '<div class="chips">' + GL_GROUPS.map(([k, n]) => '<button class="chip" data-a="pk-ng" data-v="' + k + '" aria-pressed="' + (F.ng === k) + '">' + esc(n) + '</button>').join('') + '</div>' +
    '<button class="btn sm primary" data-a="pk-new" style="align-self:flex-start"' + (F.ng ? '' : ' disabled') + '>' + I.plus + 'Add “' + esc(q.slice(0, 40)) + '”</button></div>' : '';
  if (!items.length) return add + '<p class="empty">' + (F.grp === 'mine' && !q ? 'You haven’t added any exercises of your own yet. Search for one; if it isn’t in the list you can add it.' : 'Nothing matches.') + '</p>';
  if (!F.grp && !q) { // everything, by muscle group
    const seen = new Set(), own = items.filter(x => x.own);
    return (own.length ? '<div class="grp">My exercises</div><div class="checks">' + own.map(x => { seen.add(x.n); return gymPickRow(x); }).join('') + '</div>' : '') +
      GL_GROUPS.map(([k, n]) => { const xs = items.filter(x => !seen.has(x.n) && x.g[0] === k); xs.forEach(x => seen.add(x.n)); return xs.length ? '<div class="grp">' + esc(n) + '</div><div class="checks">' + xs.map(gymPickRow).join('') + '</div>' : ''; }).join('');
  }
  return add + '<div class="checks">' + items.map(gymPickRow).join('') + '</div>';
}
function sheetPick() {
  const F = PICK, n = F.sel.length;
  const chips = [['', 'All']].concat(GL_GROUPS, [['mine', 'My exercises']]).map(([k, nm]) => '<button class="chip" data-a="pk-grp" data-v="' + k + '" aria-pressed="' + (F.grp === k) + '">' + esc(nm) + '</button>').join('');
  return { title: esc(F.title || (F.multi ? 'Add exercises' : 'Pick an exercise')), full: true, noClose: true, body: '<div class="stack pk">' +
    '<div class="row pk-top"><input class="inp" id="pk-q" placeholder="Search exercises" value="' + esc(F.q) + '" data-in="pkq" autocomplete="off" style="flex:1;min-width:0"><button class="btn" data-a="pk-cancel">Cancel</button></div>' +
    '<div class="chips pk-grps">' + chips + '</div>' +
    '<div id="pk-list">' + gymPickListHTML() + '</div>' +
    (F.multi ? '<div class="pk-foot"><span class="small muted" id="pk-sel">' + (n ? esc(F.sel.join(', ')) : 'Tick the exercises to add') + '</span><button class="btn primary" data-a="pk-done" id="pk-done"' + (n ? '' : ' disabled') + '>' + I.plus + (n ? 'Add ' + n + (n === 1 ? ' exercise' : ' exercises') : 'Add') + '</button></div>' : '') + '</div>' };
}
const gymPickFoot = () => { const F = PICK, n = F.sel.length, s = $('#pk-sel'), b = $('#pk-done'); if (s) s.textContent = n ? F.sel.join(', ') : 'Tick the exercises to add'; if (b) { b.disabled = !n; b.innerHTML = I.plus + (n ? 'Add ' + n + (n === 1 ? ' exercise' : ' exercises') : 'Add'); } };
const PICK_ACT = {
  'pk-tog': el => {
    const F = PICK; if (!F) return; const n = el.dataset.v;
    if (F.have && F.have[glKey(n)]) return;
    if (!F.multi) { gymPickClose([n]); return; }
    F.sel = F.sel.includes(n) ? F.sel.filter(x => x !== n) : F.sel.concat([n]);
    $$('#pk-list [data-a=pk-tog]').forEach(b => { if (b.dataset.v === n) b.setAttribute('aria-pressed', F.sel.includes(n)); }); gymPickFoot();
  },
  'pk-grp': el => { const F = PICK; if (!F) return; F.grp = el.dataset.v; renderSheet(); },
  'pk-ng': el => { const F = PICK; if (!F) return; F.ng = el.dataset.v; const b = $('#pk-list'); if (b) b.innerHTML = gymPickListHTML(); },
  'pk-new': () => {
    const F = PICK; if (!F || !F.ng) return; const n = F.q.trim().slice(0, 50); if (!n) return;
    if (F.have && F.have[glKey(n)]) { toast(F.have[glKey(n)] + '.'); return; }
    if (!gymMyExAdd(n, F.ng)) return;
    toast('“' + n + '” is in your exercises now.');
    if (!F.multi) { gymPickClose([n]); return; }
    if (!F.sel.includes(n)) F.sel.push(n); F.q = ''; F.ng = ''; F.grp = 'mine'; renderSheet();
  },
  'pk-done': () => { const F = PICK; if (F) gymPickClose(F.sel.slice()); },
  'pk-cancel': () => gymPickClose(null),
  // where the picker is used without a sheet underneath
  'pk-day': el => { // "Add exercise" on a day: straight into that day's plan (for everyone), 3 × 10 each (holds: 3 × 30 s)
    const date = el.dataset.d, p = P(date); if (!canEditPlan()) { toast(PT_NO); return; }
    gymPick({ have: gymHaveMap(p.strength.map(e => e.name), IN_SESSION), note: gymHaveMap(gymAccShown(date).map(r => r.t), MOVE_NOTE, accKey), done: picked => {
      ED = null; edInit(date);
      const names = gymFresh(picked, ED.ex.map(e => e.name)); if (!names.length) { ED = null; return; }
      const keys = new Set(names.map(glKey)), moved = gymAccShown(date).filter(r => keys.has(accKey(r.t))).map(r => accLabel(r.t));
      if (((getLog(date) || {}).xl || {}).acc) editLog(date, l => { l.xl.acc = l.xl.acc.filter(x => !keys.has(accKey(x.t))); if (!l.xl.acc.length) delete l.xl.acc; }, { render: false }); // your own "just today" additions move out; the plan's accessory line stays and the card leaves the item out
      names.forEach(n => ED.ex.push(gymNewEdEx(n)));
      saveEditor(date);
      const holds = names.filter(gymIsHold).length;
      toast('Added ' + names.length + (names.length === 1 ? ' exercise' : ' exercises') + (holds === names.length ? ', 3 × 30 seconds' : ', 3 × 10' + (holds ? ' (holds: 3 × 30 seconds)' : '')) + ', for everyone.' + (moved.length ? ' ' + moved.join(', ') + ' moved here from Accessory & core.' : '') + ' Change the sets with − and +, or Edit exercises.');
    } });
  },
  'ed-pick': el => { // the day editor
    const g = el.dataset.g; if (!ED) return; const ex = ED.ex.map(e => e.name);
    if (g === 'acc') { gymPick({ title: 'Add to Accessory & core', have: Object.assign(gymHaveMap(ED.acc, IN_ACC, accKey), gymHaveMap(ex, IN_MAIN)), done: names => gymFresh(names).forEach(n => ED.acc.push(n + ' — 3 × ' + gymStartReps(n))) }); return; }
    gymPick({ have: gymHaveMap(ex, IN_SESSION), note: gymHaveMap(ED.acc, MOVE_NOTE, accKey), done: picked => {
      const names = gymFresh(picked, ex), keys = new Set(names.map(glKey)), moved = ED.acc.filter(t => keys.has(accKey(t))).map(accLabel);
      ED.acc = ED.acc.filter(t => !keys.has(accKey(t)));
      names.forEach(n => ED.ex.push(gymNewEdEx(n)));
      if (moved.length) toast(moved.join(', ') + ' moved from Accessory & core to Main strength.');
    } });
  },
  'pk-acc': () => { // "Pick from the exercise list" while editing the Accessory & core card: just this day, or every day (your own list)
    const date = curDate(), p = P(date), every = !!LE['acc:every'] && leCanEvery(date);
    gymPick({ title: 'Add to Accessory & core', have: Object.assign(gymHaveMap(gymAccShown(date).map(r => r.t), IN_ACC, accKey), gymHaveMap(p.strength.map(e => e.name), IN_MAIN)), done: picked => {
      const items = gymFresh(picked).map(n => (n + ' — 3 × ' + gymStartReps(n)).slice(0, 120)); if (!items.length) return;
      if (every) { leEditProfile('acc', L => { L.add = (L.add || []).concat(items.map(t => ({ t, from: date }))); }); toast('Added to every day from ' + (date === todayISO() ? 'today' : fmtDate(date, false))); render(); }
      else editLog(date, l => { l.xl = l.xl || {}; l.xl.acc = (l.xl.acc || []).concat(items.map(t => ({ t, d: false }))); });
    } });
  }
};
const PICK_IN = {
  pkq: (el, type) => { const F = PICK; if (!F || type === 'change') return; F.q = el.value; const b = $('#pk-list'); if (b) b.innerHTML = gymPickListHTML(); }
};

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

/* ---------- v32: body check-ins (Progress → Body), brought over from GymFloorCoach ----------
   BMI alone can't tell fat from muscle, so a check-in records weight, body fat %, muscle mass and tape measurements:
     body/<uid> = { checks: [{ date, kg, fat (%), muscle (kg), waist, neck, hip (cm), t }] }
   - Body fat % and muscle mass come from a body-composition scale or an InBody. Without one, body fat % is estimated
     from a tape measure with the US Navy formula (height, neck, waist, and hips for women) and shown as an estimate.
     Muscle mass can't be estimated from a tape measure.
   - Worked out: BMI, fat in kg, lean mass in kg (everything that isn't fat), and the change since the first check-in
     and over the last 4 weeks. Height and sex come from Settings → Nutrition (height can be typed here too).
   - Like the rest of the tracker, everyone signed in can see it (Vinay's choice); only the person and the admin can
     add or delete check-ins.
   - v16: body fat can be typed in kg instead of % (fkg kept as typed, fat worked out); BMI, fat kg and lean mass show
     while typing; numbers off a printed InBody sheet (InBody score, visceral fat level, BMR) are optional and make the
     check-in an InBody one (src 'sheet', ib { score, vfl, bmr, bfm }), so the InBody card and Nutrition's BMR use them.
     Weights and % show with one decimal (3.0 kg). */
const I_LOCK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
I.lock = I_LOCK;
function navyFat(sex, cm, waist, neck, hip) { // US Navy tape estimate, metric (cm)
  if (!cm || !waist || !neck) return null;
  let v;
  if (sex === 'f') { if (!hip || waist + hip - neck <= 0) return null; v = 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.22100 * Math.log10(cm)) - 450; }
  else { if (waist - neck <= 0) return null; v = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(cm)) - 450; }
  return isFinite(v) ? Math.min(60, Math.max(3, Math.round(v * 10) / 10)) : null;
}
function bodyChecks(pid) {
  const b = nutBody(pid);
  return (((S.body || {})[pid] || {}).checks || []).slice().sort((a, x) => a.date.localeCompare(x.date) || (a.t || 0) - (x.t || 0)).map(c => {
    const est = c.fat == null ? navyFat(b.sex, b.cm, num(c.waist), num(c.neck), num(c.hip)) : null;
    const fat = c.fat != null ? num(c.fat) : est; const kg = num(c.kg);
    const fatKg = c.ib && c.ib.bfm != null ? c.ib.bfm : c.fkg != null ? num(c.fkg) : kg != null && fat != null ? Math.round(kg * fat) / 100 : null; // v15: an InBody scan has it measured; v16: typed in kg
    return Object.assign({}, c, { kg, fatPct: fat, est: est != null, fatKg, lean: fatKg != null ? Math.round((kg - fatKg) * 10) / 10 : null, muscle: c.muscle != null ? num(c.muscle) : null, bmi: c.ib && c.ib.bmi != null ? c.ib.bmi : kg && b.cm ? Math.round(kg / Math.pow(b.cm / 100, 2) * 10) / 10 : null });
  });
}
const f1 = v => v == null || v === '' || !isFinite(+v) ? v : (Math.round(+v * 10) / 10).toFixed(1); // v16: 3.0 kg, not 3 kg
function bodyDelta(a, b, key, goodDown) {
  if (!a || !b || a[key] == null || b[key] == null) return null;
  const d = Math.round((b[key] - a[key]) * 10) / 10; const good = d === 0 ? '' : (d < 0) === goodDown ? 'good' : 'bad';
  return '<span class="delta ' + good + '">' + (d > 0 ? '+' : d < 0 ? '−' : '±') + f1(Math.abs(d)) + ' kg</span>';
}
function bodyChanges(from, to, label) {
  const parts = [['Fat', 'fatKg', true], ['Muscle', 'muscle', false], ['Lean mass', 'lean', false], ['Weight', 'kg', null]].map(([n, k, down]) => { const x = down === null ? (from && to && from.kg != null && to.kg != null ? '<span class="delta">' + (to.kg - from.kg > 0 ? '+' : to.kg < from.kg ? '−' : '±') + f1(Math.abs(Math.round((to.kg - from.kg) * 10) / 10)) + ' kg</span>' : null) : bodyDelta(from, to, k, down); return x ? '<span>' + n + ' ' + x + '</span>' : ''; }).filter(Boolean);
  return parts.length ? '<div class="bchg"><b>' + esc(label) + '</b>' + parts.join('') + '</div>' : '';
}
function gymBodyCard(pid) {
  const C = bodyChecks(pid), b = nutBody(pid), can = !S.readOnly && canWriteDoc('body', pid) && pid === S.pid;
  const last = C[C.length - 1], first = C[0];
  const f = S.bodyForm;
  let h = '<section class="card" id="body-comp"><div class="card-h"><h3>Body composition</h3><span class="sp"></span>' + (can && !f ? '<button class="btn sm" data-a="ib-pick">' + I.plus + 'Import InBody file</button><button class="btn sm primary" data-a="body-new">' + I.plus + 'Add check-in</button>' : '') + '</div>';
  if (can && !f) h += gymIbImportHTML(pid); // v15
  if (f && can) h += bodyFormHTML(pid, f, b);
  if (!C.length) h += (f ? '' : '<p class="small">Track how your body changes, not just your weight. Every 2–4 weeks, add your weight and, if the gym has a body-composition scale or an InBody, your body fat % and muscle mass. No scale? A tape measure round your waist and neck' + (b.sex === 'f' ? ' and hips' : '') + ' gives an estimate.</p>');
  else {
    const tile = (lab, v, unit, sub) => '<div class="tile"><span>' + lab + '</span><b>' + (v == null ? '–' : v) + (v == null ? '' : '<small>' + unit + '</small>') + '</b>' + (sub ? '<em class="small muted">' + sub + '</em>' : '') + '</div>';
    h += '<p class="small muted">Latest check-in ' + esc(fmtDate(last.date)) + '</p><div class="tiles">' + tile('Weight', f1(last.kg), 'kg') + tile('BMI', f1(last.bmi), '', last.bmi ? (last.bmi < 18.5 ? 'below the healthy range' : last.bmi < 25 ? 'healthy range' : last.bmi < 30 ? 'above the healthy range' : 'well above the healthy range') : (b.cm ? '' : 'add your height')) +
      tile('Body fat', f1(last.fatPct), '%', last.est ? 'tape estimate' : '') + tile('Fat', f1(last.fatKg), 'kg') + tile('Lean mass', f1(last.lean), 'kg') + tile('Muscle', f1(last.muscle), 'kg', last.muscle == null ? 'needs a scale' : '') + '</div>';
    if (C.length > 1) {
      const ago = C.filter(c => diffDays(c.date, last.date) >= 21 && diffDays(c.date, last.date) <= 42).pop();
      h += bodyChanges(first, last, 'Since ' + fmtDate(first.date, false)) + (ago && ago !== first ? bodyChanges(ago, last, 'Last ' + Math.round(diffDays(ago.date, last.date) / 7) + ' weeks') : '');
      h += chartBox({ type: 'line', label: 'Weight, fat and muscle over time', x: C.map(c => fmtDate(c.date, false)), yFmt: v => v + ' kg', series: [
        { name: 'Weight', color: 'var(--ink-2)', vals: C.map(c => c.kg) },
        { name: 'Lean mass', color: 'var(--k-long)', vals: C.map(c => c.lean) },
        { name: 'Muscle', color: 'var(--k-strength)', vals: C.map(c => c.muscle) },
        { name: 'Fat', color: 'var(--accent)', vals: C.map(c => c.fatKg) }].filter(s => s.vals.some(v => v != null)) }, 220);
      const T = C.filter(c => num(c.waist) || num(c.neck) || num(c.hip)); // v16: the tape over time
      if (T.length > 1) h += chartBox({ type: 'line', label: 'Tape measure over time (cm)', x: T.map(c => fmtDate(c.date, false)), yFmt: v => v + ' cm', series: [
        { name: 'Waist', color: 'var(--accent)', vals: T.map(c => num(c.waist) || null) },
        { name: 'Hips', color: 'var(--k-long)', vals: T.map(c => num(c.hip) || null) },
        { name: 'Neck', color: 'var(--ink-2)', vals: T.map(c => num(c.neck) || null) }].filter(s => s.vals.some(v => v != null)) }, 180);
    }
    const hasHip = C.some(c => num(c.hip)), cmv = v => num(v) ? f1(num(v)) : '–';
    h += '<details style="margin-top:10px"><summary class="small">All check-ins (' + C.length + ')</summary><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th class="num">kg</th><th class="num">Fat %</th><th class="num">Muscle</th><th class="num">Waist</th><th class="num">Neck</th>' + (hasHip ? '<th class="num">Hips</th>' : '') + '<th></th></tr></thead><tbody>' +
      C.slice().reverse().map(c => '<tr><td>' + esc(fmtDate(c.date, false)) + (c.src === 'inbody' || c.src === 'sheet' ? '<br><span class="small muted">' + esc(ibDev(c)) + '</span>' : '') + '</td><td class="num mono">' + (c.kg == null ? '–' : f1(c.kg)) + '</td><td class="num mono">' + (c.fatPct == null ? '–' : f1(c.fatPct)) + (c.est ? '*' : '') + '</td><td class="num mono">' + (c.muscle == null ? '–' : f1(c.muscle)) + '</td><td class="num mono">' + cmv(c.waist) + '</td><td class="num mono">' + cmv(c.neck) + '</td>' + (hasHip ? '<td class="num mono">' + cmv(c.hip) + '</td>' : '') + '<td>' + (can ? '<button class="btn sm ghost" data-a="body-del" data-t="' + c.t + '" aria-label="Delete check-in">' + I.close + '</button>' : '') + '</td></tr>').join('') + '</tbody></table></div><p class="small muted">* estimated from a tape measure.</p></details>';
  }
  h += '<p class="small muted" style="margin-top:10px">' + 'Everyone in the tracker can see this. BMI can read high for muscular people, so watch fat and muscle rather than BMI. Scales vary with water: weigh at the same time of day, before eating.</p></section>' + gymIbCard(pid); // v15: the latest InBody scan in detail
  return h;
}
function bodyCalc(f, b) { // v16: what the numbers work out to, while typing
  const kg = num(f.kg), cm = num(f.cm) || b.cm, inKg = f.fatU === 'kg', fk = num(f.fkg);
  const typed = inKg ? (fk != null && kg ? Math.round(fk / kg * 1000) / 10 : null) : num(f.fat);
  const est = typed == null && !(inKg && fk != null) ? navyFat(b.sex, cm, num(f.waist), num(f.neck), num(f.hip)) : null, fp = typed != null ? typed : est;
  const fatKg = inKg && fk != null ? fk : kg && fp != null ? Math.round(kg * fp) / 100 : null;
  const out = [];
  if (kg && cm) out.push('BMI <b>' + f1(kg / Math.pow(cm / 100, 2)) + '</b>');
  if (inKg && typed != null) out.push('body fat <b>' + f1(typed) + '%</b>');
  if (fatKg != null) out.push('fat <b>' + f1(fatKg) + ' kg</b>' + (est != null ? ' (tape estimate)' : ''));
  if (fatKg != null && kg) out.push('lean mass <b>' + f1(kg - fatKg) + ' kg</b>');
  return out.length ? 'Works out to: ' + out.join(' · ') : '';
}
function bodyFormHTML(pid, f, b) {
  const inp = (k, lab, ph, extra) => '<label class="field"><span>' + lab + '</span><input class="inp mono" id="bf-' + k + '" inputmode="decimal" value="' + esc(f[k] == null ? '' : f[k]) + '" placeholder="' + ph + '" data-in="bodyf" data-k="' + k + '"' + (extra || '') + '></label>';
  const inKg = f.fatU === 'kg';
  const est = (inKg ? f.fkg === '' || f.fkg == null : f.fat === '' || f.fat == null) ? navyFat(b.sex, num(f.cm) || b.cm, num(f.waist), num(f.neck), num(f.hip)) : null;
  const fatF = '<div class="field bf-fat"><span>Body fat (' + (inKg ? 'kg' : '%') + ')</span><div class="bf-fatin">' +
    (inKg ? '<input class="inp mono" id="bf-fkg" inputmode="decimal" value="' + esc(f.fkg == null ? '' : f.fkg) + '" placeholder="12.4" data-in="bodyf" data-k="fkg" aria-label="Body fat in kg">'
      : '<input class="inp mono" id="bf-fat" inputmode="decimal" value="' + esc(f.fat == null ? '' : f.fat) + '" placeholder="18.5" data-in="bodyf" data-k="fat" aria-label="Body fat %">') +
    '<span class="seg bf-u" role="group" aria-label="Body fat in"><button data-a="bf-fatu" data-v="%" aria-pressed="' + !inKg + '">%</button><button data-a="bf-fatu" data-v="kg" aria-pressed="' + inKg + '">kg</button></span></div></div>';
  const sheet = f.score || f.vfl || f.bmr;
  return '<div class="bform"><div class="fgrid"><label class="field"><span>Date</span><input class="inp mono" type="date" id="bf-date" value="' + esc(f.date) + '" max="' + todayISO() + '" data-in="bodyf" data-k="date"></label>' + inp('kg', 'Weight (kg)', '72.5') + (b.cm ? '' : inp('cm', 'Height (cm)', '175')) + '</div>' +
    '<p class="small" style="margin:10px 0 4px"><b>From a body-composition scale or InBody</b> (leave empty if you don’t have one)</p><div class="fgrid">' + fatF + inp('muscle', 'Muscle mass (kg)', '33.2') + '</div>' +
    '<details class="bf-sheet"' + (sheet ? ' open' : '') + '><summary class="small">More from a printed InBody sheet (optional)</summary><div class="fgrid" style="margin-top:6px">' + inp('score', 'InBody score', '78') + inp('vfl', 'Visceral fat level', '4') + inp('bmr', 'BMR (kcal)', '1450') + '</div>' +
      '<p class="small muted">Your BMR from the sheet sets your calories on the Nutrition page.</p></details>' +
    '<p class="small" style="margin:10px 0 4px"><b>Tape measure</b> (cm)' + (b.sex ? '' : ' · set your sex in Settings → Nutrition for the estimate') + '</p><div class="fgrid">' + inp('waist', 'Waist, at the navel', '84') + inp('neck', 'Neck', '38') + (b.sex === 'f' ? inp('hip', 'Hips, widest part', '98') : '') + '</div>' +
    '<p class="small muted" id="bf-est">' + (est != null ? 'Estimated body fat from the tape: <b>' + est + '%</b>' : '') + '</p>' +
    '<p class="small bf-calc" id="bf-calc" aria-live="polite">' + bodyCalc(f, b) + '</p>' +
    '<div class="flexend"><button class="btn" data-a="body-cancel">Cancel</button><button class="btn primary" data-a="body-save">Save check-in</button></div></div>';
}
function editBody(pid, fn) { const cur = clone((S.body || {})[pid]) || { checks: [] }; if (!cur.checks) cur.checks = []; fn(cur); return put('body', pid, cur); }
const BODY_ACT = {
  'body-new': () => { const C = bodyChecks(S.pid); const l = C[C.length - 1]; S.bodyForm = { date: todayISO(), kg: l ? l.kg : (nutBody(S.pid).kg || ''), fat: '', fkg: '', fatU: LS.get('hx.fatU', '%') === 'kg' ? 'kg' : '%', muscle: '', score: '', vfl: '', bmr: '', waist: l && l.waist || '', neck: l && l.neck || '', hip: l && l.hip || '', cm: '' }; render(); const i = $('#bf-kg'); if (i) i.focus(); },
  'bf-fatu': el => { const f = S.bodyForm; if (!f) return; const u = el.dataset.v === 'kg' ? 'kg' : '%'; if (u === f.fatU) return; // v16: % or kg, what you typed carries over
    const kg = num(f.kg); if (u === 'kg') { const p = num(f.fat); f.fkg = p != null && kg ? String(f1(kg * p / 100)) : ''; } else { const k = num(f.fkg); f.fat = k != null && kg ? String(f1(k / kg * 100)) : ''; }
    f.fatU = u; LS.set('hx.fatU', u); render(); const i = $(u === 'kg' ? '#bf-fkg' : '#bf-fat'); if (i) i.focus(); },
  'body-cancel': () => { S.bodyForm = null; render(); },
  'body-save': () => {
    const f = S.bodyForm; if (!f) return; const pid = S.pid;
    const kg = num(f.kg); if (!kg || kg < 25 || kg > 300) { toast('Type your weight in kg.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date || '') || f.date > todayISO()) { toast('Pick the date of the check-in.'); return; }
    const inKg = f.fatU === 'kg', fkg = inKg ? num(f.fkg) : null, fat = inKg ? (fkg != null ? Math.round(fkg / kg * 1000) / 10 : null) : num(f.fat), mus = num(f.muscle);
    if (inKg && fkg != null && (fkg <= 0 || fkg >= kg * 0.7)) { toast('Body fat in kg looks off: it should be well under your weight.'); return; }
    if (fat != null && (fat < 2 || fat > 70)) { toast(inKg ? 'That’s ' + f1(fat) + '% body fat, which looks off. Check the kg.' : 'Body fat % looks off: it’s usually between 5 and 50.'); return; }
    if (mus != null && (mus < 5 || mus > kg)) { toast('Muscle mass should be in kg, less than your weight.'); return; }
    const score = num(f.score), vfl = num(f.vfl), bmr = num(f.bmr); // v16: off a printed InBody sheet
    if (score != null && (score < 20 || score > 120)) { toast('The InBody score is usually between 50 and 100.'); return; }
    if (vfl != null && (vfl < 1 || vfl > 30)) { toast('Visceral fat level is a number from 1 to 20 on the sheet.'); return; }
    if (bmr != null && (bmr < 600 || bmr > 4000)) { toast('BMR should be in kcal, like 1450.'); return; }
    const c = { date: f.date, kg, t: Date.now() };
    if (fat != null) c.fat = fat; if (fkg != null) c.fkg = fkg; if (mus != null) c.muscle = mus;
    if (score != null || vfl != null || bmr != null) { c.src = 'sheet'; c.ib = {}; if (score != null) c.ib.score = score; if (vfl != null) c.ib.vfl = vfl; if (bmr != null) c.ib.bmr = Math.round(bmr); if (fkg != null) c.ib.bfm = fkg; }
    ['waist', 'neck', 'hip'].forEach(k => { const v = num(f[k]); if (v) c[k] = v; });
    const cm = num(f.cm); if (cm && cm > 100 && cm < 250) editProfile(p => { p.nut = Object.assign({}, p.nut, { cm }); }, pid);
    if (f.date === todayISO() || !(nutOf(pid).kg)) editProfile(p => { p.nut = Object.assign({}, p.nut, { kg }); }, pid);
    if (editBody(pid, b => { b.checks.push(c); })) { S.bodyForm = null; toast('Check-in saved.'); render(); }
  },
  'body-del': el => { const t = +el.dataset.t; editBody(S.pid, b => { b.checks = b.checks.filter(c => c.t !== t); }); render(); }
};
const BODY_IN = {
  bodyf: (el, type) => {
    if (!S.bodyForm) return; S.bodyForm[el.dataset.k] = el.value;
    const b = nutBody(S.pid), f = S.bodyForm, c = $('#bf-calc'); if (c) c.innerHTML = bodyCalc(f, b); // v16
    const e = $('#bf-est'); if (!e) return;
    const est = (f.fatU === 'kg' ? f.fkg === '' || f.fkg == null : f.fat === '' || f.fat == null) ? navyFat(b.sex, num(f.cm) || b.cm, num(f.waist), num(f.neck), num(f.hip)) : null;
    e.innerHTML = est != null ? 'Estimated body fat from the tape: <b>' + est + '%</b>' : '';
  }
};

/* ---------- v32: InBody import (Progress → Body), brought over from GymFloorCoach ----------
   The InBody app's "Data export" gives a CSV with every scan: one row per scan, the same columns on every InBody model
   (a "-" where that machine doesn't measure something; a 270 has no phase angle, ECW ratio, visceral fat area or waist).
   The phone reads the file itself (no server): ibParse → a preview ("7 scans · 6 new") → Import adds each new scan as a
   body check-in on its date: { date, t (the scan's time), kg, fat (%), muscle (skeletal muscle, kg), src: 'inbody', dev,
   ib: { id (the scan's yyyymmddhhmmss), bfm, bmi, bmr, score, vfl, vfa, whr, tbw, icw, ecw, ecwr, protein, mineral, bmc,
   bcm, smi, pa, slm, lean[5], sfat[5], secw[5] (right arm, left arm, trunk, right leg, left leg) }, waist }.
   A scan already there (same ib.id) is skipped; a check-in typed by hand on a scan's date is replaced by the scan.
   The person and the admin can import (the body document is theirs to write). Nutrition uses the latest scan's BMR
   (gymIbBmr) instead of the formula, and the weight of the newest check-in. */

const IB_COLS = { date: 'date', measurementdevice: 'dev', weight: 'kg', skeletalmusclemass: 'muscle', softleanmass: 'slm', bodyfatmass: 'bfm', bmi: 'bmi', percentbodyfat: 'fat', basalmetabolicrate: 'bmr', inbodyscore: 'score',
  rightarmleanmass: 'l0', leftarmleanmass: 'l1', trunkleanmass: 'l2', rightlegleanmass: 'l3', leftlegleanmass: 'l4', rightarmfatmass: 'f0', leftarmfatmass: 'f1', trunkfatmass: 'f2', rightlegfatmass: 'f3', leftlegfatmass: 'f4',
  rightarmecwratio: 'e0', leftarmecwratio: 'e1', trunkecwratio: 'e2', rightlegecwratio: 'e3', leftlegecwratio: 'e4', waisthipratio: 'whr', waistcircumference: 'waist', visceralfatarea: 'vfa', visceralfatlevel: 'vfl',
  totalbodywater: 'tbw', intracellularwater: 'icw', extracellularwater: 'ecw', ecwratio: 'ecwr', protein: 'protein', mineral: 'mineral', bonemineralcontent: 'bmc', bodycellmass: 'bcm', smi: 'smi', wholebodyphaseangle: 'pa' };
const IB_SEG = ['Right arm', 'Left arm', 'Trunk', 'Right leg', 'Left leg'];
const ibKey = h => String(h || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '');
function ibCsvRows(text) { // a small CSV reader: quoted fields, commas and line breaks inside quotes, CRLF
  const rows = []; let row = [], f = '', q = false; const s = String(text || '').replace(/^\uFEFF/, ''), sep = s.split('\n')[0].includes(',') ? ',' : ';';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += ch;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
}
function ibWhen(v) { // "20260808095255" (or "2026-08-08 09:52", "2026.08.08") → { date, id, t }
  const s = String(v || '').trim(); let m = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?$/) || s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:[ T.]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const n = k => +(m[k] || 0), p2 = x => String(x).padStart(2, '0');
  if (n(2) < 1 || n(2) > 12 || n(3) < 1 || n(3) > 31) return null;
  const date = m[1] + '-' + p2(n(2)) + '-' + p2(n(3));
  return { date, id: m[1] + p2(n(2)) + p2(n(3)) + p2(n(4)) + p2(n(5)) + p2(n(6)), t: new Date(+m[1], n(2) - 1, n(3), n(4), n(5), n(6)).getTime() };
}
const ibNum = v => { const s = String(v == null ? '' : v).trim().replace(',', '.'); if (!s || s === '-' || s === '–') return null; const x = parseFloat(s); return isFinite(x) ? x : null; };
function ibParse(text) { // { scans: [check-ins], err }
  const rows = ibCsvRows(text); if (rows.length < 2) return { scans: [], err: 'That file has no scans in it.' };
  const cols = rows[0].map(h => IB_COLS[ibKey(h)] || '');
  if (!cols.includes('date') || !cols.includes('kg')) return { scans: [], err: 'That doesn’t look like an InBody export. In the InBody app: scroll down → Data export, then pick that file.' };
  const scans = [];
  rows.slice(1).forEach(r => {
    const v = {}; cols.forEach((k, i) => { if (k) v[k] = r[i]; });
    const w = ibWhen(v.date), kg = ibNum(v.kg); if (!w || kg == null || kg < 20 || kg > 400 || w.date > todayISO()) return;
    const ib = { id: w.id }; ['bfm', 'bmi', 'bmr', 'score', 'vfl', 'vfa', 'whr', 'tbw', 'icw', 'ecw', 'ecwr', 'protein', 'mineral', 'bmc', 'bcm', 'smi', 'pa', 'slm'].forEach(k => { const x = ibNum(v[k]); if (x != null) ib[k] = x; });
    [['l', 'lean'], ['f', 'sfat'], ['e', 'secw']].forEach(([p, k]) => { const a = [0, 1, 2, 3, 4].map(i => ibNum(v[p + i])); if (a.some(x => x != null)) ib[k] = a; });
    const c = { date: w.date, t: w.t, kg, src: 'inbody', dev: String(v.dev || '').trim().replace(/^-$/, ''), ib };
    const fat = ibNum(v.fat), mus = ibNum(v.muscle), waist = ibNum(v.waist);
    if (fat != null) c.fat = fat; if (mus != null) c.muscle = mus; if (waist != null) c.waist = waist;
    scans.push(c);
  });
  scans.sort((a, b) => a.t - b.t);
  return scans.length ? { scans } : { scans: [], err: 'No scans could be read from that file.' };
}
function ibPlan(pid, scans) { // what Import would do: new scans, ones already there, typed check-ins they replace
  const cur = (((S.body || {})[pid] || {}).checks || []);
  const have = new Set(cur.filter(c => c.ib && c.ib.id).map(c => c.ib.id)), seen = new Set();
  const fresh = scans.filter(c => { if (have.has(c.ib.id) || seen.has(c.ib.id)) return false; seen.add(c.ib.id); return true; });
  const days = new Set(fresh.map(c => c.date));
  return { fresh, dup: scans.length - fresh.length, typed: cur.filter(c => c.src !== 'inbody' && days.has(c.date)).length };
}
const gymIbChecks = pid => (((S.body || {})[pid] || {}).checks || []).filter(c => (c.src === 'inbody' || c.src === 'sheet') && c.ib).sort((a, b) => a.date.localeCompare(b.date) || a.t - b.t); // v16: typed off a printed sheet too
function gymIbBmr(pid) { const l = gymIbChecks(pid).filter(c => c.ib.bmr).pop(); return l ? { bmr: l.ib.bmr, date: l.date, dev: l.dev } : null; }
const ibDev = c => c.src === 'sheet' ? 'InBody sheet, typed' : 'InBody' + (c.dev ? ' ' + c.dev : '');

/* ---- the Body page ---- */
function gymIbImportHTML(pid) { // the button, and the preview once a file is picked
  const P0 = S.ibPrev && S.ibPrev.pid === pid ? S.ibPrev : null;
  if (!P0) return '<input type="file" id="ib-file" accept=".csv,text/csv,text/comma-separated-values,application/vnd.ms-excel" data-in="ibfile" hidden>' +
    '<p class="small muted ib-help" style="margin-top:6px">Got an InBody? In the InBody app: scroll down → <b>Data export</b>, then tap <b>Import InBody file</b> and pick it. Every scan comes in; next time only the new ones.</p>';
  if (P0.err) return '<div class="warnbox ib-prev"><div><b>Couldn’t read that file.</b>' + esc(P0.err) + '<div class="row" style="margin-top:8px"><button class="btn sm" data-a="ib-cancel">OK</button></div></div></div>';
  const pl = ibPlan(pid, P0.scans), L = P0.scans[P0.scans.length - 1], n = pl.fresh.length;
  const row = c => { const isNew = pl.fresh.includes(c); return '<tr' + (isNew ? '' : ' class="muted"') + '><td>' + esc(fmtDate(c.date, false)) + '</td><td class="num mono">' + c.kg + '</td><td class="num mono">' + (c.muscle == null ? '–' : c.muscle) + '</td><td class="num mono">' + (c.fat == null ? '–' : c.fat) + '</td><td class="small">' + (isNew ? 'New' : 'Already in') + '</td></tr>'; };
  return '<div class="entry ib-prev"><b>' + P0.scans.length + (P0.scans.length === 1 ? ' scan' : ' scans') + ' found · ' + n + ' new' + (pl.dup ? ' · ' + pl.dup + ' already in' : '') + '</b>' +
    '<p class="small">Latest, ' + esc(fmtDate(L.date)) + ' (' + esc(ibDev(L)) + '): ' + L.kg + ' kg' + (L.muscle != null ? ', muscle ' + L.muscle + ' kg' : '') + (L.fat != null ? ', body fat ' + L.fat + '%' : '') + '.</p>' +
    (pl.typed ? '<p class="small muted">' + pl.typed + (pl.typed === 1 ? ' check-in you typed on a scan day is' : ' check-ins you typed on scan days are') + ' replaced by the scan.</p>' : '') +
    '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Scan</th><th class="num">kg</th><th class="num">Muscle</th><th class="num">Fat %</th><th></th></tr></thead><tbody>' + P0.scans.slice().reverse().map(row).join('') + '</tbody></table></div>' +
    '<div class="flexend"><button class="btn" data-a="ib-cancel">Cancel</button><button class="btn primary" data-a="ib-import"' + (n ? '' : ' disabled') + '>' + (n ? 'Import ' + n + (n === 1 ? ' scan' : ' scans') : 'Nothing new') + '</button></div></div>';
}
function gymIbCard(pid) { // the latest scan in detail, against the scan before it
  const L0 = gymIbChecks(pid); if (!L0.length) return '';
  const L = L0[L0.length - 1], P0 = L0.length > 1 ? L0[L0.length - 2] : null, ib = L.ib, pb = (P0 && P0.ib) || {};
  const d = (a, b, unit, goodUp) => { if (a == null || b == null) return ''; const x = Math.round((a - b) * 100) / 100; if (!x) return '<span class="delta">±0</span>'; const good = goodUp == null ? '' : (x > 0) === goodUp ? 'good' : 'bad'; return '<span class="delta ' + good + '">' + (x > 0 ? '+' : '−') + Math.abs(x) + (unit || '') + '</span>'; };
  const one = (v, unit, lab) => /kg|%| L/.test(unit || '') || lab === 'BMI' ? f1(v) : v; // v16: 3.0 kg
  const val = (lab, v, unit, prev, goodUp, sub) => v == null ? '' : '<div class="ibv"><span>' + lab + '</span><b>' + one(v, unit, lab) + '<small>' + (unit || '') + '</small></b>' + (P0 ? d(v, prev, unit && unit.trim() === 'kg' ? ' kg' : '', goodUp) : '') + (sub ? '<em class="small muted">' + sub + '</em>' : '') + '</div>';
  const main = [val('InBody score', ib.score, '/100', pb.score, true), val('Weight', L.kg, ' kg', P0 && P0.kg), val('Skeletal muscle', L.muscle, ' kg', P0 && P0.muscle, true), val('Body fat', ib.bfm, ' kg', pb.bfm, false), val('Body fat %', L.fat, '%', P0 && P0.fat, false),
    val('BMI', ib.bmi, '', pb.bmi), val('Visceral fat level', ib.vfl, '', pb.vfl, false, ib.vfl != null ? (ib.vfl < 10 ? 'healthy (under 10)' : 'high (10 or more)') : ''), val('Waist-hip ratio', ib.whr, '', pb.whr, false), val('BMR', ib.bmr, ' kcal', pb.bmr, true, 'used for your calories')].join('');
  const more = [val('Body water', ib.tbw, ' L', pb.tbw), val('Protein', ib.protein, ' kg', pb.protein, true), val('Minerals', ib.mineral, ' kg', pb.mineral, true), val('Soft lean mass', ib.slm, ' kg', pb.slm, true), val('SMI', ib.smi, ' kg/m²', pb.smi, true),
    val('Visceral fat area', ib.vfa, ' cm²', pb.vfa, false), val('ECW ratio', ib.ecwr, '', pb.ecwr), val('Phase angle', ib.pa, '°', pb.pa, true), val('Bone mineral', ib.bmc, ' kg', pb.bmc), val('Body cell mass', ib.bcm, ' kg', pb.bcm, true)].join('');
  const seg = ib.lean || ib.sfat ? '<div class="tbl-wrap" style="margin-top:8px"><table class="tbl compact ib-seg"><thead><tr><th></th><th class="num">Lean kg</th><th class="num">Fat kg</th>' + (ib.secw ? '<th class="num">ECW</th>' : '') + '</tr></thead><tbody>' +
    IB_SEG.map((n, i) => '<tr><td>' + n + '</td><td class="num mono">' + ((ib.lean || [])[i] == null ? '–' : ib.lean[i]) + (P0 && pb.lean ? ' ' + d(ib.lean[i], pb.lean[i], ' kg', true) : '') + '</td><td class="num mono">' + ((ib.sfat || [])[i] == null ? '–' : ib.sfat[i]) + '</td>' + (ib.secw ? '<td class="num mono">' + (ib.secw[i] == null ? '–' : ib.secw[i]) + '</td>' : '') + '</tr>').join('') + '</tbody></table></div>' : '';
  const ch = L0.length > 1 ? chartBox({ type: 'line', label: 'InBody: body fat % and InBody score', x: L0.map(c => fmtDate(c.date, false)), series: [
    { name: 'Body fat %', color: 'var(--accent)', vals: L0.map(c => c.fat == null ? null : c.fat) },
    { name: 'InBody score', color: 'var(--k-strength)', vals: L0.map(c => c.ib.score == null ? null : c.ib.score) }].filter(s => s.vals.some(v => v != null)) }, 180) : '';
  return '<section class="card ib-card"><div class="card-h"><h3>InBody</h3><span class="sp"></span><span class="small muted">' + esc(fmtDate(L.date)) + ' · ' + esc(ibDev(L)) + '</span></div>' +
    (P0 ? '<p class="small muted">Changes against the scan before, ' + esc(fmtDate(P0.date, false)) + '.</p>' : '') +
    '<div class="ibgrid">' + main + '</div>' + (more ? '<details style="margin-top:8px"><summary class="small">More from this scan</summary><div class="ibgrid" style="margin-top:8px">' + more + '</div></details>' : '') +
    (seg ? '<b class="small" style="display:block;margin-top:12px">Arms, legs and trunk</b>' + seg : '') + ch + '</section>';
}

const IB_ACT = {
  'ib-pick': () => { const i = $('#ib-file'); if (i) { i.value = ''; i.click(); } },
  'ib-cancel': () => { S.ibPrev = null; render(); },
  'ib-import': () => {
    const P0 = S.ibPrev, pid = S.pid; if (!P0 || P0.pid !== pid || !P0.scans) return;
    const pl = ibPlan(pid, P0.scans); if (!pl.fresh.length) return;
    const days = new Set(pl.fresh.map(c => c.date));
    const ok = editBody(pid, b => { b.checks = b.checks.filter(c => c.src === 'inbody' || !days.has(c.date)).concat(pl.fresh.map(c => clone(c))); });
    if (!ok) return;
    const all = bodyChecks(pid), newest = all[all.length - 1]; // Nutrition uses the newest weight
    if (newest && newest.kg && num(nutOf(pid).kg) !== newest.kg) editProfile(p => { p.nut = Object.assign({}, p.nut, { kg: newest.kg }); }, pid);
    S.ibPrev = null; toast(pl.fresh.length + (pl.fresh.length === 1 ? ' InBody scan' : ' InBody scans') + ' imported.'); render();
  }
};
const IB_IN = {
  ibfile: (el, type) => {
    if (type !== 'change' || !el.files || !el.files[0]) return; const f = el.files[0], pid = S.pid;
    if (f.size > 5e6) { S.ibPrev = { pid, err: 'That file is too big for an InBody export.' }; render(); return; }
    const r = new FileReader();
    r.onload = () => { S.ibPrev = Object.assign({ pid }, ibParse(r.result)); render(); const e = $('.ib-prev'); if (e) e.scrollIntoView({ block: 'nearest' }); };
    r.onerror = () => { S.ibPrev = { pid, err: 'The file couldn’t be opened.' }; render(); };
    r.readAsText(f);
  }
};

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

/* ---------- sign-in gate ---------- */
function showGate(kind, extra) {
  const g = $('#gate'); if (!g) return;
  S.gate = kind;
  if (!kind) { g.hidden = true; g.innerHTML = ''; document.body.classList.remove('gated'); return; }
  const brand = '<div class="gate-brand"><span class="disp">HYROX</span><span class="disp">Tracker</span><small>16 weeks · race day Fri 15 Jan 2027</small></div>';
  let body = '';
  if (kind === 'wait') body = '<p class="muted">Connecting…</p>';
  else if (kind === 'signin') body = '<p>Sign in with the Google account you use for the tracker.</p><button class="btn primary lg block" data-a="signin">' + GOOGLE_G + 'Sign in with Google</button>' +
    (extra ? '<div class="warnbox bad">' + esc(extra) + '</div>' : '') +
    '<p class="small muted">Anyone you send the link to can sign in and join. If nothing happens when you tap the button, open this page in Chrome or Safari rather than inside another app.</p>';
  else if (kind === 'denied') body = '<div class="warnbox bad"><div><b>' + esc(S.email || 'This account') + ' can\'t open this tracker yet.</b>The tracker\'s database rules haven\'t been published, so Firebase is refusing access. Run the publish command from the setup guide, then sign in again.</div></div>' +
    '<button class="btn primary lg block" data-a="signout">Use another Google account</button>';
  else if (kind === 'setup') body = '<div class="warnbox"><div><b>Almost there: Firebase isn\'t connected yet.</b>This copy of the tracker couldn\'t find its Firebase settings. Deploy it with <span class="mono">firebase deploy</span> as described in the setup guide (START-HERE.html), or paste your web app config into <span class="mono">config.js</span>.</div></div>';
  else if (kind === 'error') body = '<div class="warnbox bad"><div><b>Couldn\'t start the tracker.</b>' + esc(extra || '') + '</div></div><button class="btn lg block" onclick="location.reload()">Try again</button>';
  g.innerHTML = '<div class="gate-card">' + brand + body + '</div>';
  g.hidden = false; document.body.classList.add('gated');
}
const GOOGLE_G = '<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

async function startSignIn() {
  if (!window.FBX || !S.fbReady) return;
  try { await FBX.signIn(false); }
  catch (e) {
    const c = e && e.code;
    if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return;
    showGate('signin', c === 'auth/unauthorized-domain' ? 'This web address isn\'t on the Authorized domains list in Firebase (Authentication → Settings).' : c === 'auth/operation-not-allowed' ? 'Google sign-in isn\'t switched on in Firebase yet (Authentication → Sign-in method → Google).' : c === 'auth/network-request-failed' ? 'No internet connection. Connect and try again.' : 'Sign-in didn\'t finish' + (c ? ' (' + c + ')' : '') + '.');
  }
}
async function doSignOut() {
  if (pending.size && !S.denied) { toast(pending.size + ' change' + (pending.size > 1 ? 's haven\'t' : ' hasn\'t') + ' synced yet. Wait until it says Saved, then sign out.'); return; }
  unsubscribeAll(); S.db = null;
  LS.del(CACHE_KEY); LS.del(OUTBOX_KEY); LS.del('hx.pid'); pending.clear();
  try { await FBX.signOut(); } catch (e) { }
  location.reload();
}

async function getConfig() {
  // On Firebase Hosting the project's web settings are served at /__/firebase/init.json, so nothing needs pasting.
  if (/^https?:$/.test(location.protocol)) {
    try {
      const r = await withTimeout(fetch('/__/firebase/init.json', { cache: 'no-store' }), 6000);
      if (r.ok) { const c = await r.json(); if (c && c.apiKey && c.projectId) { LS.set('hx.fbconfig', c); return c; } }
    } catch (e) { }
  }
  const c = window.FIREBASE_CONFIG;
  if (c && c.apiKey && c.projectId && !/PASTE|YOUR/i.test(c.apiKey)) return c;
  return LS.get('hx.fbconfig', null); // last known settings, so the tracker still opens offline
}

async function boot() {
  applyTheme();
  loadCache();
  S.pid = resolveMe();
  setSync(pending.size ? 'offline' : 'saved');
  render();
  if (!S.fromCache) showGate('wait');
  if (!window.FBX) { S.noDb = true; setSync('local'); showGate('error', 'The Firebase library (firebase-sdk.js) didn\'t load. Check your connection and reload.'); return; }
  const cfg = await getConfig();
  if (!cfg) { S.noDb = true; setSync('local'); render(); showGate('setup'); return; }
  try { FBX.init(cfg, window.FIREBASE_EMULATORS || {}); S.fbReady = true; }
  catch (e) { S.noDb = true; setSync('local'); showGate('error', e && e.message); return; }
  FBX.redirectResult && FBX.redirectResult().catch(e => { if (e && e.code) showGate('signin', 'Sign-in didn\'t finish (' + e.code + ').'); });
  FBX.onAuth(user => {
    if (!user) {
      S.user = null; S.uid = null; S.db = null; unsubscribeAll();
      setSync('out'); showGate('signin');
      return;
    }
    const changed = S.uid && S.uid !== user.uid;
    S.user = user; S.uid = user.uid; S.email = user.email; S.viewerName = user.name; S.canWrite = true;
    S.denied = false; S.readOnly = false; S.noDb = false;
    if (changed) { S.pid = null; LS.del('hx.pid'); }
    S.db = FBX.db;
    showGate(null);
    S.pid = resolveMe();
    subscribeAll();
    scheduleFlush(50);
    render();
  });
}
boot();

/* ---------- works offline once opened (service worker) ---------- */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.FIREBASE_EMULATORS) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { }); });
}
