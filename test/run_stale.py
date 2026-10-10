import json
from datetime import datetime, timezone
src = open('test/run_roles.py').read().split('with sync_playwright() as pw:')[0].replace('PORT = 8791', 'PORT = 8797')
exec(src)
# An old saved copy on the device: the plan as it was before (start Mon 28 Sep)
pd = open('public/plan-data.js').read(); D = json.loads(pd[pd.index('=') + 1:pd.rstrip().rindex(';')])
old_meta = dict(D['plan_meta']['program']); old_meta['start'] = '2026-09-28'
stale = {'metaDocs': {'program': old_meta}, 'days': {k: v for k, v in D['plan_days'].items() if k >= '2026-09-28'}, 'weeks': D['plan_weeks']}
prof = {'uadmin': {'j': json.dumps({'name': 'Vinay', 'color': 'blue', 'plan': 'A', 'uid': 'uadmin', 'race': {'fmt': 'singles', 'div': 'M'}})}}
NOW = datetime(2026, 9, 26, 4, 30, tzinfo=timezone.utc)
with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); ctx.clock.install(time=NOW)
    ctx.add_init_script('localStorage.setItem("hx.cache.v2", %s);' % json.dumps(json.dumps(stale)))
    p = ctx.new_page(); p.errors = []; p.on('pageerror', lambda e: p.errors.append(str(e)))
    init = 'window.__SEED=%s;window.__SIGNIN_AS="admin@test.com";window.__CACHE_FIRST=true;' % json.dumps({'profiles': prof})
    p.route('**/firebase-sdk.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body=init + MOCK))
    p.route('**/config.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body='window.TRACKER_ADMINS=["admin@test.com"];window.FIREBASE_EMULATORS={};window.FIREBASE_CONFIG={apiKey:"AIzaTest",projectId:"demo-hyrox"};'))
    p.route('https://fonts.googleapis.com/**', lambda r: r.abort())
    p.goto(URL); p.wait_for_timeout(600)
    top0 = p.inner_text('.plates') if p.locator('.plates').count() else ''
    check('even before signing in, the old saved start date is ignored', 'Day 1 of 112' in p.inner_text('#view') and 'DAY 1' not in top0.upper(), top0.replace('\n', ' '))
    p.click('[data-a=signin]'); p.wait_for_timeout(1200)
    top = p.inner_text('.plates'); v = p.inner_text('#view')
    check('Saturday shows only days-to-race at the top', 'DAYS TO DAY 1' not in top.upper() and '111' in top, top.replace('\n', ' '))
    check('subtitle says Day 1 of 112', 'Day 1 of 112 · Kick-off weekend' in v)
    check('no script errors', not p.errors, p.errors[:2])
    p.screenshot(path=f'{OUT}/s1-fixed.png')
    b.close()
srv.shutdown()
print('\n%d/%d passed' % (sum(r[1] for r in res), len(res)))
