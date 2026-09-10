// PVT Workforce Hub - Service Worker (Bypass Cache & Always Fresh)
const CACHE_NAME = 'pvt-hr-leave-v4-fresh';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // Always fetch fresh from network, fallback to cache only if offline
  event.respondWith(
    fetch(event.request, { cache: 'reload' })
      .then((response) => {
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
