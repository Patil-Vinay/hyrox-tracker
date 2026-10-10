import json
from datetime import datetime, timezone
# v27/v28: training together, gym-style, no invites: picking people puts them straight in the group. Each person is a
# separate phone (browser context); the fake Firebase enforces the same rules as firestore.rules (togetherAllows).
src = open('test/run_roles.py').read().split('with sync_playwright() as pw:')[0].replace('PORT = 8791', 'PORT = 8835')
exec(src)
NOW = datetime(2026, 9, 28, 2, 0, tzinfo=timezone.utc)  # Mon 28 Sep, strength day
D = '2026-09-28'
P_ = lambda uid, name, color, c: {'j': json.dumps({'name': name, 'color': color, 'plan': 'A', 'uid': uid, 'race': {'fmt': 'singles', 'div': 'M'}, 'created': c})}
L = lambda d: {'j': json.dumps(d)}
SEED = {'profiles': {'uvinay': P_('uvinay', 'Vinay', 'blue', '1'), 'uuday': P_('uuday', 'Uday', 'orange', '2'), 'urahul': P_('urahul', 'Rahul', 'green', '3'), 'upriya': P_('upriya', 'Priya', 'pink', '4')},
        'logs': {'uuday_' + D: L({'pid': 'uuday', 'date': D, 'cd': {'1': True}, 'notes': 'Uday private note'})}}
ADM = ('boss@test.com',)
def phone(email, db): return open_as(b, email, db, app_admins=ADM, rule_admins=ADM)
def lg(p, pid, d=D): return p.evaluate("JSON.parse(JSON.stringify(S.logs['%s_%s'] || {}))" % (pid, d))
def tg(p, pid, d=D): return p.evaluate("JSON.parse(JSON.stringify((S.together || {})['%s_%s'] || null))" % (pid, d))
def raw_tg(db, pid, d=D): return (db.get('together') or {}).get(pid + '_' + d)
def settle(p, ms=1300): p.wait_for_timeout(ms)
def card(p): return p.inner_text('.tg-card') if p.locator('.tg-card').count() else ''
def sets(l, i): return ((l.get('str') or {}).get(str(i)) or {}).get('s') or []
def dbl(db, pid, d=D): r = (db.get('logs') or {}).get(pid + '_' + d); return json.loads(r['j']) if r else {}
def refused(p, pid, d=D):  # try to change pid's log straight at the database
    p.evaluate("window.__REFUSED.length = 0; S.db.collection('logs').doc('%s_%s').set({ j: '{\"hack\":1}' }).catch(() => {})" % (pid, d)); p.wait_for_timeout(300)
    return p.evaluate("window.__REFUSED.includes('logs/%s_%s')" % (pid, d))
def tap_set(p, ex, k, who):  # under a heavy parallel run a tap can land while the page redraws
    for _ in range(3):
        p.click('[data-a=set][data-ex="%d"][data-set="%d"]' % (ex, k)); settle(p)
        if (sets(lg(p, who), ex)[k:k + 1] or [{}])[0].get('d'): return

with sync_playwright() as pw:
    b = pw.chromium.launch()
    # ---- Vinay starts a group with Uday and Rahul: no invites, they're in straight away
    v = phone('vinay@test.com', SEED)
    v.click('section[data-fold=wu] .check >> nth=0'); v.fill('#w-0-0', '40'); v.fill('#r-0-0', '10'); settle(v, 900); tap_set(v, 0, 0, 'uvinay')
    check('Today: "Train with…"', v.locator('[data-a=tg-open]').count() == 1)
    v.click('[data-a=tg-open]'); v.wait_for_timeout(250)
    check('the list has the other members, not me', v.locator('#sheet .tg-pick .lbl').all_inner_texts() == ['Uday', 'Rahul', 'Priya'])
    check('nothing to start until someone is picked', v.locator('#sheet [data-a=tg-send]').is_disabled())
    v.click('#sheet [data-a=tg-pick][data-v=uuday]'); v.click('#sheet [data-a=tg-pick][data-v=urahul]'); v.wait_for_timeout(150)
    check('weights: "Each person’s own" is the default', v.locator('#sheet [data-a=tg-wpick][data-v=own][aria-pressed=true]').count() == 1)
    check('button starts straight away, no invite', 'Start with Uday, Rahul' in v.inner_text('#sheet [data-a=tg-send]') and 'accept' not in v.inner_text('#sheet').lower())
    v.click('#sheet [data-a=tg-send]'); settle(v)
    db = dbof(v); r = raw_tg(db, 'uvinay')
    check('group saved with the members outside the JSON (for the rules)', r and r['in'] is True and r['group'] == ['uvinay', 'uuday', 'urahul'] and r['g'].startswith('uvinay:'), r)
    t = card(v)
    check('everyone is in at once (no waiting)', t.count('✓') == 3 and 'waiting' not in t, t)
    ul, rl = dbl(db, 'uuday'), dbl(db, 'urahul')
    check('Uday and Rahul are filled in with what Vinay had done (warm-up tick, set 1 reps and done)', ul.get('wu') == dbl(db, 'uvinay').get('wu') and sets(ul, 0)[0].get('d') is True and sets(ul, 0)[0].get('r') == 10 and sets(rl, 0)[0].get('d') is True, (ul.get('wu'), sets(ul, 0)[:1]))
    check('...but not Vinay’s weight (own weights)', sets(ul, 0)[0].get('w') in (None, ''))
    check('...Uday keeps his own cooldown tick and note, and Vinay gets the tick', ul.get('cd', {}).get('1') is True and ul.get('notes') == 'Uday private note' and dbl(db, 'uvinay').get('cd', {}).get('1') is True and 'notes' not in dbl(db, 'uvinay'))
    v.fill('#r-0-1', '9'); settle(v, 900); tap_set(v, 0, 1, 'uvinay')
    check('Vinay ticks set 2: Uday and Rahul get it straight away', sets(lg(v, 'uuday'), 0)[1].get('d') is True and sets(lg(v, 'urahul'), 0)[1].get('r') == 9)
    db = dbof(v); v.context.close()

    # ---- Uday opens his phone: already in the group, and his logging fills in the others
    u = phone('uday@test.com', db); settle(u, 600)
    t = card(u)
    check('Uday sees the group, "Vinay added you", no Accept', 'Vinay added you' in t and 'accept' not in t.lower() and u.locator('[data-a=tg-accept]').count() == 0, t)
    check('Uday’s phone joins him in (his own doc, same group)', tg(u, 'uuday') and tg(u, 'uuday')['st'] == 'in' and tg(u, 'uuday')['g'] == raw_tg(db, 'uvinay')['g'])
    check('Uday’s log says it was filled in together with Vinay', 'Filled in together with Vinay' in t)
    u.fill('#r-0-2', '8'); u.fill('#w-0-2', '30'); settle(u, 900); tap_set(u, 0, 2, 'uuday')
    vl, rl = lg(u, 'uvinay'), lg(u, 'urahul')
    check('Uday ticks set 3: Vinay and Rahul get 8 reps, done, their own weights untouched', sets(vl, 0)[2].get('d') is True and sets(vl, 0)[2].get('r') == 8 and sets(vl, 0)[2].get('w') in (None, '') and sets(rl, 0)[2].get('d') is True)
    u.evaluate("editLog('%s', l => { l.rpe = 7; l.notes = 'Uday felt strong'; l.fuel = { w: 3 }; })" % D); settle(u)
    vl = lg(u, 'uvinay')
    check('effort, notes and nutrition never copy', 'rpe' not in vl and 'notes' not in vl and 'fuel' not in vl)
    db = dbof(u); u.context.close()

    # ---- Rahul leaves; Priya (not in the group) can't touch anyone's log
    r_ = phone('rahul@test.com', db); settle(r_, 600)
    r_.click('.tg-card [data-a=tg-leave]'); settle(r_)
    check('Rahul leaves the group', tg(r_, 'urahul')['st'] == 'left' and r_.locator('.tg-card').count() == 0 and r_.locator('[data-a=tg-open]').count() == 1)
    db = dbof(r_); r_.context.close()
    p_ = phone('priya@test.com', db)
    check('Priya, outside the group, is refused writing Vinay’s log', refused(p_, 'uvinay') and not p_.evaluate("canWriteDoc('logs', 'uvinay_%s')" % D))
    p_.click('[data-a=tg-open]'); p_.wait_for_timeout(250); p_.click('#sheet [data-a=tg-pick][data-v=uvinay]'); p_.click('#sheet [data-a=tg-send]'); settle(p_)
    check('Priya can’t take over Vinay by adding him: he’s already in another group today', refused(p_, 'uvinay') and dbl(dbof(p_), 'uvinay').get('hack') is None)
    p_.click('.tg-card [data-a=tg-leave]'); settle(p_)
    db = dbof(p_); p_.context.close()

    # ---- back to Vinay: Rahul left, weights, filling in Uday's weights, Completed, Gym mode
    v = phone('vinay@test.com', db); settle(v, 600)
    t = card(v)
    check('Vinay sees Rahul left', 'left' in t, t)
    check('the rules refuse Vinay writing Rahul’s log now', refused(v, 'urahul'))
    before = json.dumps(lg(v, 'urahul'), sort_keys=True)
    v.click('.tg-card [data-a=tg-weights][data-v=same]'); settle(v, 500)
    v.fill('#r-1-0', '10'); v.fill('#w-1-0', '45'); settle(v, 900); tap_set(v, 1, 0, 'uvinay')
    us = sets(lg(v, 'uuday'), 1)
    check('Same weights: Vinay’s 45 kg set is copied to Uday', us[:1] and us[0].get('w') == 45 and us[0].get('d') is True, us)
    check('...and nothing reaches Rahul after he left', json.dumps(lg(v, 'urahul'), sort_keys=True) == before)
    v.click('.tg-card [data-a=tg-weights][data-v=own]'); settle(v, 500)
    v.click('.tg-card [data-a=tg-view][data-v=uuday]'); settle(v, 400)
    check('tap Uday: Vinay fills in Uday’s log ("Back to me")', v.evaluate("S.pid") == 'uuday' and 'Back to me' in v.inner_text('#topbar') and 'filling in' in card(v))
    v.fill('#w-0-0', '35'); settle(v)
    check('Own weights: Vinay sets Uday’s set 1 to 35 kg; Vinay’s own stays 40', sets(lg(v, 'uuday'), 0)[0].get('w') == 35 and sets(lg(v, 'uvinay'), 0)[0].get('w') == 40)
    v.click('.tg-card [data-a=tg-view][data-v=uvinay]'); settle(v, 400)
    check('Back to mine', v.evaluate("S.pid") == 'uvinay')
    v.evaluate("editLog('%s', l => { l.status = 'complete'; l.time = 70; l.rpe = 6; })" % D); settle(v)
    ul = lg(v, 'uuday')
    check('Completed and minutes copy; Uday keeps his own effort (7)', ul.get('status') == 'complete' and ul.get('time') == 70 and ul.get('rpe') == 7, {k: ul.get(k) for k in ('status', 'time', 'rpe')})
    v.evaluate("openMode('gym')"); v.wait_for_timeout(300); v.evaluate("gymGo('set')"); v.wait_for_timeout(200)
    ex = v.evaluate("MODE.i"); st_ = v.evaluate("MODE.s"); v.click('[data-a=md-done]'); settle(v)
    check('Gym mode fills in Uday too', sets(lg(v, 'uuday'), ex)[st_].get('d') is True, (ex, st_))
    v.evaluate("closeMode()"); v.wait_for_timeout(200)
    check('no page errors (Vinay)', not v.errors, v.errors[:2])
    db = dbof(v); v.context.close()

    # ---- Uday switches off "Others can add me" in Settings
    u = phone('uday@test.com', db)
    u.evaluate("go({view:'settings'})"); u.wait_for_timeout(300)
    check('Settings has "Others can add me to their group", on', u.locator('#tg-prefs [data-a=tg-prefs][aria-pressed=true]').count() == 1)
    u.click('#tg-prefs [data-a=tg-prefs]'); settle(u)
    check('...switched off', raw_tg(dbof(u), 'uuday', 'prefs')['in'] is False)
    db = dbof(u); u.context.close()
    v = phone('vinay@test.com', db); settle(v, 600)
    check('with it off, the rules refuse Vinay writing Uday’s log', refused(v, 'uuday') and not v.evaluate("canWriteDoc('logs', 'uuday_%s')" % D))
    check('...and the group card shows Uday "turned off"', 'turned off' in card(v), card(v))
    v.click('.tg-card [data-a=tg-leave]'); settle(v)
    check('End for everyone', tg(v, 'uvinay')['st'] == 'left' and v.locator('.tg-card').count() == 0)
    v.click('[data-a=tg-open]'); v.wait_for_timeout(250); v.click('#sheet [data-a=tg-pick][data-v=uuday]'); v.click('#sheet [data-a=tg-send]'); settle(v)
    check('adding someone who switched it off does nothing', tg(v, 'uvinay')['st'] == 'left' and v.locator('.tg-card').count() == 0)
    v.evaluate("closeSheet()"); v.evaluate("go({view:'day', date:'2026-09-27'})"); v.wait_for_timeout(300)
    check('rest days: no Train with…', v.locator('[data-a=tg-open]').count() == 0)
    v.evaluate("go({view:'day', date:'2026-09-29'})"); v.wait_for_timeout(300)
    check('...not on a future day either', v.locator('[data-a=tg-open]').count() == 0)
    v.set_viewport_size({'width': 320, 'height': 700}); v.evaluate("go({view:'today'})"); v.wait_for_timeout(300)
    check('320 px: no sideways scroll on Today', not v.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1'))
    check('no page errors (end)', not v.errors, v.errors[:2])
    v.context.close()
    b.close()
srv.shutdown()
print('\n%d/%d passed' % (sum(r[1] for r in res), len(res)))
