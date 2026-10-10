/* ================= Together ================= */
function weekHighlights(pid, n) {
  const ds = weekDates(n); const out = [];
  strengthEntries(pid).filter(e => ds.includes(e.date) && e.top > 0).forEach(e => { const b = bestLoadBefore(pid, e.name, e.date); if (b != null && e.top > b) out.push('PR ' + e.name.replace(/\s*\(.*?\)/, '') + ' ' + e.top + ' kg'); });
  const rs = runsOf(pid).filter(r => ds.includes(r.date));
  if (rs.length) { const lr = rs.reduce((a, b) => b.dist > a.dist ? b : a); out.push('Longest run ' + fmtKm(lr.dist) + ' km'); }
  const B = (S.meta && S.meta.benchmarks) || []; const res = (S.bench[pid] || {}).results || {};
  B.filter(b => ds.includes(b.date) && res[b.id] && res[b.id].v).forEach(b => { const st = benchStatus(b, res[b.id]); out.push(b.name + ': ' + res[b.id].v + (st ? ' (' + st.txt + ')' : '')); });
  return out.slice(0, 3);
}
function wkDotsHTML(pid, n) {
  const t = todayISO();
  const col = { complete: 'var(--done)', modified: 'var(--mod)', partial: 'var(--mod)', skipped: 'repeating-linear-gradient(45deg,var(--skip) 0 3px,var(--skip-tint) 3px 6px)', rest: 'var(--k-rest-tint)', restdone: 'var(--k-rest-tint)', missed: 'var(--surface)', future: 'var(--surface-2)', today: 'var(--surface)' };
  return '<div class="wkdots">' + weekDates(n).map(d => {
    const st = dayState(pid, d);
    const ring = st === 'missed' ? 'box-shadow:inset 0 0 0 2px var(--miss)' : st === 'today' ? 'box-shadow:inset 0 0 0 2px var(--accent)' : st === 'restdone' ? 'box-shadow:inset 0 0 0 2px var(--done)' : (st === 'future' || st === 'rest') ? 'box-shadow:inset 0 0 0 1px var(--line)' : '';
    return '<div><i style="background:' + col[st] + ';' + ring + '" data-tip="' + esc(pname(pid) + ' · ' + fmtDate(d) + '\n' + S.days[d].short + ': ' + STATE_LABEL[st]) + '"></i>' + DOWS[dowOf(d)][0] + '</div>';
  }).join('') + '</div>';
}
function viewTogether() {
  if (!S.order.length) return loadingView();
  const ids = peopleIds(); const t = todayISO();
  const n = pickWeek();
  const w = weekDoc(n);
  const tp = S.days[t] ? P(t) : null;
  let headline;
  if (!tp) headline = t < START() ? 'Training starts Monday. Pick your profiles and get your bags ready.' : 'Season complete. Well trained, both of you.';
  else if (tp.rest) headline = 'Rest day for everyone. A walk counts as a win.';
  else {
    const done = ids.filter(pid => doneStates.has(dayState(pid, t)));
    if (ids.length > 1 && done.length === ids.length) headline = 'Everyone has trained today. Nice work.';
    else if (done.length) headline = done.map(pname).join(' and ') + (done.length > 1 ? ' have' : ' has') + ' trained today. ' + ids.filter(x => !done.includes(x)).map(pname).join(' and ') + ', your session is ' + tp.day.heading + '.';
    else headline = 'Today is ' + tp.day.heading + '. Nobody has logged it yet.';
  }
  const stats = ids.map(pid => ({ pid, ws: weekStats(pid, n), st: streaks(pid), hl: weekHighlights(pid, n) }));
  const combKm = sum(stats.map(s => s.ws.km));
  const cards = stats.map(s => {
    const today = tp ? dayState(s.pid, t) : null;
    return '<section class="card person" style="--pc:' + pcolor(s.pid) + '"><div class="row"><span class="nm">' + esc(pname(s.pid)) + '</span>' + (s.pid === S.pid ? '<span class="pill">You</span>' : '') + '<span class="sp" style="flex:1"></span>' +
      (today ? '<span class="pill ' + (doneStates.has(today) ? 'ok' : today === 'skipped' ? '' : today === 'rest' || today === 'restdone' ? '' : 'warn') + '">Today: ' + esc(STATE_LABEL[today]) + '</span>' : '') + (tp ? (() => { const sc = dayScore(s.pid, t); return sc && sc.score != null && (sc.score > 0 || tp.rest) ? '<span class="pill">Score ' + sc.score + '</span>' : ''; })() : '') + '</div>' +
      wkDotsHTML(s.pid, n) +
      '<div class="tiles" style="margin-top:12px;grid-template-columns:repeat(3,minmax(0,1fr))"><div class="tile" style="border:0;background:var(--surface-2)"><span>Running</span><b>' + fmtKm(s.ws.km) + '<small>km</small></b>' + (s.ws.pkm ? '<span class="pl">of ' + fmtKm(s.ws.pkm) + '</span>' : '') + '</div>' +
      '<div class="tile" style="border:0;background:var(--surface-2)"><span>Sessions</span><b>' + s.ws.done + '<small>/ ' + s.ws.planned + '</small></b></div><div class="tile" style="border:0;background:var(--surface-2)"><span>Streak</span><b>' + s.st.cur + '<small>days</small></b></div></div>' +
      (s.hl.length ? '<ul class="small" style="margin:10px 0 0;padding-left:18px">' + s.hl.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') + '</section>';
  }).join('');
  const invite = '<section class="card flat"><p class="small">' + (ids.length < 2 ? 'Training with someone? ' : '') + 'Send them the link. They sign in with Google, set up their profile once, and log on their own phone. Everyone\'s progress shows up here.</p></section>';
  const weeks = []; for (let i = 1; i <= Math.min(weekCount(), Math.max(currentWeekN(), 1)); i++) weeks.push(i);
  const chart = ids.length && S.order[0] <= t ? '<section class="card"><div class="card-h"><h3>Weekly running</h3></div>' + chartBox({ type: 'bar', label: 'Weekly running per person', x: weeks.map(i => 'W' + i), series: [{ name: 'Planned', ghost: true, vals: weeks.map(i => (weekDoc(i) || {}).km || 0) }].concat(ids.map(pid => ({ name: pname(pid), color: pcolor(pid), vals: weeks.map(i => +weekStats(pid, i).km.toFixed(1)) }))), yFmt: v => v + '' }, 220) + '</section>' : '';
  return '<h2 class="disp" style="font-size:34px;text-transform:uppercase">Together</h2><div class="row" style="flex-wrap:nowrap"><button class="iconbtn" data-a="wk" data-v="' + (n - 1) + '" ' + (n > minWeek() ? '' : 'disabled') + ' aria-label="Previous week">' + I.left + '</button><span class="small" style="flex:1;text-align:center"><b>' + weekName(n) + '</b>' + (w ? '<br><span class="muted">' + esc(w.dates) + '</span>' : '') + '</span><button class="iconbtn" data-a="wk" data-v="' + (n + 1) + '" ' + (n < weekCount() ? '' : 'disabled') + ' aria-label="Next week">' + I.right + '</button></div>' +
    '<p style="font-size:17px;max-width:60ch">' + esc(headline) + (ids.length > 1 && combKm ? ' Together you\'ve run <b>' + fmtKm(combKm) + ' km</b> ' + (n === 0 ? 'over the kick-off weekend' : 'in week ' + n) + '.' : '') + '</p>' +
    '<div class="people">' + cards + '</div>' + achievementsCard() + togetherPhotos() + invite + chart +
    '<section class="card"><div class="card-h"><h3>Weekly recap</h3><span class="sp"></span>' + (S.dl ? '<button class="btn sm" data-a="recap-png" data-n="' + n + '">Save as image</button>' : '') + '</div>' + recapCard(n, stats, w) + '<p class="small muted" style="margin-top:10px">Screenshot it or save the image to share in your chat.</p></section>';
}
function recapCard(n, stats, w) {
  const comb = sum(stats.map(s => s.ws.km));
  return '<div class="recap" id="recap"><div class="rh"><b>' + weekName(n) + '</b><span>' + esc(w ? w.dates : '') + '<br>' + esc(w ? w.label : '') + '</span></div>' +
    '<div class="rp">' + stats.map(s => '<div style="--pc:' + pcolor(s.pid) + '"><div class="n">' + esc(pname(s.pid)) + '</div><div class="k">' + fmtKm(s.ws.km) + '</div><small>km run of ' + fmtKm(s.ws.pkm) + ' planned</small><small>' + s.ws.done + '/' + s.ws.planned + ' sessions · ' + s.st.cur + '-day streak</small>' + (s.hl[0] ? '<small>' + esc(s.hl[0]) + '</small>' : '') + '</div>').join('') + '</div>' +
    (stats.length > 1 ? '<div class="hl">' + fmtKm(comb) + ' km together this week.</div>' : '') + '<div class="brand">16 Weeks to HYROX · Race day Fri 15 Jan 2027</div></div>';
}
async function recapPNG(n) {
  const ids = peopleIds(); const stats = ids.map(pid => ({ pid, ws: weekStats(pid, n), st: streaks(pid), hl: weekHighlights(pid, n) })); const w = weekDoc(n);
  try { await document.fonts.load('800 60px "Big Shoulders Display"'); await document.fonts.load('600 20px "IBM Plex Sans"'); } catch (e) { }
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const cs = getComputedStyle(document.documentElement); const v = k => cs.getPropertyValue(k).trim();
  g.fillStyle = '#14171A'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#C24D17'; g.fillRect(0, 0, W, 14);
  g.fillStyle = '#FFFFFF'; g.font = '800 170px "Big Shoulders Display", Impact, sans-serif'; g.textBaseline = 'alphabetic';
  g.fillText(n === 0 ? 'KICK-OFF' : 'WEEK ' + n, 72, 250);
  g.font = '600 34px "IBM Plex Sans", sans-serif'; g.fillStyle = 'rgba(255,255,255,.72)';
  g.fillText((w ? w.dates + ' · ' + w.label : '').toUpperCase(), 76, 312);
  const colW = (W - 144 - (stats.length - 1) * 40) / Math.max(1, stats.length);
  stats.slice(0, 3).forEach((s, i) => {
    const x = 72 + i * (colW + 40), y = 420;
    const pc = v('--p-' + ((S.profiles[s.pid] || {}).color || 'blue')) || '#2a78d6';
    g.fillStyle = pc; g.fillRect(x, y, colW, 10);
    g.fillStyle = '#FFFFFF'; g.font = '700 40px "IBM Plex Sans", sans-serif'; g.fillText(pname(s.pid), x, y + 70);
    g.font = '800 190px "Big Shoulders Display", Impact, sans-serif'; g.fillText(fmtKm(s.ws.km), x, y + 250);
    g.font = '500 32px "IBM Plex Sans", sans-serif'; g.fillStyle = 'rgba(255,255,255,.75)';
    const lines = [s.ws.pkm ? 'km of ' + fmtKm(s.ws.pkm) + ' planned' : 'km run', s.ws.done + '/' + s.ws.planned + ' sessions', s.st.cur + '-day streak'].concat(s.hl.slice(0, 2));
    lines.forEach((ln, k) => { let t = ln; while (g.measureText(t).width > colW && t.length > 4) t = t.slice(0, -2); if (t !== ln) t += '…'; g.fillText(t, x, y + 310 + k * 46); });
  });
  if (stats.length > 1) { g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(72, 1090, W - 144, 2); g.fillStyle = '#FFFFFF'; g.font = '600 40px "IBM Plex Sans", sans-serif'; g.fillText(fmtKm(sum(stats.map(s => s.ws.km))) + ' km together this week', 72, 1160); }
  g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '600 26px "IBM Plex Sans", sans-serif'; g.fillText('16 WEEKS TO HYROX · RACE DAY FRI 15 JAN 2027', 72, 1270);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  if (!blob) { toast("Couldn't draw the image. Take a screenshot instead."); return; }
  saveFile('hyrox-week-' + n + '-recap.png', blob);
}

