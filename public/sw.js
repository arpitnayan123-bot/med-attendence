// AttendMate Pro service worker — offline shell for the device-only data model.
// Strategies (per Workbox guidance):
//   • hashed static assets + icons + manifest → cache-first (immutable content)
//   • navigations (app shell HTML)            → network-first, cache fallback
//   • /api/* (credentials-only endpoints)     → network only, never cached
// User DATA is never cached here — it lives in localStorage behind the
// storage-consent gate, fully under the user's control.
const VERSION = "attendmate-static-v2";
const STATIC_PREFIXES = ["/_next/static/", "/icons/", "/manifest.webmanifest", "/favicon"];

self.addEventListener("install", (event) => {
  // Precache the app shell so the very first offline reload can boot: without
  // this, the cache only fills after a navigation happens while controlled.
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      try {
        const res = await fetch("/", { credentials: "same-origin" });
        if (res.ok) await cache.put("/", res.clone());
      } catch { /* offline install — runtime caching will fill later */ }
      self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== VERSION).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never cached

  // immutable static assets → cache-first
  if (STATIC_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSION);
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch {
          return new Response("Offline", { status: 503 });
        }
      })(),
    );
    return;
  }

  // app shell / documents → network-first with cache fallback
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSION);
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch {
          const hit = await cache.match(req, { ignoreSearch: true });
          if (hit) return hit;
          const shell = await cache.match("/");
          if (shell) return shell;
          return new Response("Offline — open AttendMate once while online to cache the shell.", { status: 503 });
        }
      })(),
    );
  }
});
