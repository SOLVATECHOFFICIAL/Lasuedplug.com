const CACHE_NAME = 'lasuedplug-static-v3';
const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/lasued.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .catch(() => Promise.resolve())
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept Vite dev/HMR internals or Firestore/API requests
  if (
    url.pathname.startsWith('/@vite/') ||
    url.pathname.startsWith('/@react-refresh') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/')
  ) {
    return;
  }

  // SPA navigation requests: network-first, fallback to cached shell when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          }
          return response;
        })
        .catch(async () => {
          const cachedRoot = await caches.match('/');
          return cachedRoot || caches.match('/index.html') || Response.error();
        })
    );
    return;
  }

  // Immutable hashed build assets (/assets/*.js, /assets/*.css, /assets/*.jpg): cache-first
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // Static public assets (logos, icons, fonts, manifest): stale-while-revalidate for instant loads
  const isStaticAsset =
    ['style', 'script', 'image', 'font', 'manifest'].includes(
      request.destination
    ) ||
    /\.(?:js|mjs|css|png|jpg|jpeg|webp|svg|ico|woff2?|json)$/i.test(
      url.pathname
    );

  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkPromise = fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached || new Response('', { status: 503, statusText: 'Offline' }));

      return cached || networkPromise;
    })
  );
});
