/**
 * JetVeil — Scramjet service worker bootstrap  (v1.0.7)
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

addEventListener("install", () => self.skipWaiting());
addEventListener("activate", (e) => e.waitUntil(clients.claim()));

addEventListener("fetch", (e) => {
  if ($scramjetController.shouldRoute(e)) {
    e.respondWith($scramjetController.route(e));
  }
});
