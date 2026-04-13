/**
 * JetVeil browser.js — client-side Scramjet initialisation and URL routing.
 *
 * Flow:
 *  1. Configure bare-mux to use the bare-server HTTP transport (/bare/)
 *  2. Initialise ScramjetController and register the service worker
 *  3. If the page was opened with ?url=<target> (from the Flutter app),
 *     navigate to that URL through the proxy automatically
 *  4. Handle the URL bar form submission
 */

const $loading = document.getElementById("loading-screen");
const $error   = document.getElementById("error-screen");
const $app     = document.getElementById("app");
const $form    = document.getElementById("url-form");
const $input   = document.getElementById("url-input");
const $home    = document.getElementById("home-btn");
const $homePg  = document.getElementById("home-page");

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
  // ── 1. Configure bare-mux transport ──────────────────────────────────────
  try {
    const { BareMuxConnection } = await import("/baremux/index.js");
    const conn = new BareMuxConnection("/baremux/worker.js");
    // Use bare-server transport via bare-as-module.
    await conn.setTransport("/baremod/index.mjs", ["/bare/"]);
  } catch (err) {
    showError(`Failed to configure transport: ${err.message}`);
    return;
  }

  // ── 2. Initialise Scramjet ────────────────────────────────────────────────
  let scramjet;
  try {
    const {
      ScramjetController,
      ScramjetBareClient,
      encodeUrl,
    } = await import("/scramjet/scramjet.all.js");
    scramjet = { controller: new ScramjetController(), encodeUrl };
    await scramjet.controller.init({
      files: {
        wasm: "/scramjet/scramjet.wasm.wasm",
        worker: "/scramjet/scramjet.sync.js",
        client: "/scramjet/scramjet.bundle.js",
        shared: "/scramjet/scramjet.all.js",
      },
      defaultFlags: {
        serviceworkers: false,
        naiiveRewriter: false,
        captureErrors: true,
      },
      siteFlags: {},
    });
    ScramjetBareClient.data = "/baremod/index.mjs";
    ScramjetBareClient.bareURL = "/bare/";
  } catch (err) {
    showError(`Scramjet init failed: ${err.message}`);
    return;
  }

  // ── 3. Show app UI ────────────────────────────────────────────────────────
  $loading.hidden = true;
  $app.hidden     = false;

  // ── 4. Handle ?url= from Flutter app ─────────────────────────────────────
  const params    = new URLSearchParams(window.location.search);
  const targetUrl = params.get("url");
  if (targetUrl) {
    const url = normaliseUrl(targetUrl);
    if (url) {
      $input.value    = url;
      $homePg.hidden  = true;
      const encoded = scramjet.encodeUrl(url);
      scramjet.controller.serviceWorker.controller.postMessage({
        scramjet$type: "baremuxinit",
        data: "/baremux/worker.js",
      });
      location.href = "/scramjet/" + encoded;
      return;
    }
  }

  // ── 5. Wire up URL bar ────────────────────────────────────────────────────
  $form.addEventListener("submit", (e) => {
    e.preventDefault();
    const url = normaliseUrl($input.value);
    if (!url) return;
    $homePg.hidden = true;
    const encoded = scramjet.encodeUrl(url);
    scramjet.controller.serviceWorker.controller.postMessage({
      scramjet$type: "baremuxinit",
      data: "/baremux/worker.js",
    });
    location.href = "/scramjet/" + encoded;
  });

  // Quick-access cards
  document.querySelectorAll(".quick-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.dataset.url;
      if (!url) return;
      $input.value   = url;
      $homePg.hidden = true;
      const encoded = scramjet.encodeUrl(url);
      scramjet.controller.serviceWorker.controller.postMessage({
        scramjet$type: "baremuxinit",
        data: "/baremux/worker.js",
      });
      location.href = "/scramjet/" + encoded;
    });
  });

  // Home button — navigate back to the JetVeil new-tab page
  $home.addEventListener("click", () => {
    history.pushState(null, "", "/");
    $input.value   = "";
    $homePg.hidden = false;
  });
}

main().catch((err) => showError(String(err)));
