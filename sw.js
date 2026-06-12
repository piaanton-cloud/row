const CACHE = 'row-v4';
const FILES = [
  '/row/',
  '/row/index.html',
  '/row/manifest.json',
  '/row/icon.png',
  '/row/icon-192.png',
  '/row/icon-512.png',
];

self.addEventListener('install', e => {
  // addAll fallisce tutto se UN file manca: cache file per file, best-effort
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled(FILES.map(f => c.add(f)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Solo richieste GET della stessa origine (Open-Meteo ecc. passano dirette)
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  const isHTML =
    e.request.mode === 'navigate' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname === '/row/';

  if (isHTML) {
    // NETWORK-FIRST per l'app: aggiornamenti visibili subito, cache solo offline
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
          return r;
        })
        .catch(() => caches.match(e.request).then(r => r || caches.match('/row/index.html')))
    );
  } else {
    // CACHE-FIRST per asset statici (icone, manifest): veloci, cambiano di rado
    e.respondWith(
      caches.match(e.request).then(r =>
        r || fetch(e.request).then(resp => {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
          return resp;
        })
      )
    );
  }
});
