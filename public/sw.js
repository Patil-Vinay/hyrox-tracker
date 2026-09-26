/* Lets the tracker open on bad gym Wi-Fi: always tries the network first, falls back to the last saved copy. */
const CACHE = 'hyrox-tracker-v36';
const CORE = ['./', 'index.html', 'app.js', 'plan-data.js', 'firebase-sdk.js', 'config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function networkFirst(req, waitMs) {
  return new Promise(resolve => {
    let done = false;
    const fallback = () => caches.match(req, { ignoreSearch: true })
      .then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : null));
    const timer = setTimeout(() => {
      fallback().then(r => { if (r && !done) { done = true; resolve(r); } });
    }, waitMs);
    fetch(req).then(res => {
      clearTimeout(timer);
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      if (!done) { done = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      fallback().then(r => { if (!done) { done = true; resolve(r || Response.error()); } });
    });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/__/auth/')) return; // Google sign-in pages always come live
    e.respondWith(networkFirst(req, 4000));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    })));
  }
});
