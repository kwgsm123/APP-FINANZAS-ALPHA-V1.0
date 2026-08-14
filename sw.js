const CACHE = 'mis-finanzas-v26';
const BASE = '/APP-FINANZAS-ALPHA-V1.0/';
const ARCHIVOS = [
  BASE,
  BASE + 'index.html',
  BASE + 'style.css',
  BASE + 'app.js',
  BASE + 'manifest.json',
  BASE + 'icons/icon-192.png',
  BASE + 'icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// Network-first para el "app shell" (html/css/js) — así las actualizaciones
// se ven de inmediato en vez de quedar atrapadas en la caché vieja.
// Cache-first solo para íconos (no cambian casi nunca).
self.addEventListener('fetch', e => {
  const esAppShell = /\.(html|js|css)$/.test(e.request.url) || e.request.mode === 'navigate';

  if (esAppShell) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copia));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
  }
});
