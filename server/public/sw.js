importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function shouldBypassScramjet(requestUrl) {
  const url = new URL(requestUrl);
  if (url.origin !== self.location.origin) return false;
  return !url.pathname.startsWith("/scramjet/");
}

async function handleRequest(event) {
  if (shouldBypassScramjet(event.request.url)) {
    return fetch(event.request);
  }
  try {
    await scramjet.loadConfig();
    if (scramjet.route(event)) {
      return scramjet.fetch(event);
    }
  } catch {
    // Config store may not exist yet; always fail open.
    return fetch(event.request);
  }
  return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});
