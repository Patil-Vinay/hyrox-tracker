/* ---------- Session photos: the original file is kept at full quality; a small preview makes browsing fast ---------- */
const UPL = {}; // uploads in progress, by date
function photoErr(e) {
  const c = (e && e.code) || '';
  if (c === 'storage/unauthorized') return 'Firebase refused the upload. Check that photo storage is set up and its rules are published (setup guide, "Photos").';
  if (c === 'storage/unknown' || c === 'storage/bucket-not-found' || c === 'storage/project-not-found' || c === 'storage/no-default-bucket') return 'Photo storage isn\'t set up in Firebase yet. Follow the "Photos" part of the setup guide.';
  if (c === 'storage/quota-exceeded') return 'Photo storage is over its limit.';
  if (c === 'storage/retry-limit-exceeded') return 'The connection dropped during the upload. Try again with better signal.';
  return 'Couldn\'t upload the photo' + (c ? ' (' + c + ')' : '') + '.';
}
function makeThumb(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const max = 480, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => { URL.revokeObjectURL(url); resolve({ blob: b, w: img.naturalWidth, h: img.naturalHeight }); }, 'image/jpeg', 0.8);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ blob: null, w: 0, h: 0 }); };
    img.src = url;
  });
}
async function addPhotos(date, files) {
  if (S.demo) { toast('Photos are turned off in the demo.'); return; }
  if (!S.pid || !window.FBX || !FBX.storage) return;
  const pid = S.pid, lid = logKey(pid, date);
  if (!canWriteDoc('logs', lid)) { toast('You can only add photos to your own log.'); return; }
  if (navigator.onLine === false) { toast('You\'re offline. Add photos when you have signal.'); return; }
  const list = Array.from(files || []).filter(f => /^image\//.test(f.type) || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name));
  for (const f of list) {
    if (f.size > 25 * 1024 * 1024) { toast(f.name + ' is over 25 MB, so it was skipped.'); continue; }
    const id = uidGen('p');
    const ext = ((f.name.match(/\.([a-z0-9]+)$/i) || [])[1] || (f.type.split('/')[1] || 'jpg')).toLowerCase();
    const type = f.type || (ext === 'heic' || ext === 'heif' ? 'image/' + ext : 'image/jpeg');
    const base = 'photos/' + pid + '/' + date + '_' + id;
    const u = { id, pct: 0 }; (UPL[date] = UPL[date] || []).push(u); renderSoon();
    try {
      const th = await makeThumb(f);
      let tpath = null, turl = null;
      if (th.blob) { tpath = base + '_t.jpg'; turl = (await FBX.storage.upload(tpath, th.blob, 'image/jpeg')).url; }
      const up = await FBX.storage.upload(base + '.' + ext, f, type, (a, b) => { u.pct = b ? Math.round(100 * a / b) : 0; const el = document.getElementById('upl-' + id); if (el) el.textContent = u.pct + '%'; });
      const cur = clone(S.logs[lid]) || { pid, date };
      cur.photos = (cur.photos || []).concat([{ id, path: base + '.' + ext, url: up.url, tpath, turl, w: th.w, h: th.h, bytes: f.size, at: Date.now() }]);
      put('logs', lid, cur);
    } catch (e) { toast(photoErr(e)); }
    UPL[date] = (UPL[date] || []).filter(x => x !== u); renderSoon();
  }
}
async function deletePhoto(k) {
  const c = (S.phCtx || [])[k]; if (!c) return;
  const lid = logKey(c.pid, c.date); const cur = clone(S.logs[lid]);
  if (!cur || !cur.photos || !cur.photos[c.i]) return;
  const ph = cur.photos.splice(c.i, 1)[0];
  if (!put('logs', lid, cur)) return;
  S.phDel = null; closeSheet(); render(); toast('Photo deleted.');
  try { await FBX.storage.remove(ph.path); } catch (e) { }
  if (ph.tpath) { try { await FBX.storage.remove(ph.tpath); } catch (e) { } }
}
function photosHTML(date, l) {
  const own = !!S.pid && canWriteDoc('logs', logKey(S.pid, date));
  const ph = (l && l.photos) || [], up = UPL[date] || [];
  let h = '';
  if (ph.length || up.length || own) h += '<div class="field"><span>Photos</span><div class="phgrid">' +
    ph.map((x, i) => '<button class="phtile" data-a="photo-open" data-p="' + S.pid + '" data-d="' + date + '" data-i="' + i + '" aria-label="Open photo ' + (i + 1) + '"><img src="' + esc(x.turl || x.url) + '" alt="" loading="lazy"></button>').join('') +
    up.map(x => '<div class="phtile up"><span id="upl-' + x.id + '">' + x.pct + '%</span><span class="small">Uploading</span></div>').join('') +
    (own ? '<label class="phtile add">' + I.plus + '<span>Add photo</span><input type="file" accept="image/*" multiple hidden data-in="photos" data-d="' + date + '"></label>' : '') +
    '</div>' + (own && !ph.length && !up.length ? '<span class="small muted" style="font-weight:400">Saved at full quality. Everyone in the tracker can see them.</span>' : '') + '</div>';
  const others = peopleIds().filter(p => p !== S.pid).map(p => ({ p, l: getLog(date, p) })).filter(x => x.l && x.l.photos && x.l.photos.length);
  if (others.length) h += '<div class="field"><span>Everyone else\'s photos from this day</span><div class="phgrid">' +
    others.map(x => x.l.photos.map((y, i) => '<button class="phtile" data-a="photo-open" data-p="' + x.p + '" data-d="' + date + '" data-i="' + i + '" aria-label="Photo by ' + esc(pname(x.p)) + '"><img src="' + esc(y.turl || y.url) + '" alt="" loading="lazy">' + whoTag(x.p) + '</button>').join('')).join('') + '</div></div>';
  return h;
}
function sheetPhoto(o) {
  const ctx = S.phCtx || []; const c = ctx[o.k];
  const l = c ? getLog(c.date, c.pid) : null; const ph = l && l.photos && l.photos[c.i];
  if (!ph) return { title: 'Photo', body: '<p class="muted">This photo has been removed.</p>' };
  const own = canWriteDoc('logs', logKey(c.pid, c.date)); const n = ctx.length;
  const nav = n > 1 ? '<button class="btn" data-a="ph-nav" data-k="' + ((o.k - 1 + n) % n) + '" aria-label="Previous photo">' + I.left + '</button><button class="btn" data-a="ph-nav" data-k="' + ((o.k + 1) % n) + '" aria-label="Next photo">' + I.right + '</button>' : '';
  const del = own ? (S.phDel === ph.id ? '<button class="btn" style="border-color:var(--miss);color:var(--miss)" data-a="photo-rm" data-k="' + o.k + '">Yes, delete</button>' : '<button class="btn ghost" style="color:var(--miss)" data-a="photo-del-ask" data-v="' + esc(ph.id) + '">Delete</button>') : '';
  return { title: esc(pname(c.pid)) + ' · ' + esc(fmtDate(c.date)) + (n > 1 ? ' · ' + (o.k + 1) + '/' + n : ''), body: '<div class="phview"><img src="' + esc(ph.url) + '" alt="Photo by ' + esc(pname(c.pid)) + '">' +
    '<div class="row">' + nav + '<a class="btn" href="' + esc(ph.url) + '" target="_blank" rel="noopener">Open full size</a><span class="sp" style="flex:1"></span>' + del + '</div>' +
    '<p class="small muted">' + (ph.w ? ph.w + ' × ' + ph.h + ' px' : '') + (ph.bytes ? ' · ' + (ph.bytes / 1048576).toFixed(1) + ' MB original' : '') + '</p></div>' };
}
function allPhotos(onlyPid) {
  const order = peopleIds(); const out = [];
  Object.values(S.logs).forEach(l => {
    if (!l || !l.photos || !l.photos.length || !order.includes(l.pid)) return;
    if (onlyPid && l.pid !== onlyPid) return;
    l.photos.forEach((ph, i) => out.push({ pid: l.pid, date: l.date, i, ph }));
  });
  return out.sort((a, b) => b.date.localeCompare(a.date) || order.indexOf(a.pid) - order.indexOf(b.pid) || (a.ph.at || 0) - (b.ph.at || 0));
}
const whoTag = pid => peopleIds().length > 1 ? '<span class="phwho" style="--pc:' + pcolor(pid) + '"><i></i>' + esc(pname(pid)) + '</span>' : '';
function galTile(x, k) { return '<button class="phtile" data-a="gal-open" data-k="' + k + '" aria-label="Photo by ' + esc(pname(x.pid)) + ', ' + esc(fmtDate(x.date)) + '"><img src="' + esc(x.ph.turl || x.ph.url) + '" alt="" loading="lazy">' + whoTag(x.pid) + '</button>'; }
function viewPhotos() {
  const ids = peopleIds(); const f = ids.includes(S.route.pf) ? S.route.pf : 'all';
  const items = allPhotos(f === 'all' ? null : f);
  S.gal = items.map(x => ({ pid: x.pid, date: x.date, i: x.i }));
  const days = []; items.forEach(x => { if (!days.includes(x.date)) days.push(x.date); });
  const filt = ids.length > 1 ? '<div class="seg" role="group" aria-label="Whose photos">' + [['all', 'Everyone']].concat(ids.map(p => [p, pname(p)])).map(([v, t]) => '<button data-a="pf" data-v="' + v + '" aria-pressed="' + (f === v) + '">' + (v === 'all' ? '' : '<span class="dot" style="--pc:' + pcolor(v) + ';margin-right:6px;width:10px;height:10px"></span>') + esc(t) + '</button>').join('') + '</div>' : '';
  const head = '<div class="row"><h2 class="disp" style="font-size:34px;text-transform:uppercase;flex:1">Photos</h2>' + filt + '</div>' +
    (items.length ? '<p class="small muted" style="margin-top:-6px">' + items.length + ' photo' + (items.length > 1 ? 's' : '') + ' · ' + days.length + ' day' + (days.length > 1 ? 's' : '') + '</p>' : '');
  if (!items.length) return head + '<section class="card"><p class="empty">' + (f === 'all' ? 'No photos yet. Add them in <b>Finish session</b> on any day, and everyone\'s show up here.' : esc(pname(f)) + ' hasn\'t added any photos yet.') + '</p><div class="row" style="margin-top:8px"><button class="btn" data-a="nav" data-v="today">Go to today</button></div></section>';
  return head + days.map(d => {
    const p = S.days[d] ? P(d) : null;
    return '<section class="card"><div class="card-h"><h3 style="font-size:20px">' + esc(fmtDate(d)) + '</h3><span class="small muted">' + (p ? 'Day ' + p.n + ' · ' + esc(p.day.heading) : '') + '</span><span class="sp"></span><button class="btn sm ghost" data-a="go-day" data-d="' + d + '">Open day</button></div>' +
      '<div class="phgrid">' + items.map((x, k) => x.date === d ? galTile(x, k) : '').join('') + '</div></section>';
  }).join('');
}
const BADGE_GENERIC = { long: 'Longest single run so far', rpkm: 'A 1 km split at your race pace', race: 'Sled push and pull at your race weights' };
function achievementsCard() {
  const ids = peopleIds(); if (!ids.length) return '';
  const per = ids.map(pid => ({ pid, B: badges(pid) })); const defs = per[0].B;
  const feed = [];
  per.forEach(x => x.B.forEach(b => { if (b.on && b.id !== 'long') feed.push({ pid: x.pid, b }); }));
  feed.sort((a, b) => b.b.on.localeCompare(a.b.on) || ids.indexOf(a.pid) - ids.indexOf(b.pid));
  const chip = (pid, extra) => '<span class="pill"><span class="dot" style="--pc:' + pcolor(pid) + '"></span>' + esc(pname(pid)) + (extra ? ' ' + extra : '') + '</span>';
  const tally = '<div class="row" style="gap:8px">' + per.map(x => chip(x.pid, '<b class="mono">' + x.B.filter(b => b.on).length + '/' + x.B.length + '</b>')).join('') + '</div>';
  const latest = feed.length
    ? '<div class="stack" style="gap:8px;margin-top:14px">' + feed.slice(0, 6).map(f => '<div class="row" style="flex-wrap:nowrap;align-items:flex-start;gap:10px"><span class="medal-sm" style="color:' + pcolor(f.pid) + '">' + I.medal + '</span><span class="small" style="flex:1;min-width:0"><b>' + esc(pname(f.pid)) + '</b> earned <b>' + esc(f.b.name) + '</b><br><span class="muted">' + esc(fmtDate(f.b.on)) + '</span></span></div>').join('') + '</div>'
    : '<p class="empty" style="margin-top:10px">No achievements yet. The first one comes with your first completed session.</p>';
  const all = '<details style="margin-top:12px"><summary class="small">All achievements (' + defs.length + ')</summary><div class="stack" style="gap:12px;margin-top:8px">' + defs.map((d, i) => {
    const got = per.filter(x => x.B[i].on);
    return '<div><b class="small">' + esc(d.name) + '</b><br><span class="small muted">' + esc(BADGE_GENERIC[d.id] || d.desc) + '</span><div class="row" style="gap:6px;margin-top:6px">' +
      (got.length ? got.map(x => chip(x.pid, '· ' + esc(d.id === 'long' ? fmtKm((runsOf(x.pid).reduce((a, r) => r.dist > a ? r.dist : a, 0))) + ' km' : fmtDate(x.B[i].on, false)))).join('') : '<span class="small muted">Nobody yet</span>') + '</div></div>';
  }).join('') + '</div></details>';
  return '<section class="card"><div class="card-h"><h3>Achievements</h3><span class="sp"></span><button class="btn sm ghost" data-a="sub" data-v="progress" data-s="badges">' + I.medal + 'Badges</button></div>' + tally + latest + all + '</section>';
}
function togetherPhotos() {
  const items = allPhotos(null); if (!items.length) return '';
  S.gal = items.map(x => ({ pid: x.pid, date: x.date, i: x.i }));
  return '<section class="card"><div class="card-h"><h3>Latest photos</h3><span class="sp"></span><button class="btn sm" data-a="nav" data-v="photos">' + I.photo + 'See all ' + items.length + '</button></div><div class="phgrid">' + items.slice(0, 8).map((x, k) => galTile(x, k)).join('') + '</div></section>';
}
function finishCard(date, p, l) {
  const el = l.start && !l.time ? Math.round((Date.now() - l.start) / 60000) : null;
  return '<section class="card finish o9" id="finish"><div class="card-h"><h3>Finish session</h3></div><div class="stack">' +
    '<div class="field"><span>Session RPE' + (p.rpe ? ' · target ' + esc(p.rpe.split(/[ ,(]/)[0]) : '') + '</span><div class="chips rpe">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => '<button class="chip" data-a="rpe" data-v="' + v + '" aria-pressed="' + (l.rpe === v) + '">' + v + '</button>').join('') + '</div></div>' +
    '<div class="fgrid" style="grid-template-columns:minmax(0,1fr) auto;align-items:end"><label class="field"><span>Total session time (min)</span><input class="inp mono" id="sess-time" inputmode="numeric" placeholder="' + (p.planMin || '') + '" value="' + esc(l.time || '') + '" data-in="lg" data-k="time" data-num="1"></label>' +
    (el ? '<button class="btn" data-a="use-elapsed" data-v="' + el + '">Use ' + el + ' min</button>' : '<span></span>') + '</div>' +
    '<label class="field"><span>Notes / journal</span><textarea class="inp" id="notes-' + date + '" data-in="notes" placeholder="What went well, what felt off, anything to remember">' + esc(l.notes || '') + '</textarea></label>' +
    photosHTML(date, l) +
    '<div class="statusbtns"><button class="btn c" data-a="status" data-v="complete" aria-pressed="' + (l.status === 'complete') + '">' + I.check + 'Complete</button><button class="btn s" data-a="status" data-v="skipped" aria-pressed="' + (l.status === 'skipped') + '">Skipped</button></div>' +
    (l.status === 'modified' || l.status === 'skipped' ? '<div class="field"><span>Reason</span><div class="chips">' + REASONS.map(r => '<button class="chip" data-a="reason" data-v="' + r + '" aria-pressed="' + (l.reason === r || (l.reason || '').startsWith(r + ':')) + '">' + r + '</button>').join('') + '</div><input class="inp" id="reason" style="margin-top:6px" placeholder="What changed and why" value="' + esc(l.reason || '') + '" data-in="lg" data-k="reason"></div>' : '') +
    '</div></section>';
}

