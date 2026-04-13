/**
 * JetVeil browser.js — Ultraviolet client bootstrap and URL routing.
 *
 * Flow:
 *  1. Configure bare-mux to use the bare HTTP transport (/bare/)
 *  2. Register the Ultraviolet service worker under /uv/service/
 *  3. If opened with ?url=<target>, navigate there immediately
 *  4. Handle URL bar and quick access cards
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

function navigateToUltraviolet(url) {
  if (!url) return;
  const target = __uv$config.prefix + __uv$config.encodeUrl(url);
  window.location.href = target;
}

let transportReadyPromise;
function ensureTransport() {
  if (transportReadyPromise) return transportReadyPromise;
  transportReadyPromise = (async () => {
    const { BareMuxConnection } = await import("/baremux/index.js");
    const conn = new BareMuxConnection("/baremux/worker.js");
    await conn.setTransport("/baremod/index.mjs", ["/bare/"]);
  })();
  return transportReadyPromise;
}

async function main() {
  // ── 1. Register Ultraviolet service worker ────────────────────────────────
  try {
    if (!("serviceWorker" in navigator)) {
      throw new Error("service workers are not supported in this browser");
    }
    await navigator.serviceWorker.register("/uv/sw.js", {
      scope: __uv$config.prefix,
    });
  } catch (err) {
    showError(`Ultraviolet init failed: ${err.message}`);
    return;
  }

  // ── 2. Show app UI ────────────────────────────────────────────────────────
  $loading.hidden = true;
  $app.hidden     = false;

  // ── 3. Handle ?url= from Flutter app ─────────────────────────────────────
  const params    = new URLSearchParams(window.location.search);
  const targetUrl = params.get("url");
  if (targetUrl) {
    const url = normaliseUrl(targetUrl);
    if (url) {
      $input.value    = url;
      $homePg.hidden  = true;
      try {
        await ensureTransport();
      } catch (err) {
        showError(`Failed to configure transport: ${err.message}`);
        return;
      }
      navigateToUltraviolet(url);
      return;
    }
  }

  // ── 4. Wire up URL bar ────────────────────────────────────────────────────
  $form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const url = normaliseUrl($input.value);
    if (!url) return;
    $homePg.hidden = true;
    try {
      await ensureTransport();
    } catch (err) {
      showError(`Failed to configure transport: ${err.message}`);
      return;
    }
    navigateToUltraviolet(url);
  });

  // Quick-access cards
  document.querySelectorAll(".quick-card").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const url = btn.dataset.url;
      if (!url) return;
      $input.value   = url;
      $homePg.hidden = true;
      try {
        await ensureTransport();
      } catch (err) {
        showError(`Failed to configure transport: ${err.message}`);
        return;
      }
      navigateToUltraviolet(url);
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
