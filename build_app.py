# Joins src/*.js in name order into public/app.js, the one script the page loads.
# Run from the repo folder: python build_app.py
import glob, os, re, subprocess, sys

root = os.path.dirname(os.path.abspath(__file__))
files = sorted(glob.glob(os.path.join(root, 'src', '*.js')))
src = ''.join(open(f, encoding='utf-8', newline='').read() for f in files)

# the version shown in Settings and the offline cache name have to move together
ver = re.search(r"APP_VERSION = '(v\d+)'", src).group(1)
sw = open(os.path.join(root, 'public', 'sw.js'), encoding='utf-8').read()
cache = re.search(r"const CACHE = 'hyrox-tracker-(v\d+)'", sw).group(1)
if ver != cache:
    sys.exit('APP_VERSION is %s but sw.js caches %s: bump both' % (ver, cache))

out = os.path.join(root, 'public', 'app.js')
open(out, 'w', encoding='utf-8', newline='').write(src)
print('%d files, %d chars, %s' % (len(files), len(src), ver))

# syntax check
try:
    subprocess.run(['node', '-e', "new Function(require('fs').readFileSync(process.argv[1], 'utf8'))", out], check=True)
except FileNotFoundError:
    print('node not found, skipped the syntax check')
