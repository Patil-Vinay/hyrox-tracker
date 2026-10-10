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

