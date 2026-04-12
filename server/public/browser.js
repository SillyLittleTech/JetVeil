/**
 * JetVeil browser.js — client-side Scramjet v2 initialisation and URL routing.
 *
 * Flow:
 *  1. Load scramjet_bundled.js + controller.api.js via <script> tags in index.html
 *     (they set window.$scramjet and window.$scramjetController respectively)
 *  2. Create a bare-as-module3 ClientV3 as the ProxyTransport (connects to /bare/)
 *  3. Register the service worker (scram-sw.js) and obtain the active SW handle
 *  4. Instantiate the scramjet-controller Controller with the SW + transport
 *  5. Create a proxy Frame bound to the <iframe id="proxy-frame"> element
 *  6. If the page was opened with ?url=<target> navigate automatically
 *  7. Handle the URL bar form submission and quick-access cards
 */

/* global $scramjet, $scramjetController */

const $loading  = document.getElementById("loading-screen");
const $loadLbl  = document.getElementById("loading-label");
const $error    = document.getElementById("error-screen");
const $app      = document.getElementById("app");
const $form     = document.getElementById("url-form");
const $input    = document.getElementById("url-input");
const $home     = document.getElementById("home-btn");
const $homePg   = document.getElementById("home-page");
const $frame    = document.getElementById("proxy-frame");

/** Update the visible loading label so users can see which step we are on. */
function setStep(msg) {
  if ($loadLbl) $loadLbl.textContent = msg;
}

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
  // ── 1. Ensure $scramjet + $scramjetController are present ────────────────
  setStep("Step 1/4 — Checking Scramjet runtime…");
  if (typeof $scramjet === "undefined" || typeof $scramjetController === "undefined") {
    showError("Scramjet runtime failed to load. Please reload the page.");
    return;
  }

  // ── 2. Point controller config to our served paths ───────────────────────
  // scramjetPath  → where rewritten pages load scramjet (sets $scramjet global)
  // wasmPath      → the oxc WASM module used by the JS rewriter
  // injectPath    → injected into every proxied page
  $scramjetController.config.scramjetPath = "/scramjet/scramjet_bundled.js";
  $scramjetController.config.wasmPath     = "/scramjet/scramjet.wasm";
  $scramjetController.config.injectPath   = "/controller/controller.inject.js";

  // ── 3. Create a bare-server transport ────────────────────────────────────
  setStep("Step 2/4 — Loading transport…");
  let transport;
  try {
    const { default: ClientV3 } = await import("/bam/index.mjs");
    transport = new ClientV3(new URL("/bare/", location.href));
    await transport.init();
  } catch (err) {
    showError(`Failed to configure transport: ${err.message}`);
    return;
  }

  // ── 4. Register the service worker ───────────────────────────────────────
  setStep("Step 3/4 — Registering service worker…");
  if (!("serviceWorker" in navigator)) {
    showError("Service workers are not supported in this browser.");
    return;
  }
  let sw;
  try {
    await navigator.serviceWorker.register("/scram-sw.js", { scope: "/" });
    setStep("Step 3/4 — Waiting for service worker to activate…");
    const reg = await navigator.serviceWorker.ready;
    sw = reg.active;
  } catch (err) {
    showError(`Service worker registration failed: ${err.message}`);
    return;
  }

  // ── 5. Instantiate the scramjet Controller ───────────────────────────────
  setStep("Step 4/4 — Starting Scramjet controller…");
  let controller;
  try {
    const { Controller } = $scramjetController;
    controller = new Controller({ serviceworker: sw, transport });

    // Timeout so a hang shows a readable error instead of an infinite spinner.
    const timeout = new Promise((_, reject) =>
      setTimeout(() =>
        reject(new Error(
          "Timed out waiting for Scramjet controller (step 4/4). " +
          "The service worker may not be communicating with the page. " +
          "Try a hard refresh (Ctrl+Shift+R / Cmd+Shift+R)."
        )), 20_000)
    );

    await Promise.race([controller.wait(), timeout]);
  } catch (err) {
    showError(`Scramjet controller init failed: ${err.message}`);
    return;
  }

  // Create a reusable proxy frame bound to the iframe element
  const proxyFrame = controller.createFrame($frame);

  /** Navigate the proxy iframe to the given URL. */
  function go(url) {
    $homePg.hidden = true;
    $frame.hidden  = false;
    $input.value   = url;
    proxyFrame.go(url);
  }

  /** Return to the JetVeil home page. */
  function goHome() {
    $frame.hidden  = true;
    $homePg.hidden = false;
    $input.value   = "";
    history.pushState(null, "", "/");
  }

  // ── 6. Show app UI ────────────────────────────────────────────────────────
  $loading.hidden = true;
  $app.hidden     = false;

  // ── 7. Handle ?url= from Flutter app ─────────────────────────────────────
  const params    = new URLSearchParams(window.location.search);
  const targetUrl = params.get("url");
  if (targetUrl) {
    const url = normaliseUrl(targetUrl);
    if (url) { go(url); return; }
  }

  // ── 8. Wire up URL bar ────────────────────────────────────────────────────
  $form.addEventListener("submit", (e) => {
    e.preventDefault();
    const url = normaliseUrl($input.value);
    if (url) go(url);
  });

  // Quick-access cards
  document.querySelectorAll(".quick-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.dataset.url;
      if (url) go(url);
    });
  });

  // Home button — navigate back to the JetVeil new-tab page
  $home.addEventListener("click", goHome);
}

main().catch((err) => showError(String(err)));

