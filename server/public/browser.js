/**
 * JetVeil browser.js — client-side Scramjet initialisation and URL routing.
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
const staleBootstrapParams = ["jetveilRecovery", "jetveilSwControlReload"];

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

let transportReady = false;
let initError = null;
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

function isScramjetSchemaNotFound(err) {
  const message = err?.message ?? "";
  return (
    err?.name === "NotFoundError" &&
    message.includes("transaction") &&
    message.includes("object stores")
  );
}

function deleteIndexedDbByName(name) {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) {
      resolve();
      return;
    }
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error(`failed deleting DB '${name}'`));
    req.onblocked = () => resolve();
  });
}

async function recoverScramjetIndexedDb() {
  const dbNames = new Set(["$scramjet", "scramjet"]);
  const listDbs = indexedDB.databases?.bind(indexedDB);
  if (typeof listDbs === "function") {
    try {
      const dbs = await listDbs();
      for (const db of dbs) {
        if (!db?.name) continue;
        if (db.name.toLowerCase().includes("scramjet")) dbNames.add(db.name);
      }
    } catch {
      // Best-effort DB discovery.
    }
  }
  for (const dbName of dbNames) {
    await deleteIndexedDbByName(dbName);
  }
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

async function registerSWWithTimeout(timeoutMs = 6000) {
  await Promise.race([
    registerSW(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Service worker registration timed out.")), timeoutMs)
    ),
  ]);
}

async function ensureBareTransport() {
  if (transportReady) return;
  await connection.setTransport("/baremod/index.mjs", [`${location.origin}/bare/`]);
  transportReady = true;
}

function startScramjetInit() {
  scramjet
    .init()
    .catch(async (err) => {
      if (!isScramjetSchemaNotFound(err)) throw err;
      await recoverScramjetIndexedDb();
      await scramjet.init();
    })
    .catch((err) => {
      initError = err;
      console.error("Scramjet init failed:", err);
    });
}

function clearStaleBootstrapParams() {
  const url = new URL(location.href);
  let changed = false;
  for (const param of staleBootstrapParams) {
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      changed = true;
    }
  }
  if (changed) {
    history.replaceState(null, "", url.toString());
  }
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

async function navigate(url) {
  try {
    if (initError) throw initError;
    await registerSWWithTimeout();
    await ensureBareTransport();
    startScramjetInit();
    const frame = ensureProxyFrame();
    showProxy();
    frame.go(url);
  } catch (err) {
    showError(`Navigation failed: ${err.message}`);
  }
}

async function main() {
  clearStaleBootstrapParams();
  startScramjetInit();

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
