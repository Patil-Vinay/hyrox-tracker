/* ================= HYROX guide ================= */
function viewGuide() {
  const M = S.meta; if (!M) return loadingView();
  const G = M.info || {}; const sts = M.stations || [];
  const pid = S.pid; const r = pid ? raceOf(pid) : null; const lc = loadClass(r);
  const solo = !r || r.fmt === 'singles';
  const sp = pid ? planSplits(pid) : M.plans.A;
  const strip = sts.map((s, i) => '<span class="seg-run">1 km</span><span class="seg-st"><b>' + (i + 1) + '</b> ' + esc(s.name) + '</span>').join('');
  const stRows = sts.map((s, i) => '<tr><td class="mono">' + (i + 1) + '</td><td><b>' + esc(s.name) + '</b></td><td class="mono">' + esc(s.amount.toLocaleString('en-IN') + (s.unit === 'reps' ? ' reps' : ' m')) + '</td><td>' + esc(loadText(s.key, pid)) + '</td><td class="wrap">' + esc(s.standard) + '</td>' + (solo ? '<td class="num mono">' + (sp ? esc(sp.stations[s.key]) : '') + '</td>' : '') + '</tr>').join('');
  const L = k => LOADS[k];
  const wrow = (key, name, used, l, tgt, mine) => '<tr' + (mine ? ' class="cell-good"' : '') + '><td><b>' + esc(name) + '</b>' + (mine ? ' <span class="pill ok">Your race</span>' : '') + '<br><span class="small muted">' + esc(used) + '</span></td><td class="mono">' + l.push + ' kg</td><td class="mono">' + l.pull + ' kg</td><td class="mono">2 × ' + l.farm + ' kg</td><td class="mono">' + l.bag + ' kg</td><td class="mono">' + l.wb + ' kg · ' + tgt + '</td></tr>';
  const isMix = r && r.div === 'X';
  const wRows = wrow('W', 'Women', 'Singles Women Open · Doubles Women · Relay Women', L('W'), '2.70 m', r && !isMix && lc === 'W') +
    wrow('WP', 'Women Pro', 'Singles Women Pro · Doubles Women Pro', L('WP'), '2.70 m', r && !isMix && lc === 'WP') +
    wrow('M', 'Men', 'Singles Men Open · Doubles Men · Relay Men', L('M'), '3.00 m', !r || (!isMix && lc === 'M')) +
    wrow('MP', 'Men Pro', 'Singles Men Pro · Doubles Men Pro', L('MP'), '3.00 m', r && !isMix && lc === 'MP') +
    wrow('X', 'Mixed doubles', 'Doubles Mixed (one woman, one man)', L('M'), '2.70 m her · 3.00 m him', r && isMix && r.fmt === 'doubles') +
    '<tr' + (r && isMix && r.fmt === 'relay' ? ' class="cell-good"' : '') + '><td><b>Mixed relay</b>' + (r && isMix && r.fmt === 'relay' ? ' <span class="pill ok">Your race</span>' : '') + '<br><span class="small muted">Relay Mixed (two women, two men)</span></td><td colspan="5" class="small">The relay rulebook lists only Women and Men loads. Check your event\'s athlete guide for which weights mixed teams use.</td></tr>';
  const formats = [
    ['Singles', 'Women Open · Women Pro · Men Open · Men Pro', ['You run all 8 km and do all 8 stations yourself.', 'Open is the standard entry; Pro uses heavier loads (see the table).', 'Results are also ranked by age group, from 16–24 upwards in five-year bands.']],
    ['Doubles', 'Women · Women Pro · Men · Men Pro · Mixed', ['You run every 1 km together. Running ahead of your partner is a 1-minute penalty, and more than 3 of those puts you out of the competition.', 'Split each station however you like: one works while the other rests on their feet in the station area.', 'Burpee broad jumps: the next person starts with hands where the other\'s feet landed.', 'Sandbag lunges: pass the bag sideways or backwards, never forwards.', 'Wall balls: 100 reps in total, shared any way you choose.']],
    ['Relay', 'Women · Men · Mixed (2 women + 2 men)', ['A team of four. Each member runs 1 km and does the station after it, twice, so each person covers 2 of the 8 legs.', 'You can go in a fixed rotation or back to back; hand over in the Roxzone.', 'There\'s no Pro relay. Age groups go by the team\'s average age: under 40, or 40 and over.']],
    ['Adaptive', 'Thirteen divisions', ['For athletes with an impairment, with adjusted reps, loads and distances. See the adaptive rulebook on hyrox.com for your division.']],
    ['Elite 15 and Challenger', 'Invite only', ['The fastest 15 men and women race the Elite series. New for 2026/27: a Challenger division for athletes ranked 16–30.']]
  ];
  const fmtCards = formats.map(f => '<div class="' + (r && RACE_FORMATS[r.fmt] && RACE_FORMATS[r.fmt].name === f[0] ? 'note' : '') + '" style="' + (r && RACE_FORMATS[r.fmt] && RACE_FORMATS[r.fmt].name === f[0] ? '' : 'padding:2px 0') + '"><b>' + esc(f[0]) + '</b>' + (r && RACE_FORMATS[r.fmt] && RACE_FORMATS[r.fmt].name === f[0] ? ' <span class="pill ok">Yours</span>' : '') + '<br><span class="small muted">' + esc(f[1]) + '</span><ul class="small" style="margin:6px 0 0;padding-left:18px;color:var(--ink-2)">' + f[2].map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>').join('');
  const sources = [
    { t: 'HYROX Singles rulebook 2026/27', u: 'https://maintain.hyrox.com/rulebooks/HYROX_RulebookSingles_EN.pdf' },
    { t: 'HYROX Doubles rulebook 2026/27', u: 'https://maintain.hyrox.com/rulebooks/HYROX_RulebookDoubles_EN.pdf' },
    { t: 'HYROX Relay rulebook 2026/27', u: 'https://hyrox.mx/wp-content/uploads/2026/07/26_27_HYROX_RulebookRelay_EN_Final_240626.pdf' },
    { t: 'HYROX: The fitness race (formats and divisions)', u: 'https://hyrox.com/the-fitness-race/' }
  ];
  const title = r ? 'HYROX ' + raceLabel(r) : (M.title || 'HYROX');
  const canEdit = pid && (pid === S.uid || isAdmin());
  return '<div><span class="eyebrow">Reference</span><h2 class="disp" style="font-size:40px;text-transform:uppercase;margin-top:4px">HYROX guide</h2><p style="max-width:62ch;margin-top:8px;font-size:16px;color:var(--ink-2)">' + esc(G.lead || '') + '</p></div>' +
    '<section class="card k-race" style="background:var(--k-race-tint);border-color:transparent"><div class="row"><div style="flex:1;min-width:220px"><span class="eyebrow" style="color:var(--k-race)">' + (pid && pid !== S.uid ? esc(pname(pid)) + '\'s race' : 'Your race') + '</span><h3 class="disp" style="font-size:30px;text-transform:uppercase;margin:6px 0 4px">' + esc(title) + '</h3><p class="small">Friday 15 January 2027' + (pid ? ' · Plan ' + planOf(pid) + ' (' + esc(sp.finish) + ')' : '') + '</p><p class="small" style="margin-top:4px;color:var(--ink-2)">' + esc(loadsSummary(lc)) + '</p></div><div class="row"><button class="btn" data-a="tool" data-t="race">' + I.flag + 'Race-day mode</button>' + (canEdit ? '<button class="btn" data-a="nav" data-v="settings">Change race</button>' : '') + '</div></div></section>' +
    '<section class="card"><div class="card-h"><h3>The format</h3><span class="sp"></span><span class="small muted">8 km running · 8 stations · one order, every event</span></div><div class="course">' + strip + '<span class="seg-fin">Finish</span></div>' +
    '<p class="small muted" style="margin-top:10px">' + esc(G.roxzone || '') + '</p></section>' +
    '<section class="card"><div class="card-h"><h3>Stations</h3><span class="sp"></span><span class="small muted">' + esc(loadsLabel(r)) + ' loads' + (solo ? ' · target for your plan' : '') + '</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Station</th><th>Distance</th><th>Load</th><th>Standard that costs time</th>' + (solo ? '<th class="num">Target</th>' : '') + '</tr></thead><tbody>' + stRows + '</tbody></table></div>' +
    '<div class="cues" style="margin-top:12px">' + sts.map(s => '<details class="cue"><summary>' + esc(s.name) + ' tips</summary><p>' + esc(s.cue) + '</p></details>').join('') + '</div></section>' +
    '<section class="card"><div class="card-h"><h3>Ways to race</h3><span class="sp"></span><span class="small muted">Same course and stations in every format</span></div><div class="stack">' + fmtCards + '</div></section>' +
    '<section class="card"><div class="card-h"><h3>Weights by division</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Loads</th><th>Sled push</th><th>Sled pull</th><th>Farmers carry</th><th>Sandbag</th><th>Wall ball · target</th></tr></thead><tbody>' + wRows + '</tbody></table></div>' +
    '<p class="small muted" style="margin-top:8px">Sled weights include the sled. SkiErg and row are 1,000 m, burpee broad jumps 80 m and wall balls 100 reps in every division. Doubles and relay teams share the same totals; the loads don\'t get lighter.</p></section>' +
    '<section class="card"><div class="card-h"><h3>Rules that cost time</h3></div><ul class="small stack" style="padding-left:18px;margin:0">' + (G.rules || []).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></section>' +
    '<section class="card"><div class="card-h"><h3>Race-day timeline</h3></div><div class="stack">' + ((M.raceWeek && M.raceWeek.timeline) || []).map(x => '<div class="row" style="align-items:flex-start;flex-wrap:nowrap"><b class="mono" style="min-width:86px">' + esc(x.t) + '</b><span class="small">' + esc(x.what) + '</span></div>').join('') + '</div><p class="small muted" style="margin-top:10px">' + esc((M.raceWeek && M.raceWeek.rules) || '') + '</p></section>' +
    nutRaceCard() + '<section class="card"><div class="card-h"><h3>Sources</h3><span class="sp"></span><span class="small muted">Checked 25 Sep 2026</span></div><ul class="small stack" style="padding-left:18px;margin:0">' + sources.map(s => '<li><a href="' + esc(s.u) + '" target="_blank" rel="noopener">' + esc(s.t) + '</a></li>').join('') + '</ul></section>';
}

