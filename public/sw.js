/*
 * CircuitMaker works offline after the first visit (PWA). The page itself is
 * fetched from the network first, so a new version is seen at once, and kept
 * for when there is no network. Scripts, styles, icons and fonts never change
 * under the same name (their names carry a hash), so they come from the cache.
 */
const CACHE = 'circuitmaker-v1';
const FONTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const ours = url.origin === self.location.origin;
  if (!ours && !FONTS.includes(url.hostname)) return;

  if (request.mode === 'navigate') {
    // the page: network first, the saved copy when offline
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE).then((c) => c.put(self.registration.scope, copy));
          return response;
        })
        .catch(() => caches.match(self.registration.scope).then((r) => r || Response.error())),
    );
    return;
  }

  // everything else: the cache first, then the network (and keep it)
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok || response.type === 'opaque') {
            const copy = response.clone();
            void caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
