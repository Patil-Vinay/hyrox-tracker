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

