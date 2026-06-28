const CACHE_VERSION = 'wl-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const FONT_CACHE   = `${CACHE_VERSION}-fonts`;

const STATIC_ASSETS = [
  '/index.html',
  '/dist/bundle.js',
  '/css/reset.css',
  '/css/variables.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/charts.css',
  '/css/pages.css',
  '/css/cursor.css',
  '/css/animations.css',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── Install: pre-cache static assets ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(STATIC_ASSETS.filter(Boolean))
    ).then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('wl-') && k !== STATIC_CACHE && k !== FONT_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: routing strategy ───────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls → network only, never cache
  if (url.pathname.startsWith('/api/')) {
    return; // fall through to network
  }

  // Google Fonts & Chart.js CDN → cache first
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com' ||
    url.hostname === 'cdn.jsdelivr.net'
  ) {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      })
    );
    return;
  }

  // Static assets → cache first, fall back to network
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      })
    );
  }
});
