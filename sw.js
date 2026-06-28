// ============================================================================
//  sw.js · Service Worker — funcionamiento offline (app shell + caché)
// ----------------------------------------------------------------------------
//  Estrategia:
//   · App shell (HTML/CSS/JS/iconos): cache-first con actualización en 2º plano.
//   · API del BCE (Euríbor): network-first; la app ya cachea el último valor
//     en localStorage, así que aquí no la interceptamos para no servir datos
//     obsoletos.
// ============================================================================

const CACHE = 'hipoteca-v1.0.0';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/ui.js',
  './js/calculos.js',
  './js/impuestos.js',
  './js/euribor.js',
  './js/db.js',
  './js/changelog.js',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Cacheamos individualmente para que un 404 de un icono no rompa todo.
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // No interceptamos la API del BCE: dejamos que la app gestione su caché.
  if (url.hostname.endsWith('ecb.europa.eu')) return;

  // Solo gestionamos peticiones de nuestro propio origen.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cacheada) => {
      const red = fetch(request)
        .then((resp) => {
          if (resp && resp.status === 200 && resp.type === 'basic') {
            const copia = resp.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copia));
          }
          return resp;
        })
        .catch(() => cacheada);
      // Cache-first: responde rápido desde caché y actualiza en segundo plano.
      return cacheada || red;
    })
  );
});
