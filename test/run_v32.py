import json
from datetime import datetime, timezone
# v32: brought over from GymFloorCoach, fitted to the one shared plan (only what changed).
#  - any member changes the shared plan's days: Add exercise (the picker with muscle filters and your own exercises,
#    no duplicates, holds in seconds), + / − sets on every later day, Edit exercises (never moving somebody else's
#    logged sets), move a session, catch up a missed one, Change exercises from today on
#  - last time's weights; Accessory & core edited like the cooldown; no strike-through on ticked items
#  - body check-ins, InBody import, tape history, Nutrition calories from the InBody BMR (everyone can see them)
#  - training together: partner reps and weights in gym mode; only what you changed goes across
#  - muscles worked from the exercise library; dropdowns stay open
src = open('test/run_roles.py').read().split('with sync_playwright() as pw:')[0].replace('PORT = 8791', 'PORT = 8841')
exec(src)
D = '2026-09-28'  # Mon 28 Sep 2026: Back + Biceps (deadlift, pull-up, lat pulldown, V-bar row, farmers hold, barbell curl, hammer curl); accessory = Face pull
P_ = lambda uid, name, color, c, **x: {'j': json.dumps(dict({'name': name, 'color': color, 'plan': 'A', 'uid': uid, 'race': {'fmt': 'singles', 'div': 'M'}, 'created': c}, **x))}
L = lambda d: {'j': json.dumps(d)}
ADM = ('boss@test.com',)
def phone(email, db): return open_as(b, email, db, app_admins=ADM, rule_admins=ADM)
def sheet(p): return p.inner_text('#sheet') if p.is_visible('#sheet') else ''
def toast(p): return p.inner_text('#toasts')
def typ(p, sel, v): p.fill(sel, v); p.dispatch_event(sel, 'input')
def lg(p, pid, d=D): return p.evaluate("JSON.parse(JSON.stringify(S.logs['%s_%s'] || {}))" % (pid, d))
def day(p, d): p.evaluate("go({view:'day', date:'%s'})" % d); p.wait_for_timeout(400)
def items(p, d): return p.evaluate("ptItems(S.days['%s'])" % d)
def names(p, d): return p.evaluate("ptItems(S.days['%s']).map(ptName)" % d)
def acc_txt(p, d): return p.evaluate("((S.days['%s'].fields || []).find(f => f.label === 'ACCESSORY/CORE') || {}).text || ''" % d)
def view_of(p, d, pid): return p.evaluate("(() => { const v = listView('%s', '%s', 'acc'); return { rows: v.rows.filter(r => r.k !== 'h').map(r => r.t), adds: v.adds.map(a => a.t), removed: v.removed.map(r => r.t), n: v.n, done: v.done }; })()" % (pid, d))
def dayof(p, d): return p.evaluate("(() => { const x = S.days['%s']; return { kind: x.kind, heading: x.heading, moved: x.moved || '', caught: x.caught || '', caughtTo: x.caughtTo || '', week: x.week, dow: x.dow, date: x.date }; })()" % d)
def same_as_builtin(p, d): return p.evaluate("canon(S.days['%s']) === canon(DEFAULTS.plan_days['%s'])" % (d, d))
def pick(p, name): typ(p, '#pk-q', name); p.wait_for_timeout(150); p.click('#pk-list [data-a=pk-tog][data-v="%s"]' % name)
def prow(p, name): return p.locator('#pk-list .pk-row', has=p.locator('b:text-is("%s")' % name))
def settle(p, ms=1300): p.wait_for_timeout(ms)
ACC = '#view section[data-fold=acc]'; STR = '#view section[data-fold=str]'
sets = lambda w, r, n: [{'w': w, 'r': r, 'd': True} for _ in range(n)]
PEOPLE = {'uvinay': P_('uvinay', 'Vinay', 'blue', '1', nut={'kg': 72, 'cm': 175, 'by': 1994, 'sex': 'm'}), 'uuday': P_('uuday', 'Uday', 'orange', '2')}
SEED = {'profiles': PEOPLE,
        'logs': {'uvinay_2026-09-21': L({'pid': 'uvinay', 'date': '2026-09-21', 'status': 'complete', 'str': {'0': {'n': 'Hammer curl', 's': sets(15, 12, 2)}, '1': {'n': 'Goblet squat', 's': [{'w': 20, 'r': 10, 'd': True}, {'w': 22.5, 'r': 10, 'd': True}]}}})},
        'body': {'uuday': L({'checks': [{'date': '2026-09-20', 'kg': 80, 'fat': 22, 't': 1}]})}}
# a made-up InBody export in the app's format (not anyone's real data)
HEAD = 'Date,Measurement device.,Weight(kg),Skeletal Muscle Mass(kg),Soft Lean Mass(kg),Body Fat Mass(kg),BMI(kg/m²),Percent Body Fat(%),Basal Metabolic Rate(kcal),InBody Score,Right Arm Lean Mass(kg),Left Arm Lean Mass(kg),Trunk Lean Mass(kg),Right Leg Lean Mass(kg),Left leg Lean Mass(kg),Right Arm Fat Mass(kg),Left Arm Fat Mass(kg),Trunk Fat Mass(kg),Right Leg Fat Mass(kg),Left Leg Fat Mass(kg),Right Arm ECW Ratio,Left Arm ECW Ratio,Trunk ECW Ratio,Right Leg ECW Ratio,Left Leg ECW Ratio,Waist Hip Ratio,Waist Circumference(cm),Visceral Fat Area(cm²),Visceral Fat Level(Level),Total Body Water(L),Intracellular Water(L),Extracellular Water(L),ECW Ratio,Upper-Lower,Upper,Lower,Leg Muscle Level(Level),Leg Lean Mass(kg),Protein(kg),Mineral(kg),Bone Mineral Content(kg),Body Cell Mass(kg),SMI(kg/m²),Whole Body Phase Angle(°)'
ROWS = ['20260920081500,270,71.8,33.9,-,13.6,22.9,18.9,1610,76,3.40,3.38,27.0,9.10,9.05,0.8,0.8,7.1,2.4,2.4,-,-,-,-,-,0.88,-,-,5,42.6,-,-,-,0,0,0,-,-,11.6,3.71,-,-,8.4,-',
        '20260725090000,270,72.6,33.1,-,15.2,23.2,20.9,1592,73,3.31,3.30,26.6,8.95,8.92,0.9,0.9,7.9,2.7,2.7,-,-,-,-,-,0.90,-,-,6,41.9,-,-,-,0,0,0,-,-,11.4,3.65,-,-,8.2,-']
CSV = '﻿' + HEAD + '\r\n' + '\r\n'.join(ROWS) + '\r\n'

with sync_playwright() as pw:
    b = pw.chromium.launch()
    NOW = datetime(2026, 9, 28, 2, 0, tzinfo=timezone.utc)  # Mon 28 Sep, 07:30 IST
    v = phone('vinay@test.com', SEED); v.wait_for_timeout(500)

    # ================= the picker, no duplicates, holds, move instead of duplicate
    check('a member sees Add exercise and Edit exercises on Main strength, and Edit in the day header', v.locator(STR + ' [data-a=pk-day]').count() == 1 and v.locator(STR + ' [data-a=edit-plan]').count() == 1 and v.locator('.hero [data-a=edit-plan]').count() == 1)
    v.click(STR + ' [data-a=pk-day]'); v.wait_for_timeout(300)
    s = sheet(v)
    check('Add exercise opens the picker: search, 13 filters (All, 11 muscle groups, My exercises)', 'ADD EXERCISES' in s.upper() and v.locator('#sheet [data-a=pk-grp]').count() == 13 and v.locator('#pk-q').count() == 1, s[:120])
    v.click('#sheet [data-a=pk-grp][data-v=hams]'); v.wait_for_timeout(200)
    nm = v.eval_on_selector_all('#pk-list .pk-row b', 'bs => bs.map(b => b.textContent)')
    check('Hamstrings filter: leg curls and Romanian deadlift, no bench press', 'Lying leg curl' in nm and 'Romanian deadlift' in nm and 'Barbell bench press' not in nm, nm[:8])
    r0 = prow(v, 'Barbell deadlift')
    check('...the session’s own exercise is greyed out: “Already in this session”', r0.count() == 1 and r0.is_disabled() and 'Already in this session' in r0.inner_text(), r0.inner_text() if r0.count() else '')
    v.click('#sheet [data-a=pk-grp][data-v=""]'); v.wait_for_timeout(200)
    typ(v, '#pk-q', 'face pull'); v.wait_for_timeout(150)
    check('...Face pull (in Accessory & core) says it moves to Main strength', 'In Accessory & core. Adding it here moves it to Main strength.' in prow(v, 'Face pull').inner_text() and not prow(v, 'Face pull').is_disabled(), prow(v, 'Face pull').inner_text())
    v.click('#pk-list [data-a=pk-tog][data-v="Face pull"]'); pick(v, 'Plank'); pick(v, 'Goblet squat')
    typ(v, '#pk-q', 'Sandbag hug walk'); v.wait_for_timeout(150)
    check('not in the list: “Add to your own exercises”, pick its muscle group', 'Not in the list?' in sheet(v) and v.locator('#sheet [data-a=pk-new]').is_disabled())
    v.click('#sheet [data-a=pk-ng][data-v=core]'); v.click('#sheet [data-a=pk-new]'); v.wait_for_timeout(300)
    check('...it is in My exercises and ticked', v.evaluate("gymMyEx()") == [{'n': 'Sandbag hug walk', 'g': 'core'}] and 'Add 4 exercises' in v.inner_text('#pk-done'), v.evaluate("gymMyEx()"))
    v.click('#pk-done'); settle(v, 900)
    it = items(v, D)
    check('added to the day: 3 × 10, holds 3 × 30 s', it[-4:] == ['Face pull — 3 × 10 — 90 s', 'Plank — 3 × 30 s — 90 s', 'Goblet squat — 3 × 10 — 90 s', 'Sandbag hug walk — 3 × 10 — 90 s'] and len(it) == 11, it[-4:])
    check('...the toast: for everyone, holds in seconds, Face pull moved', 'for everyone' in toast(v) and 'holds: 3 × 30 seconds' in toast(v) and 'Face pull moved here from Accessory & core' in toast(v), toast(v)[-220:])
    db = dbof(v)
    check('...saved as a change to the shared plan (plan_days), and the own exercise in myex', D in ids(db, 'plan_days') and dec(db, 'myex', 'uvinay') and dec(db, 'myex', 'uvinay')['list'][0]['n'] == 'Sandbag hug walk', (ids(db, 'plan_days'), ids(db, 'myex')))
    check('...Face pull shows once: Main strength only (the plan’s accessory line is untouched)', view_of(v, D, 'uvinay')['n'] == 0 and 'Face pull' in acc_txt(v, D) and 'Nothing planned' in v.inner_text(ACC), view_of(v, D, 'uvinay'))
    ex = v.evaluate("P('%s').strength.slice(-3).map(e => [e.name, e.sets, e.reps, e.unit])" % D)
    check('...Plank is read as 3 sets of 30 seconds', ex[0] == ['Plank', 3, 30, 's'], ex)
    mus = v.inner_text('#view section[data-fold=mus]')
    check('muscles worked: your own exercise counts by its group (Abs); Face pull and the rear-delt fly are shoulders (the fly was chest before)', 'Abs' in mus and 'delts' in v.evaluate("gymMusclesOf('Face pull')[0]") and v.evaluate("gymMusclesOf('Rear-delt cable fly')[0]") == ['delts'] and v.evaluate("gymMusclesOf('Sandbag hug walk')[0]") == ['abs'], (mus[:160], v.evaluate("[gymMusclesOf('Face pull'), gymMusclesOf('Rear-delt cable fly'), gymMusclesOf('Sandbag hug walk')]")))

    # ================= last time's weights
    t = v.inner_text('#ex-6')
    check('last time’s weights under the exercise (Hammer curl, Mon 21 Sep: 15 · 15 kg)', 'Last time, Mon 21 Sep: 15 · 15 kg' in t, t[:160])
    check('...the plan’s weight stays in the box when the plan gives one', v.input_value('#w-6-0') == '15' and v.locator('#w-6-0.lw').count() == 0)
    check('...no planned weight (Goblet squat, just added): last time’s weights fill the boxes in grey, set by set', v.input_value('#w-9-0') == '20' and v.input_value('#w-9-1') == '22.5' and v.input_value('#w-9-2') == '22.5' and v.locator('#w-9-0.lw').count() == 1, [v.input_value('#w-9-%d' % k) for k in range(3)])
    v.click(STR + ' [data-a=set][data-ex="9"][data-set="0"]'); settle(v, 600)
    x = lg(v, 'uvinay')['str']['9']['s'][0]
    check('...ticking the set saves that weight, and it is no longer grey', x.get('w') == 20 and x.get('d') is True and v.locator('#w-9-0.lw').count() == 0, x)

    # ================= + / − sets: this day and every later day that has it
    dl = v.evaluate("S.order.filter(d => d >= '%s' && ptItems(S.days[d]).some(it => normEx(ptName(it)) === normEx('Barbell deadlift')))" % D)
    check('+ / − under each exercise', v.locator('#ex-0 .setpm [data-a=set-pm]').count() == 2 and '3 sets' in v.inner_text('#ex-0 .setpm'))
    v.click('#ex-0 [data-a=set-pm][data-v="1"]'); settle(v, 700)
    n4 = v.evaluate("%s.filter(d => /— 4 ×/.test(ptItems(S.days[d]).find(it => normEx(ptName(it)) === normEx('Barbell deadlift'))))" % json.dumps(dl))
    check('+ on Barbell deadlift: 4 sets today and on every later day that has it (%d days)' % len(dl), len(dl) >= 6 and n4 == dl and v.evaluate("P('%s').strength[0].sets" % D) == 4 and 'for everyone' in toast(v) and 'days that have it' in toast(v), (len(dl), len(n4), toast(v)[-120:]))
    check('...the rest of the line stays (reps, weight, rest)', items(v, D)[0] == 'Barbell deadlift — 4 × 10 — 55 kg, RPE 6–7 — 2 min', items(v, D)[0])
    v.click(STR + ' [data-a=set][data-ex="0"][data-set="3"]'); settle(v, 500)
    v.click('#ex-0 [data-a=set-pm][data-v="-1"]'); settle(v, 500)
    check('− while the last set is ticked: “Untick set 4 first”', 'Untick set 4 first' in toast(v) and v.evaluate("P('%s').strength[0].sets" % D) == 4, toast(v)[-60:])
    v.click(STR + ' [data-a=set][data-ex="0"][data-set="3"]'); settle(v, 500)
    v.click('#ex-0 [data-a=set-pm][data-v="-1"]'); settle(v, 700)
    check('unticked, − works: back to 3 sets on all those days', v.evaluate("P('%s').strength[0].sets" % D) == 3 and v.evaluate("%s.every(d => /— 3 ×/.test(ptItems(S.days[d]).find(it => normEx(ptName(it)) === normEx('Barbell deadlift'))))" % json.dumps(dl)))
    v.evaluate("stopRest(); openMode('gym', 'set')"); v.wait_for_timeout(500)
    check('gym mode: − and + next to the set buttons', v.locator('#mode .md-pm').count() == 2, (v.evaluate('MODE && MODE.view'), v.inner_text('#mode')[:120]))
    v.evaluate("closeMode()"); v.wait_for_timeout(300)

    # ================= the day editor for a member
    v.click(STR + ' [data-a=edit-plan] >> nth=-1'); v.wait_for_timeout(400)
    v.click('#sheet [data-a=ed-pick][data-g=ex]'); v.wait_for_timeout(300)
    check('editor → Add exercise: the picker, with the day’s own greyed out', prow(v, 'Goblet squat').first.is_disabled() if (typ(v, '#pk-q', 'goblet') or True) and v.wait_for_timeout(150) is None else False)
    v.click('[data-a=pk-cancel]'); v.wait_for_timeout(300)
    typ(v, '#ed-ex-1-name', 'barbell deadlift'); v.wait_for_timeout(100)
    v.click('#sheet [data-a=editor-save]'); v.wait_for_timeout(400)
    check('typing a name that is already there: Save is refused', 'is there twice' in toast(v) and v.is_visible('#sheet'), toast(v)[-100:])
    v.evaluate("closeSheet()"); v.wait_for_timeout(200)

    # ================= Accessory & core like the cooldown
    day(v, '2026-09-30')  # Wed: Chest + Shoulders + Triceps; accessory = Push-ups
    t = v.inner_text(ACC)
    check('Accessory & core: the line under the title, Edit, no add box outside Edit', 'Core and finishers. Tick when done; no weights.' in t and v.locator(ACC + ' .lefoot [data-a=le-edit]').count() == 1 and v.locator('#xl-in-acc').count() == 0, t[:200])
    v.click(ACC + ' [data-a=le-edit]'); v.wait_for_timeout(300)
    check('Edit: Just this day / Every day, × on the item, Pick from the exercise list, a box to type your own', v.locator(ACC + ' [data-a=le-scope]').count() == 2 and v.locator(ACC + ' [data-a=le-rm]').count() == 1 and v.locator(ACC + ' [data-a=pk-acc]').count() == 1 and v.locator('#xl-in-acc').count() == 1)
    v.click(ACC + ' [data-a=le-scope][data-v=every]'); v.wait_for_timeout(200)
    v.click(ACC + ' [data-a=le-rm][data-k=plan]'); settle(v, 600)
    rm = ((v.evaluate("S.profiles.uvinay.lists") or {}).get('acc') or {}).get('rm') or []
    later = v.evaluate("S.order.filter(d => d > '2026-09-30' && P(d).acc.some(t => accLabel(t) === 'Push-ups'))")
    check('× (every day): kept by the exercise’s name; out of every later day whatever its sets', len(rm) == 1 and rm[0]['t'] == 'Push-ups' and len(later) >= 3 and v.evaluate("%s.every(d => !listView('uvinay', d, 'acc').rows.some(r => r.k !== 'h' && accLabel(r.t) === 'Push-ups'))" % json.dumps(later)), (rm, later[:3], view_of(v, later[0], 'uvinay')))
    v.click(ACC + ' [data-a=pk-acc]'); v.wait_for_timeout(300)
    typ(v, '#pk-q', 'bench press'); v.wait_for_timeout(150)
    check('the accessory picker greys out what Main strength has', v.locator('#pk-list .pk-have').count() >= 1 and 'Already in Main strength' in v.inner_text('#pk-list'), v.inner_text('#pk-list')[:120])
    pick(v, 'Dead bug'); pick(v, 'Hollow hold'); v.click('#pk-done'); settle(v, 600)
    add = ((v.evaluate("S.profiles.uvinay.lists") or {}).get('acc') or {}).get('add') or []
    check('Every day + pick: Dead bug 3 × 10 and Hollow hold 3 × 30 s on every later strength day', [x['t'] for x in add] == ['Dead bug — 3 × 10', 'Hollow hold — 3 × 30 s'] and view_of(v, '2026-10-01', 'uvinay')['adds'] == ['Dead bug — 3 × 10', 'Hollow hold — 3 × 30 s'] and view_of(v, '2026-10-03', 'uvinay')['adds'] == [], add)
    v.fill('#xl-in-acc', 'Dead bug 3 x 12'); v.click('[data-a=xl-add][data-g=acc]'); v.wait_for_timeout(400)
    check('typing one that is already there: “Already in Accessory & core”', 'Already in Accessory & core' in toast(v), toast(v)[-60:])
    v.click(ACC + ' [data-a=le-edit] >> nth=0'); v.wait_for_timeout(300)
    v.click(ACC + ' [data-a=le-chk] >> nth=0'); settle(v, 500)
    check('a ticked item shows its tick only: no strike-through', v.evaluate("getComputedStyle(document.querySelector('#view section[data-fold=acc] .check[aria-pressed=true] .lbl')).textDecorationLine") == 'none')
    check('...Uday’s Accessory & core is his own: the plan’s Push-ups, none of Vinay’s additions', view_of(v, '2026-09-30', 'uuday')['rows'] == ['Push-ups — 2 × 12, chest to floor (burpee prep)'] and view_of(v, '2026-09-30', 'uuday')['adds'] == [], view_of(v, '2026-09-30', 'uuday'))

    # ================= move a session
    check('the week: Wed, Thu, Sat and Sun can move; test days (Tue, Fri) and today (already logged) cannot', v.evaluate("['2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02','2026-10-03','2026-10-04'].map(d => gymMovable(d))") == [False, False, True, True, False, True, True], v.evaluate("['2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02','2026-10-03','2026-10-04'].map(d => gymMovable(d))"))
    day(v, '2026-10-01')  # Thu: Legs
    check('Thu (Legs): Move in the header', v.locator('.hero [data-a=gym-move]').count() == 1)
    v.click('.hero [data-a=gym-move]'); v.wait_for_timeout(300)
    opts = v.eval_on_selector_all('#sheet [data-a=gym-move-to]', 'bs => bs.map(b => b.dataset.v)')
    check('...the days it can swap with: Wed, Sat (rest) and Sun (long run); “The plan changes for everyone”', opts == ['2026-09-30', '2026-10-03', '2026-10-04'] and 'The plan changes for everyone' in sheet(v), opts)
    v.click('#sheet [data-a=gym-move-to][data-v="2026-10-03"]'); settle(v, 700)
    a, c = dayof(v, '2026-10-01'), dayof(v, '2026-10-03')
    check('swapped: Legs is on Sat, Thu is a rest day; each keeps its own date and week', c['heading'] == 'Legs' and c['kind'] == 'legs' and c['moved'] == '2026-10-01' and c['date'] == '2026-10-03' and c['dow'] == 'Sat' and a['kind'] == 'rest' and a['moved'] == '2026-10-03' and a['dow'] == 'Thu', (a, c))
    check('...both days are saved in the shared plan', all(d in ids(dbof(v), 'plan_days') for d in ['2026-10-01', '2026-10-03']), ids(dbof(v), 'plan_days'))
    day(v, '2026-10-03')
    check('Sat shows “Moved here from Thursday…” and Move back', 'Moved here from' in v.inner_text('.hero') and v.locator('.hero [data-a=gym-move-back]').count() == 1, v.inner_text('.hero')[:160])
    v.click('.hero [data-a=gym-move-back]'); settle(v, 700)
    check('Move back: both days are exactly the built-in plan again', same_as_builtin(v, '2026-10-01') and same_as_builtin(v, '2026-10-03'), (dayof(v, '2026-10-01'), dayof(v, '2026-10-03')))
    day(v, '2026-10-03')
    check('a rest day: “Train today instead”', v.locator('.restday [data-a=gym-move]').count() == 1)

    # ================= Change exercises (from today on)
    v.evaluate("go({view:'settings'})"); v.wait_for_timeout(400)
    check('Settings → Plan: “Change exercises”; the text says members change the plan for everyone', v.locator('#view [data-a=gym-swap]').count() == 1 and 'Every change is for everyone' in v.inner_text('#view'))
    v.click('#view [data-a=gym-swap]'); v.wait_for_timeout(400)
    s = sheet(v)
    check('the sheet lists the plan’s exercises with how many days they are on', 'Hammer curl' in s and 'days, next' in s and 'The plan changes for everyone' in s, s[:200])
    hc = v.evaluate("S.order.filter(d => d >= '%s' && names0(d).includes('Hammer curl'))".replace('names0(d)', "ptItems(S.days[d]).map(ptName)") % D)
    v.click('#sheet [data-a=gsw-pick][data-n="Hammer curl"]'); v.wait_for_timeout(300)
    typ(v, '#pk-q', 'barbell curl'); v.wait_for_timeout(150)
    check('Pick: an exercise the same days already have is greyed out', prow(v, 'Barbell curl').is_disabled() and 'Already on' in prow(v, 'Barbell curl').inner_text(), prow(v, 'Barbell curl').inner_text())
    typ(v, '#pk-q', 'zottman'); v.wait_for_timeout(150)
    has_z = v.locator('#pk-list [data-a=pk-tog][data-v="Zottman curl"]').count() == 1
    if has_z: v.click('#pk-list [data-a=pk-tog][data-v="Zottman curl"]'); v.wait_for_timeout(300)
    else:
        v.click('[data-a=pk-cancel]'); v.wait_for_timeout(300)
        sel = v.evaluate("'#' + [...document.querySelectorAll('#sheet [data-in=gsw]')].find(x => x.dataset.n === 'Hammer curl').id"); typ(v, sel, 'Zottman curl')
    sel = v.evaluate("'#' + [...document.querySelectorAll('#sheet [data-in=gsw]')].find(x => x.dataset.n === 'Barbell curl').id")
    typ(v, sel, 'Zottman curl'); v.wait_for_timeout(100)
    v.click('#sheet [data-a=gsw-save]'); v.wait_for_timeout(500)
    check('two exercises of one day changed to the same name: Save is refused', 'is there twice' in toast(v) and v.is_visible('#sheet') and 'Hammer curl' in names(v, D), toast(v)[-110:])
    typ(v, sel, ''); v.wait_for_timeout(100)
    v.click('#sheet [data-a=gsw-rm][data-n="Farmers hold"]'); v.wait_for_timeout(200)
    check('Remove marks it “Removed” with Put back', 'Removed' in sheet(v) and 'Put back' in sheet(v))
    v.click('#sheet [data-a=gsw-save]'); settle(v, 900)
    fut = [d for d in hc if d != D]
    check('saved: today is already logged, so it stays as it was', 'Hammer curl' in names(v, D) and 'Farmers hold' in names(v, D) and 'already logged' in toast(v) and 'for everyone' in toast(v), (names(v, D), toast(v)[-160:]))
    check('...every later day has Zottman curl instead of Hammer curl, with its sets and rest but no old weight', len(fut) >= 4 and all('Hammer curl' not in names(v, d) and any(x.startswith('Zottman curl — ') and '×' in x and 'kg' not in x and 'RPE' not in x for x in items(v, d)) for d in fut), (fut[:3], [x for x in items(v, fut[0]) if 'curl' in x.lower()]))
    check('...and Farmers hold is gone from every later day', v.evaluate("S.order.filter(d => d > '%s' && ptItems(S.days[d]).map(ptName).includes('Farmers hold')).length" % D) == 0)

    # ================= body check-ins, InBody, tape, Nutrition (everyone can see them)
    v.evaluate("go({view:'progress', sub:'body'})"); v.wait_for_timeout(500)
    t = v.inner_text('#body-comp')
    check('Progress → Body: Body composition with Add check-in and Import InBody file; “Everyone in the tracker can see this”', v.locator('#body-comp [data-a=body-new]').count() == 1 and v.locator('#body-comp [data-a=ib-pick]').count() == 1 and 'Everyone in the tracker can see this' in t, t[:200])
    v.click('#body-comp [data-a=body-new]'); v.wait_for_timeout(300)
    typ(v, '#bf-kg', '72.4'); typ(v, '#bf-fat', '18.5'); typ(v, '#bf-muscle', '33'); typ(v, '#bf-waist', '84'); typ(v, '#bf-neck', '38'); v.wait_for_timeout(150)
    check('the form works it out while typing (BMI, fat kg, lean mass)', 'BMI' in v.inner_text('#bf-calc') and '13.4 kg' in v.inner_text('#bf-calc') and 'lean mass' in v.inner_text('#bf-calc'), v.inner_text('#bf-calc'))
    v.click('[data-a=body-save]'); settle(v, 900)
    bd = dec(dbof(v), 'body', 'uvinay')
    check('saved in body/<uid>', len(bd['checks']) == 1 and bd['checks'][0]['kg'] == 72.4 and bd['checks'][0]['waist'] == 84, bd)
    v.set_input_files('#ib-file', files=[{'name': 'InBody-20260928.csv', 'mimeType': 'text/csv', 'buffer': CSV.encode('utf-8')}]); v.wait_for_timeout(600)
    check('InBody file: a preview before importing (2 scans, 2 new)', '2 scans' in v.inner_text('.ib-prev') and '2 new' in v.inner_text('.ib-prev'), v.inner_text('.ib-prev')[:160])
    v.click('[data-a=ib-import]'); settle(v, 900)
    bd = dec(dbof(v), 'body', 'uvinay')
    check('imported: three check-ins now, the InBody card shows the latest scan', len(bd['checks']) == 3 and v.locator('.ib-card').count() == 1 and '1610' in v.inner_text('.ib-card'), len(bd['checks']))
    v.click('#body-comp [data-a=body-new]'); v.wait_for_timeout(300)
    typ(v, '#bf-date', '2026-09-27'); typ(v, '#bf-kg', '72.0'); typ(v, '#bf-waist', '83'); typ(v, '#bf-neck', '38'); v.click('[data-a=body-save]'); settle(v, 700)
    check('tape history: a chart of waist and neck once there are two taped check-ins', 'Tape measure over time' in v.inner_html('#body-comp'))
    v.click('#body-comp details summary'); v.wait_for_timeout(200)
    n0 = v.locator('#body-comp [data-a=body-del]').count()
    v.click('#body-comp [data-a=body-del] >> nth=0'); settle(v, 600)
    check('dropdowns stay open: “All check-ins” is still open after deleting a row', v.locator('#body-comp details[open]').count() >= 1 and v.locator('#body-comp [data-a=body-del]').count() == n0 - 1, (n0, v.locator('#body-comp [data-a=body-del]').count()))
    v.evaluate("go({view:'nutrition'})"); v.wait_for_timeout(500)
    check('Nutrition: calories from the InBody BMR (1610 kcal)', 'from your InBody BMR, 1610 kcal' in v.inner_text('#view'), v.inner_text('#view')[:300])
    v.evaluate("go({view:'progress', sub:'body', pv:'uuday'})"); v.wait_for_timeout(500)
    t = v.inner_text('#body-comp')
    check('Uday’s check-ins can be seen by Vinay (80.0 kg), without Add or Delete', '80.0' in t and v.locator('#body-comp [data-a=body-new]').count() == 0 and v.locator('#body-comp [data-a=body-del]').count() == 0, t[:200])
    wr = v.evaluate("window.FBX.db.collection('body').doc('uuday').set({j:'{}'}).then(()=>'written', ()=>'refused')")
    check('...and the database rules refuse changing someone else’s', wr == 'refused')
    check('no page errors (Vinay)', not v.errors, v.errors[:2])

    # ================= a member can't move somebody else's logged sets; rules
    SEED2 = dict(SEED, logs=dict(SEED['logs'], **{'uuday_' + D: L({'pid': 'uuday', 'date': D, 'str': {'1': {'n': 'Pull-up', 's': sets(0, 6, 4)}}})}))
    w = phone('vinay@test.com', SEED2); w.wait_for_timeout(500)
    w.click(STR + ' [data-a=edit-plan] >> nth=-1'); w.wait_for_timeout(400)
    w.click('#sheet #ed-strength [data-a=ed-del][data-i="0"]'); w.wait_for_timeout(200)
    w.click('#sheet [data-a=editor-save]'); w.wait_for_timeout(500)
    check('Uday has logged the day: removing an exercise is refused for a member, the plan stays', 'Uday has logged this day' in toast(w) and w.is_visible('#sheet') and names(w, D)[0] == 'Barbell deadlift', toast(w)[-200:])
    w.evaluate("closeSheet()"); w.wait_for_timeout(200)
    w.click(STR + ' [data-a=pk-day]'); w.wait_for_timeout(300); pick(w, 'Goblet squat'); w.click('#pk-done'); settle(w, 800)
    check('...adding is fine: Uday’s sets stay on Pull-up, nothing of his was touched', names(w, D)[-1] == 'Goblet squat' and lg(w, 'uuday')['str']['1']['n'] == 'Pull-up' and not any(x.startswith('logs/uuday') for x in w.evaluate('window.__REFUSED.concat(window.__WRITES)')), w.evaluate('window.__REFUSED'))
    w.click('#ex-1 [data-a=set-pm][data-v="-1"]'); w.wait_for_timeout(400)
    check('− on a set Uday ticked: it stays', 'Uday ticked set 4, so it stays' in toast(w) and w.evaluate("P('%s').strength[1].sets" % D) == 4, toast(w)[-80:])
    check('no page errors (Vinay, second phone)', not w.errors, w.errors[:2])
    n = phone('newbie@test.com', {'profiles': PEOPLE})  # signed in, no profile yet
    wr = n.evaluate("window.FBX.db.collection('plan_days').doc('%s').set({j:'{}'}).then(()=>'written', ()=>'refused')" % D)
    check('someone without a profile cannot change the plan (database rules)', wr == 'refused')
    adm = phone('boss@test.com', SEED2); adm.wait_for_timeout(500)
    adm.evaluate("ED = null; openSheet('editor', { date: '%s' })" % D); adm.wait_for_timeout(400)
    adm.click('#sheet #ed-strength [data-a=ed-del][data-i="0"]'); adm.wait_for_timeout(200); adm.click('#sheet [data-a=editor-save]'); settle(adm, 800)
    ul = lg(adm, 'uuday')
    check('the admin can: Uday’s sets move with Pull-up (now the first exercise)', names(adm, D)[0] == 'Pull-up' and list(ul['str'].keys()) == ['0'] and ul['str']['0']['n'] == 'Pull-up', ul.get('str'))

    # ================= catch up a missed session
    NOW = datetime(2026, 10, 1, 2, 0, tzinfo=timezone.utc)  # Thu 1 Oct: Wed's session was missed by everyone
    k = phone('vinay@test.com', SEED); k.wait_for_timeout(500)
    day(k, '2026-09-30')
    check('Wed (missed): “Catch up this week”', k.locator('#view [data-a=catch-open]').count() == 1)
    k.click('#view [data-a=catch-open]'); k.wait_for_timeout(300)
    opts = k.eval_on_selector_all('#sheet [data-a=catch-do]', 'bs => bs.map(b => b.dataset.v + ":" + b.dataset.h)')
    check('...on the free day (Sat), or added to Thu’s or Sun’s session; not on the test day (Fri)', opts == ['2026-10-03:move', '2026-10-01:add', '2026-10-04:add'], opts)
    k.click('#sheet [data-a=catch-do][data-v="2026-10-01"]'); settle(k, 800)
    a, c = dayof(k, '2026-09-30'), dayof(k, '2026-10-01')
    nm = names(k, '2026-10-01')
    check('added to Thu: “Legs + Chest + Shoulders + Triceps”, both sessions’ exercises; Wed says Done later', c['heading'] == 'Legs + Chest + Shoulders + Triceps' and c['caught'] == '2026-09-30' and nm[0] == 'Back squat' and 'Barbell bench press' in nm and len(nm) == 14 and a['heading'] == 'Done later' and a['caughtTo'] == '2026-10-01' and a['kind'] == 'rest', (a, c, len(nm)))
    check('...Wed has no score (Done later), and the page opened on Thu', k.evaluate("dayScore('uvinay', '2026-09-30')") == {'score': None, 'parts': [], 'label': 'Done later'} and k.evaluate('S.route.date') == '2026-10-01')
    day(k, '2026-09-30')
    check('Wed shows where it went, with Undo catch up', 'added to Thursday' in k.inner_text('#view') and k.locator('#view [data-a=catch-undo]').count() == 1, k.inner_text('.restday')[:200])
    k.click('#view [data-a=catch-undo]'); settle(k, 800)
    check('Undo: both days are exactly the built-in plan again', same_as_builtin(k, '2026-09-30') and same_as_builtin(k, '2026-10-01'))
    k.click('#view [data-a=catch-open]'); k.wait_for_timeout(300); k.click('#sheet [data-a=catch-do][data-v="2026-10-03"]'); settle(k, 800)
    c = dayof(k, '2026-10-03')
    check('on the free day instead: Sat is Chest + Shoulders + Triceps', c['heading'] == 'Chest + Shoulders + Triceps' and c['kind'] == 'push' and c['caught'] == '2026-09-30' and c['dow'] == 'Sat', c)
    check('no page errors (catch up)', not k.errors, k.errors[:2])
    SEED3 = dict(SEED, logs=dict(SEED['logs'], **{'uuday_2026-09-30': L({'pid': 'uuday', 'date': '2026-09-30', 'status': 'complete'})}))
    k2 = phone('vinay@test.com', SEED3); k2.wait_for_timeout(500)
    day(k2, '2026-09-30')
    check('Uday did Wed’s session: no catch up (the plan is shared, his day stays)', k2.locator('#view [data-a=catch-open]').count() == 0 and 'Not logged' in k2.inner_text('#view'))

    # ================= training together: partner lines in gym mode, only what changed goes across
    NOW = datetime(2026, 9, 28, 2, 0, tzinfo=timezone.utc)
    g = phone('vinay@test.com', SEED); g.wait_for_timeout(500)
    g.click('[data-a=tg-open]'); g.wait_for_timeout(250); g.click('#sheet [data-a=tg-pick][data-v=uuday]'); g.click('#sheet [data-a=tg-send]'); settle(g)
    if g.evaluate("tgActive('uvinay', '%s').weights" % D) != 'own': g.click('.tg-card [data-a=tg-weights][data-v=own]'); settle(g, 700)
    check('training together with Uday, each with their own weights', g.evaluate("tgActive('uvinay', '%s').weights" % D) == 'own' and g.evaluate("ptTgPartners('%s')" % D) == ['uuday'])
    g.evaluate("openMode('gym', 'set')"); g.wait_for_timeout(600)
    m = g.inner_text('#mode')
    check('gym mode: a line for Uday under the set, for his reps and weight', g.locator('#mode .md-tgw').count() == 1 and 'Uday' in g.inner_text('#mode .md-tgw') and g.locator('#mtwr-uuday-0-0').count() == 1 and g.locator('#mtw-uuday-0-0').count() == 1, m[:200])
    check('...his weight box suggests the plan’s 55 kg in grey', g.get_attribute('#mtw-uuday-0-0', 'placeholder') == '55', g.get_attribute('#mtw-uuday-0-0', 'placeholder'))
    g.fill('#mtwr-uuday-0-0', '8'); g.dispatch_event('#mtwr-uuday-0-0', 'change'); g.fill('#mtw-uuday-0-0', '45'); g.dispatch_event('#mtw-uuday-0-0', 'change'); settle(g, 900)
    us = lg(g, 'uuday')['str']['0']['s'][0]
    check('typed for Uday: 8 reps at 45 kg go into his log', us.get('r') == 8 and us.get('w') == 45 and not us.get('d'), us)
    check('...the database rules allowed it (he is in today’s group)', 'logs/uuday_' + D in g.evaluate('window.__WRITES') and not g.evaluate('window.__REFUSED'), g.evaluate('window.__REFUSED'))
    g.click('#mode [data-a=md-done]'); settle(g, 900)
    me, us = lg(g, 'uvinay')['str']['0']['s'][0], lg(g, 'uuday')['str']['0']['s'][0]
    check('ticking my set ticks his too, and his own reps and weight stay (8 × 45, mine 10 × 55)', me.get('d') and me.get('r') == 10 and me.get('w') == 55 and us.get('d') is True and us.get('r') == 8 and us.get('w') == 45, (me, us))
    g.evaluate("closeMode()"); g.wait_for_timeout(300)
    g.fill('#r-0-0', '12'); g.dispatch_event('#r-0-0', 'change'); settle(g, 800)
    check('changing my reps afterwards stays on my log', lg(g, 'uvinay')['str']['0']['s'][0]['r'] == 12 and lg(g, 'uuday')['str']['0']['s'][0]['r'] == 8)
    g.click(STR + ' [data-a=set][data-ex="0"][data-set="0"]'); settle(g, 800)
    check('unticking mine leaves his ticked', not lg(g, 'uvinay')['str']['0']['s'][0].get('d') and lg(g, 'uuday')['str']['0']['s'][0].get('d') is True)
    g.evaluate("stopRest(); openMode('gym', 'set')"); g.wait_for_timeout(500)
    g.evaluate("MODE.view = 'set'; MODE.i = 0; MODE.s = 1; gymVals(); renderMode()"); g.wait_for_timeout(300)
    g.click('#mode [data-a=mtw-same]'); settle(g, 800)
    us = lg(g, 'uuday')['str']['0']['s'][1]
    check('“Same” copies my reps and weight for that set to him', us.get('r') == 10 and us.get('w') == 55, us)
    g.evaluate("closeMode()"); g.wait_for_timeout(300)
    check('no page errors (together)', not g.errors, g.errors[:2])
    b.close()

bad = [n for n, ok in res if not ok]
print('\n%d checks, %d failed' % (len(res), len(bad)))
for n in bad: print('  FAIL', n)
