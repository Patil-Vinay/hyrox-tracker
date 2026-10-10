import json, os, threading, http.server, socketserver, functools
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright

PUB = 'public'
OUT = 'test/shots'; os.makedirs(OUT, exist_ok=True)
PORT = 8791
socketserver.TCPServer.allow_reuse_address = True
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', PORT), functools.partial(Quiet, directory=PUB))
threading.Thread(target=srv.serve_forever, daemon=True).start()
MOCK = open('test/mock-fbx.js').read()
URL = f'http://127.0.0.1:{PORT}/index.html'
NOW = datetime(2026, 9, 28, 2, 0, tzinfo=timezone.utc)  # Mon 28 Sep, 07:30 IST

res = []
def check(n, c, d=''):
    res.append((n, bool(c))); print(('PASS ' if c else 'FAIL ') + n, ('- ' + str(d)) if d else '')

def open_as(b, email, seed, app_admins=('admin@test.com',), rule_admins=('admin@test.com',), locked=False, vp=(390, 844)):
    ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, device_scale_factor=2)
    ctx.clock.install(time=NOW)
    p = ctx.new_page(); p.errors = []
    p.on('pageerror', lambda e: p.errors.append(str(e)))
    init = 'window.__SEED=%s;window.__SIGNIN_AS=%s;window.__RULE_ADMINS=%s;window.__LOCKED=%s;' % (json.dumps(seed), json.dumps(email), json.dumps(list(rule_admins)), 'true' if locked else 'false')
    p.route('**/firebase-sdk.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body=init + MOCK))
    p.route('**/config.js', lambda r: r.fulfill(status=200, content_type='application/javascript',
        body='window.TRACKER_ADMINS=%s;window.FIREBASE_EMULATORS={};window.FIREBASE_CONFIG={apiKey:"AIzaTest",projectId:"demo-hyrox",authDomain:"demo-hyrox.firebaseapp.com"};' % json.dumps(list(app_admins))))
    p.route('https://fonts.googleapis.com/**', lambda r: r.abort())
    p.goto(URL)
    p.wait_for_selector('[data-a=signin]', timeout=8000)
    p.click('[data-a=signin]')
    p.wait_for_timeout(1200)
    return p

def dbof(p): return p.evaluate('JSON.parse(JSON.stringify(window.__DB))')
def ids(db, col): return sorted((db.get(col) or {}).keys())
def dec(db, col, i): return json.loads(db[col][i]['j'])

with sync_playwright() as pw:
    b = pw.chromium.launch()

    # 1. Admin, brand-new project -> one-time setup, no restore card, no list of other people
    a = open_as(b, 'admin@test.com', {})
    sheet = a.inner_text('#sheet') if a.is_visible('#sheet') else ''
    check('first sign-in asks to set up a profile', 'SET UP YOUR PROFILE' in sheet.upper(), sheet[:60].replace('\n', ' '))
    check('no restore card', 'Moving from' not in sheet)
    check('setup cannot be skipped (no close button)', a.locator('#sheet [data-a=close]').count() == 0)
    a.screenshot(path=f'{OUT}/r1-setup.png')
    a.fill('#nf-name', 'Vinay'); a.click('[data-a=create-person]'); a.wait_for_timeout(400)
    check('race is required before the profile is created', 'uadmin' not in ids(dbof(a), 'profiles'))
    a.click('[data-a=nf-fmt][data-v=singles]'); a.click('[data-a=nf-div][data-v=M]'); a.wait_for_timeout(100)
    check('setup shows the chosen weights', '152 kg' in a.inner_text('#sheet') and '3.00 m' in a.inner_text('#sheet'))
    a.click('[data-a=create-person]'); a.wait_for_timeout(900)
    check('race saved with the profile', dec(dbof(a), 'profiles', 'uadmin').get('race') == {'fmt': 'singles', 'div': 'M'}, dec(dbof(a), 'profiles', 'uadmin').get('race'))
    db = dbof(a)
    check('profile saved under the account id', ids(db, 'profiles') == ['uadmin'], ids(db, 'profiles'))
    top = a.inner_text('#topbar')
    check('admin lands on own profile with Admin badge', 'Vinay' in top and 'Admin' in top, top.replace('\n', ' '))
    check('admin sees plan Edit button', a.locator('[data-a=edit-plan]').count() > 0)
    a.locator('[data-a="set"]').first.click(); a.wait_for_timeout(1200)
    db = dbof(a)
    check('admin log saved as uadmin_<date>', 'uadmin_2026-09-28' in ids(db, 'logs'), ids(db, 'logs'))
    a.screenshot(path=f'{OUT}/r2-admin-today.png')

    # 2. Uday, first time -> setup once, then only his own things are editable
    u = open_as(b, 'uday@test.com', db)
    check('new member gets the setup screen', u.is_visible('#sheet >> text=Set up your profile'))
    u.fill('#nf-name', 'Uday'); u.click('#sheet [data-a=nf-color][data-v=orange]')
    u.click('[data-a=nf-fmt][data-v=doubles]'); u.wait_for_timeout(100)
    divs = u.locator('#sheet [data-a=nf-div]').all_inner_texts()
    check('doubles offers all five divisions', divs == ['Women', 'Women Pro', 'Men', 'Men Pro', 'Mixed'], divs)
    u.click('[data-a=nf-div][data-v=X]'); u.wait_for_timeout(100)
    check('mixed asks woman/man', u.locator('#sheet [data-a=nf-sex]').count() == 2)
    u.click('[data-a=create-person]'); u.wait_for_timeout(300)
    check('mixed without woman/man is refused', 'uuday' not in ids(dbof(u), 'profiles'))
    u.click('[data-a=nf-sex][data-v=W]'); u.wait_for_timeout(100)
    check('mixed doubles woman: 6 kg ball to 2.70 m', '6 kg to 2.70 m' in u.inner_text('#sheet'))
    u.screenshot(path=f'{OUT}/r6-setup-race.png', full_page=True)
    u.click('[data-a=create-person]'); u.wait_for_timeout(900)
    check('Uday is on his own profile', u.evaluate('S.pid') == 'uuday' and 'Uday' in u.inner_text('#topbar'))
    check('no Admin badge for Uday; v32: a member has Edit on the day too', 'Admin' not in u.inner_text('#topbar') and u.locator('[data-a=edit-plan]').count() >= 1)
    u.click('#topbar [data-a=who]'); u.wait_for_timeout(400)
    check('tapping his name opens Settings, not a person switcher', u.evaluate('S.route.view') == 'settings' and not u.is_visible('#sheet'))
    st = u.inner_text('#view')
    check('Settings: no restore, no member Edit, no Add member', 'Restore from backup' not in st and u.locator('[data-a=mem-edit]').count() == 0 and 'Add member' not in st)
    check('Settings members list shows both people', 'Vinay' in st and 'Uday' in st)
    u.screenshot(path=f'{OUT}/r3-uday-settings.png', full_page=True)
    ok = u.evaluate("put('logs','uadmin_2026-09-29',{pid:'uadmin',date:'2026-09-29',notes:'hack'})")
    check('app refuses Uday editing Vinay\'s log', ok is False)
    ok2 = u.evaluate("(() => { const o = clone(S.days['2026-09-28']); delete o._u; const ok = put('plan_days','2026-09-28', Object.assign(clone(o), {heading:'X'})); put('plan_days','2026-09-28', o); return ok; })()")
    check('v32: a member may change a day of the shared plan', ok2 is True)
    ok3 = u.evaluate("put('plan_weeks','w01', Object.assign(clone(S.weeks['w01']), {label:'X'}))")
    wk = u.evaluate("window.FBX.db.collection('plan_weeks').doc('w01').set({j:'{}'}).then(()=>'written', ()=>'refused')")
    check('...but not the weeks: the app and the database rules refuse', ok3 is False and wk == 'refused', (ok3, wk))
    refused = u.evaluate("window.FBX.db.collection('logs').doc('uadmin_2026-09-30').set({j:'{}'}).then(()=>'written', ()=>'refused')")
    check('database rules refuse it too (direct write)', refused == 'refused')
    u.evaluate("go({view:'today'})"); u.wait_for_timeout(300)
    u.locator('[data-a="set"]').first.click(); u.wait_for_timeout(1200)
    db = dbof(u)
    check('Uday can log his own sets', 'uuday_2026-09-28' in ids(db, 'logs'), ids(db, 'logs'))
    u.evaluate("go({view:'together'})"); u.wait_for_timeout(500)
    tg = u.inner_text('#view')
    check('Together shows both people to Uday', 'Vinay' in tg and 'Uday' in tg)
    u.evaluate("go({view:'progress', sub:'week', pv:'uadmin'})"); u.wait_for_timeout(500)
    check("Uday can view Vinay's progress", 'Something went wrong' not in u.inner_text('#view'))
    u.evaluate("go({view:'guide'})"); u.wait_for_timeout(400)
    gd = u.inner_text('#view')
    check('guide shows her race title', 'HYROX DOUBLES MIXED' in gd.upper())
    check('guide lists every format', all(x in gd for x in ['Singles', 'Doubles', 'Relay', 'Adaptive', 'Elite 15']))
    check('guide stations use her loads', '6 kg ball to a 2.70 m target' in gd and '152 kg including sled' in gd)
    check('guide marks her row in the weights table', u.locator('tr.cell-good >> text=Mixed doubles').count() == 1)
    check('no solo target column for doubles', not u.evaluate("[...document.querySelectorAll('th')].some(t => t.textContent.trim() === 'Target')"))
    u.screenshot(path=f'{OUT}/r7-guide-mixed.png', full_page=True)
    u.evaluate("go({view:'settings'})"); u.wait_for_timeout(300)
    u.click('[data-a=rc-fmt][data-v=relay]'); u.wait_for_timeout(700)
    rr = dec(dbof(u), 'profiles', 'uuday').get('race')
    check('switching to relay keeps mixed + woman', rr == {'fmt': 'relay', 'div': 'X', 'sex': 'W'}, rr)
    u.click('[data-a=rc-div][data-v=W]'); u.wait_for_timeout(700)
    check('relay women saved', dec(dbof(u), 'profiles', 'uuday').get('race') == {'fmt': 'relay', 'div': 'W'})
    check('members list shows the race', 'Relay Women' in u.inner_text('#view'))
    u.click('[data-a=rc-fmt][data-v=doubles]'); u.click('[data-a=rc-div][data-v=X]'); u.wait_for_timeout(700)
    u.evaluate("openSheet('race')"); u.wait_for_timeout(300)
    check('race-day mode explains doubles targets', 'share the work' in u.inner_text('#sheet'))
    u.evaluate("closeSheet()")
    for v in ['calendar', 'guide', 'settings']:
        u.evaluate(f"go({{view:'{v}'}})"); u.wait_for_timeout(300)
        check(f'{v} renders for member', 'Something went wrong' not in u.inner_text('#view'))
    check('no script errors for member', not u.errors, u.errors[:2])

    # 3. Uday on a second PC -> straight into his profile, no setup
    u2 = open_as(b, 'uday@test.com', db, vp=(1280, 860))
    check('second device goes straight to own profile', u2.evaluate('S.pid') == 'uuday' and not u2.is_visible('#sheet'))
    u2.screenshot(path=f'{OUT}/r4-uday-2nd-pc.png')

    # 4. Admin can open and edit Uday's log, then go back
    a2 = open_as(b, 'admin@test.com', db)
    a2.click('#topbar [data-a=who]'); a2.wait_for_timeout(300)
    names = a2.locator('#sheet [data-a=choose]').all_inner_texts()
    check('admin switcher lists members', any('Uday' in n for n in names), names)
    a2.click('#sheet [data-a=choose][data-v=uuday]'); a2.wait_for_timeout(400)
    check('admin sees "Editing Uday" + Back to me', 'Editing Uday' in a2.inner_text('#topbar') and 'Back to me' in a2.inner_text('#topbar'))
    a2.screenshot(path=f'{OUT}/r5-admin-editing-uday.png')
    a2.evaluate("editLog('2026-09-28', l => { l.notes = 'Coach note from Vinay'; })"); a2.wait_for_timeout(1200)
    db = dbof(a2)
    check("admin's edit to Uday's log is saved", dec(db, 'logs', 'uuday_2026-09-28').get('notes') == 'Coach note from Vinay')
    a2.click('#topbar [data-a=choose]'); a2.wait_for_timeout(300)
    check('Back to me returns to own profile', a2.evaluate('S.pid') == 'uadmin')
    a2.evaluate("put('plan_days','2026-09-30', Object.assign(clone(S.days['2026-09-30']), {heading:'ADMIN EDIT'}))"); a2.wait_for_timeout(900)
    check('admin can edit the plan', '2026-09-30' in ids(dbof(a2), 'plan_days'))
    check('no script errors for admin', not (a.errors + a2.errors), (a.errors + a2.errors)[:2])

    # 5. Profile made with the previous version is moved under the account automatically
    legacy = {'profiles': {'vinay-a0aa': {'j': json.dumps({'name': 'Vinay', 'color': 'blue', 'plan': 'B', 'uid': 'uadmin', 'created': '2026-09-25T1'})}},
              'logs': {'vinay-a0aa_2026-09-28': {'j': json.dumps({'pid': 'vinay-a0aa', 'date': '2026-09-28', 'notes': 'old note'})}}}
    m = open_as(b, 'admin@test.com', legacy); m.wait_for_timeout(1200)
    dbm = dbof(m)
    check('old profile moved to account id', 'uadmin' in ids(dbm, 'profiles'), ids(dbm, 'profiles'))
    check('existing profile without a race is asked once', m.is_visible('#sheet >> text=One new question') and m.input_value('#nf-name') == 'Vinay')
    m.click('[data-a=nf-fmt][data-v=singles]'); m.click('[data-a=nf-div][data-v=M]'); m.click('[data-a=create-person]'); m.wait_for_timeout(900)
    check('after answering, straight into the profile with plan kept', not m.is_visible('#sheet') and dec(dbof(m), 'profiles', 'uadmin').get('plan') == 'B')
    check('old log moved with it', dec(dbm, 'logs', 'uadmin_2026-09-28').get('notes') == 'old note' if 'uadmin_2026-09-28' in ids(dbm, 'logs') else False, ids(dbm, 'logs'))
    check('old copy hidden from members', m.evaluate('peopleIds()') == ['uadmin'], m.evaluate('peopleIds()'))

    # 6. Rules not published yet -> clear message
    l = open_as(b, 'uday@test.com', {}, locked=True)
    check('locked database shows the publish hint', "can't open this tracker yet" in l.inner_text('#gate'))

    # 7. Admin in config.js but missing from firestore.rules -> change dropped with a message, app keeps working
    x = open_as(b, 'uday@test.com', db, app_admins=('uday@test.com',), rule_admins=('admin@test.com',))
    x.evaluate("put('logs','uadmin_2026-10-01',{notes:'x'})"); x.wait_for_timeout(1500)
    check('refused admin write is dropped, app not locked', not x.is_visible('#gate') and x.evaluate('pending.size') == 0)
    b.close()

srv.shutdown()
print('\n%d/%d passed' % (sum(r[1] for r in res), len(res)))
