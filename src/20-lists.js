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

