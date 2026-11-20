const CACHE_NAME = 'lasuedplug-static-v1';
const APP_SHELL_ASSETS = ['/', '/index.html', '/manifest.json', '/lasued.png'];

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
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept API routes or Vite HMR internals
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/@vite/') ||
    url.pathname.startsWith('/@react-refresh')
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

  // Static assets (CSS, JS, images, fonts, manifest): cache on fetch, serve cached copy offline
  const isStaticAsset =
    ['style', 'script', 'image', 'font', 'manifest'].includes(
      request.destination
    ) ||
    /\.(?:js|mjs|css|png|jpg|jpeg|webp|svg|ico|woff2?|json)$/i.test(
      url.pathname
    );

  if (!isStaticAsset) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response('', { status: 503, statusText: 'Offline' });
      })
  );
});
