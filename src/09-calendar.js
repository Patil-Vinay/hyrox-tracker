/* ================= Calendar & list ================= */
function stDots(date) {
  return peopleIds().slice(0, 4).map(pid => {
    const st = dayState(pid, date);
    const cls = doneStates.has(st) || st === 'restdone' ? 'f' : st === 'skipped' ? 'x' : '';
    if (!cls && st !== 'missed') return '';
    return '<i class="' + cls + '" style="--pc:' + pcolor(pid) + '" title="' + esc(pname(pid) + ': ' + STATE_LABEL[st]) + '"></i>';
  }).join('');
}
function stMark(pid, date) {
  const st = dayState(pid, date);
  const map = { complete: 's-complete', modified: 's-modified', partial: 's-modified', skipped: 's-skipped', missed: 's-missed', restdone: 's-complete' };
  if (!map[st]) return '';
  return '<span class="stmark ' + map[st] + '"><i></i>' + (peopleIds().length > 1 ? esc(pname(pid)) : esc(STATE_LABEL[st])) + '</span>';
}
function listRow(d) {
  const p = P(d); const t = todayISO();
  const marks = peopleIds().map(pid => stMark(pid, d)).filter(Boolean).join(' ');
  return '<button class="lrow k-' + p.kind + (d === t ? ' today' : '') + '" data-a="go-day" data-d="' + d + '"><span class="d">' + DOWS[dowOf(d)] + '<b>' + D(d).getUTCDate() + ' ' + MON[D(d).getUTCMonth()] + '</b></span>' +
    '<span class="s"><b>' + esc(p.day.heading) + '</b><small>' + esc(kindLabel(p)) + (p.day.km ? ' · ' + fmtKm(p.day.km) + ' km' : '') + ((p.day.badges || []).length ? ' · ' + (p.day.badges.includes('test') ? 'Benchmark' : 'Simulation') : '') + '</small></span><span class="row" style="gap:6px;justify-content:flex-end">' + marks + '</span></button>';
}
const CAL_MONTHS = ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01'];
function viewCalendar() {
  if (!S.order.length) return loadingView();
  const mode = LS.get('hx.calmode', 'month');
  const t = todayISO();
  let month = S.route.arg && /^\d{4}-\d{2}$/.test(S.route.arg) ? S.route.arg : (t < START() ? '2026-10' : t > RACE() ? '2027-01' : t.slice(0, 7));
  let h = '<div class="row"><div class="seg" role="group" aria-label="Calendar view"><button data-a="calmode" data-v="month" aria-pressed="' + (mode === 'month') + '">Month</button><button data-a="calmode" data-v="list" aria-pressed="' + (mode === 'list') + '">List</button></div><span style="flex:1"></span>' +
    (S.days[t] ? '<button class="btn sm" data-a="nav" data-v="today">Today</button>' : '') + '</div>';
  if (mode === 'list') {
    let body = '';
    const w0 = weekDates(0);
    if (w0.length) body += '<div class="wkh" id="wk-0"><b>Kick-off weekend</b><span class="muted small">' + esc(fmtDate(w0[0], false) + ' – ' + fmtDate(w0[w0.length - 1], false)) + '</span></div>' + w0.map(listRow).join('');
    for (let n = 1; n <= weekCount(); n++) {
      const w = weekDoc(n); if (!w) continue;
      body += '<div class="wkh" id="wk-' + n + '"><b>Week ' + n + '</b><span class="muted small">' + esc(w.dates) + ' · ' + esc(w.label) + ' · ' + fmtKm(w.km) + ' km</span></div>' + weekDates(n).map(listRow).join('');
    }
    return h + '<div class="list-w">' + body + '</div>';
  }
  const idx = CAL_MONTHS.indexOf(month);
  const y = +month.slice(0, 4), m = +month.slice(5, 7) - 1;
  h += '<section class="card calcard"><div class="cal-h"><button class="iconbtn" data-a="calmonth" data-v="' + (CAL_MONTHS[idx - 1] || '') + '" ' + (idx > 0 ? '' : 'disabled') + ' aria-label="Previous month">' + I.left + '</button><h2>' + MONTH_FULL[m] + ' <span class="muted" style="font-size:20px">' + y + '</span></h2><button class="iconbtn" data-a="calmonth" data-v="' + (CAL_MONTHS[idx + 1] || '') + '" ' + (idx < CAL_MONTHS.length - 1 ? '' : 'disabled') + ' aria-label="Next month">' + I.right + '</button></div>' +
    '<div class="mgrid" style="margin-top:12px">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => '<div class="dow">' + d + '</div>').join('');
  const first = month + '-01';
  let cur = mondayOf(first);
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
  while (cur <= lastDay || dowOf(cur) !== 1) {
    const inMonth = cur.slice(0, 7) === month;
    const p = S.days[cur] ? P(cur) : null;
    if (!p) h += '<div class="dc none"><span class="dn">' + D(cur).getUTCDate() + '</span></div>';
    else h += '<button class="dc k-' + p.kind + (cur === t ? ' today' : '') + (inMonth ? '' : ' out') + '" data-a="go-day" data-d="' + cur + '" aria-label="' + esc(fmtDate(cur) + ': ' + p.day.short) + '"><span class="dn">' + D(cur).getUTCDate() + '</span><span class="st">' + stDots(cur) + '</span>' +
      '<span class="kl f">' + esc(p.day.short) + '</span><span class="kl t">' + esc(p.day.tiny) + '</span>' + (p.day.km ? '<span class="km">' + fmtKm(p.day.km) + '</span>' : '') + '</button>';
    cur = addDays(cur, 1);
    if (cur > lastDay && dowOf(cur) === 1) break;
  }
  h += '</div><div class="hleg" style="margin-top:12px"><span><i class="dot" style="--pc:var(--k-strength)"></i>Strength</span><span><i class="dot" style="--pc:var(--k-hyrox)"></i>HYROX</span><span><i class="dot" style="--pc:var(--k-long)"></i>Long run</span><span><i class="dot" style="--pc:var(--k-race)"></i>Race</span>' +
    peopleIds().map(pid => '<span><i class="dot" style="--pc:' + pcolor(pid) + '"></i>' + esc(pname(pid)) + ' done</span>').join('') + '<span class="muted">Numbers = planned km</span></div></section>';
  return h;
}

