import json
from datetime import datetime, timezone
src = open('test/run_roles.py').read().split('with sync_playwright() as pw:')[0].replace('PORT = 8791', 'PORT = 8821')
exec(src)
# NOW (from run_roles): Mon 28 Sep 2026, 07:30 IST, a pull day with 7 exercises
P_ = lambda uid, name, color: {'j': json.dumps({'name': name, 'color': color, 'plan': 'A', 'uid': uid, 'race': {'fmt': 'singles', 'div': 'M'}})}
seed = {'profiles': {'uadmin': P_('uadmin', 'Vinay', 'blue'), 'uuday': P_('uuday', 'Uday', 'orange')}}
D = '2026-09-28'
PLAN = ['Barbell deadlift', 'Pull-up', 'Lat pulldown', 'High cable V-bar row', 'Farmers hold', 'Barbell curl', 'Hammer curl']

def log(p, lid):
    p.wait_for_timeout(700); db = dbof(p); return json.loads(db['logs'][lid]['j']) if lid in (db.get('logs') or {}) else {}
def names(p): return [x.strip().rstrip(' ✓') for x in p.locator('section[data-fold=str] .ex .ex-h .n b').all_inner_texts()]
def ids_in_view(p): return p.evaluate("[...document.querySelectorAll('section[data-fold=str] .ex')].map(e => +e.id.slice(3))")
def up(p, i): return p.locator('#ex-%d [data-a=ex-mv][data-v="-1"]' % i)
def dn(p, i): return p.locator('#ex-%d [data-a=ex-mv][data-v="1"]' % i)
def overflow(p): return p.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1')
def scroll_to(loc):  # retry if a redraw (a save coming back) swaps the element out mid-scroll
    for _ in range(10):
        try: loc.scroll_into_view_if_needed(timeout=2000); return
        except Exception: loc.page.wait_for_timeout(150)
def ytop(loc):  # a save coming back redraws the screen; retry if we catch the element mid-redraw
    for _ in range(10):
        loc.wait_for(state='visible'); bb = loc.bounding_box()
        if bb: return bb['y']
    return None

with sync_playwright() as pw:
    b = pw.chromium.launch()
    a = open_as(b, 'admin@test.com', seed)
    check('Today is the pull day in plan order', names(a) == PLAN, names(a))
    check('every exercise has up and down arrows', a.locator('section[data-fold=str] .ex [data-a=ex-mv]').count() == 14)
    check('first exercise cannot move up, last cannot move down', up(a, 0).is_disabled() and dn(a, 6).is_disabled() and not dn(a, 0).is_disabled() and not up(a, 6).is_disabled())
    check('arrows have readable labels', up(a, 2).get_attribute('aria-label') == 'Move Lat pulldown up (Main strength)'.replace(' (Main strength)', ''), up(a, 2).get_attribute('aria-label'))
    check('no "own order" note before any move', a.locator('.exord').count() == 0)
    check('no horizontal scroll at 390 px', not overflow(a))
    a.screenshot(path=f'{OUT}/mv1-plan-order.png', full_page=True)

    # log a set on the deadlift, then move it down one place
    a.locator('#ex-0 [data-a=set][data-set="0"]').click(); a.wait_for_timeout(400)
    a.evaluate('stopRest()')
    scroll_to(a.locator('#ex-0')); a.evaluate('window.scrollBy(0, -200)'); a.wait_for_timeout(100)
    y0 = ytop(dn(a, 0))
    dn(a, 0).click()
    check('moved exercise flashes', a.locator('#ex-0.moved').count() == 1)
    a.wait_for_timeout(300)
    check('Deadlift moves below Pull-up', names(a)[:3] == ['Pull-up', 'Barbell deadlift', 'Lat pulldown'], names(a)[:3])
    y1 = ytop(dn(a, 0))
    check('the arrow stays under the finger', abs(y1 - y0) < 2, (y0, y1))
    check('focus stays on the moved exercise', a.evaluate("document.activeElement.closest('.ex') && document.activeElement.closest('.ex').id") == 'ex-0')
    l = log(a, 'uadmin_' + D)
    check('focus survives the redraw when the save comes back', a.evaluate("document.activeElement.closest('.ex') && document.activeElement.closest('.ex').id") == 'ex-0' and a.evaluate('document.activeElement.dataset.v') == '1')
    check('order saved in my log', l.get('ord') == [1, 0, 2, 3, 4, 5, 6], l.get('ord'))
    check('logged set stays with the deadlift', l['str']['0']['s'][0]['d'] is True and '1/3' in a.inner_text('#ex-0 .exn'), a.inner_text('#ex-0 .exn'))
    check('Pull-up now cannot move up', up(a, 1).is_disabled() and not up(a, 0).is_disabled())
    check('note + Back to plan order appear', 'In your own order' in a.inner_text('.exord') and a.locator('[data-a=ex-mv-reset]').count() == 1, a.inner_text('.exord') if a.locator('.exord').count() else '')

    # moving it back to where it was clears the custom order
    up(a, 0).click(); a.wait_for_timeout(300)
    check('moving back restores plan order', names(a) == PLAN)
    check('...and removes the saved order', 'ord' not in log(a, 'uadmin_' + D))
    check('...and the note goes away', a.locator('.exord').count() == 0)

    # tap the same arrow again and again: Hammer curl climbs to the top
    for k in range(6): up(a, 6).click(); a.wait_for_timeout(150)
    check('six taps take Hammer curl to the top', names(a)[0] == 'Hammer curl' and names(a)[1:] == PLAN[:6], names(a))
    check('at the top its up arrow is disabled and focus moves to down', up(a, 6).is_disabled() and a.evaluate("document.activeElement.dataset.v") == '1')
    check('saved as [6,0,1,2,3,4,5]', log(a, 'uadmin_' + D).get('ord') == [6, 0, 1, 2, 3, 4, 5])

    # folding: folded exercises keep their arrows and stay folded after moving
    a.click('section[data-fold=str] [data-a=exfold-all]'); a.wait_for_timeout(200)
    check('Hide all sets: arrows still visible', a.locator('section[data-fold=str] .ex.folded').count() == 7 and dn(a, 6).is_visible() and a.locator('section[data-fold=str] .set:visible').count() == 0)
    a.screenshot(path=f'{OUT}/mv2-folded-reorder.png', full_page=True)
    dn(a, 2).click(); a.wait_for_timeout(250)
    check('can reorder while folded', ids_in_view(a) == [6, 0, 1, 3, 2, 4, 5], ids_in_view(a))
    check('still folded after moving', a.locator('section[data-fold=str] .ex.folded').count() == 7)
    a.click('section[data-fold=str] [data-a=exfold-all]'); a.wait_for_timeout(200)

    # rest timer follows my order: last set of Hammer curl (now first) starts rest; last set of the last one does not
    a.locator('#ex-6 [data-a=set][data-set="0"]').click(); a.wait_for_timeout(150); a.evaluate('stopRest()')
    a.locator('#ex-6 [data-a=set][data-set="1"]').click(); a.wait_for_timeout(150)
    check('last set of Hammer curl (plan-last, now first) starts rest', not a.locator('#restbar').is_hidden())
    a.evaluate('stopRest()')
    for s in range(2): a.locator('#ex-5 [data-a=set][data-set="%d"]' % s).click(); a.wait_for_timeout(150)
    a.evaluate('stopRest()')
    a.locator('#ex-5 [data-a=set][data-set="2"]').click(); a.wait_for_timeout(150)
    check('last set of Barbell curl (now last in my order) does not', a.locator('#restbar').is_hidden())
    a.evaluate('stopRest()'); a.wait_for_timeout(1200)
    db = dbof(a)

    # Uday sees the plan order; his own moves don't touch mine
    u = open_as(b, 'uday@test.com', db)
    check('Uday still sees the plan order', names(u) == PLAN, names(u))
    dn(u, 0).click(); u.wait_for_timeout(200); dn(u, 0).click(); u.wait_for_timeout(1200)
    check('Uday can reorder his own day', ids_in_view(u) == [1, 2, 0, 3, 4, 5, 6], ids_in_view(u))
    db = dbof(u)
    check("Uday's order is in his log only", dec(db, 'logs', 'uuday_' + D).get('ord') == [1, 2, 0, 3, 4, 5, 6] and dec(db, 'logs', 'uadmin_' + D).get('ord') == [6, 0, 1, 3, 2, 4, 5])
    check('plan itself is untouched', 'plan_days' not in db or D not in db['plan_days'])
    check('no page errors for Uday', not u.errors, u.errors[:2])

    # reload: my order is still there
    a2 = open_as(b, 'admin@test.com', db)
    check('my order survives a reload', ids_in_view(a2) == [6, 0, 1, 3, 2, 4, 5], ids_in_view(a2))

    # admin "Editing Uday" moves Uday's exercises
    a2.click('#topbar [data-a=who]'); a2.wait_for_timeout(300)
    a2.click('#sheet [data-a=choose][data-v=uuday]'); a2.wait_for_timeout(400)
    check("admin sees Uday's order", ids_in_view(a2) == [1, 2, 0, 3, 4, 5, 6], ids_in_view(a2))
    check("note names Uday", 'Uday’s own order' in a2.inner_text('.exord'), a2.inner_text('.exord'))
    up(a2, 0).click(); a2.wait_for_timeout(1200)
    check("admin's move saved to Uday's log", dec(dbof(a2), 'logs', 'uuday_' + D).get('ord') == [1, 0, 2, 3, 4, 5, 6])
    a2.click('#topbar [data-a=choose]'); a2.wait_for_timeout(300)

    # admin edits the plan (removes Pull-up): everyone's order follows by name, logged sets stay put
    a2.click('[data-a=edit-plan][data-d="%s"]:not([data-f])' % D); a2.wait_for_timeout(400)
    a2.click('#sheet [data-a=ed-del][data-g=ex][data-i="1"]'); a2.wait_for_timeout(200)
    a2.click('#sheet [data-a=editor-save]'); a2.wait_for_timeout(1200)
    db = dbof(a2)
    check('plan now has 6 exercises', a2.locator('section[data-fold=str] .ex').count() == 6)
    check('my order kept by name after the plan edit', names(a2) == ['Hammer curl', 'Barbell deadlift', 'High cable V-bar row', 'Lat pulldown', 'Farmers hold', 'Barbell curl'], names(a2))
    check('my saved order remapped', dec(db, 'logs', 'uadmin_' + D).get('ord') == [5, 0, 2, 1, 3, 4], dec(db, 'logs', 'uadmin_' + D).get('ord'))
    ms = dec(db, 'logs', 'uadmin_' + D)['str']
    check('logged sets still on the right exercises', ms['0']['n'] == 'Barbell deadlift' and ms['5']['n'] == 'Hammer curl' and sum(1 for x in ms['5']['s'] if x and x['d']) == 2, {k: v.get('n') for k, v in ms.items()})
    check("Uday's order remapped too", dec(db, 'logs', 'uuday_' + D).get('ord') in (None, [0, 1, 2, 3, 4, 5]), dec(db, 'logs', 'uuday_' + D).get('ord'))

    # Back to plan order
    a2.click('[data-a=ex-mv-reset]'); a2.wait_for_timeout(1200)
    check('Back to plan order resets the list', names(a2) == ['Barbell deadlift', 'Lat pulldown', 'High cable V-bar row', 'Farmers hold', 'Barbell curl', 'Hammer curl'], names(a2))
    check('...and clears the saved order', 'ord' not in log(a2, 'uadmin_' + D))

    # a stale order (plan shrank on another device) is ignored safely
    a2.evaluate("S.logs['uadmin_%s'] = Object.assign(clone(S.logs['uadmin_%s']), { ord: [9, 3, 3, 'x', 1] }); render();" % (D, D)); a2.wait_for_timeout(200)
    check('broken saved order is cleaned up on screen', ids_in_view(a2) == [3, 1, 0, 2, 4, 5], ids_in_view(a2))

    # phone sizes and dark mode
    for w in (360, 320):
        a2.set_viewport_size({'width': w, 'height': 800}); a2.wait_for_timeout(200)
        bb = a2.locator('#ex-3 .exmv').bounding_box(); card = a2.locator('section[data-fold=str]').bounding_box()
        check('%d px: no horizontal scroll, arrows inside the card' % w, not overflow(a2) and bb['x'] + bb['width'] <= card['x'] + card['width'] - 8, (bb, card))
    a2.set_viewport_size({'width': 390, 'height': 844})
    a2.locator('section[data-fold=str]').scroll_into_view_if_needed()
    a2.locator('section[data-fold=str]').screenshot(path=f'{OUT}/mv3-custom-order-light.png')
    a2.emulate_media(color_scheme='dark'); a2.wait_for_timeout(200)
    a2.locator('section[data-fold=str]').screenshot(path=f'{OUT}/mv4-custom-order-dark.png')
    check('no page errors for admin', not (a.errors + a2.errors), (a.errors + a2.errors)[:2])

print('%d/%d passed' % (sum(1 for _, ok in res if ok), len(res)))
