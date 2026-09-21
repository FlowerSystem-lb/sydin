/* SydIN service worker -- deliberately tiny.
 *
 * Its only job: when the installed app is opened with no signal, show
 * /offline instead of the browser's raw error page. Navigations are
 * network-first, nothing else is intercepted, and no app asset or data is
 * ever cached -- so this can never serve a stale build or stale stock.
 */
const CACHE = "sydin-offline-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(OFFLINE_URL).then((cached) => cached || Response.error())
    )
  );
});
