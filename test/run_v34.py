import json
from datetime import datetime, timezone
# v34: "Are you sure?" when a value looks like a typing slip (a test time, a run's pace, a rep time, a set's weight or
# reps): "Change it" empties the field, "Yes, keep it" keeps it and doesn't ask again. A time trial logged in the
# Running card on its test day fills in the test result, so the run log and the test can't disagree.
src = open('test/run_roles.py').read().split('with sync_playwright() as pw:')[0].replace('PORT = 8791', 'PORT = 8847')
exec(src)
P_ = lambda uid, name, color: {'j': json.dumps({'name': name, 'color': color, 'plan': 'A', 'uid': uid, 'race': {'fmt': 'singles', 'div': 'M'}})}
SEED = {'profiles': {'uuday': P_('uuday', 'Uday', 'orange')}}
def lg(p, d, pid='uuday'): return p.evaluate("JSON.parse(JSON.stringify(S.logs['%s_%s'] || {}))" % (pid, d))
def bench(p, i, pid='uuday'): return p.evaluate("(benchVal('%s', '%s') || {}).v" % (pid, i))
def day(p, d): p.evaluate("go({view:'day', date:'%s'})" % d); p.wait_for_timeout(400)
def typ(p, sel, v): p.fill(sel, v); p.dispatch_event(sel, 'input'); p.dispatch_event(sel, 'change'); p.wait_for_timeout(350)
def box(p): return p.inner_text('#sure') if p.locator('#sure .sure-box').count() and p.is_visible('#sure') else ''
def z400(p): return p.evaluate("zonesFor('uuday').find(z => z.key === 'p400').txt")
with sync_playwright() as pw:
    b = pw.chromium.launch()
    NOW = datetime(2026, 9, 29, 2, 0, tzinfo=timezone.utc)  # Tue 29 Sep: the 1 km time trial and wall-ball test
    u = open_as(b, 'uday@test.com', SEED); u.wait_for_timeout(500)
    # ---- a test result
    typ(u, '#b-tt1k', '1')
    t = box(u)
    check('1 km time trial typed as “1”: “Are you sure?” says how it was read (1:00) and why it looks off', 'ARE YOU SURE?' in t.upper() and '1 km time trial: 1:00' in t and 'much faster than the target' in t and 'minutes:seconds' in t and 'Change it' in t and 'Yes, keep it' in t, t)
    u.screenshot(path=f'{OUT}/v34-sure.png')
    u.click('#sure [data-a=sure-no]'); u.wait_for_timeout(500)
    check('Change it: the box closes, the field is empty and so is the saved result', box(u) == '' and u.input_value('#b-tt1k') == '' and not bench(u, 'tt1k'), bench(u, 'tt1k'))
    typ(u, '#b-tt1k', '10:00')
    check('10:00 is fine: no question; the 400 m target follows it (10:10–10:20/km)', box(u) == '' and bench(u, 'tt1k') == '10:00' and z400(u) == '10:10–10:20/km', z400(u))
    typ(u, '#b-tt1k', '1')
    u.click('#sure [data-a=sure-yes]'); u.wait_for_timeout(400)
    check('Yes, keep it: it stays as typed', box(u) == '' and bench(u, 'tt1k') == '1')
    typ(u, '#b-tt1k', '1')
    check('...and the same value isn’t asked about again', box(u) == '')
    typ(u, '#b-tt1k', '')
    typ(u, '#b-wbmax', '500')
    check('wall balls “500 reps”: asked too', 'Wall balls, max unbroken: 500 reps' in box(u), box(u))
    u.click('#sure [data-a=sure-no]'); u.wait_for_timeout(500)
    typ(u, '#b-wbmax', '22')
    check('22 reps: no question', box(u) == '' and bench(u, 'wbmax') == '22')
    # ---- the time trial logged in the Running card fills in the test
    typ(u, '#rd-0', '1'); typ(u, '#rtm-0', '10:00'); u.wait_for_timeout(400)
    check('Running card: 1 km in 10:00 on the test day → the 1 km time trial result is 10:00 too', box(u) == '' and bench(u, 'tt1k') == '10:00' and u.input_value('#b-tt1k') == '10:00' and lg(u, '2026-09-29')['runs'][0]['time'] == 600, (bench(u, 'tt1k'), lg(u, '2026-09-29').get('runs')))
    check('...so the targets come from it: 400 m pace 10:10–10:20/km', z400(u) == '10:10–10:20/km', z400(u))
    typ(u, '#rtm-0', '1'); u.wait_for_timeout(300)
    t = box(u)
    check('time typed as “1”: “1.00 km in 1:00 = 1:00 per km” looks too fast', '1.00 km in 1:00 = 1:00 per km' in t and 'too fast' in t, t)
    u.click('#sure [data-a=sure-no]'); u.wait_for_timeout(500)
    check('Change it: the run’s time and the test result it filled in are both emptied', not lg(u, '2026-09-29')['runs'][0].get('time') and not bench(u, 'tt1k') and u.input_value('#rtm-0') == '', (lg(u, '2026-09-29').get('runs'), bench(u, 'tt1k')))
    typ(u, '#rtm-0', '10:00'); u.wait_for_timeout(300)
    check('typed again properly: back to 10:00 everywhere', bench(u, 'tt1k') == '10:00' and box(u) == '')
    # ---- rep times
    day(u, '2026-09-28')  # (a past day is fine for typing)
    # ---- a set's weight and reps
    typ(u, '#w-0-0', '550')
    t = box(u)
    check('deadlift set 1 at 550 kg: asked, against the plan’s 55 kg', 'Barbell deadlift, set 1: 550 kg' in t and 'far more than the plan’s 55 kg' in t, t)
    u.click('#sure [data-a=sure-no]'); u.wait_for_timeout(600)
    s0 = (((lg(u, '2026-09-28').get('str') or {}).get('0') or {}).get('s') or [{}])[0] or {}
    check('Change it: the weight is not kept', s0.get('w') in (None, '') and u.input_value('#w-0-0') in ('', '55'), (s0, u.input_value('#w-0-0')))
    typ(u, '#w-0-0', '60')
    check('60 kg: no question', box(u) == '' and lg(u, '2026-09-28')['str']['0']['s'][0]['w'] == 60)
    typ(u, '#r-0-0', '100')
    check('100 reps where the plan has 10: asked', 'set 1: 100 reps' in box(u) and 'The plan has 10 reps' in box(u), box(u))
    u.click('#sure [data-a=sure-yes]'); u.wait_for_timeout(500)
    check('Yes, keep it: 100 reps stay', lg(u, '2026-09-28')['str']['0']['s'][0]['r'] == 100 and box(u) == '')
    typ(u, '#r-0-1', '12')
    check('12 reps: no question', box(u) == '')
    day(u, '2026-10-06')  # Tue week 2: 6 × 400 m
    n = u.locator('[data-in=rep]').count()
    typ(u, '[data-in=rep] >> nth=0', '0:10')
    check('a 400 m rep typed as 0:10: asked (0:25 per km)', n == 6 and '400 m in 0:10 = 0:25 per km' in box(u), (n, box(u)))
    u.click('#sure [data-a=sure-no]'); u.wait_for_timeout(500)
    typ(u, '[data-in=rep] >> nth=0', '2:40')
    check('2:40 for 400 m: no question', box(u) == '')
    check('no page errors', not u.errors, u.errors[:2])
    # ---- Gym mode: asked when you tap Done
    NOW = datetime(2026, 9, 28, 2, 0, tzinfo=timezone.utc)
    g = open_as(b, 'uday@test.com', SEED); g.wait_for_timeout(500)
    g.evaluate("openMode('gym', 'set')"); g.wait_for_timeout(500)
    g.fill('#md-w', '550'); g.click('#mode [data-a=md-done]'); g.wait_for_timeout(400)
    check('Gym mode, Done with 550 kg: asked before the set is saved', 'Barbell deadlift, set 1: 550 kg' in box(g) and not lg(g, '2026-09-28').get('str'), box(g))
    g.click('#sure [data-a=sure-no]'); g.wait_for_timeout(400)
    check('Change it: nothing saved, the weight box is empty', not lg(g, '2026-09-28').get('str') and g.input_value('#md-w') == '')
    g.fill('#md-w', '60'); g.click('#mode [data-a=md-done]'); g.wait_for_timeout(600)
    s0 = lg(g, '2026-09-28')['str']['0']['s'][0]
    check('60 kg: saved straight away', s0.get('w') == 60 and s0.get('d') is True and box(g) == '', s0)
    check('no page errors (gym mode)', not g.errors, g.errors[:2])
    b.close()
bad = [n for n, ok in res if not ok]
print('\n%d checks, %d failed' % (len(res), len(bad)))
