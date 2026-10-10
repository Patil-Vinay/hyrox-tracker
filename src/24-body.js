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

