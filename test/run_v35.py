import json
from datetime import datetime, timezone
# v35: 6 x 400 m keeps its 6 rep boxes after the first is filled in and the page redraws; what was typed stays.
src = open('test/run_roles.py').read().split('with sync_playwright() as pw:')[0].replace('PORT = 8791', 'PORT = 8849')
exec(src)
P_ = lambda uid, name, color: {'j': json.dumps({'name': name, 'color': color, 'plan': 'A', 'uid': uid, 'race': {'fmt': 'singles', 'div': 'M'}})}
L = lambda d: {'j': json.dumps(d)}
NOW = datetime(2026, 10, 6, 5, 0, tzinfo=timezone.utc)  # Tue 6 Oct: 6 x 400 m
D = '2026-10-06'
def typ(p, sel, v): p.fill(sel, v); p.dispatch_event(sel, 'input'); p.dispatch_event(sel, 'change'); p.wait_for_timeout(350)
def reps(p): return p.evaluate("(((getLog('%s') || {}).runs || [])[0] || {}).reps || []" % D)
def boxes(p): return p.locator('[data-in=rep]').count()
with sync_playwright() as pw:
    b = pw.chromium.launch()
    v = open_as(b, 'vinay@test.com', {'profiles': {'uvinay': P_('uvinay', 'Vinay', 'blue')}}); v.wait_for_timeout(500)
    check('6 x 400 m: six rep boxes to start with', boxes(v) == 6)
    typ(v, '#rep-0-0', '2:54'); v.evaluate('render()'); v.wait_for_timeout(300)
    check('the first one filled in, then a redraw: still six boxes, the time is there', boxes(v) == 6 and v.input_value('#rep-0-0') == '2:54' and reps(v) == ['2:54'], (boxes(v), reps(v)))
    typ(v, '#rep-0-0', '120')
    check('a slip (120, read as 120 minutes): Are you sure?', v.locator('#sure .sure-box').count() == 1 and '400 m in 2:00:00' in v.inner_text('#sure'), v.inner_text('#sure') if v.locator('#sure .sure-box').count() else '')
    v.click('#sure [data-a=sure-no]'); v.wait_for_timeout(500); v.evaluate('render()'); v.wait_for_timeout(300)
    check('Change it, then a redraw: six boxes, the first one empty', boxes(v) == 6 and v.input_value('#rep-0-0') == '', (boxes(v), reps(v)))
    typ(v, '#rep-0-2', '2:56'); v.click('[data-a=run-rpe][data-v="7"]'); v.wait_for_timeout(500)
    check('the third one filled in and an RPE picked (a redraw): six boxes, 2:56 in the third', boxes(v) == 6 and v.input_value('#rep-0-2') == '2:56' and reps(v) == ['', '', '2:56'], (boxes(v), reps(v)))
    w = open_as(b, 'vinay@test.com', {'profiles': {'uvinay': P_('uvinay', 'Vinay', 'blue')}, 'logs': {'uvinay_' + D: L({'pid': 'uvinay', 'date': D, 'runs': [{'type': 'intervals', 'reps': ['2 mins'], 'repDist': 0.4}]})}}); w.wait_for_timeout(500)
    check('a log saved earlier with one rep time opens with six boxes and that time in the first', boxes(w) == 6 and w.input_value('#rep-0-0') == '2 mins', boxes(w))
    check('no page errors', not v.errors and not w.errors, (v.errors[:1], w.errors[:1]))
    b.close()
bad = [n for n, ok in res if not ok]
print('\n%d checks, %d failed' % (len(res), len(bad)))
