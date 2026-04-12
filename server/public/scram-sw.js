/**
 * JetVeil — Scramjet service worker bootstrap
 *
 * Loads the scramjet-controller SW module and wires up the fetch handler.
 * All actual HTTP proxying is delegated back to the Controller instance
 * running on the main page via RPC over MessageChannel.
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
