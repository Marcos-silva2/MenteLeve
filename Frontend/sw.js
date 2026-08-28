/* ============================================================
   Service Worker — cache básico para instalação offline (PWA)
   ============================================================ */

const CACHE = 'menteleve-v30';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './assets/mulher-onboard.png',
  './assets/isotipo.png',
  './assets/ML.png',
  './assets/icon-512.png',
  './js/app.js',
  './js/store.js',
  './js/api.js',
  './js/dates.js',
  './js/ui.js',
  './js/components/taskSheet.js',
  './js/views/onboarding.js',
  './js/views/login.js',
  './js/views/register.js',
  './js/views/home.js',
  './js/views/agenda.js',
  './js/views/chat.js',
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
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Chamadas à API (backend em outra origem) passam direto — sem cache.
  if (url.origin !== self.location.origin) return;

  // Código (navegação + .js/.css/.html/.json) → NETWORK-FIRST: sempre busca a
  // versão mais nova quando online; cai no cache só se offline. Evita ficar
  // preso em JS antigo. Imagens/ícones/fontes → cache-first (mais rápido).
  const isCode = request.mode === 'navigate' || /\.(?:js|css|html|json)$/.test(url.pathname);

  if (isCode) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match('./index.html')))
    );
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
