/* ================= Routing, rendering, events ================= */
const curDate = () => (S.route.view === 'day' && S.route.date) ? S.route.date : todayISO();
function isTyping() { const a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'file' && $('#view').contains(a)); }
let renderQueued = false, pendingRender = false;
function renderSoon() { if (renderQueued) return; renderQueued = true; requestAnimationFrame(() => { renderQueued = false; if (isTyping()) { pendingRender = true; return; } render(); }); }
document.addEventListener('focusout', () => { if (pendingRender) setTimeout(() => { if (!isTyping() && pendingRender) { pendingRender = false; render(); } }, 80); });

function topbarHTML() {
  const p = me();
  const other = !!(S.pid && S.uid && S.pid !== S.uid);
  return '<button class="who" data-a="who" style="--pc:' + (p ? pcolor(S.pid) : 'var(--muted)') + (other ? ';border-color:var(--accent)' : '') + '" aria-label="' + (isAdmin() ? 'View or edit as someone else' : 'Your profile') + '"><span class="dot"></span>' + (p ? (other ? 'Editing ' : '') + esc(p.name) : 'Set up profile') + '</button>' +
    (other && ownProfile() ? '<button class="btn sm" data-a="choose" data-v="' + S.uid + '">Back to me</button>' : isAdmin() ? '<span class="pill">Admin</span>' : '') +
    '<span class="sync" id="sync" data-s="' + S.sync + '"><i></i><span></span></span><span class="sp"></span>' +
    '<button class="iconbtn" data-a="tool" data-t="tools" aria-label="More: HYROX guide, score history, achievements">' + I.more + '</button>';
}
function render() {
  pendingRender = false;
  CHARTS.clear(); chartSeq = 0;
  const v = S.route.view;
  let html = '';
  try {
    html = v === 'day' ? viewDay(S.route.date) : v === 'calendar' ? viewCalendar() : v === 'progress' ? viewProgress() : v === 'together' ? viewTogether() : v === 'settings' ? viewSettings() : v === 'guide' ? viewGuide() : v === 'nutrition' ? viewNutrition() : v === 'photos' ? viewPhotos() : viewToday();
  } catch (e) { console.error(e); html = '<div class="card"><b>Something went wrong drawing this screen.</b><p class="small muted">' + esc(e && e.message) + '</p></div>'; }
  $('#topbar').innerHTML = topbarHTML();
  const fa = document.activeElement, fmv = fa && fa.dataset && fa.dataset.a === 'ex-mv' && $('#view').contains(fa) ? '#ex-' + fa.dataset.ex + ' [data-a=ex-mv][data-v="' + fa.dataset.v + '"]' : null;
  const tabsWas = tabsSave($('#view'), v);
  $('#view').innerHTML = html; keepOpen($('#view')); tabsRestore($('#view'), tabsWas, v);
  if (fmv) { const n = $(fmv), box = n && n.closest('.ex'); const f = n && !n.disabled ? n : box && box.querySelector('[data-a=ex-mv]:not([disabled])'); if (f) f.focus({ preventScroll: true }); }
  setSync(S.sync);
  const cur = v === 'day' ? (S.route.date === todayISO() ? 'today' : 'calendar') : v;
  $$('#nav a[data-v]').forEach(a => a.setAttribute('aria-current', a.dataset.v === cur ? 'page' : 'false'));
  drawCharts();
  if (SHEET && SHEET.kind === 'who') renderSheet();
}
function go(route) { S.route = route; window.scrollTo(0, 0); render(); }
function onData(col) {
  if (!PLAN_COLS.includes(col)) ensureMe();
  if (col === 'together' || col === 'profiles') tgTidy();
  if (col === 'plan_days' && S.route.view !== 'day') { /* plan edits by others */ }
  renderSoon();
}

