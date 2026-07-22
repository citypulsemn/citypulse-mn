/*
 * City Pulse MN — service worker.
 *
 * THE RULE THIS FILE EXISTS TO OBEY: never serve stale event data. A cached
 * events page is a WRONG events page — a start time that moved, a show that was
 * cancelled, a festival that ended. So HTML is NEVER cached. The only
 * cache-first resources are Next's content-hashed build assets under
 * /_next/static/, whose URLs change whenever their bytes do, so they cannot go
 * stale by construction.
 *
 * Strategy:
 *   /_next/static/*   cache-first   (immutable, hashed — safe forever)
 *   navigations       network-only  → /offline when the network is truly gone
 *   everything else   untouched     (API, beacons, feeds, images, third party)
 *
 * Only GET is intercepted, so the analytics beacon (POST) is never touched.
 *
 * To REMOVE this service worker from browsers that already have it, deploy the
 * self-unregistering stub in docs/deploy-history/DEPLOY-PWA.md — deleting this
 * file is not enough (a 404 leaves the installed worker in place).
 */

const VERSION = "v1";
const STATIC_CACHE = `citypulse-static-${VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .catch(() => {}) // a failed precache must not block activation
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Never intercept non-GET: the stat beacon is a POST and must always fly.
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  // Third-party (fonts, Mapbox, Resend) — leave entirely alone.
  if (url.origin !== self.location.origin) return;

  // Immutable, content-hashed build output → cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Page navigations → always the network. Offline is a stated fact, not a
  // stale page. NOTE: no caches.put here, by design.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(OFFLINE_URL).then(
          (page) =>
            page ||
            new Response("You are offline.", {
              status: 503,
              headers: { "content-type": "text/plain; charset=utf-8" },
            }),
        ),
      ),
    );
    return;
  }

  // Everything else: no interception at all.
});
