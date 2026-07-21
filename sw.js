/* Brantech Auditoria SST — service worker
   Cache-first para o app (funciona offline em campo).
   Suba uma nova versão trocando o número em CACHE quando editar o app. */
const CACHE = 'brantech-sst-v2';
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
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: cacheia na primeira vez online, serve do cache depois
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

  // App (mesma origem): cache-first, com index.html como fallback offline
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((cached) =>
        cached || fetch(req).catch(() => caches.match('./index.html'))
      )
    );
  }
});
