import time
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:5055'
OUT = 'test/shots'
res = []
def check(n, c, d=''):
    res.append((n, bool(c))); print(('PASS ' if c else 'FAIL ') + n, d)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844})
    ctx.route('https://fonts.googleapis.com/**', lambda r: r.abort())
    ctx.route('**/config.js', lambda r: r.fulfill(status=200, content_type='application/javascript',
        body='window.FIREBASE_CONFIG=null;window.FIREBASE_EMULATORS={authEmulator:"http://127.0.0.1:9099"};'))
    p = ctx.new_page(); errs = []
    p.on('pageerror', lambda e: errs.append(str(e)))
    p.goto(BASE + '/index.html')
    p.wait_for_selector('[data-a=signin]', timeout=15000)
    check('real SDK: config found via /__/firebase/init.json', p.evaluate("!!localStorage.getItem('hx.fbconfig')"))
    # Google's sign-in servers aren't reachable from this sandbox, so attach a signed-in state by hand
    p.evaluate("S.user={uid:'u1',email:'vinay@example.com'}; S.uid='u1'; S.email=S.user.email; S.db=FBX.db; showGate(null); subscribeAll(); render();")
    check('real SDK: Firestore listeners attach without errors', not errs, str(errs[:2]))
    # Firestore has no emulator here and the sandbox has no internet, so this also exercises the offline path
    p.wait_for_timeout(1500)
    p.evaluate("S.pid = 'u1'; S.profiles.u1 = {name:'Tmp', uid:'u1'}; editLog('2026-10-01', l => { l.notes = 'x'; })")
    p.wait_for_timeout(17000)
    s = p.inner_text('#sync')
    check('real SDK offline: change kept and shown as waiting', 'Offline' in s or 'Saving' in s, s)
    check('real SDK offline: plan still shows from built-in data', p.evaluate('S.order.length') == 112, str(p.evaluate('S.order.length')))
    p.screenshot(path=OUT + '/8-real-offline.png')
    check('real SDK: no script errors', not errs, str(errs[:3]))

    # service worker: open once, then reload with the network off
    ctx2 = b.new_context(viewport={'width': 390, 'height': 844})
    ctx2.route('https://fonts.googleapis.com/**', lambda r: r.abort())
    p2 = ctx2.new_page()
    p2.goto(BASE + '/index.html'); p2.wait_for_timeout(1500)
    p2.evaluate("navigator.serviceWorker.ready.then(()=>1)"); p2.wait_for_timeout(1500)
    check('service worker installed', p2.evaluate("navigator.serviceWorker.controller !== null || navigator.serviceWorker.getRegistration().then(r=>!!r)"))
    p2.reload(); p2.wait_for_timeout(1000)
    ctx2.set_offline(True)
    p2.reload(); p2.wait_for_timeout(5500)
    ok = p2.evaluate("!!document.querySelector('#nav a')")
    check('opens with no connection (from service worker cache)', ok)
    p2.screenshot(path=OUT + '/9-offline-open.png')
    b.close()
print('%d/%d passed' % (sum(r[1] for r in res), len(res)))
