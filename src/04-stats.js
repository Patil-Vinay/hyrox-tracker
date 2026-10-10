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

