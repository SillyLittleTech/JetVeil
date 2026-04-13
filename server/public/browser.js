/**
 * JetVeil browser.js — client-side Scramjet initialisation and URL routing.
 *
 * Flow:
 *  1. Register SW and force bare-mux to use Bare transport only
 *  2. Initialise Scramjet controller using current bundle API
 *  3. Build/manage a Scramjet iframe for proxied browsing
 *  4. Handle URL bar submissions and Flutter ?url= handoff
 */

const $loading = document.getElementById("loading-screen");
const $error = document.getElementById("error-screen");
const $app = document.getElementById("app");
const $form = document.getElementById("url-form");
const $input = document.getElementById("url-input");
const $home = document.getElementById("home-btn");
const $homePg = document.getElementById("home-page");
const $proxy = document.getElementById("proxy-container");

const swAllowedHostnames = ["localhost", "127.0.0.1"];

const { ScramjetController } = $scramjetLoadController();
const scramjet = new ScramjetController({
  prefix: "/scramjet/",
  files: {
    wasm: "/scram/scramjet.wasm.wasm",
    all: "/scram/scramjet.all.js",
    sync: "/scram/scramjet.sync.js",
  },
});
const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

let proxyFrame = null;

function showError(msg) {
  $loading.hidden = true;
  $error.hidden = false;
  document.getElementById("error-message").textContent = msg;
}

function normaliseUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z0-9-]+(\.[a-z]{2,})/i.test(trimmed)) return `https://${trimmed}`;
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

async function registerSW() {
  if (!navigator.serviceWorker) {
    throw new Error("Your browser does not support service workers.");
  }
  if (
    location.protocol !== "https:" &&
    !swAllowedHostnames.includes(location.hostname)
  ) {
    throw new Error("Service workers require HTTPS on non-local hosts.");
  }
  await navigator.serviceWorker.register("/sw.js");
}

function ensureProxyFrame() {
  if (proxyFrame) return proxyFrame;
  proxyFrame = scramjet.createFrame();
  proxyFrame.frame.id = "proxy-frame";
  proxyFrame.frame.setAttribute("title", "JetVeil proxied content");
  $proxy.appendChild(proxyFrame.frame);
  return proxyFrame;
}

function showHome() {
  $proxy.hidden = true;
  $homePg.hidden = false;
}

function showProxy() {
  $homePg.hidden = true;
  $proxy.hidden = false;
}

function navigate(url) {
  const frame = ensureProxyFrame();
  showProxy();
  frame.go(url);
}

async function setupRuntime() {
  await registerSW();
  // Force bare transport only to avoid WebSocket-based Wisp on Vercel.
  await connection.setTransport("/baremod/index.mjs", [`${location.origin}/bare/`]);
  await scramjet.init();
}

async function main() {
  try {
    await setupRuntime();
  } catch (err) {
    showError(`Proxy bootstrap failed: ${err.message}`);
    return;
  }

  $loading.hidden = true;
  $app.hidden = false;

  const params = new URLSearchParams(window.location.search);
  const targetUrl = params.get("url");
  if (targetUrl) {
    const url = normaliseUrl(targetUrl);
    if (url) {
      $input.value = url;
      navigate(url);
      return;
    }
  }

  $form.addEventListener("submit", (e) => {
    e.preventDefault();
    const url = normaliseUrl($input.value);
    if (!url) return;
    navigate(url);
  });

  document.querySelectorAll(".quick-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.dataset.url;
      if (!url) return;
      $input.value = url;
      navigate(url);
    });
  });

  $home.addEventListener("click", () => {
    history.pushState(null, "", "/");
    $input.value = "";
    showHome();
  });
}

main().catch((err) => showError(String(err)));
