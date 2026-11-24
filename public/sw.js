const CACHE_NAME = 'lasuedplug-static-v4';
const IMAGE_CACHE_NAME = 'lasuedplug-images-v1';
const MAX_IMAGE_CACHE_ENTRIES = 250;

const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/lasued.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
];

function isCacheableImageRequest(request, url) {
  if (request.destination === 'image') {
    return true;
  }
  if (
    /\.(?:png|jpe?g|webp|gif|svg|avif|ico)(?:\?.*)?$/i.test(url.pathname)
  ) {
    return true;
  }
  return (
    url.hostname === 'res.cloudinary.com' ||
    url.hostname.endsWith('.cloudinary.com') ||
    url.hostname === 'firebasestorage.googleapis.com'
  );
}

async function trimImageCacheIfNeeded(cache) {
  try {
    const keys = await cache.keys();
    if (keys.length <= MAX_IMAGE_CACHE_ENTRIES) return;
    const overflow = keys.length - MAX_IMAGE_CACHE_ENTRIES;
    for (let i = 0; i < overflow; i += 1) {
      await cache.delete(keys[i]);
    }
  } catch {
    // Ignore cache trim errors
  }
}

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
            .filter((key) => key !== CACHE_NAME && key !== IMAGE_CACHE_NAME)
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
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Never intercept Vite dev/HMR internals, SEO manifests, or Firestore/Auth/API requests
  if (
    url.pathname === '/sitemap.xml' ||
    url.pathname === '/robots.txt' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/@vite/') ||
    url.pathname.startsWith('/@react-refresh') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com')
  ) {
    return;
  }

  // Persistent Cache-First strategy for all listing & UI images (same-origin + Cloudinary/Firebase Storage)
  if (isCacheableImageRequest(request, url)) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }
        try {
          const response = await fetch(request);
          if (
            response &&
            (response.ok || response.type === 'opaque')
          ) {
            void cache.put(request, response.clone()).then(() => trimImageCacheIfNeeded(cache));
          }
          return response;
        } catch {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

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

  // Immutable hashed build assets (/assets/*.js, /assets/*.css): cache-first
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

  // Static public assets (fonts, manifest, styles, scripts): stale-while-revalidate for instant loads
  const isStaticAsset =
    ['style', 'script', 'font', 'manifest'].includes(request.destination) ||
    /\.(?:js|mjs|css|woff2?|json)$/i.test(url.pathname);

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
