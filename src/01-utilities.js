
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

