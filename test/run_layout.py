import json
from datetime import datetime, timezone
src = open('test/run_roles.py').read().split('with sync_playwright() as pw:')[0].replace('PORT = 8791', 'PORT = 8817')
exec(src)
NOW = datetime(2026, 9, 27, 10, 10, tzinfo=timezone.utc)  # Sun 27 Sep, 15:40 IST
P_ = lambda uid, name, color: {'j': json.dumps({'name': name, 'color': color, 'plan': 'A', 'uid': uid, 'race': {'fmt': 'singles', 'div': 'M'}})}
L = lambda d: {'j': json.dumps(d)}
seed = {'profiles': {'uadmin': P_('uadmin', 'Vinay', 'orange'), 'uuday': P_('uuday', 'Uday', 'blue')},
        'logs': {'uadmin_2026-09-26': L({'pid': 'uadmin', 'date': '2026-09-26', 'status': 'complete', 'rpe': 3, 'time': 80, 'runs': [{'type': 'easy', 'dist': 6.25, 'time': 3537, 'rpe': 3}]}),
                 'uadmin_2026-09-27': L({'pid': 'uadmin', 'date': '2026-09-27', 'rest': {'acts': ['walk', 'foam'], 'min': 30}})}}

def box(p, sel, i=0): return p.locator(sel).nth(i).bounding_box()
def same_row(a, b): return abs(a['y'] - b['y']) < 2 and abs(a['height'] - b['height']) < 2
def overflow(p): return p.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1')
def tbl_scrolls(p, sel): return p.evaluate("(s) => { const w = document.querySelector(s); return w.scrollWidth > w.clientWidth + 1; }", sel)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    a = open_as(b, 'admin@test.com', seed, vp=(1920, 1000))
    # ---- Progress → Week (kick-off weekend, 2 rows)
    a.evaluate("go({view:'progress', sub:'week'})"); a.wait_for_timeout(400)
    g = '#view .grid2.wk2 > section'
    c1, c2 = box(a, g, 0), box(a, g, 1)
    check('laptop: Day by day and Running by week side by side, same height', c1['x'] < c2['x'] and same_row(c1, c2), (c1, c2))
    check('day-by-day table fits without sideways scrolling', not tbl_scrolls(a, g + ':first-child .tbl-wrap'))
    v = a.inner_text('#view')
    check('week totals row', 'Week total' in v)
    check('season summary under the chart', 'SEASON SO FAR' in v.upper() and '6.3' in v and 'LONGEST' in v.upper())
    check('short status labels', 'Done' in a.inner_text(g + ':first-child') and 'Recovered' in a.inner_text(g + ':first-child'))
    a.screenshot(path=f'{OUT}/l1-week-kickoff.png')
    a.click('[data-a=wk][aria-label="Next week"]'); a.wait_for_timeout(300)
    c1, c2 = box(a, g, 0), box(a, g, 1)
    check('Week 1 (7 days): still the same height', same_row(c1, c2) and not tbl_scrolls(a, g + ':first-child .tbl-wrap'), (c1, c2))
    a.screenshot(path=f'{OUT}/l2-week1.png')
    # ---- Progress → Running
    a.evaluate("go({view:'progress', sub:'running'})"); a.wait_for_timeout(400)
    cs = [box(a, '#view .cgrid.eq > section', i) for i in range(4)]
    check('running charts: cards in each row are the same height', same_row(cs[0], cs[1]) and same_row(cs[2], cs[3]), [(round(c['y']), round(c['height'])) for c in cs])
    k = a.inner_text('#view .cgrid.eq > section >> nth=3')
    check('1 km card shows race pace, the time trial and the first 1 km session', 'RACE PACE' in k.upper() and '1 KM TIME TRIAL' in k.upper() and 'Tue 3 Nov' in k and '3 × 1 km at threshold' in k, k.replace('\n', ' | '))
    a.screenshot(path=f'{OUT}/l3-running.png')
    # ---- Rest day
    a.evaluate("go({view:'today'})"); a.wait_for_timeout(400)
    left, right = box(a, '.restgrid > section'), box(a, '.restgrid > .rcol')
    check('rest day: both columns end at the same line', abs((left['y'] + left['height']) - (right['y'] + right['height'])) < 2 and abs(left['y'] - right['y']) < 2, (left, right))
    check('Tomorrow sits under the Journal', 'TOMORROW' in a.inner_text('.restgrid .rcol').upper() and 'JOURNAL' in a.inner_text('.restgrid .rcol').upper())
    check('Morning check below, full width', a.locator('.restgrid + section').count() == 1 and 'MORNING CHECK' in a.inner_text('.restgrid + section').upper())
    a.screenshot(path=f'{OUT}/l4-rest-laptop.png')
    # ---- Tests
    a.evaluate("go({view:'progress', sub:'tests'})"); a.wait_for_timeout(400)
    days = a.locator('#view section[data-fold^="tst:"]')
    n = days.count()
    check('every test day has an arrow', n >= 4 and a.locator('#view section[data-fold^="tst:"] .foldh').count() == n, n)
    check('each day shows how many are done', '0/2 done' in a.inner_text('#view section[data-fold^="tst:"] >> nth=0'), a.inner_text('#view section[data-fold^="tst:"] >> nth=0')[:80])
    a.click('#view section[data-fold^="tst:"] >> nth=0 >> .foldh h3'); a.wait_for_timeout(200)
    first = days.nth(0)
    check('tap a test day to hide it', 'folded' in (first.get_attribute('class') or '') and not first.locator('.entry').first.is_visible())
    a.click('#view [data-a=fold-all]'); a.wait_for_timeout(200)
    check('Hide all folds every test day', a.locator('#view section[data-fold^="tst:"].folded').count() == n and a.inner_text('#view [data-a=fold-all]') == 'Show all')
    a.evaluate('render()'); a.wait_for_timeout(200)
    check('stays folded after a re-render', a.locator('#view section[data-fold^="tst:"].folded').count() == n and a.inner_text('#view [data-a=fold-all]') == 'Show all')
    a.screenshot(path=f'{OUT}/l5-tests-folded.png')
    a.click('#view [data-a=fold-all]'); a.wait_for_timeout(200)
    check('Show all opens them', a.locator('#view section[data-fold^="tst:"].folded').count() == 0 and a.inner_text('#view [data-a=fold-all]') == 'Hide all')
    a.click('#view section[data-fold^="tst:"] >> nth=1 >> .foldh h3'); a.wait_for_timeout(200)
    check('label stays right after folding one', a.inner_text('#view [data-a=fold-all]') == 'Hide all')
    check('no script errors (laptop)', not a.errors, a.errors[:3])
    db = dbof(a)

    # ---- 1366 laptop
    m = open_as(b, 'admin@test.com', db, vp=(1366, 768))
    m.evaluate("go({view:'progress', sub:'week', wk:1})"); m.wait_for_timeout(400)
    c1, c2 = box(m, g, 0), box(m, g, 1)
    check('1366 laptop: side by side, same height, table fits', same_row(c1, c2) and c1['x'] < c2['x'] and not tbl_scrolls(m, g + ':first-child .tbl-wrap'), (c1, c2))
    m.screenshot(path=f'{OUT}/l6-week-1366.png')
    m.evaluate("go({view:'today'})"); m.wait_for_timeout(300)
    left, right = box(m, '.restgrid > section'), box(m, '.restgrid > .rcol')
    check('1366 rest day columns line up', abs((left['y'] + left['height']) - (right['y'] + right['height'])) < 2)

    # ---- iPad portrait
    ip = open_as(b, 'admin@test.com', db, vp=(820, 1180))
    ip.evaluate("go({view:'progress', sub:'week', wk:1})"); ip.wait_for_timeout(400)
    c1, c2 = box(ip, g, 0), box(ip, g, 1)
    check('iPad: week table full width above the chart', c2['y'] > c1['y'] + c1['height'] - 2 and not tbl_scrolls(ip, g + ':first-child .tbl-wrap'), (c1, c2))
    check('iPad: no sideways scrolling', not overflow(ip))
    ip.evaluate("go({view:'today'})"); ip.wait_for_timeout(300)
    left, right = box(ip, '.restgrid > section'), box(ip, '.restgrid > .rcol')
    check('iPad rest day: columns line up', abs((left['y'] + left['height']) - (right['y'] + right['height'])) < 2 and left['x'] < right['x'], (left, right))
    ip.screenshot(path=f'{OUT}/l7-rest-ipad.png')
    ip.evaluate("go({view:'progress', sub:'running'})"); ip.wait_for_timeout(300)
    cs = [box(ip, '#view .cgrid.eq > section', i) for i in range(4)]
    check('iPad running: rows even', same_row(cs[0], cs[1]) and same_row(cs[2], cs[3]))
    check('no script errors (iPad/1366)', not (ip.errors + m.errors), (ip.errors + m.errors)[:3])

    # ---- phone
    ph = open_as(b, 'admin@test.com', db)
    bad = []
    for route in ["go({view:'progress', sub:'week'})", "go({view:'progress', sub:'week', wk:1})", "go({view:'progress', sub:'running'})", "go({view:'progress', sub:'tests'})", "go({view:'today'})"]:
        ph.evaluate(route); ph.wait_for_timeout(300)
        if overflow(ph): bad.append(route)
    check('phone: no sideways scrolling anywhere', not bad, bad)
    ph.evaluate("go({view:'today'})"); ph.wait_for_timeout(300)
    check('phone rest day: What did you do, then Journal, then Tomorrow', box(ph, '.restgrid > section')['y'] < box(ph, '.restgrid .rcol > section', 0)['y'] < box(ph, '.restgrid .rcol > section', 1)['y'])
    ph.screenshot(path=f'{OUT}/l8-rest-phone.png', full_page=True)
    check('no script errors (phone)', not ph.errors, ph.errors[:3])
    b.close()
srv.shutdown()
print('\n%d/%d passed' % (sum(r[1] for r in res), len(res)))
