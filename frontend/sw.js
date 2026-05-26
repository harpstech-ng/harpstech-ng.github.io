const CACHE_NAME = 'harps-voicepay-v1';
const urlsToCache = [
  '/',
  '/login.html',
  '/index.html',
  '/flow.html',
  '/dashboard.html',
  '/logo.png'
];

// Install - cache files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
    .then(cache => cache.addAll(urlsToCache))
    .then(() => self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
        .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request)
    .then(response => {
      return response || fetch(event.request).catch(() => {
        // Fallback for offline
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});