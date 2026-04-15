import { ScramjetServiceWorker } from "/scram/scramjet.bundle.js";

const scramjet = new ScramjetServiceWorker();
let configReady = false;
let scramjetConfig = null;

async function ensureConfig() {
  if (configReady) return;
  
  // If config was sent via postMessage, use it
  if (scramjetConfig) {
    configReady = true;
    return;
  }
  
  try {
    await scramjet.loadConfig();
    configReady = true;
  } catch (err) {
    console.error('[SW] Failed to load Scramjet config:', err);
    throw err;
  }
}

self.addEventListener("message", (event) => {
  if (event.data.type === "SCRAMJET_CONFIG") {
    scramjetConfig = event.data.payload;
    configReady = true;
    console.log('[SW] Received Scramjet config:', scramjetConfig);
  }
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    (async () => {
      const reqUrl = new URL(event.request.url);
      const looksLikeScramjetRoute = reqUrl.pathname.startsWith("/scramjet/");
      const isFrameRequest = event.request.destination === "document" || event.request.destination === "iframe";

      try {
        await ensureConfig();

        // Log all requests for debugging
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: "sw-fetch",
              url: event.request.url,
              method: event.request.method,
              isScramjetRoute: looksLikeScramjetRoute,
              routeResult: scramjet.route(event),
              isFrameRequest,
            });
          });
        });

        if (scramjet.route(event) || looksLikeScramjetRoute) {
          return await scramjet.fetch(event);
        }

        return fetch(event.request);
      } catch (err) {
        // Log error for debugging
        console.error('[SW] Fetch error:', err, { url: event.request.url });
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: "sw-error",
              url: event.request.url,
              error: String(err),
            });
          });
        });

        // Do not fall back to app HTML for Scramjet routes; that creates a
        // recursive app-in-iframe failure mode.
        if (looksLikeScramjetRoute) {
          try {
            return await scramjet.fetch(event);
          } catch {
            return new Response("Scramjet service worker failed to handle proxied route.", {
              status: 502,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
          }
        }
        return fetch(event.request);
      }
    })()
  );
});
