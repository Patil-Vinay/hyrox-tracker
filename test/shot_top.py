import json
from datetime import datetime, timezone
src = open('test/run_roles.py').read().split('with sync_playwright() as pw:')[0].replace('PORT = 8791', 'PORT = 8799')
exec(src)
NOW = datetime(2026, 9, 26, 4, 30, tzinfo=timezone.utc)
prof = {'uadmin': {'j': json.dumps({'name': 'Vinay', 'color': 'blue', 'plan': 'A', 'uid': 'uadmin', 'race': {'fmt': 'singles', 'div': 'M'}})}}
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for vp, name in [((1280, 560), 'top-desktop'), ((390, 700), 'top-phone')]:
        p = open_as(b, 'admin@test.com', {'profiles': prof}, vp=vp); p.wait_for_timeout(500)
        p.screenshot(path=f'test/shots/{name}.png')
    b.close()
srv.shutdown()
