import json
from datetime import datetime, timezone
# v24: share card (story / square image of a finished day)
src = open('test/run_roles.py').read().split('with sync_playwright() as pw:')[0].replace('PORT = 8791', 'PORT = 8831')
exec(src)
P_ = lambda uid, name, color, **kw: {'j': json.dumps(dict({'name': name, 'color': color, 'plan': 'A', 'uid': uid, 'race': {'fmt': 'singles', 'div': 'M'}}, **kw))}
L = lambda d: {'j': json.dumps(d)}
def at(d): return datetime(int(d[:4]), int(d[5:7]), int(d[8:]), 2, 0, tzinfo=timezone.utc)
W = [(12, 0), (12, 45), (12, 65), (10, 55), (12, 14), (12, 12), (15, 20)]  # reps, kg for the 7 exercises on Mon 28 Sep
st = {str(i): {'s': [{'r': W[i][0], 'w': W[i][1], 'd': True}] * 3} for i in range(7)}
MON = {'pid': 'uadmin', 'date': '2026-09-28', 'status': 'complete', 'rpe': 6, 'time': 105, 'str': st, 'wu': {str(i): True for i in range(1, 11)},
       'runs': [{'type': 'easy', 'dist': 2.6, 'time': 1200, 'rpe': 4}], 'fuel': {'w': 2, 'p': 1}, 'notes': 'Felt good'}
SUN = {'pid': 'uadmin', 'date': '2026-09-27', 'rest': {'acts': ['walk', 'stretch'], 'min': 30}}
SAT = {'pid': 'uadmin', 'date': '2026-09-26', 'status': 'complete', 'rpe': 3, 'runs': [{'type': 'easy', 'dist': 6.25, 'time': 3537}]}
def seed(extra=None):
    logs = {'uadmin_2026-09-26': L(SAT), 'uadmin_2026-09-27': L(SUN), 'uadmin_2026-09-28': L(MON)}
    logs.update(extra or {})
    return {'profiles': {'uadmin': P_('uadmin', 'Vinay', 'blue', fuelFrom='2026-09-28'), 'uuday': P_('uuday', 'Uday', 'orange')}, 'logs': logs}
def ev(p, js): return p.evaluate(js)
def sd(p, d, o='{size:"story",look:"dark",score:"workout",ex:true,names:true}'): return ev(p, "JSON.parse(JSON.stringify(shareData('uadmin', '%s', %s)))" % (d, o))
def ready(p):
    for _ in range(40):
        if ev(p, "!!(SHARE && SHARE.file)"): return True
        p.wait_for_timeout(100)
    return False
def imgsize(p): return ev(p, "(() => { const i = document.getElementById('sh-img'); return i ? [i.naturalWidth, i.naturalHeight] : null; })()")
def overflow(p): return ev(p, 'document.documentElement.scrollWidth > window.innerWidth + 1 || (document.querySelector("#sheet .panel") && document.querySelector("#sheet .panel").scrollWidth > document.querySelector("#sheet .panel").clientWidth + 1)')

with sync_playwright() as pw:
    b = pw.chromium.launch()
    NOW = at('2026-09-28')
    a = open_as(b, 'admin@test.com', seed())
    check('finished day: Share button on the Completed bar', a.locator('.o2 .statusbar [data-a=share]').count() == 1 and 'Share' in a.inner_text('.o2 .statusbar'))
    ws = ev(a, "workoutScore('uadmin', '2026-09-28')"); full = ev(a, "dayScore('uadmin', '2026-09-28').score")
    check('workout score leaves out Fuel and is scaled to 100', ws['score'] > full and ws['full'] == full and ws['hasFuel'], (ws, full))
    parts = ev(a, "dayScore('uadmin', '2026-09-28').parts.filter(x => x.label !== 'Fuel')")
    check('...exactly the training points out of 100', ws['score'] == round(100 * sum(x['pts'] for x in parts) / sum(x['max'] for x in parts)), (ws, parts))
    a.click('.o2 .statusbar [data-a=share]'); a.wait_for_timeout(300)
    check('the Share sheet opens with a preview', a.is_visible('#sheet') and 'SHARE TODAY' in a.inner_text('#sheet .sheet-h').upper() and ready(a) and imgsize(a) == [1080, 1920], imgsize(a))
    t = a.inner_text('#sheet')
    check('sheet explains the workout score with both numbers', 'Workout score leaves out Fuel' in t and ('workout %d, full day %d' % (ws['score'], full)) in t, t[:400])
    d = sd(a, '2026-09-28')
    check('card: days to race, race date, name and date', d['days'] == 109 and d['raceLine'] == 'Fri 15 Jan 2027' and d['dateLine'] == 'Vinay · Mon 28 Sep', (d['days'], d['raceLine'], d['dateLine']))
    check('card: workout score and its word', d['score']['v'] == ws['score'] and d['score']['lab'] == 'Workout score' and d['score']['w'] == ws['label'])
    check('card: session title and pills', d['title'] == 'Back + Biceps + Easy Run' and [x['t'] for x in d['pills']] == ['✓ Completed', 'Week 1 · Day 3 of 112'], (d['title'], d['pills']))
    stt = [(x['big'], x['unit'], x['sub']) for x in d['stats']]
    plan = ev(a, "P('2026-09-28').strength.map(x => ({ n: x.name, u: x.unit || '', dual: !!x.dual, bw: !!x.bw }))")
    vol = sum(W[i][0] * W[i][1] * 3 * (2 if plan[i]['dual'] else 1) for i in range(7) if W[i][1] and plan[i]['u'] not in ('s', 'm', 'min'))
    check('card: sets, kg lifted, run with pace, minutes with RPE', stt == [('21', '/21', 'sets'), ('{:,}'.format(vol), 'kg', 'lifted'), ('2.6', 'km', 'run · 7:42/km'), ('105', 'min', 'effort RPE 6')], (stt, vol))
    ex = d['lists'][0]['rows']
    import re
    want = [[re.sub(r'\s*\(.*?\)', '', plan[i]['n']), '3 × %d%s%s' % (W[i][0], ' s' if plan[i]['u'] == 's' else ' m' if plan[i]['u'] == 'm' else '', ' · %d kg' % W[i][1] if W[i][1] else ' · BW' if plan[i]['bw'] else '')] for i in range(7)]
    check('card: what I did, in plan order, with the heaviest weight', d['lists'][0]['h'] == 'What I did' and ex == want, [(x, y) for x, y in zip(ex, want) if x != y])
    ev(a, "editLog('2026-09-28', l => { l.ord = [1, 0, 2, 3, 4, 5, 6]; })"); a.wait_for_timeout(300)
    check('...and in my own order after I move exercises', sd(a, '2026-09-28')['lists'][0]['rows'][0] == want[1])
    check('card: no week bars, no streak and no "Training with" line (v25)', 'week' not in d and 'foot' not in d and 'Uday' not in json.dumps(d) and 'streak' not in json.dumps(d), sorted(d.keys()))
    blank = ev(a, "(() => { const o = {size:'story',look:'dark',score:'workout',ex:false,names:true}; const c = drawShare(shareData('uadmin', '2026-09-28', o), o); const x = c.getContext('2d').getImageData(0, 1700, 1080, 200).data; let n = 0; for (let q = 0; q < x.length; q += 4) if (x[q] + x[q + 1] + x[q + 2] > 330) n++; return n; })()")
    check('...and nothing drawn at the bottom of the story where they were', blank == 0, blank)
    check('card never carries notes, weight or nutrition', 'Felt good' not in json.dumps(d) and 'Fuel' not in json.dumps(d) and 'kcal' not in json.dumps(d))
    # choices
    a.click('#sheet [data-a=sh-opt][data-k=size][data-v=square]'); a.wait_for_timeout(200); ready(a)
    check('Square: 1080 × 1080', imgsize(a) == [1080, 1080], imgsize(a))
    px = lambda look: ev(a, "(() => { const c = drawShare(shareData('uadmin', '2026-09-28', Object.assign({}, SHARE, {look: '%s'})), Object.assign({}, SHARE, {look: '%s'})); const x = c.getContext('2d').getImageData(1070, 1070, 1, 1).data; return x[0] + x[1] + x[2]; })()" % (look, look))
    check('Light and Dark looks', px('light') > 600 and px('dark') < 150, (px('light'), px('dark')))
    a.click('#sheet [data-a=sh-opt][data-k=score][data-v=day]'); a.wait_for_timeout(200)
    check('Full day score is the Today score', ev(a, "shareData('uadmin', '2026-09-28', SHARE).score.v") == full and ev(a, "shareData('uadmin', '2026-09-28', SHARE).score.lab") == 'Today’s score')
    a.click('#sheet [data-a=sh-opt][data-k=score][data-v=off]'); a.wait_for_timeout(200)
    check('Hide: no score on the card', ev(a, "shareData('uadmin', '2026-09-28', SHARE).score") is None)
    a.click('#sheet [data-a=sh-opt][data-k=names]'); a.wait_for_timeout(200)
    dn = ev(a, "shareData('uadmin', '2026-09-28', SHARE)")
    check('My name off: just the date', dn['dateLine'] == 'Mon 28 Sep' and 'Vinay' not in json.dumps(dn), dn['dateLine'])
    a.click('#sheet [data-a=sh-opt][data-k=ex]'); a.wait_for_timeout(200)
    check('Exercises off: no list', not ev(a, "shareData('uadmin', '2026-09-28', SHARE).lists.length"))
    check('choices remembered on this phone', ev(a, "LS.get('hx.share')") == {'size': 'square', 'look': 'dark', 'score': 'off', 'ex': False, 'names': False}, ev(a, "LS.get('hx.share')"))
    a.click('#sheet [data-a=close]'); a.wait_for_timeout(200)
    a.click('.o2 .statusbar [data-a=share]'); a.wait_for_timeout(300); ready(a)
    check('...and used next time', imgsize(a) == [1080, 1080] and a.locator('#sheet [data-a=sh-opt][data-k=score][data-v=off][aria-pressed=true]').count() == 1)
    for k, v in (('size', 'story'), ('score', 'workout'), ('names', None), ('ex', None)):
        a.click('#sheet [data-a=sh-opt][data-k=%s]%s' % (k, '[data-v=%s]' % v if v else '')); a.wait_for_timeout(150)
    ready(a)
    # sharing: the phone's share menu gets a PNG file straight from the tap
    ev(a, "window.__shared = null; navigator.canShare = () => true; navigator.share = d => { window.__shared = { n: d.files.length, name: d.files[0].name, type: d.files[0].type, size: d.files[0].size }; return Promise.resolve(); }; true")
    a.click('#sheet [data-a=sh-share]'); a.wait_for_timeout(300)
    sh = ev(a, "window.__shared")
    check('Share… hands the phone one PNG image', sh and sh['n'] == 1 and sh['type'] == 'image/png' and sh['name'] == 'hyrox-2026-09-28-story.png' and sh['size'] > 50000, sh)
    with a.expect_download() as dl:
        a.click('#sheet [data-a=sh-save]')
    check('Download image saves the PNG', dl.value.suggested_filename == 'hyrox-2026-09-28-story.png')
    a.screenshot(path=f'{OUT}/s1-share-sheet.png')
    for w in (390, 320):
        a.set_viewport_size({'width': w, 'height': 800}); a.wait_for_timeout(200)
        check('%d px: the share sheet has no sideways scroll' % w, not overflow(a))
    a.set_viewport_size({'width': 390, 'height': 844})
    for look, size in (('dark', 'story'), ('light', 'story'), ('dark', 'square')):
        ev(a, "(() => { const o = Object.assign({}, SHARE, {look: '%s', size: '%s'}); window.__png = drawShare(shareData('uadmin', '2026-09-28', o), o).toDataURL('image/png'); })()" % (look, size))
        import base64
        open(f'{OUT}/s-{look}-{size}-mon.png', 'wb').write(base64.b64decode(ev(a, "window.__png").split(',')[1]))
    a.click('#sheet [data-a=close]'); a.wait_for_timeout(200)
    # rest day: share once something is ticked
    a.evaluate("go({view:'day', date:'2026-09-27'})"); a.wait_for_timeout(300)
    check('rest day with a walk ticked: Share on the card', a.locator('#view .restgrid [data-a=share]').count() == 1)
    r = sd(a, '2026-09-27')
    check('rest-day card: Rest day, recovered, minutes and what I did', r['title'] == 'Rest day' and r['pills'][0]['t'] == '✓ Recovered' and r['stats'][0]['big'] == '30' and r['lists'][0]['rows'] == [['Walk', ''], ['Stretching', '']], (r['title'], r['pills'], r['stats'], r['lists']))
    check('no page errors (strength and rest day)', not a.errors, a.errors[:2])
    a.context.close()

    # HYROX / test day: tests with results against target, stations
    NOW = at('2026-09-29')
    TUE = {'pid': 'uadmin', 'date': '2026-09-29', 'status': 'complete', 'rpe': 7, 'time': 75, 'runs': [{'type': 'tt', 'dist': 1, 'time': 324}, {'type': 'easy', 'dist': 2}],
           'hx': {'0': {'d': True, 'sd': 3, 'amt': 15, 'load': 6}, '1': {'d': True, 'amt': 18, 'load': 6}, '2': {'d': True, 'sd': 4}, '3': {'d': True, 'sd': 2}, '4': {'d': True, 'sd': 3}}}
    s2 = seed({'uadmin_2026-09-29': L(TUE)}); s2['bench'] = {'uadmin': {'j': json.dumps({'results': {'tt1k': {'v': '5:24', 'date': '2026-09-29'}, 'wbmax': {'v': '18', 'date': '2026-09-29'}}})}}
    a = open_as(b, 'admin@test.com', s2)
    h = sd(a, '2026-09-29')
    check('test day: title, tests pill', h['title'] == 'Benchmark day' and [x['t'] for x in h['pills']] == ['✓ Completed', '2 tests', 'Week 1 · Day 4 of 112'], (h['title'], h['pills']))
    check('test day: tests with results, green when on target', h['lists'][0]['h'] == 'Tests' and h['lists'][0]['rows'] == [['1 km time trial', '5:24', 'good', 'target 5:10–5:50 expected'], ['Wall balls, max unbroken', '18 reps', 'good', 'target 15+ reps']], h['lists'][0])
    check('test day: stations (the test row is not repeated)', [x[0] for x in h['lists'][1]['rows']] == ['Wall balls', 'Sled push', 'Sandbag lunges', 'Burpee broad jumps'], h['lists'][1])
    check('test day: 3.0 km and 75 min', [(x['big'], x['unit']) for x in h['stats']] == [('3.0', 'km'), ('75', 'min')], h['stats'])
    a.click('.o2 .statusbar [data-a=share]'); a.wait_for_timeout(300); ready(a)
    import base64
    for look in ('dark', 'light'):
        ev(a, "(() => { const o = Object.assign({}, SHARE, {look: '%s', size: 'story'}); window.__png = drawShare(shareData('uadmin', '2026-09-29', o), o).toDataURL('image/png'); })()" % look)
        open(f'{OUT}/s-{look}-story-tue.png', 'wb').write(base64.b64decode(ev(a, "window.__png").split(',')[1]))
    check('no page errors (test day)', not a.errors, a.errors[:2])
    b.close()
srv.shutdown()
print('\n%d/%d passed' % (sum(r[1] for r in res), len(res)))
