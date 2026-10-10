import json
from datetime import datetime, timezone
# v33: the row of tabs on Progress keeps its place: picking a tab at the far end (Body, Journal) no longer puts the
# row back at its start, and the picked tab is always in view.
src = open('test/run_roles.py').read().split('with sync_playwright() as pw:')[0].replace('PORT = 8791', 'PORT = 8845')
exec(src)
P_ = lambda uid, name, color: {'j': json.dumps({'name': name, 'color': color, 'plan': 'A', 'uid': uid, 'race': {'fmt': 'singles', 'div': 'M'}})}
SEED = {'profiles': {'uvinay': P_('uvinay', 'Vinay', 'blue')}}
VIS = "(() => { const e = document.querySelector('#view .scrollx'), on = e.querySelector('[aria-pressed=true]'), r = on.getBoundingClientRect(), b = e.getBoundingClientRect(); return { x: Math.round(e.scrollLeft), tab: on.dataset.s, in: r.left >= b.left - 1 && r.right <= b.right + 1, wide: e.scrollWidth > e.clientWidth }; })()"
with sync_playwright() as pw:
    b = pw.chromium.launch()
    v = open_as(b, 'vinay@test.com', SEED); v.wait_for_timeout(500)
    v.evaluate("go({view:'progress'})"); v.wait_for_timeout(400)
    s = v.evaluate(VIS)
    check('Progress on a phone: more tabs than fit, the row starts at Week', s['wide'] and s['x'] == 0 and s['tab'] == 'week', s)
    v.click('#view .subnav [data-s=body]'); v.wait_for_timeout(400)
    s = v.evaluate(VIS)
    check('picking Body: the row stays scrolled, Body is in view and selected', s['tab'] == 'body' and s['x'] > 100 and s['in'], s)
    x = s['x']
    v.click('#view .subnav [data-s=journal]'); v.wait_for_timeout(400)
    s = v.evaluate(VIS)
    check('picking Journal next to it: still there, no jump back to the start', s['tab'] == 'journal' and s['x'] > 100 and s['in'], (x, s))
    v.evaluate("render()"); v.wait_for_timeout(300)
    s2 = v.evaluate(VIS)
    check('a redraw (a save coming back) leaves the row where it is', s2['x'] == s['x'] and s2['in'], (s, s2))
    v.evaluate("go({view:'today'}); go({view:'progress', sub:'body'})"); v.wait_for_timeout(400)
    s = v.evaluate(VIS)
    check('coming back to Progress on Body: the row opens with Body in view', s['tab'] == 'body' and s['in'] and s['x'] > 0, s)
    v.click('#view .subnav [data-s=week]'); v.wait_for_timeout(400)
    s = v.evaluate(VIS)
    check('back to Week: in view again', s['tab'] == 'week' and s['in'], s)
    check('no page errors', not v.errors, v.errors[:2])
    b.close()
bad = [n for n, ok in res if not ok]
print('\n%d checks, %d failed' % (len(res), len(bad)))
