import json, os
from datetime import datetime, timezone
src = open('test/run_roles.py').read().split('with sync_playwright() as pw:')[0].replace('PORT = 8791', 'PORT = 8801')
exec(src)
NOW = datetime(2026, 9, 26, 14, 0, tzinfo=timezone.utc)  # Sat 26 Sep, 19:30 IST
P = lambda uid, name: {'j': json.dumps({'name': name, 'color': 'blue', 'plan': 'A', 'uid': uid, 'race': {'fmt': 'singles', 'div': 'M'}})}
seed = {'profiles': {'uadmin': P('uadmin', 'Vinay'), 'uuday': P('uuday', 'Uday')}}
BIG = 'test/photo-big.jpg'; SIZE = os.path.getsize(BIG)

def photos(p, lid):
    db = dbof(p); return json.loads(db['logs'][lid]['j']).get('photos', []) if lid in (db.get('logs') or {}) else []

with sync_playwright() as pw:
    b = pw.chromium.launch()
    a = open_as(b, 'admin@test.com', seed)
    check('Finish session has an Add photo tile', a.locator('#finish label.phtile.add').count() == 1)
    a.set_input_files('#finish input[data-in=photos]', BIG)
    try: a.wait_for_selector('.phtile.up', timeout=1500); seen = True
    except Exception: seen = False
    check('upload progress tile appears', seen)
    a.wait_for_timeout(2500)
    ph = photos(a, 'uadmin_2026-09-26')
    objs = a.evaluate('window.__OBJ')
    check('photo saved on the day', len(ph) == 1 and ph[0]['url'] and ph[0]['turl'], ph)
    orig = [k for k in objs if not k.endswith('_t.jpg')]
    check('original stored at full size (not compressed)', len(orig) == 1 and objs[orig[0]]['size'] == SIZE and ph[0]['w'] == 3000 and ph[0]['h'] == 2000, (objs, SIZE))
    check('small preview stored too', any(k.endswith('_t.jpg') and v['size'] < 200000 for k, v in objs.items()), objs)
    check('stored under your own folder', orig[0].startswith('photos/uadmin/2026-09-26_'))
    a.locator('#finish .phtile img').first.scroll_into_view_if_needed(); a.wait_for_timeout(600)  # previews load lazily; the Fuel card (v14) pushed Finish session below the fold
    check('tile shows the preview image', a.evaluate("(() => { const i = document.querySelector('#finish .phtile img'); return i && i.complete && i.naturalWidth > 0 && i.naturalWidth <= 480; })()"))
    a.screenshot(path=f'{OUT}/ph1-finish.png', full_page=True)
    a.click('#finish .phtile img'); a.wait_for_timeout(400)
    check('tapping opens the full-quality photo', a.evaluate("(() => { const i = document.querySelector('#sheet .phview img'); return i && i.naturalWidth === 3000; })()"))
    check('viewer has Open full size + Delete', a.is_visible('#sheet >> text=Open full size') and a.is_visible('#sheet [data-a=photo-del-ask]'))
    a.screenshot(path=f'{OUT}/ph2-viewer.png')
    a.click('#sheet [data-a=photo-del-ask]'); a.click('#sheet [data-a=photo-rm]'); a.wait_for_timeout(900)
    check('delete removes it from the day and from storage', photos(a, 'uadmin_2026-09-26') == [] and a.evaluate('Object.keys(window.__OBJ).length') == 0)
    a.set_input_files('#finish input[data-in=photos]', [BIG, BIG]); a.wait_for_timeout(5000)
    check('several photos at once', len(photos(a, 'uadmin_2026-09-26')) == 2)
    a.evaluate("go({view:'progress', sub:'journal'})"); a.wait_for_timeout(500)
    check('photos show in Progress → Journal', 'Photos ·' in a.inner_text('#view') and a.locator('.phstrip img').count() == 2)
    a.evaluate("document.querySelector('#finish input[data-in=photos]')")
    a.evaluate("go({view:'today'})"); a.wait_for_timeout(300)
    a.set_input_files('#finish input[data-in=photos]', 'test/too-big.jpg'); a.wait_for_timeout(500)
    check('photos over 25 MB are skipped with a message', 'over 25 MB' in a.inner_text('#toasts'))
    check('no script errors (admin)', not a.errors, a.errors[:2])
    db = dbof(a)

    u = open_as(b, 'uday@test.com', db)
    u.set_input_files('#finish input[data-in=photos]', BIG); u.wait_for_timeout(2500)
    check("Uday can add photos to his own day", len(photos(u, 'uuday_2026-09-26')) == 1)
    r = u.evaluate("FBX.storage.upload('photos/uadmin/x.jpg', new Blob(['x'], {type:'image/jpeg'}), 'image/jpeg').then(() => 'ok', e => e.code)")
    check("storage rules stop Uday writing into Vinay's photos", r == 'storage/unauthorized', r)
    db = dbof(u)

    a2 = open_as(b, 'admin@test.com', db)
    a2.evaluate("choosePerson('uuday')"); a2.wait_for_timeout(400)
    check("admin sees Uday's photo and can manage it", a2.locator('#finish .phtile:not(:has(.phwho)) img').count() == 1 and a2.locator('#finish label.phtile.add').count() == 1)

    n = open_as(b, 'admin@test.com', seed)
    n.evaluate('window.__NO_STORAGE = true')
    n.set_input_files('#finish input[data-in=photos]', BIG); n.wait_for_timeout(1500)
    check('clear message if photo storage is not set up yet', "isn't set up in Firebase yet" in n.inner_text('#toasts'))
    check('no script errors (others)', not (u.errors + a2.errors + n.errors), (u.errors + a2.errors + n.errors)[:2])
    b.close()
srv.shutdown()
print('\n%d/%d passed' % (sum(r[1] for r in res), len(res)))
