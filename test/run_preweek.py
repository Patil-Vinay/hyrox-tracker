import json
from datetime import datetime, timezone
src = open('test/run_roles.py').read().split('with sync_playwright() as pw:')[0].replace('PORT = 8791', 'PORT = 8795')
exec(src)

def at(b, email, seed, when):
    global NOW
    NOW = when
    return open_as(b, email, seed)

prof = lambda uid, name, race: {'j': json.dumps({'name': name, 'color': 'blue', 'plan': 'A', 'uid': uid, 'race': race, 'created': '2026-09-25T1'})}
seed = {'profiles': {'uadmin': prof('uadmin', 'Vinay', {'fmt': 'singles', 'div': 'M'}), 'uuday': prof('uuday', 'Uday', {'fmt': 'singles', 'div': 'M'})}}

with sync_playwright() as pw:
    b = pw.chromium.launch()
    # Saturday 26 Sep, 09:45 IST
    p = at(b, 'admin@test.com', seed, datetime(2026, 9, 26, 4, 15, tzinfo=timezone.utc))
    v = p.inner_text('#view')
    check('Saturday is Day 1 of 112 (kick-off run)', 'KICK-OFF RUN' in v.upper() and 'Day 1 of 112 · Kick-off weekend' in v, v[:200].replace('\n', ' | '))
    top = p.inner_text('.plates')
    check('top shows only the race countdown', top.split() == ['111', 'DAYS', 'TO', 'RACE'] or 'DAYS TO RACE' in ' '.join(top.upper().split()) and '112' not in top, top.replace('\n', ' '))
    check('labelled as an easy run', 'EASY RUN · KICK-OFF' in v.upper())
    p.fill('#rd-0', '5.2'); p.fill('#rtm-0', '38:30'); p.locator('#rtm-0').blur(); p.wait_for_timeout(1500)
    log = dec(dbof(p), 'logs', 'uadmin_2026-09-26') if 'uadmin_2026-09-26' in ids(dbof(p), 'logs') else {}
    runs = log.get('runs') or [{}]
    check('run saved for Saturday', runs[0].get('dist') == 5.2 and runs[0].get('time') == 2310, runs)
    p.screenshot(path=f'{OUT}/p1-saturday.png', full_page=True)
    db = dbof(p)
    for v2 in ['calendar', 'progress', 'together', 'settings']:
        p.evaluate(f"go({{view:'{v2}'}})"); p.wait_for_timeout(400)
        check(f'{v2} renders with pre-week days', 'Something went wrong' not in p.inner_text('#view'))
    p.evaluate("go({view:'progress', sub:'running'})"); p.wait_for_timeout(400)
    check('run counts in running progress', '5.2' in p.inner_text('#view'))
    p.evaluate("LS.set('hx.calmode','list'); go({view:'calendar'})"); p.wait_for_timeout(400)
    check('calendar list view renders', 'Something went wrong' not in p.inner_text('#view'))
    p.evaluate("LS.set('hx.calmode','month'); go({view:'calendar'})"); p.wait_for_timeout(300)
    p.screenshot(path=f'{OUT}/p2-calendar.png')
    check('no script errors (Saturday)', not p.errors, p.errors[:2])

    # Sunday 27 Sep: rest
    s = at(b, 'admin@test.com', db, datetime(2026, 9, 27, 4, 0, tzinfo=timezone.utc))
    check('Sunday is Day 2, a rest day', 'Rest' in s.inner_text('#view') and 'KICK-OFF WEEKEND' in s.inner_text('#view').upper() and 'Day 2 of 112' in s.inner_text('#view'))

    # Monday 28 Sep: still Day 1 of 110; Uday isn't penalised for skipping the optional run
    m = at(b, 'uday@test.com', db, datetime(2026, 9, 28, 4, 0, tzinfo=timezone.utc))
    sub_ = m.inner_text('.dayhead')
    check('Monday is Day 3 of 112, Week 1', 'Day 3 of 112 · Week 1' in sub_, sub_.replace('\n', ' '))
    check("Saturday counts as a normal day (Uday didn't log it)", m.evaluate("completion('uuday').planned") == 1 and m.evaluate("dayState('uuday','2026-09-26')") == 'missed')
    check("Vinay's pre-week run counts as done", m.evaluate("completion('uadmin').done") == 1 and m.evaluate("streaks('uadmin').cur") >= 2)
    check('no script errors (Monday)', not (s.errors + m.errors), (s.errors + m.errors)[:2])
    b.close()
srv.shutdown()
print('\n%d/%d passed' % (sum(r[1] for r in res), len(res)))
