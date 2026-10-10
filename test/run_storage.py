import json, re
from datetime import datetime, timezone
# v23: an iPhone whose storage for the site is full (or blocked). Before v23, folding worked one way only.
src = open('test/run_roles.py').read().split('with sync_playwright() as pw:')[0].replace('PORT = 8791', 'PORT = 8829')
exec(src)
P_ = lambda uid, name, color: {'j': json.dumps({'name': name, 'color': color, 'plan': 'A', 'uid': uid, 'race': {'fmt': 'singles', 'div': 'M'}})}
L = lambda d: {'j': json.dumps(d)}
NOW = datetime(2026, 9, 28, 2, 0, tzinfo=timezone.utc)  # Mon 28 Sep, pull day
D = '2026-09-28'
st = {str(i): {'s': [{'r': 10, 'w': 20, 'd': True}] * 3} for i in range(7)}
SEED = {'profiles': {'uadmin': P_('uadmin', 'Vinay', 'blue')}, 'logs': {'uadmin_' + D: L({'pid': 'uadmin', 'date': D, 'status': 'complete', 'rpe': 6, 'str': st})}}
# 'full': a write that makes storage bigger fails while the offline copy is there (like a full iPhone); 'blocked': every write fails
FAKE = r"""(function () {
  const orig = Storage.prototype.setItem; window.__MODE = 'ok';
  Storage.prototype.setItem = function (k, v) {
    if (window.__MODE === 'blocked') throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    if (window.__MODE === 'full') { const cur = this.getItem(k); if (this.getItem('hx.cache.v2') != null && (cur == null || String(v).length > cur.length)) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError'); }
    return orig.call(this, k, v);
  };
})();"""

def open_phone(b, seed):
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
    ctx.clock.install(time=NOW)
    ctx.add_init_script(FAKE)
    p = ctx.new_page(); p.errors = []
    p.on('pageerror', lambda e: p.errors.append(str(e)))
    init = 'window.__SEED=%s;window.__SIGNIN_AS="admin@test.com";window.__RULE_ADMINS=["admin@test.com"];window.__LOCKED=false;' % json.dumps(seed)
    p.route('**/firebase-sdk.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body=init + MOCK))
    p.route('**/config.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body='window.TRACKER_ADMINS=["admin@test.com"];window.FIREBASE_EMULATORS={};window.FIREBASE_CONFIG={apiKey:"AIzaTest",projectId:"demo-hyrox",authDomain:"demo-hyrox.firebaseapp.com"};'))
    p.route('https://fonts.googleapis.com/**', lambda r: r.abort())
    p.goto(URL); p.wait_for_selector('[data-a=signin]', timeout=8000); p.tap('[data-a=signin]'); p.wait_for_timeout(1500)
    return p

def tap(p, sel):
    p.locator(sel).scroll_into_view_if_needed(); bb = p.locator(sel).bounding_box()
    p.touchscreen.tap(bb['x'] + bb['width'] - 8, bb['y'] + bb['height'] / 2); p.wait_for_timeout(200)
def ex0(p): return p.locator('#ex-0.folded').count() == 1
def nfold(p): return p.locator('section[data-fold=str] .ex.folded').count()
def card(p): return p.locator('section[data-fold=str].folded').count() == 1
def allbtn(p): return p.inner_text('section[data-fold=str] [data-a=exfold-all]')
def stored(p): return p.evaluate("JSON.parse(localStorage.getItem('hx.fold') || '{}')")

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for mode in ('full', 'blocked'):
        a = open_phone(b, SEED)
        a.wait_for_timeout(3000)  # let the offline copy be written first
        had_cache = a.evaluate("localStorage.getItem('hx.cache.v2') != null")
        a.evaluate("window.__MODE = '%s'" % mode)
        seq = []
        for k in range(4):
            tap(a, '#ex-0 .exfold'); seq.append(ex0(a))
        check('%s storage: an exercise opens and closes on every tap' % mode, seq == [True, False, True, False], seq)
        seq = []
        for k in range(4):
            a.locator('section[data-fold=str] [data-a=exfold-all]').tap(); a.wait_for_timeout(200); seq.append((nfold(a), allbtn(a)))
        check('%s storage: Hide all sets / Show all sets keep switching' % mode, seq == [(7, 'Show all sets'), (0, 'Hide all sets'), (7, 'Show all sets'), (0, 'Hide all sets')], seq)
        seq = []
        for k in range(4):
            tap(a, 'section[data-fold=str] > .card-h'); seq.append(card(a))
        check('%s storage: the Main strength card opens and closes every time' % mode, seq == [True, False, True, False], seq)
        a.evaluate("render()"); a.wait_for_timeout(200)
        check('%s storage: a redraw keeps what you chose' % mode, nfold(a) == 0 and not card(a))
        if mode == 'full':
            tap(a, '#ex-2 .exfold')
            check('full storage: the offline copy was cleared to make room', had_cache and a.evaluate("localStorage.getItem('hx.cache.v2') == null"), had_cache)
            check('full storage: the choice is saved on the phone again', stored(a).get('ex:%s:2' % D) == 1, stored(a))
            a.wait_for_timeout(3000)
            check('...and the offline copy is not written back in this session', a.evaluate("localStorage.getItem('hx.cache.v2') == null"))
            a.evaluate("go({view:'settings'})"); a.wait_for_timeout(300)
            v = a.inner_text('#app-ver')
            check('Settings shows the version, storage used and that storage was full', a.evaluate('APP_VERSION') in v and 'KB' in v and 'storage for the app was full' in v, v)
        else:
            check('blocked storage: nothing is saved, but the session still works', stored(a).get('ex:%s:0' % D) is None)
        check('no page errors (%s)' % mode, not a.errors, a.errors[:2])
        a.context.close()

    # normal storage: nothing changes, no warning
    a = open_phone(b, SEED)
    tap(a, '#ex-0 .exfold'); tap(a, '#ex-0 .exfold'); tap(a, '#ex-0 .exfold')
    check('normal storage: saved as before', ex0(a) and stored(a).get('ex:%s:0' % D) == 1)
    a.evaluate("go({view:'settings'})"); a.wait_for_timeout(300)
    check('Settings: version line without a warning', a.evaluate('APP_VERSION') in a.inner_text('#app-ver') and 'full' not in a.inner_text('#app-ver'))
    # v31: every release bumps both; phones only fetch the new version when the cache name changes
    ver = a.evaluate('APP_VERSION'); cache = (re.search(r"const CACHE = '([^']+)'", open(PUB + '/sw.js').read()) or [None, None])[1]
    check('release: the offline cache name in sw.js matches APP_VERSION (%s)' % ver, cache == 'hyrox-tracker-' + ver, cache)
    check('no page errors (normal)', not a.errors, a.errors[:2])
    b.close()
srv.shutdown()
print('\n%d/%d passed' % (sum(r[1] for r in res), len(res)))
