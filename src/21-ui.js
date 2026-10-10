/* ---------- v16: dropdowns stay open ----------
   A <details> you opened stays open when the screen redraws (deleting a row inside it, a sync, a tick).
   Each one is known by where it is (the page, the sheet or gym mode), its summary text with the numbers
   taken out ("All check-ins (5)" and "(4)" are the same one) and which of that name it is on the screen. */
const DOPEN = new Set();
function dScope(root) { return root.id === 'sheet' ? 'sheet:' + (typeof PICK !== 'undefined' && PICK ? 'pick' : SHEET ? SHEET.kind : '') : root.id === 'mode' ? 'mode' : 'view:' + (S.route ? S.route.view : ''); }
function dKeys(root) {
  const seen = {}, sc = dScope(root);
  return [...root.querySelectorAll('details')].map(d => {
    const s = d.querySelector(':scope > summary');
    const t = (s ? s.textContent : '').replace(/\d+([.,]\d+)?/g, '#').replace(/\s+/g, ' ').trim();
    const n = seen[t] = (seen[t] || 0) + 1;
    return [d, sc + '|' + t + '|' + n];
  });
}
function keepOpen(root) { if (!root || !DOPEN.size) return; dKeys(root).forEach(([d, k]) => { if (DOPEN.has(k) && !d.open) d.open = true; }); }
document.addEventListener('toggle', e => {
  const d = e.target; if (!d || d.tagName !== 'DETAILS') return;
  const root = d.closest('#view, #sheet, #mode'); if (!root) return; // already redrawn away
  const hit = dKeys(root).find(x => x[0] === d); if (!hit) return;
  if (d.open) DOPEN.add(hit[1]); else DOPEN.delete(hit[1]);
}, true);

/* ---------- a scrolling row of tabs keeps its place ----------
   Progress has more tabs than fit on a phone. Picking one redraws the screen, which put the row back at its start, so
   the tab you just picked (Body, Journal…) was out of sight. The row now stays where you scrolled it, and the picked
   tab is always brought into view. */
function tabsSave(root, key) { return { key, x: [...root.querySelectorAll('.scrollx')].map(e => e.scrollLeft) }; }
function tabsRestore(root, was, key) {
  [...root.querySelectorAll('.scrollx')].forEach((e, i) => {
    if (was && was.key === key && was.x[i] != null) e.scrollLeft = was.x[i];
    const on = e.querySelector('[aria-pressed="true"]'); if (!on) return;
    const r = on.getBoundingClientRect(), b = e.getBoundingClientRect();
    if (r.left < b.left) e.scrollLeft -= b.left - r.left + 12; else if (r.right > b.right) e.scrollLeft += r.right - b.right + 12;
  });
}

