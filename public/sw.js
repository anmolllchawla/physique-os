// PhysiqueOS — Service Worker
// Cache-first for static assets, network-first for pages.

const CACHE_NAME = "physiqueos-v3";

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

// ── Rest timer notifications ──────────────────────────────
// The page asks the SW to fire a "rest complete" notification at a target time.
// The SW holds its own timer, which is more resilient to the page being
// backgrounded than an in-page setTimeout (best-effort on iOS installed PWAs).
let restTimer = null;

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SCHEDULE_REST_NOTIFICATION") {
    if (restTimer) clearTimeout(restTimer);
    const delay = Math.max(0, data.endTime - Date.now());
    restTimer = setTimeout(() => {
      self.registration.showNotification(data.title || "Rest complete", {
        body: data.body || "Time for your next set.",
        tag: "rest-timer",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        vibrate: [200, 100, 200],
        renotify: true,
      });
      restTimer = null;
    }, delay);
  } else if (data.type === "CANCEL_REST_NOTIFICATION") {
    if (restTimer) {
      clearTimeout(restTimer);
      restTimer = null;
    }
    self.registration.getNotifications({ tag: "rest-timer" }).then((ns) =>
      ns.forEach((n) => n.close())
    );
  }
});

// Tapping the notification focuses the app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});
