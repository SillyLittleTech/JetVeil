/**
 * JetVeil browser.js — client-side Scramjet initialisation and URL routing.
 *
 * Flow:
 *  1. Register the Scramjet service worker (/sw.js)
 *  2. Configure bare-mux to use the bare-server HTTP transport (/bare/)
 *  3. Initialise ScramjetController (stores config in IndexedDB)
 *  4. If the page was opened with ?url=<target> (from the Flutter app),
 *     navigate to that URL through the proxy automatically
 *  5. Handle the URL bar form submission
 *
 * Prerequisites (loaded as <script> tags before this file):
 *  - /scram/scramjet.all.js  → sets globalThis.$scramjetLoadController etc.
 *  - /baremux/index.js       → sets globalThis.BareMux.BareMuxConnection
 */

const $loading      = document.getElementById("loading-screen");
const $error        = document.getElementById("error-screen");
const $app          = document.getElementById("app");
const $form         = document.getElementById("url-form");
const $input        = document.getElementById("url-input");
const $home         = document.getElementById("home-btn");
const $homePg       = document.getElementById("home-page");
const $browserFrame = document.getElementById("browser-frame");

/** Show the error screen with a message. */
function showError(msg) {
  $loading.hidden = true;
  $error.hidden   = false;
  document.getElementById("error-message").textContent = msg;
}

/** Normalise raw user input into a full https:// URL. */
function normaliseUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Bare domain (e.g. "google.com") — assume https
  if (/^[a-z0-9-]+(\.[a-z]{2,})/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  // Treat as a Google search
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

async function main() {
  // ── 1. Register the Scramjet service worker ───────────────────────────────
  if (!navigator.serviceWorker) {
    showError("Service workers are not supported in this browser. " +
              "Try a modern browser over HTTPS.");
    return;
  }
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (err) {
    showError(`Failed to register service worker: ${err.message}`);
    return;
  }

  // ── 2. Configure bare-mux transport ──────────────────────────────────────
  // BareMux global is set by /baremux/index.js loaded as a <script> tag.
  try {
    const conn    = new BareMux.BareMuxConnection("/baremux/worker.js");
    const bareUrl = location.origin + "/bare/";
    await conn.setTransport("/transport/index.mjs", [bareUrl]);
  } catch (err) {
    showError(`Failed to configure transport: ${err.message}`);
    return;
  }

  // ── 3. Initialise Scramjet ────────────────────────────────────────────────
  // $scramjetLoadController is set by /scram/scramjet.all.js <script> tag.
  let controller;
  try {
    const { ScramjetController } = $scramjetLoadController();
    controller = new ScramjetController({
      prefix: "/scramjet/",
      files: {
        wasm: "/scram/scramjet.wasm.wasm",
        all:  "/scram/scramjet.all.js",
        sync: "/scram/scramjet.sync.js",
      },
    });

    // Attempt to initialise; if the existing IndexedDB has a stale schema
    // (e.g. a different Scramjet alpha build stored version 1 with different
    // object stores) the upgrade callback won't fire and the transaction will
    // throw NotFoundError.  Delete the database and retry once to recover.
    try {
      await controller.init();
    } catch (err) {
      if (err.name === "NotFoundError" || (err.message && err.message.includes("object store"))) {
        await new Promise((res, rej) => {
          const req = indexedDB.deleteDatabase("$scramjet");
          req.onsuccess = res;
          req.onerror   = () => rej(req.error);
          req.onblocked = res; // proceed even if another tab blocks the delete
        });
        await controller.init();
      } else {
        throw err;
      }
    }
  } catch (err) {
    showError(`Scramjet init failed: ${err.message}`);
    return;
  }

  // Attach a ScramjetFrame to the hidden iframe element.
  const frame = controller.createFrame($browserFrame);

  /** Navigate the proxy frame to a URL and show the browser viewport. */
  function navigate(url) {
    $input.value    = url;
    $homePg.hidden  = true;
    $browserFrame.hidden = false;
    frame.go(url);
  }

  // ── 4. Show app UI ────────────────────────────────────────────────────────
  $loading.hidden = true;
  $app.hidden     = false;

  // ── 5. Handle ?url= from Flutter app ─────────────────────────────────────
  const params    = new URLSearchParams(window.location.search);
  const targetUrl = params.get("url");
  if (targetUrl) {
    const url = normaliseUrl(targetUrl);
    if (url) {
      navigate(url);
      return;
    }
  }

  // ── 6. Wire up URL bar ────────────────────────────────────────────────────
  $form.addEventListener("submit", (e) => {
    e.preventDefault();
    const url = normaliseUrl($input.value);
    if (!url) return;
    navigate(url);
  });

  // Quick-access cards
  document.querySelectorAll(".quick-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.dataset.url;
      if (!url) return;
      navigate(url);
    });
  });

  // Home button — navigate back to the JetVeil new-tab page
  $home.addEventListener("click", () => {
    history.pushState(null, "", "/");
    $input.value         = "";
    $browserFrame.hidden = true;
    $homePg.hidden       = false;
  });
}

main().catch((err) => showError(String(err)));
