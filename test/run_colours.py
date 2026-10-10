import json
from datetime import datetime, timezone
src = open('test/run_roles.py').read().split('with sync_playwright() as pw:')[0].replace('PORT = 8791', 'PORT = 8823')
exec(src)
P_ = lambda uid, name, color: {'j': json.dumps({'name': name, 'color': color, 'plan': 'A', 'uid': uid, 'race': {'fmt': 'singles', 'div': 'M'}})}
seed = {'profiles': {'uadmin': P_('uadmin', 'Vinay', 'blue'), 'uuday': P_('uuday', 'Uday', 'orange')}}

def rgb(h): h = h.lstrip('#'); return 'rgb(%d, %d, %d)' % tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def var(p, n): return p.evaluate("getComputedStyle(document.documentElement).getPropertyValue('%s').trim().toUpperCase()" % n)
def attr(p, n): return p.evaluate("document.documentElement.getAttribute('%s')" % n)
def body_color(p): return p.evaluate("getComputedStyle(document.body).color")
def meta(p): return p.evaluate("[...document.querySelectorAll('meta[name=theme-color]')].map(m => m.content.toUpperCase())")
def pressed(p, a): return p.locator('[data-a=%s][aria-pressed=true]' % a).get_attribute('data-v')
def tap(p, a, v): p.click('[data-a=%s][data-v=%s]' % (a, v)); p.wait_for_timeout(200)
def overflow(p): return p.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1')

with sync_playwright() as pw:
    b = pw.chromium.launch()
    a = open_as(b, 'admin@test.com', seed)
    a.emulate_media(color_scheme='light')
    a.evaluate("go({view:'settings'})"); a.wait_for_timeout(300)
    txt = a.inner_text('#view')
    check('Display has Theme, Colours and Text colour', all(x in txt for x in ['Theme', 'Colours', 'Classic', 'Colourful', 'Text colour', 'Navy', 'Green', 'Purple', 'Brown']))
    check('defaults: Automatic, Classic, Default text', (pressed(a, 'theme'), pressed(a, 'look-style'), pressed(a, 'look-ink')) == ('system', 'classic', 'default'))
    check('classic light is unchanged', var(a, '--ground') == '#EDEFEA' and body_color(a) == rgb('#14171A') and attr(a, 'data-style') is None and attr(a, 'data-ink') is None)
    dots = a.evaluate("[...document.querySelectorAll('.inkseg .inkdot')].map(d => getComputedStyle(d).backgroundColor)")
    check('every text colour shows a coloured dot', len(dots) == 5 and len(set(dots)) == 5 and 'rgba(0, 0, 0, 0)' not in dots, dots)

    # Colourful light: navy text, gradient page, coloured headings, status bar colour
    tap(a, 'look-style', 'colourful')
    check('Colourful is saved on this device', a.evaluate("localStorage.getItem('hx.style')") == '"colourful"' and attr(a, 'data-style') == 'colourful')
    check('Colourful light: navy text', body_color(a) == rgb('#162B6E'), body_color(a))
    check('Colourful light: soft blue page with a gradient', var(a, '--ground') == '#EAF0FC' and 'linear-gradient' in a.evaluate("getComputedStyle(document.body, '::before').backgroundImage"))
    check('Colourful: card headings in colour', a.evaluate("getComputedStyle(document.querySelector('.card-h h3')).color") == rgb('#3035C2'))
    check('phone status bar follows the page colour', meta(a) == ['#EAF0FC', '#EAF0FC'], meta(a))
    a.evaluate("go({view:'today'})"); a.wait_for_timeout(300)
    bgp = a.evaluate("getComputedStyle(document.querySelector('.plate.alt')).backgroundImage")
    check('Colourful: race countdown is a sunset gradient tile', 'linear-gradient' in bgp and 'rgb(224, 68, 12)' in bgp and 'rgb(107, 36, 222)' in bgp and a.evaluate("getComputedStyle(document.querySelector('.plate.alt')).color") == rgb('#FFFFFF'), bgp[:120])
    big = a.evaluate("(() => { const s = getComputedStyle(document.querySelector('.sc-num .big')); return [s.backgroundImage, s.webkitTextFillColor || s.getPropertyValue('-webkit-text-fill-color'), s.backgroundClip || s.webkitBackgroundClip]; })()")
    check("Colourful: today's score number in the same gradient", 'linear-gradient' in big[0] and big[1] == 'rgba(0, 0, 0, 0)' and 'text' in (big[2] or ''), big)
    check("Colourful: day label (e.g. Strong day) in magenta", a.evaluate("getComputedStyle(document.querySelector('.sc-num .cap')).color") == rgb('#B8155F'))
    check('Colourful: score card has a gradient border', 'linear-gradient' in a.evaluate("getComputedStyle(document.querySelector('.scorecard')).backgroundImage"))
    a.screenshot(path=f'{OUT}/c0-colourful-light-today.png')
    a.evaluate("go({view:'settings'})"); a.wait_for_timeout(300)
    a.screenshot(path=f'{OUT}/c1-colourful-light-settings.png')

    # Dark
    tap(a, 'theme', 'dark')
    check('Colourful dark: deep navy page, light text', var(a, '--ground') == '#0B1024' and body_color(a) == rgb('#EEF2FF'), (var(a, '--ground'), body_color(a)))
    check('status bar goes dark too', meta(a) == ['#0B1024', '#0B1024'], meta(a))
    a.screenshot(path=f'{OUT}/c2-colourful-dark-settings.png')

    # Text colour Navy: deep in light, soft in dark
    tap(a, 'look-ink', 'blue')
    check('Navy text in dark theme is a soft blue', attr(a, 'data-ink') == 'blue' and body_color(a) == rgb('#E3ECFF'), body_color(a))
    tap(a, 'theme', 'light')
    check('Navy text in light theme is navy', body_color(a) == rgb('#162B6E'), body_color(a))
    tap(a, 'look-style', 'classic')
    check('Classic + Navy: original page, navy text', var(a, '--ground') == '#EDEFEA' and body_color(a) == rgb('#162B6E') and attr(a, 'data-style') is None)
    check('muted text follows the text colour', var(a, '--muted') == '#4F6392', var(a, '--muted'))
    for k, lt, dk in [('green', '#0B4A30', '#DDF6E9'), ('purple', '#4B1A63', '#F3E3F8'), ('brown', '#4E2A12', '#F8EBDD')]:
        tap(a, 'look-ink', k); l1 = body_color(a); tap(a, 'theme', 'dark'); d1 = body_color(a); tap(a, 'theme', 'light')
        check('%s text: deep in light, soft in dark' % k.title(), l1 == rgb(lt) and d1 == rgb(dk), (l1, d1))

    # Automatic follows the phone, and live when it switches
    tap(a, 'look-style', 'colourful'); tap(a, 'look-ink', 'default'); tap(a, 'theme', 'system')
    check('Automatic + light phone', attr(a, 'data-theme') is None and var(a, '--ground') == '#EAF0FC')
    a.emulate_media(color_scheme='dark'); a.wait_for_timeout(200)
    check('Automatic: phone switches to dark, page follows', var(a, '--ground') == '#0B1024' and body_color(a) == rgb('#EEF2FF'))
    check('...and so does the status bar', meta(a) == ['#0B1024', '#0B1024'], meta(a))
    a.emulate_media(color_scheme='light'); a.wait_for_timeout(200)
    check('...and back to light', meta(a) == ['#EAF0FC', '#EAF0FC'] and var(a, '--ground') == '#EAF0FC')

    # layout at phone widths
    for w in (390, 320):
        a.set_viewport_size({'width': w, 'height': 800}); a.wait_for_timeout(150)
        check('%d px: Settings has no horizontal scroll' % w, not overflow(a))
    a.set_viewport_size({'width': 390, 'height': 844})

    # applied before the app loads (no flash): block app.js and check the page is already coloured
    tap(a, 'theme', 'dark'); tap(a, 'look-ink', 'purple')
    ctx = a.context
    p2 = ctx.new_page(); p2.route('**/app.js', lambda r: r.abort()); p2.goto(URL); p2.wait_for_timeout(300)
    check('before app.js runs: theme, colours and text colour already set', (attr(p2, 'data-theme'), attr(p2, 'data-style'), attr(p2, 'data-ink')) == ('dark', 'colourful', 'purple') and var(p2, '--ground') == '#0B1024' and body_color(p2) == rgb('#F3E3F8'), (attr(p2, 'data-theme'), attr(p2, 'data-style'), attr(p2, 'data-ink')))
    p2.close()

    # reload with a forced Dark theme, then pick Automatic: it must really go back to automatic
    a.reload(); a.wait_for_selector('[data-a=signin]', timeout=8000); a.click('[data-a=signin]'); a.wait_for_timeout(1200)
    a.emulate_media(color_scheme='light')
    a.evaluate("go({view:'settings'})"); a.wait_for_timeout(300)
    check('after reload: settings remembered', (pressed(a, 'theme'), pressed(a, 'look-style'), pressed(a, 'look-ink')) == ('dark', 'colourful', 'purple'))
    tap(a, 'theme', 'system')
    check('Automatic after a reload in Dark goes back to the phone setting', attr(a, 'data-theme') is None and var(a, '--ground') == '#EAF0FC', (attr(a, 'data-theme'), var(a, '--ground')))

    # back to the original look
    tap(a, 'look-style', 'classic'); tap(a, 'look-ink', 'default')
    check('Classic + Default restores the original colours', attr(a, 'data-style') is None and attr(a, 'data-ink') is None and var(a, '--ground') == '#EDEFEA' and body_color(a) == rgb('#14171A'))
    check('no gradient in Classic', a.evaluate("getComputedStyle(document.body, '::before').content") in ('none', 'normal'))
    a.evaluate("go({view:'today'})"); a.wait_for_timeout(300)
    check('Classic: countdown and score keep the original orange', a.evaluate("getComputedStyle(document.querySelector('.plate.alt')).backgroundImage") == 'none' and a.evaluate("getComputedStyle(document.querySelector('.plate.alt')).backgroundColor") == rgb('#C24D17') and a.evaluate("getComputedStyle(document.querySelector('.sc-num .big')).color") == rgb('#C24D17'))

    # it's per device: Uday's browser is untouched
    u = open_as(b, 'uday@test.com', seed)
    check("another device keeps its own look", attr(u, 'data-style') is None and attr(u, 'data-ink') is None)
    check('no page errors', not (a.errors + u.errors), (a.errors + u.errors)[:2])
    b.close()
srv.shutdown()
print('\n%d/%d passed' % (sum(r[1] for r in res), len(res)))
