/* ============================================================
   Service Worker — cache básico para instalação offline (PWA)
   ============================================================ */

const CACHE = 'menteleve-v7';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './assets/mulher-onboard.png',
  './js/app.js',
  './js/store.js',
  './js/api.js',
  './js/ui.js',
  './js/components/taskSheet.js',
  './js/views/onboarding.js',
  './js/views/login.js',
  './js/views/home.js',
  './js/views/agenda.js',
  './js/views/connections.js',
  './js/views/paywall.js',
  './js/views/profile.js',
  './manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  // não cacheia chamadas à API
  if (request.method !== 'GET' || request.url.includes('/tasks') || request.url.includes('/health')) {
    return;
  }
  // network-first para HTML, cache-first para o resto
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
      return res;
    }).catch(() => cached))
  );
});
