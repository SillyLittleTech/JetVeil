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

// #region agent log
function debugLog(hypothesisId, location, message, data = {}) {
  const payload = { hypothesisId, location, message, data, timestamp: Date.now() };
  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/__debug-log", body);
      return;
    }
    fetch("/__debug-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {}
}
// #endregion

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
  // #region agent log
  debugLog("H1", "browser.js:main:entry", "Starting browser init", {
    href: location.href,
    hasScramjet: typeof $scramjet !== "undefined",
    hasController: typeof $scramjetController !== "undefined",
    hasServiceWorker: "serviceWorker" in navigator,
  });
  // #endregion

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
    // updateViaCache:"none" ensures the browser always re-fetches controller.sw.js
    // (imported via importScripts) on every SW update check, so a redeployment of
    // scramjet-controller is always picked up without needing scram-sw.js to change.
    await navigator.serviceWorker.register("/scram-sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    setStep("Step 3/4 — Waiting for service worker to activate…");
    const reg = await navigator.serviceWorker.ready;
    await reg.update();
    const activeWorker = reg.active;
    const controllerWorker = navigator.serviceWorker.controller;

    const swControlReloadKey = "jetveil_sw_control_reload";
    const hasScramjetController =
      controllerWorker && new URL(controllerWorker.scriptURL).pathname === "/scram-sw.js";
    if (!hasScramjetController) {
      const hasRetriedControl = localStorage.getItem(swControlReloadKey) === "1";
      if (!hasRetriedControl) {
        localStorage.setItem(swControlReloadKey, "1");
        window.location.reload();
        return;
      }
      localStorage.removeItem(swControlReloadKey);
      showError(
        "Service worker installed but is not controlling this page. " +
        "Try clearing site data, then reload.",
      );
      return;
    }
    localStorage.removeItem(swControlReloadKey);
    sw = controllerWorker;
    // #region agent log
    debugLog("H1", "browser.js:main:sw-ready", "Service worker ready", {
      activeScriptURL: activeWorker?.scriptURL ?? null,
      activeState: activeWorker?.state ?? null,
      controllerScriptURL: controllerWorker?.scriptURL ?? null,
    });
    // #endregion
  } catch (err) {
    showError(`Service worker registration failed: ${err.message}`);
    return;
  }

  // ── 5a. Pre-load the WASM binary ────────────────────────────────────────
  // controller.wait() resolves only after BOTH the SW "ready" RPC AND
  // loadScramjetWasm() complete.  loadScramjetWasm() fetches the WASM file
  // independently from inside the Controller constructor, so if that fetch
  // stalls the whole init hangs even after the SW handshake succeeds.
  //
  // Fix: read the full WASM body here, call $scramjet.setWasm() directly, then
  // redirect config.wasmPath to an in-memory blob URL.  loadScramjetWasm()
  // will then fetch from the blob (≈instant, no network) and complete
  // immediately.  This removes WASM download latency from controller.wait().
  setStep("Step 4/4 — Loading WASM binary…");
  const wasmPath = $scramjetController.config.wasmPath || "/scramjet/scramjet.wasm";
  try {
    const wasmFetchTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`WASM headers timed out (${wasmPath})`)), 8_000)
    );
    const wasmResp = await Promise.race([fetch(wasmPath), wasmFetchTimeout]);
    if (!wasmResp.ok) {
      showError(`WASM endpoint returned HTTP ${wasmResp.status} (${wasmPath}). Check deployment.`);
      return;
    }

    const wasmBodyTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`WASM body timed out after 20s (${wasmPath})`)), 20_000)
    );
    const wasmBuffer = await Promise.race([wasmResp.arrayBuffer(), wasmBodyTimeout]);

    // Pre-set the WASM so scramjet has it immediately.
    $scramjet.setWasm(wasmBuffer);

    // Point the Controller at a blob URL so its internal loadScramjetWasm()
    // fetch is instant (no second network round-trip).
    const wasmBlob = new Blob([wasmBuffer], { type: "application/wasm" });
    $scramjetController.config.wasmPath = URL.createObjectURL(wasmBlob);
  } catch (err) {
    showError(`WASM load failed: ${err.message}`);
    return;
  }

  // ── 5b. Instantiate the scramjet Controller ──────────────────────────────
  // WASM is pre-loaded — the only remaining async work in controller.wait() is
  // the SW "ready" RPC (SW → main page MessagePort handshake).
  setStep("Step 4/4 — Handshaking with service worker…");
  let controller;
  try {
    const { Controller } = $scramjetController;
    controller = new Controller({ serviceworker: sw, transport });
    const controllerMethods = controller?.methods;
    if (controllerMethods && typeof controllerMethods.request === "function") {
      const originalRequest = controllerMethods.request.bind(controllerMethods);
      controllerMethods.request = async (payload) => {
        if (payload && typeof payload.rawClientUrl === "string") {
          try {
            new URL(payload.rawClientUrl);
          } catch {
            // #region agent log
            debugLog("H3", "browser.js:controller:request", "Dropping invalid rawClientUrl", {
              rawClientUrl: payload.rawClientUrl,
            });
            // #endregion
            payload.rawClientUrl = undefined;
          }
        }
        return originalRequest(payload);
      };
    }
    // #region agent log
    debugLog("H1", "browser.js:main:controller-wait", "Waiting for controller handshake", {
      wasmPath: $scramjetController.config.wasmPath,
      swState: sw?.state ?? null,
    });
    // #endregion

    await controller.wait();
  } catch (err) {
    // #region agent log
    debugLog("H1", "browser.js:main:controller-error", "Controller handshake failed", {
      error: err?.message ?? String(err),
    });
    // #endregion
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

