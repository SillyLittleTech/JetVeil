import { ScramjetServiceWorker } from "/scram/scramjet.bundle.js";

const scramjet = new ScramjetServiceWorker();

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    (async () => {
      try {
        await scramjet.loadConfig();

        if (scramjet.route(event)) {
          return await scramjet.fetch(event);
        }

        return fetch(event.request);
      } catch {
        return fetch(event.request);
      }
    })()
  );
});
