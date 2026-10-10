import json
from datetime import datetime, timezone
# v36: a session can move to a day up to 3 days away across the week's edge: Sat 10 Oct (rest) and Sun 11 Oct (long
# run) swap, then Mon 12 Oct (Back + Biceps, next week) goes to Sunday and Monday becomes the rest day.
src = open('test/run_roles.py').read().split('with sync_playwright() as pw:')[0].replace('PORT = 8791', 'PORT = 8851')
exec(src)
P_ = lambda uid, name, color: {'j': json.dumps({'name': name, 'color': color, 'plan': 'A', 'uid': uid, 'race': {'fmt': 'singles', 'div': 'M'}})}
NOW = datetime(2026, 10, 10, 2, 30, tzinfo=timezone.utc)  # Sat 10 Oct, 08:00 IST
def dayof(p, d): return p.evaluate("(() => { const x = S.days['%s']; return [x.kind, x.heading, x.dow, x.week, x.moved || '']; })()" % d)
def day(p, d): p.evaluate("go({view:'day', date:'%s'})" % d); p.wait_for_timeout(400)
def opts(p): return p.eval_on_selector_all('#sheet [data-a=gym-move-to]', 'bs => bs.map(b => b.dataset.v)')
with sync_playwright() as pw:
    b = pw.chromium.launch()
    v = open_as(b, 'vinay@test.com', {'profiles': {'uvinay': P_('uvinay', 'Vinay', 'blue')}}); v.wait_for_timeout(500)
    day(v, '2026-10-12')
    v.click('.hero [data-a=gym-move]'); v.wait_for_timeout(300)
    o = opts(v)
    check('Mon 12 Oct (Back + Biceps, week 3): Sat 10 and Sun 11 (week 2) are offered too, as well as its own week', '2026-10-10' in o and '2026-10-11' in o and '2026-10-14' in o and 'up to 3 days either side' in v.inner_text('#sheet'), o)
    v.evaluate("closeSheet()"); v.wait_for_timeout(200)
    check('...but not further than 3 days outside its week (Wed 7 Oct is in the past anyway; Thu 8 Oct too)', all(x >= '2026-10-10' for x in o), o)
    # step 1: the run today, rest tomorrow
    v.evaluate("go({view:'today'})"); v.wait_for_timeout(400)
    check('today (Sat, rest): “Train today instead”', v.locator('.restday [data-a=gym-move]').count() == 1)
    v.click('.restday [data-a=gym-move]'); v.wait_for_timeout(300)
    v.click('#sheet [data-a=gym-move-to][data-v="2026-10-11"]'); v.wait_for_timeout(700)
    check('Sat ↔ Sun: the long run is today, Sunday is rest', dayof(v, '2026-10-10')[:2] == ['long', 'Long Run'] and dayof(v, '2026-10-11')[0] == 'rest', (dayof(v, '2026-10-10'), dayof(v, '2026-10-11')))
    # step 2: Monday's Back + Biceps to Sunday
    day(v, '2026-10-12')
    v.click('.hero [data-a=gym-move]'); v.wait_for_timeout(300)
    v.click('#sheet [data-a=gym-move-to][data-v="2026-10-11"]'); v.wait_for_timeout(700)
    s, m = dayof(v, '2026-10-11'), dayof(v, '2026-10-12')
    check('Mon ↔ Sun: Back + Biceps on Sunday (keeps Sunday’s date and week 2), Monday is the rest day', s[:3] == ['pull', 'Back + Biceps + Easy Run', 'Sun'] and s[3] == 2 and s[4] == '2026-10-12' and m[0] == 'rest' and m[2] == 'Mon' and m[3] == 3, (s, m))
    check('...what Vinay wanted: Sat run, Sun Back + Biceps, Mon rest', [dayof(v, d)[0] for d in ['2026-10-10', '2026-10-11', '2026-10-12']] == ['long', 'pull', 'rest'])
    day(v, '2026-10-11')
    check('Sunday says where it came from', 'Moved here from Monday 12 October' in v.inner_text('.hero'), v.inner_text('.hero')[:200])
    check('no page errors', not v.errors, v.errors[:2])
    b.close()
bad = [n for n, ok in res if not ok]
print('\n%d checks, %d failed' % (len(res), len(bad)))
