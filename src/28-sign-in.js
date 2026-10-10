/* ---------- sign-in gate ---------- */
function showGate(kind, extra) {
  const g = $('#gate'); if (!g) return;
  S.gate = kind;
  if (!kind) { g.hidden = true; g.innerHTML = ''; document.body.classList.remove('gated'); return; }
  const brand = '<div class="gate-brand"><span class="disp">HYROX</span><span class="disp">Tracker</span><small>16 weeks · race day Fri 15 Jan 2027</small></div>';
  let body = '';
  if (kind === 'wait') body = '<p class="muted">Connecting…</p>';
  else if (kind === 'signin') body = '<p>Sign in with the Google account you use for the tracker.</p><button class="btn primary lg block" data-a="signin">' + GOOGLE_G + 'Sign in with Google</button>' +
    (extra ? '<div class="warnbox bad">' + esc(extra) + '</div>' : '') +
    '<p class="small muted">Anyone you send the link to can sign in and join. If nothing happens when you tap the button, open this page in Chrome or Safari rather than inside another app.</p>';
  else if (kind === 'denied') body = '<div class="warnbox bad"><div><b>' + esc(S.email || 'This account') + ' can\'t open this tracker yet.</b>The tracker\'s database rules haven\'t been published, so Firebase is refusing access. Run the publish command from the setup guide, then sign in again.</div></div>' +
    '<button class="btn primary lg block" data-a="signout">Use another Google account</button>';
  else if (kind === 'setup') body = '<div class="warnbox"><div><b>Almost there: Firebase isn\'t connected yet.</b>This copy of the tracker couldn\'t find its Firebase settings. Deploy it with <span class="mono">firebase deploy</span> as described in the setup guide (START-HERE.html), or paste your web app config into <span class="mono">config.js</span>.</div></div>';
  else if (kind === 'error') body = '<div class="warnbox bad"><div><b>Couldn\'t start the tracker.</b>' + esc(extra || '') + '</div></div><button class="btn lg block" onclick="location.reload()">Try again</button>';
  g.innerHTML = '<div class="gate-card">' + brand + body + '</div>';
  g.hidden = false; document.body.classList.add('gated');
}
const GOOGLE_G = '<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

async function startSignIn() {
  if (!window.FBX || !S.fbReady) return;
  try { await FBX.signIn(false); }
  catch (e) {
    const c = e && e.code;
    if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return;
    showGate('signin', c === 'auth/unauthorized-domain' ? 'This web address isn\'t on the Authorized domains list in Firebase (Authentication → Settings).' : c === 'auth/operation-not-allowed' ? 'Google sign-in isn\'t switched on in Firebase yet (Authentication → Sign-in method → Google).' : c === 'auth/network-request-failed' ? 'No internet connection. Connect and try again.' : 'Sign-in didn\'t finish' + (c ? ' (' + c + ')' : '') + '.');
  }
}
async function doSignOut() {
  if (pending.size && !S.denied) { toast(pending.size + ' change' + (pending.size > 1 ? 's haven\'t' : ' hasn\'t') + ' synced yet. Wait until it says Saved, then sign out.'); return; }
  unsubscribeAll(); S.db = null;
  LS.del(CACHE_KEY); LS.del(OUTBOX_KEY); LS.del('hx.pid'); pending.clear();
  try { await FBX.signOut(); } catch (e) { }
  location.reload();
}

async function getConfig() {
  // On Firebase Hosting the project's web settings are served at /__/firebase/init.json, so nothing needs pasting.
  if (/^https?:$/.test(location.protocol)) {
    try {
      const r = await withTimeout(fetch('/__/firebase/init.json', { cache: 'no-store' }), 6000);
      if (r.ok) { const c = await r.json(); if (c && c.apiKey && c.projectId) { LS.set('hx.fbconfig', c); return c; } }
    } catch (e) { }
  }
  const c = window.FIREBASE_CONFIG;
  if (c && c.apiKey && c.projectId && !/PASTE|YOUR/i.test(c.apiKey)) return c;
  return LS.get('hx.fbconfig', null); // last known settings, so the tracker still opens offline
}

async function boot() {
  applyTheme();
  loadCache();
  S.pid = resolveMe();
  setSync(pending.size ? 'offline' : 'saved');
  render();
  if (!S.fromCache) showGate('wait');
  if (!window.FBX) { S.noDb = true; setSync('local'); showGate('error', 'The Firebase library (firebase-sdk.js) didn\'t load. Check your connection and reload.'); return; }
  const cfg = await getConfig();
  if (!cfg) { S.noDb = true; setSync('local'); render(); showGate('setup'); return; }
  try { FBX.init(cfg, window.FIREBASE_EMULATORS || {}); S.fbReady = true; }
  catch (e) { S.noDb = true; setSync('local'); showGate('error', e && e.message); return; }
  FBX.redirectResult && FBX.redirectResult().catch(e => { if (e && e.code) showGate('signin', 'Sign-in didn\'t finish (' + e.code + ').'); });
  FBX.onAuth(user => {
    if (!user) {
      S.user = null; S.uid = null; S.db = null; unsubscribeAll();
      setSync('out'); showGate('signin');
      return;
    }
    const changed = S.uid && S.uid !== user.uid;
    S.user = user; S.uid = user.uid; S.email = user.email; S.viewerName = user.name; S.canWrite = true;
    S.denied = false; S.readOnly = false; S.noDb = false;
    if (changed) { S.pid = null; LS.del('hx.pid'); }
    S.db = FBX.db;
    showGate(null);
    S.pid = resolveMe();
    subscribeAll();
    scheduleFlush(50);
    render();
  });
}
boot();

/* ---------- works offline once opened (service worker) ---------- */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.FIREBASE_EMULATORS) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { }); });
}
