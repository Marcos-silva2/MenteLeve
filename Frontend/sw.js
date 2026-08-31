/* ============================================================
   Service Worker — cache básico para instalação offline (PWA)
   ============================================================ */

const CACHE = 'menteleve-v39';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './assets/mulher-onboard.webp',
  './assets/isotipo.webp',
  './assets/icon-192.webp',
  // Os PNG dos ícones ficam FORA do precache de propósito: só o manifest e o
  // apple-touch-icon os usam, na instalação. São 333 KB que todo mundo baixaria
  // à toa — o WebP acima é o mesmo desenho em 4 KB.
  './js/app.js',
  './js/store.js',
  './js/api.js',
  './js/dates.js',
  './js/sound.js',
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
  // Item a item, tolerando falha individual. Com `cache.addAll(ASSETS)`, UM
  // arquivo com caminho errado (a lista é mantida à mão) rejeitava a promessa,
  // a instalação inteira falhava e o app ficava SEM offline nenhum — em
  // silêncio. Assim o que estiver acessível é cacheado de qualquer forma.
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(
        ASSETS.map((url) => c.add(url).catch(() => {
          console.warn('[sw] não foi possível precachear:', url);
        }))
      ))
      .then(() => self.skipWaiting())
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

  // Só guarda resposta boa. Antes, um 404/5xx era cacheado e passava a ser
  // servido offline como se fosse conteúdo válido.
  const guardar = (req, res) => {
    if (!res || !res.ok || res.type === 'opaque') return res;
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
    return res;
  };

  if (isCode) {
    e.respondWith(
      fetch(request)
        .then((res) => guardar(request, res))
        .catch(() => caches.match(request).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((res) => guardar(request, res))
        // Offline e sem cache: devolve uma resposta de verdade. Antes caía em
        // `catch(() => cached)`, mas aqui `cached` é sempre indefinido — o
        // respondWith recebia undefined e estourava.
        .catch(() => new Response('', { status: 504, statusText: 'Offline' }));
    })
  );
});
