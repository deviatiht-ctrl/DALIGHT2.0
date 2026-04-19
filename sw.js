const CACHE_NAME = 'dalight-spa-v1';
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
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - Network First strategy for API calls
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // NEVER cache Supabase API calls - always use network
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch((error) => {
        console.error('[SW] Supabase request failed:', error);
        return new Response(
          JSON.stringify({ error: 'Network request failed' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }
  
  // For other requests, try cache first then network
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request).catch((error) => {
          console.error('[SW] Fetch failed:', error);
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
