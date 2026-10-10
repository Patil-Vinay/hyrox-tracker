import json
# v37: the tracker is private (members() in the rules, by uid) and visitors can "Look around" a demo with sample data
src = open('test/run_roles.py').read().split('with sync_playwright() as pw:')[0].replace('PORT = 8791', 'PORT = 8841')
exec(src)
from datetime import datetime, timezone
NOW = datetime(2026, 11, 12, 2, 0, tzinfo=timezone.utc)  # Thu 12 Nov, 07:30 IST
MEMBERS = ['uadmin', 'uvinay', 'uuday']

def page(b, email=None, seed=None, demo=False, sign_in=True):
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    ctx.clock.install(time=NOW)
    p = ctx.new_page(); p.errors = []
    p.on('pageerror', lambda e: p.errors.append(str(e)))
    init = 'window.__SEED=%s;window.__SIGNIN_AS=%s;window.__RULE_ADMINS=["uadmin"];window.__RULE_MEMBERS=%s;' % (json.dumps(seed or {}), json.dumps(email or ''), json.dumps(MEMBERS))
    p.route('**/firebase-sdk.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body=init + MOCK))
    p.route('**/config.js', lambda r: r.fulfill(status=200, content_type='application/javascript',
        body='window.TRACKER_ADMINS=["uadmin"];window.FIREBASE_EMULATORS={};window.FIREBASE_CONFIG={apiKey:"AIzaTest",projectId:"demo-hyrox",authDomain:"demo-hyrox.firebaseapp.com"};'))
    p.route('https://fonts.googleapis.com/**', lambda r: r.abort())
    p.goto(URL + ('?demo' if demo else ''))
    if not demo:
        p.wait_for_selector('[data-a=signin]', timeout=8000)
        if sign_in: p.click('[data-a=signin]'); p.wait_for_timeout(1200)
    else:
        p.wait_for_timeout(1200)
    return p

P_ = lambda uid, name, color: {'j': json.dumps({'name': name, 'color': color, 'plan': 'A', 'uid': uid, 'race': {'fmt': 'singles', 'div': 'M'}})}
SEED = {'profiles': {'uadmin': P_('uadmin', 'Vinay', 'blue'), 'uuday': P_('uuday', 'Uday', 'orange')},
        'logs': {'uuday_2026-11-11': {'j': json.dumps({'pid': 'uuday', 'date': '2026-11-11', 'status': 'complete', 'notes': 'secret note'})}}}

with sync_playwright() as pw:
    b = pw.chromium.launch()

    # 1. Signed out: the gate offers Google sign-in plus Look around and says the tracker is private
    g = page(b, sign_in=False)
    t = g.inner_text('#gate')
    check('gate says the tracker is private', 'private' in t, t[:120].replace('\n', ' '))
    check('gate has Look around', g.locator('#gate [data-a=demo]').count() == 1)
    check('gate no longer invites anyone to join', 'Anyone you send the link to' not in t)
    g.screenshot(path=f'{OUT}/v37-gate.png')

    # 2. A stranger signs in: refused everything, told it's private, can still look around
    s = page(b, 'stranger@test.com', SEED)
    t = s.inner_text('#gate') if s.is_visible('#gate') else ''
    check('stranger sees the private message', 'This tracker is private' in t, t[:120].replace('\n', ' '))
    check('stranger is offered Look around', s.locator('#gate [data-a=demo]').count() == 1)
    check('stranger gets no data', s.evaluate("Object.keys(S.profiles).length") == 0 and 'secret note' not in s.content())
    s.evaluate("put('logs', 'ustranger_2026-11-12', {pid:'ustranger', date:'2026-11-12', status:'complete'})"); s.wait_for_timeout(500)
    check('stranger cannot write', 'logs/ustranger_2026-11-12' not in s.evaluate('window.__WRITES'))
    ok = s.evaluate("""(async () => { try { await FBX.storage.upload('photos/ustranger/x.jpg', new Blob(['x'], {type:'image/jpeg'}), 'image/jpeg'); return 'uploaded'; } catch (e) { return e.code; } })()""")
    check('stranger cannot upload a photo', ok == 'storage/unauthorized', ok)
    s.screenshot(path=f'{OUT}/v37-denied.png')

    # 3. Members work as before; the admin is recognised by uid
    a = page(b, 'admin@test.com', SEED)
    check('admin (by uid) gets in with the Admin badge', 'Admin' in a.inner_text('#topbar') and not a.is_visible('#gate'), a.inner_text('#topbar')[:80])
    a.locator('[data-a="set"]').first.click(); a.wait_for_timeout(1200)
    check('admin can save', any(w.startswith('logs/uadmin_') for w in a.evaluate('window.__WRITES')))
    u = page(b, 'uday@test.com', SEED)
    check('member Uday gets in, not admin', 'Uday' in u.inner_text('#topbar') and 'Admin' not in u.inner_text('#topbar'))
    check('member sees the other member\'s log', u.evaluate("!!S.logs['uuday_2026-11-11']"))
    v = page(b, 'vinay@test.com', SEED)
    check('new member (User 2) is asked to set up a profile', v.is_visible('#sheet >> text=Set up your profile'))

    # 4. Look around: sample data only, Firebase never started, nothing saved anywhere
    d = page(b, None, SEED, sign_in=False)
    d.click('#gate [data-a=demo]'); d.wait_for_timeout(1500)
    check('Look around opens ?demo', d.url.endswith('?demo'), d.url)
    check('demo hides the gate', not d.is_visible('#gate'))
    check('demo never starts Firebase', not d.evaluate('!!window.__FB_STARTED'))
    check('demo shows sample people, not real ones', d.evaluate("Object.values(S.profiles).map(p => p.name).sort().join()") == 'Alex,Sam')
    check('demo has logged days up to yesterday', d.evaluate("Object.keys(S.logs).filter(k => k.startsWith('demo-alex_')).length") > 25)
    check('demo top bar says not saved', 'Demo' in d.inner_text('#topbar'), d.inner_text('#topbar')[:80])
    check('no real data in the demo', 'secret note' not in d.content() and 'Vinay' not in d.inner_text('body'))
    d.screenshot(path=f'{OUT}/v37-demo-today.png')
    d.locator('[data-a="set"]').first.click(); d.wait_for_timeout(800)
    check('demo edits work in memory', d.evaluate("!!S.logs['demo-alex_2026-11-12']"))
    check('demo writes nothing to Firebase', d.evaluate('window.__WRITES.length') == 0)
    check('demo writes no cache or outbox', d.evaluate("!localStorage.getItem('hx.cache.v2') && !localStorage.getItem('hx.outbox.v2')"))
    for view in ['calendar', 'progress', 'together', 'nutrition', 'settings']:
        d.evaluate("S.route.view = '%s'; render()" % view); d.wait_for_timeout(300)
        check('demo %s page draws' % view, 'Something went wrong' not in d.inner_text('#view'))
        if view == 'progress': d.screenshot(path=f'{OUT}/v37-demo-progress.png')
    check('demo settings offers Leave demo', d.locator('[data-a=signout]').inner_text().strip() == 'Leave demo')
    d.evaluate("addPhotos('2026-11-12', [new File(['x'], 'a.jpg', {type:'image/jpeg'})])"); d.wait_for_timeout(300)
    check('demo refuses photos', 'Photos are turned off' in d.inner_text('body'))
    d.click('[data-a=signout]'); d.wait_for_timeout(1200)
    check('Leave demo goes back to sign-in', not d.url.endswith('?demo') and d.locator('[data-a=signin]').count() == 1, d.url)

    for name, x in [('gate', g), ('stranger', s), ('admin', a), ('uday', u), ('vinay', v), ('demo', d)]:
        check('no page errors (%s)' % name, not x.errors, x.errors[:2])
    b.close()
srv.shutdown()
print('\n%d/%d passed' % (sum(1 for _, c in res if c), len(res)))
