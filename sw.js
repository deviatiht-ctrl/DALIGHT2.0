const CACHE_NAME = 'dalight-spa-v5';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css',
  '/css/responsive.css',
  '/js/main.js',
  '/js/auth.js',
  '/js/reservation.js',
  '/js/payment.js',
  '/js/orders.js',
  '/js/follow.js',
  '/js/admin.js',
  '/assets/images/logodaligth.png',
  '/manifest.json'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Claim clients immediately
      self.clients.claim(),
      // Remove old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  // 0. Only handle GET requests — POST/PUT/DELETE cannot be cached
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const path = url.pathname;

  // 1. NEVER cache Supabase API calls
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. NEVER cache admin pages and scripts — always network
  if (path.startsWith('/admin/') || path.includes('/admin/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // 3. Network-First for HTML and JS files (use pathname to handle ?v= query strings)
  if (event.request.mode === 'navigate' ||
      path.endsWith('.html') ||
      path.endsWith('.js') ||
      path.endsWith('.css')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 4. Cache-First for static assets (images, fonts, etc.)
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request).then((networkResponse) => {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return networkResponse;
        });
      })
  );
});
