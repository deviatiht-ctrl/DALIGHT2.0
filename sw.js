const CACHE_NAME = 'dalight-spa-v6';

// Core resources to pre-cache during install
const urlsToCache = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  // CSS
  '/css/style.css',
  '/css/responsive.css',
  // JS
  '/js/main.js',
  '/js/auth.js',
  '/js/reservation.js',
  '/js/payment.js',
  '/js/orders.js',
  '/js/follow.js',
  '/js/admin.js',
  '/js/cart.js',
  '/js/chat-widget.js',
  '/js/checkout.js',
  '/js/consent-forms.js',
  '/js/email-service.js',
  '/js/email-templates.js',
  '/js/giveaway.js',
  '/js/image-compression.js',
  '/js/loyalty-client.js',
  '/js/plop-payment.js',
  '/js/pwa.js',
  '/js/registration-popup.js',
  '/js/shop.js',
  '/js/specials.js',
  '/js/staff-client-tracking.js',
  '/js/staff-portal.js',
  '/js/toast.js',
  '/js/visitor-tracking.js',
  // Vendor - JS libraries
  '/vendor/lucide/lucide.min.js',
  '/vendor/three/three.min.js',
  '/vendor/gsap/gsap.min.js',
  '/vendor/gsap/ScrollTrigger.min.js',
  '/vendor/supabase/supabase.min.js',
  '/vendor/stripe/stripe.min.js',
  '/vendor/chartjs/chart.umd.min.js',
  '/vendor/qrcode/qrcode-generator.min.js',
  '/vendor/qrcode/qrcodejs.min.js',
  '/vendor/html5-qrcode/html5-qrcode.min.js',
  '/vendor/cropperjs/cropper.min.js',
  // Vendor - CSS
  '/vendor/fontawesome/css/all.min.css',
  '/vendor/cropperjs/cropper.min.css',
  // Vendor - Fonts CSS
  '/vendor/fonts/google-fonts.css',
  '/vendor/fonts/inter-fonts.css',
  // Vendor - Font files
  '/vendor/fontawesome/webfonts/fa-brands-400.woff2',
  '/vendor/fontawesome/webfonts/fa-brands-400.ttf',
  '/vendor/fontawesome/webfonts/fa-regular-400.woff2',
  '/vendor/fontawesome/webfonts/fa-regular-400.ttf',
  '/vendor/fontawesome/webfonts/fa-solid-900.woff2',
  '/vendor/fontawesome/webfonts/fa-solid-900.ttf',
  '/vendor/fontawesome/webfonts/fa-v4compatibility.woff2',
  '/vendor/fontawesome/webfonts/fa-v4compatibility.ttf',
  '/vendor/fonts/montserrat-400.ttf',
  '/vendor/fonts/montserrat-500.ttf',
  '/vendor/fonts/montserrat-600.ttf',
  '/vendor/fonts/montserrat-700.ttf',
  '/vendor/fonts/playfair-display-400.ttf',
  '/vendor/fonts/playfair-display-600.ttf',
  '/vendor/fonts/playfair-display-700.ttf',
  '/vendor/fonts/inter-400.ttf',
  '/vendor/fonts/inter-500.ttf',
  '/vendor/fonts/inter-600.ttf',
  '/vendor/fonts/inter-700.ttf',
  '/vendor/fonts/inter-800.ttf',
  // Images
  '/assets/images/logodaligth.png',
  // Pages
  '/pages/about.html',
  '/pages/cart.html',
  '/pages/checkout.html',
  '/pages/follow.html',
  '/pages/formation.html',
  '/pages/giveaway.html',
  '/pages/login.html',
  '/pages/loyalty.html',
  '/pages/order-confirmation.html',
  '/pages/orders.html',
  '/pages/payment.html',
  '/pages/product.html',
  '/pages/register.html',
  '/pages/reservation-v2.html',
  '/pages/services.html',
  '/pages/shop.html',
  '/pages/soins.html',
  // Staff & loyalty
  '/staff.html',
  '/loyalty-card.html',
];

// Install Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Use allSettled so one failure doesn't break everything
        return Promise.allSettled(
          urlsToCache.map((url) =>
            cache.add(url).catch((err) => {
              console.warn('[SW] Failed to cache:', url, err);
            })
          )
        );
      })
      .then(() => {
        console.log('[SW] Install completed');
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
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
  // 0. Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const path = url.pathname;

  // 1. NEVER cache Supabase API calls or Stripe API calls
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('stripe.com') ||
      url.hostname.includes('api.stripe.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. NEVER intercept cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // 3. Navigation requests (HTML pages) - Network-First with offline fallback
  if (event.request.mode === 'navigate' ||
      (path.endsWith('.html') && !path.startsWith('/admin/'))) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            return cached || caches.match('/offline.html');
          });
        })
    );
    return;
  }

  // 4. Admin pages - Network-First, fall back to cache
  if (path.startsWith('/admin/') || path.includes('/admin/')) {
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

  // 5. JS and CSS files - Network-First with cache fallback
  if (path.endsWith('.js') || path.endsWith('.css')) {
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

  // 6. Static assets (images, fonts, videos, etc.) - Cache-First
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        }).catch(() => {
          return caches.match('/assets/images/logodaligth.png');
        });
      })
  );
});
