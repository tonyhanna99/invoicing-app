const CACHE_NAME = 'invoicing-pwa-v1';
const FILES_TO_CACHE = [
  '/invoicing-app/',
  '/invoicing-app/index.html',
  '/invoicing-app/manifest.json',
  '/invoicing-app/icon-192.png',
  '/invoicing-app/icon-512.png',
  '/invoicing-app/TrinityLogo.png'
];

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evt) => {
  if (evt.request.mode !== 'navigate') return;
  evt.respondWith(
    fetch(evt.request).catch(() => caches.match('/index.html'))
  );
});
