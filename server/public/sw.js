/**
 * JetVeil service worker — powered by Scramjet.
 *
 * scramjet.all.js is loaded via importScripts which sets the global
 * $scramjetLoadWorker function used to get ScramjetServiceWorker.
 */

importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

// ── Lifecycle: take over immediately so updates aren't blocked by open tabs ──

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Fetch handler ─────────────────────────────────────────────────────────────

async function handleRequest(event) {
  // loadConfig reads Scramjet's config from IndexedDB. If the DB doesn't
  // exist yet (first load) or has a stale schema (old alpha build), it will
  // throw a NotFoundError. In that case fall back to a plain native fetch so
  // the page can finish loading and controller.init() can recreate the DB.
  try {
    await scramjet.loadConfig();
  } catch {
    return fetch(event.request);
  }

  if (scramjet.route(event)) {
    return scramjet.fetch(event);
  }
  return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});
