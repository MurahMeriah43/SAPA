// SAPA — Service Worker sederhana
// Fungsinya: cache file inti biar app tetap kebuka meski koneksi lemah,
// dan supaya browser mengenali ini sebagai PWA yang bisa di-install.

const CACHE_NAME = "sapa-cache-v1";
const CORE_ASSETS = [
  "/",
  "/manifest.json",
  "/assets/css/style.css",
  "/assets/js/app.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {

  // Lewati semua request selain GET — POST ke Supabase dll tidak boleh di-cache
  if (event.request.method !== "GET") {
    return; // biarkan browser handle sendiri, tanpa respondWith
  }

  // Lewati request ke API eksternal (Supabase, AI worker, dsb)
  const url = new URL(event.request.url);
  const isExternal = url.origin !== self.location.origin;
  if (isExternal) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // Hanya cache response yang valid (status 200, bukan opaque)
        if (
          res &&
          res.status === 200 &&
          res.type === "basic"
        ) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, resClone);
          });
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );

});