/* ---------- "Look around": the tracker with sample data, for visitors who aren't members ----------
   Opened from the sign-in screen (or any link ending in ?demo). Firebase is never started: nothing is read from the
   real tracker, nothing is saved to it and nothing is written to this device's cache. Changes stay in memory only,
   so a reload starts the demo afresh. Two made-up people, Alex (you) and Sam, have logged the plan up to yesterday. */
const DEMO = /[?&]demo\b/.test(location.search);
const DEMO_ME = 'demo-alex', DEMO_PAL = 'demo-sam';

function demoRand(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const DEMO_NOTES = ['Felt strong today.', 'Legs heavy from yesterday, kept it easy.', 'Good session, sleep helped.', 'Hot gym, drank lots of water.', 'Pace felt easier than last week.'];

function demoLog(pid, date, form, R) {
  const p = P(date); if (!p) return null;
  if (p.rest) {
    if (R() < 0.35) return null;
    const l = { pid, date, rest: { acts: [R() < 0.5 ? 'walk' : 'stretch'], min: 20 + Math.round(R() * 25) } };
    if (R() < 0.3) l.notes = 'Easy recovery day.';
    return l;
  }
  const r = R();
  if (r < 0.06) return null; // the odd missed day
  if (r < 0.1) return { pid, date, status: 'skipped', notes: 'Work ran late.' };
  const modified = r < 0.22;
  const l = { pid, date, status: modified ? 'modified' : 'complete', time: Math.round((p.planMin || 60) * (0.85 + R() * 0.3)) };
  const want = p.rpeHi || 6; l.rpe = Math.max(2, Math.min(10, want + (R() < 0.3 ? 1 : 0) - (R() < 0.2 ? 1 : 0)));
  ['wu', 'cd'].forEach(g => { const on = {}; listItems(p, g).forEach((it, i) => { if (!it.h && R() < 0.92) on[i] = true; }); l[g] = on; });
  if (p.strength.length) {
    l.str = {};
    p.strength.forEach((x, i) => {
      const w = x.load ? Math.max(0, Math.round(x.load * form / 2.5) * 2.5) : 0;
      const n = Math.max(1, (x.sets || 1) - (modified && R() < 0.5 ? 1 : 0));
      l.str[i] = { s: Array.from({ length: n }, () => ({ r: x.reps || 10, w, d: true })) };
    });
  }
  if (!p.run.none && p.day.km) {
    const dist = Math.round(p.day.km * (0.9 + R() * 0.15) * 100) / 100;
    const pace = p.run.pace ? (p.run.pace.lo + p.run.pace.hi) / 2 : 390;
    l.runs = [{ type: p.run.type, dist, time: Math.round(dist * pace * (2 - form) * (0.97 + R() * 0.06)), rpe: l.rpe }];
  }
  const hrows = p.hyrox.rows.filter(x => x.kind !== 'note');
  if (hrows.length) { l.hx = {}; hrows.forEach(x => { if (R() < 0.9) l.hx[x.i] = { d: true }; }); }
  if (R() < 0.45) l.notes = DEMO_NOTES[Math.floor(R() * DEMO_NOTES.length)];
  return l;
}
function demoLogs(pid, form, seed) {
  const R = demoRand(seed), out = {}, t = todayISO();
  S.order.filter(d => d < t).forEach(d => { const l = demoLog(pid, d, form, R); if (l) out[logKey(pid, d)] = l; });
  return out;
}

function startDemo() {
  S.demo = true; S.noDb = false; S.readOnly = false; S.denied = false;
  for (const col of Object.keys(COLS)) S[COLS[col]] = PLAN_COLS.includes(col) ? withDefaults(col, {}) : {};
  rebuildDerived();
  S.uid = DEMO_ME; S.email = ''; S.viewerName = 'Visitor';
  S.user = { uid: DEMO_ME, email: '', name: 'Visitor', demo: true };
  const start = S.order[0] || todayISO();
  S.profiles[DEMO_ME] = { uid: DEMO_ME, name: 'Alex', color: 'blue', plan: 'A', race: { fmt: 'singles', div: 'M' }, bar: 20, created: start + 'T1' };
  S.profiles[DEMO_PAL] = { uid: DEMO_PAL, name: 'Sam', color: 'orange', plan: 'A', race: { fmt: 'singles', div: 'W' }, bar: 20, created: start + 'T2' };
  Object.assign(S.logs, demoLogs(DEMO_ME, 1, 7), demoLogs(DEMO_PAL, 0.8, 11));
  Object.keys(COLS).forEach(c => { S.loaded[c] = true; });
  S.pid = DEMO_ME;
  showGate(null); setSync('demo'); render();
  setTimeout(() => toast('You\'re looking around with sample data. Nothing you change is saved.'), 500);
}
function demoPut(col, id, data) { // in memory only: never Firebase, never this device's storage
  S[COLS[col]][id] = Object.assign({}, data, { _u: Date.now() });
  if (PLAN_COLS.includes(col)) rebuildDerived();
  return true;
}
