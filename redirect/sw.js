/* The tracker moved to https://hyroxtraining.web.app/. This retires the offline copy that was installed from the old address. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))))
    .then(() => self.registration.unregister())
    .then(() => self.clients.matchAll({ type: 'window' }))
    .then(cs => cs.forEach(c => c.navigate('https://hyroxtraining.web.app/')))
));
