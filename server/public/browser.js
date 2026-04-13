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

  // ── 2. Configure bare-mux transport (Bare HTTP only — no Wisp/WebSocket) ──
  //
  // Scramjet uses bare-mux internally and will use whatever transport was last
  // stored in the SharedWorker.  Other Scramjet deployments (e.g. the official
  // scramjet-app) default to libcurl-transport or epoxy-transport, both of
  // which tunnel through Wisp — a WebSocket-based protocol.  Vercel serverless
  // functions terminate WebSocket upgrade requests immediately, so any Wisp
  // transport is dead on arrival here.
  //
  // We MUST explicitly force bare-as-module3, which proxies requests via plain
  // HTTP POST to /bare/ — a standard serverless-compatible endpoint.
  //
  // We use setRemoteTransport() (not setTransport()) so the BareTransport
  // instance lives in this window rather than inside the SharedWorker.
  // setTransport() requires the SharedWorker to evaluate a dynamic function
  // string and run import() — a chain that can silently fail if the worker is
  // killed or restarted.  setRemoteTransport() is simpler: the window handles
  // every HTTP request directly via a MessageChannel port, matching how
  // Ultraviolet reliably operates on Vercel.
  try {
    const conn = new BareMux.BareMuxConnection("/baremux/worker.js");

    // Warn in the console if a previous session left a non-bare transport
    // (e.g. libcurl/Wisp) configured in the SharedWorker.  We always override
    // it unconditionally below — this check is purely diagnostic.
    try {
      const prev = await conn.getTransport();
      if (prev && typeof prev === "string" && !prev.includes("bare-as-module3")) {
        console.warn(
          `[JetVeil] Replacing previous transport "${prev}" with bare HTTP transport.` +
          " Wisp/WebSocket transports do not work on Vercel serverless."
        );
      }
    } catch { /* SharedWorker may not have started yet — safe to ignore */ }

    // Import the transport module here in the window (not in the SharedWorker)
    // so there is no risk of the eval/import chain inside the worker failing.
    const { default: BareTransport } = await import("/transport/index.mjs");
    const transport = new BareTransport(location.origin + "/bare/");
    await conn.setRemoteTransport(transport, "bare-as-module3");
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
      if (err.name === "NotFoundError" || err.name === "InvalidStateError" ||
          (err.message && err.message.toLowerCase().includes("object store"))) {
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
