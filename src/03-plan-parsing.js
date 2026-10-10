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

