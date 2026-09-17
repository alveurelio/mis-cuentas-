const CACHE_NOMBRE = "mis-cuentas-v1";
const ARCHIVOS = [
  "./index.html",
  "./app.js",
  "./db.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NOMBRE).then((cache) => cache.addAll(ARCHIVOS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(nombres.filter(n => n !== CACHE_NOMBRE).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((respuesta) => respuesta || fetch(e.request))
  );
});
