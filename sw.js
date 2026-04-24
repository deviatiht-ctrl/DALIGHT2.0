const CACHE_NAME = 'dalight-spa-v2';
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
  '/assets/images/logodaligth.jpg',
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
  const url = new URL(event.request.url);
  
  // 1. NEVER cache Supabase API calls
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. Network-First strategy for HTML and JS files to ensure latest version
  if (event.request.mode === 'navigate' || 
      event.request.url.endsWith('.html') || 
      event.request.url.endsWith('.js')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Update cache with new version
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request)) // Fallback to cache if offline
    );
    return;
  }
  
  // 3. Cache-First for assets (images, fonts, etc.)
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
