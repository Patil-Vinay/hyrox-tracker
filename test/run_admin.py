import json
from datetime import datetime, timezone
# v26: the admin is a separate Google account that doesn't train. The old admin (Vinay) becomes an ordinary member.
src = open('test/run_roles.py').read().split('with sync_playwright() as pw:')[0].replace('PORT = 8791', 'PORT = 8833')
exec(src)
NOW = datetime(2026, 9, 28, 2, 0, tzinfo=timezone.utc)
P_ = lambda uid, name, color: {'j': json.dumps({'name': name, 'color': color, 'plan': 'A', 'uid': uid, 'race': {'fmt': 'singles', 'div': 'M'}})}
L = lambda d: {'j': json.dumps(d)}
SEED = {'profiles': {'uvinay': P_('uvinay', 'Vinay', 'blue'), 'uuday': P_('uuday', 'Uday', 'orange')},
        'logs': {'uvinay_2026-09-26': L({'pid': 'uvinay', 'date': '2026-09-26', 'status': 'complete', 'rpe': 3})}}
ADM = ('boss@test.com',)
def ev(p, js): return p.evaluate(js)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    a = open_as(b, 'boss@test.com', SEED, app_admins=ADM, rule_admins=ADM)
    a.wait_for_timeout(800)
    check('admin account without a profile: no "Set up your profile"', not (a.is_visible('#sheet') and 'Set up your profile' in a.inner_text('#sheet')), a.inner_text('#sheet') if a.is_visible('#sheet') else '')
    check('...opens someone\'s log straight away (the first person in the list)', ev(a, "S.pid") == ev(a, "peopleIds()[0]") and 'Admin' in a.inner_text('#topbar') and 'Back to me' not in a.inner_text('#topbar'))
    check('the admin is not one of the people', sorted(ev(a, "peopleIds()")) == ['uuday', 'uvinay'] and ev(a, "!S.profiles[S.uid]"))
    a.click('#topbar [data-a=who]'); a.wait_for_timeout(300)
    t = a.inner_text('#sheet')
    check('View or edit as: just Vinay and Uday, with a note that this account doesn\'t train', a.locator('#sheet [data-a=choose]').count() == 2 and "doesn't train" in t and 'boss' not in t.lower(), t[:300])
    a.click('#sheet [data-a=choose][data-v=uvinay]'); a.wait_for_timeout(300); a.click('#topbar [data-a=who]'); a.wait_for_timeout(300)
    a.click('#sheet [data-a=choose][data-v=uuday]'); a.wait_for_timeout(400)
    check('pick Uday: his log opens', ev(a, "S.pid") == 'uuday' and 'Uday' in a.inner_text('#topbar'))
    a.click('section[data-fold=wu] .check >> nth=0'); a.wait_for_timeout(1300)
    db = dbof(a)
    check("ticks go into Uday's log (the admin may change it)", 'uuday_2026-09-28' in db.get('logs', {}) and json.loads(db['logs']['uuday_2026-09-28']['j']).get('wu'))
    check('no profile, log or anything else is created for the admin account', not any(k.startswith('uboss') for col in db.values() if isinstance(col, dict) for k in col), [(c, [k for k in v if k.startswith('uboss')]) for c, v in db.items() if isinstance(v, dict)])
    a.evaluate("go({view:'together'})"); a.wait_for_timeout(300)
    check('Together shows Vinay and Uday only', 'boss' not in a.inner_text('#view').lower() and 'Vinay' in a.inner_text('#view') and 'Uday' in a.inner_text('#view'))
    a.evaluate("go({view:'settings'})"); a.wait_for_timeout(300)
    check('Settings: the profile card is Uday\'s, with View or edit as', a.locator('#view .card-h h3', has_text='Uday').count() >= 1 and a.locator('#view [data-a=who]').count() >= 1)
    a.reload(); a.wait_for_timeout(300)
    if a.locator('[data-a=signin]').count(): a.click('[data-a=signin]')
    a.wait_for_timeout(1500)
    check('after a reload the admin comes back to the last person picked (Uday)', ev(a, "S.pid") == 'uuday', ev(a, "S.pid"))
    check('no page errors (admin)', not a.errors, a.errors[:2])
    db = dbof(a); a.context.close()

    # Vinay is an ordinary member now
    v = open_as(b, 'vinay@test.com', db, app_admins=ADM, rule_admins=ADM)
    v.wait_for_timeout(600)
    check('Vinay: his own log, no Admin badge', ev(v, "S.pid") == 'uvinay' and 'Admin' not in v.inner_text('#topbar') and not ev(v, "isAdmin()"))
    check("Vinay can't change Uday's log any more", not ev(v, "canWriteDoc('logs', 'uuday_2026-09-28')") and ev(v, "canWriteDoc('logs', 'uvinay_2026-09-28')"))
    v.click('#topbar [data-a=who]'); v.wait_for_timeout(300)
    check('Vinay: tapping his name opens Settings, not View or edit as', not (v.is_visible('#sheet') and 'View or edit as' in v.inner_text('#sheet')) and ev(v, "S.route.view") == 'settings')
    check('no page errors (Vinay)', not v.errors, v.errors[:2])
    v.context.close()

    # the admin account got a profile by mistake (signed in before v26, when everyone had to set one up): remove it in Settings
    s2 = json.loads(json.dumps(SEED)); s2['profiles']['uboss'] = P_('uboss', 'Vinay', 'green')
    m = open_as(b, 'boss@test.com', s2, app_admins=ADM, rule_admins=ADM)
    m.wait_for_timeout(600)
    check('admin with a mistaken profile shows up as a person (the reported problem)', 'uboss' in ev(m, "peopleIds()"))
    m.evaluate("go({view:'settings'})"); m.wait_for_timeout(300)
    row = m.locator('#view .row', has_text='· you')
    check('Settings → Members marks that one "· you"', row.count() == 1)
    row.locator('[data-a=mem-edit]').click(); m.wait_for_timeout(300)
    m.click('#sheet [data-a=mem-remove-ask]'); m.wait_for_timeout(200); m.click('#sheet [data-a=mem-remove]'); m.wait_for_timeout(1300)
    check('after Remove member: the admin is gone from the people, no setup sheet', ev(m, "peopleIds()") and 'uboss' not in ev(m, "peopleIds()") and not (m.is_visible('#sheet') and 'Set up your profile' in m.inner_text('#sheet')), ev(m, "peopleIds()"))
    check('...and it opens Vinay\'s or Uday\'s log as admin', ev(m, "S.pid") in ('uvinay', 'uuday') and 'Admin' in m.inner_text('#topbar') and 'Back to me' not in m.inner_text('#topbar'))
    m.evaluate("go({view:'together'})"); m.wait_for_timeout(300)
    check('Together: only the two who train', m.locator('#view', has_text='Uday').count() == 1 and ev(m, "peopleIds().length") == 2)
    check('no page errors (mistaken profile)', not m.errors, m.errors[:2])
    m.context.close()

    # a brand-new tracker with nobody in it: the admin still gets the normal first-time setup
    n = open_as(b, 'boss@test.com', {}, app_admins=ADM, rule_admins=ADM)
    check('empty tracker: the admin is offered the normal setup', n.is_visible('#sheet'))
    n.context.close()
    b.close()
srv.shutdown()
print('\n%d/%d passed' % (sum(r[1] for r in res), len(res)))
