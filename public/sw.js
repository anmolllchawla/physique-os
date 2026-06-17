// PhysiqueOS — Service Worker
// Cache-first for static assets, network-first for pages.

const CACHE_NAME = "physiqueos-v2";

const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never cache API calls (GitHub sync must always hit the network).
  if (request.url.includes("/api/")) {
    return; // fall through to default network handling
  }

  // Only handle GET requests.
  if (request.method !== "GET") return;

  // Cache-first for static assets
  if (
    request.url.includes("/_next/static") ||
    request.url.match(/\.(png|jpg|svg|ico|woff2)$/)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) => cached || fetch(request)
      )
    );
    return;
  }

  // Network-first for everything else
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});
