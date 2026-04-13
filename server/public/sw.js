/**
 * JetVeil service worker — powered by Scramjet.
 *
 * scramjet.all.js is loaded via importScripts which sets the global
 * $scramjetLoadWorker function used to get ScramjetServiceWorker.
 */

importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

async function handleRequest(event) {
  await scramjet.loadConfig();
  if (scramjet.route(event)) {
    return scramjet.fetch(event);
  }
  return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});
