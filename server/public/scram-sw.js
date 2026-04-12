/**
 * JetVeil — Scramjet service worker bootstrap  (v1.0.8)
 *
 * Loads the scramjet-controller SW module and wires up the fetch handler.
 * All actual HTTP proxying is delegated back to the Controller instance
 * running on the main page via RPC over MessageChannel.
 *
 * NOTE: Bump the version string above whenever controller.sw.js changes so
 * that browsers always re-fetch it (bypassing any stale SW script cache).
 */

/* global $scramjetController */

importScripts("/controller/controller.sw.js");

// #region agent log
function debugLog(hypothesisId, location, message, data = {}) {
  const payload = { hypothesisId, location, message, data, timestamp: Date.now() };
  try {
    fetch("/__debug-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}
// #endregion

addEventListener("install", () => self.skipWaiting());
addEventListener("activate", (e) => e.waitUntil(clients.claim()));

addEventListener("message", (e) => {
  if (e?.data?.$controller$init && typeof e.data.$controller$init === "object") {
    // #region agent log
    debugLog("H1", "scram-sw.js:message:controller-init", "Received $controller$init", {
      hasPort: Boolean(e.ports?.[0]),
      prefix: e.data.$controller$init.prefix ?? null,
      id: e.data.$controller$init.id ?? null,
    });
    // #endregion
  }
});

addEventListener("fetch", (e) => {
  const requestUrl = e.request?.url ?? "";
  if (requestUrl.startsWith("chrome-extension://") || requestUrl.startsWith("moz-extension://")) {
    return;
  }
  const shouldRoute = $scramjetController.shouldRoute(e);
  if (shouldRoute) {
    e.respondWith(
      $scramjetController.route(e).catch((err) => {
        // #region agent log
        debugLog("H3", "scram-sw.js:fetch:route-error", "route() threw", {
          requestUrl,
          error: err?.message ?? String(err),
        });
        // #endregion
        throw err;
      }),
    );
  }
});
