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

