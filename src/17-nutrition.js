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

