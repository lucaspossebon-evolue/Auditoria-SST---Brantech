/* Brantech Auditoria SST — service worker
   HTML: network-first (sempre pega a versão mais nova online; usa cache só offline).
   Estáticos (ícones/manifest) e fontes: cache-first.
   Troque o número em CACHE ao editar o app. */
const CACHE = 'brantech-sst-v20';
const FONTS = 'brantech-fonts-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null)))) // 1 arquivo falho não quebra a instalação
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: cacheia na 1ª vez online, serve do cache depois
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONTS).then(async (c) => {
        const cached = await c.match(req);
        const network = fetch(req).then((r) => { c.put(req, r.clone()); return r; }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navegações (HTML): NETWORK-FIRST — sempre a versão mais nova quando online.
  const isNav = req.mode === 'navigate' ||
                (req.headers.get('accept') || '').includes('text/html');
  if (isNav) {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy)); // atualiza o fallback offline
          return r;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  // Demais estáticos (ícones, manifest): cache-first + revalida em segundo plano.
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((r) => {
        if (r && r.status === 200) {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return r;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
