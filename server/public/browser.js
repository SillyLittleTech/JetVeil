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
const $frameHost = document.getElementById("frame-host");
const $debugBtn = document.getElementById("debug-btn");
const $debugToggle = document.getElementById("debug-toggle");
const $debugToggleError = document.getElementById("debug-toggle-error");
const $debugPanel = document.getElementById("debug-panel");
const $debugClose = document.getElementById("debug-close");
const $debugContent = document.getElementById("debug-content");
const $debugPause = document.getElementById("debug-pause");
const $debugCopy = document.getElementById("debug-copy");

const appLogs = [];
const MAX_APP_LOGS = 300;
let serverLogs = [];
let debugPanelOpen = false;
let debugPanelPaused = false;
let debugPollTimer = null;
let scramFrame = null;

const sjBootParams = new URLSearchParams(window.location.search);
const sjRecoveryAttempted = sjBootParams.get("sj_recover") === "1";
const sjSwBootAttempted = sjBootParams.get("sj_sw") === "1";

const SCRAMJET_CONFIG = {
  prefix: "/scramjet/",
  files: {
    wasm: "/scram/scramjet.wasm.wasm",
    all: "/scram/scramjet.all.js",
    sync: "/scram/scramjet.sync.js",
  },
};

function serialiseLogArg(arg) {
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}${arg.stack ? `\n${arg.stack}` : ""}`;
  }
  if (typeof arg === "string") return arg;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function pushAppLog(level, ...args) {
  appLogs.push({
    ts: new Date().toISOString(),
    level,
    message: args.map(serialiseLogArg).join(" "),
  });
  if (appLogs.length > MAX_APP_LOGS) appLogs.shift();
}

window.addEventListener("error", (event) => {
  pushAppLog("error", "window.error", event.message || event.error || "unknown");
});

window.addEventListener("unhandledrejection", (event) => {
  pushAppLog("error", "unhandledrejection", event.reason || "unknown");
});

const nativeConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
};

console.log = (...args) => {
  pushAppLog("log", ...args);
  nativeConsole.log(...args);
};
console.info = (...args) => {
  pushAppLog("info", ...args);
  nativeConsole.info(...args);
};
console.warn = (...args) => {
  pushAppLog("warn", ...args);
  nativeConsole.warn(...args);
};
console.error = (...args) => {
  pushAppLog("error", ...args);
  nativeConsole.error(...args);
};
console.debug = (...args) => {
  pushAppLog("debug", ...args);
  nativeConsole.debug(...args);
};

function renderDebugPanel() {
  if (!$debugContent) return;

  const appLogLines = appLogs.slice(-120).map((entry) => {
    return `[APP ${entry.ts}] [${entry.level.toUpperCase()}] ${entry.message}`;
  });

  const serverLogLines = serverLogs.slice(-120).map((entry) => {
    const data = entry.data ? ` ${JSON.stringify(entry.data)}` : "";
    return `[SRV ${entry.ts}] [${String(entry.level || "info").toUpperCase()}] ${entry.message}${data}`;
  });

  const output = [
    "=== Advanced Debugging Info ===",
    "",
    `URL: ${window.location.href}`,
    `Time: ${new Date().toISOString()}`,
    `Status: ${debugPanelPaused ? "[PAUSED]" : "[LIVE]"}`,
    "",
    "--- App Logs (browser) ---",
    ...(appLogLines.length ? appLogLines : ["(none yet)"]),
    "",
    "--- Server Logs ---",
    ...(serverLogLines.length ? serverLogLines : ["(none yet)"]),
  ].join("\n");

  $debugContent.textContent = output;
}

async function refreshServerLogs() {
  if (debugPanelPaused) return; // Don't fetch if paused
  try {
    const resp = await fetch("/__debug/logs", { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const payload = await resp.json();
    if (Array.isArray(payload.logs)) serverLogs = payload.logs;
  } catch (err) {
    pushAppLog("warn", "Failed to fetch server logs", err?.message || err);
  }
  renderDebugPanel();
}

function setDebugPanelOpen(open) {
  debugPanelOpen = open;
  if ($debugPanel) $debugPanel.hidden = !open;

  if (debugPollTimer) {
    clearInterval(debugPollTimer);
    debugPollTimer = null;
  }

  if (open) {
    refreshServerLogs();
    debugPollTimer = setInterval(refreshServerLogs, 2000);
  }
}

[$debugBtn, $debugToggle, $debugToggleError].forEach((btn) => {
  btn?.addEventListener("click", () => setDebugPanelOpen(!debugPanelOpen));
});
$debugClose?.addEventListener("click", () => setDebugPanelOpen(false));
$debugPause?.addEventListener("click", () => {
  debugPanelPaused = !debugPanelPaused;
  $debugPause.textContent = debugPanelPaused ? "▶ Resume" : "⏸ Pause";
  if (!debugPanelPaused) {
    renderDebugPanel();
  }
});
$debugCopy?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($debugContent.textContent);
    const originalText = $debugCopy.textContent;
    $debugCopy.textContent = "✓ Copied!";
    setTimeout(() => {
      $debugCopy.textContent = originalText;
    }, 2000);
  } catch (err) {
    pushAppLog("error", "Failed to copy logs", err);
  }
});

pushAppLog("info", "JetVeil browser runtime loaded");

// Listen for service worker messages (fetch/error events)
navigator.serviceWorker?.addEventListener("message", (event) => {
  if (event.data.type === "sw-fetch") {
    pushAppLog("debug", `[SW] Fetch ${event.data.method} ${event.data.url}`, {
      isScramjetRoute: event.data.isScramjetRoute,
      routeResult: event.data.routeResult,
      isFrameRequest: event.data.isFrameRequest,
    });
  } else if (event.data.type === "sw-error") {
    pushAppLog("warn", `[SW] Error handling ${event.data.url}`, event.data.error);
  }
});

/** Show the error screen with a message. */
function showError(msg) {
  $loading.hidden = true;
  $error.hidden   = false;
  const text = typeof msg === "string" && msg.trim()
    ? msg
    : "An unknown error occurred.";
  document.getElementById("error-message").textContent = text;
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

/** Remove stale Scramjet IndexedDB state (schema mismatch recovery). */
async function resetScramjetDb() {
  if (!("indexedDB" in window)) return;
  await new Promise((resolve) => {
    const req = indexedDB.deleteDatabase("$scramjet");
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

async function hardResetScramjetState() {
  pushAppLog("warn", "Performing hard Scramjet state reset");
  // Keep Service Worker registration intact; removing it can break /scramjet/
  // routing until a full controlled-page reload occurs.
  await resetScramjetDb();
}

async function withTimeout(promise, timeoutMs, timeoutMessage) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function waitWithSoftTimeout(promise, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      promise.then(() => ({ timedOut: false })),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function createMemoryDbShim() {
  const stores = new Map();
  return {
    async get(storeName, key) {
      const store = stores.get(storeName);
      if (!store) return undefined;
      return store.get(key);
    },
    async put(storeName, value, key) {
      let store = stores.get(storeName);
      if (!store) {
        store = new Map();
        stores.set(storeName, store);
      }
      store.set(key, value);
      return key;
    },
  };
}

function reloadForScramjetRecovery() {
  const url = new URL(window.location.href);
  url.searchParams.set("sj_recover", "1");
  window.location.replace(url.toString());
}

function reloadForServiceWorkerControl() {
  const url = new URL(window.location.href);
  url.searchParams.set("sj_sw", "1");
  window.location.replace(url.toString());
}

async function main() {
  pushAppLog("info", "Starting initialization pipeline");

  // ── 1. Configure bare-mux transport ──────────────────────────────────────
  try {
    pushAppLog("info", "Configuring bare-mux transport");
    const { BareMuxConnection } = await import("/baremux/index.mjs");
    const conn = new BareMuxConnection("/baremux/worker.js");
    const bareServerUrl = new URL("/bare/", window.location.origin).toString();

    // Use bare-as-module3 transport (served by this server) over /bare/
    await conn.setTransport("/transports/bare-as-module3/index.mjs", [bareServerUrl]);
    pushAppLog("info", "bare-mux transport configured", bareServerUrl);
  } catch (err) {
    pushAppLog("error", "Transport configuration failed", err);
    showError(`Failed to configure transport: ${err.message}`);
    return;
  }

  // ── 2. Initialise Scramjet ────────────────────────────────────────────────
  let controller;
  try {
    pushAppLog("info", "Initializing Scramjet controller");
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service workers are not supported in this environment");
    }

    await navigator.serviceWorker.register("/scramjet.sw.js", {
      scope: "/",
      type: "module",
    });

    try {
      await navigator.serviceWorker.ready;
    } catch {
      // Ignore; we still run controller checks below.
    }

    if (!navigator.serviceWorker.controller) {
      pushAppLog("warn", "No active service worker controller yet; waiting for controllerchange");
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 1500);
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => {
            clearTimeout(timeout);
            resolve();
          },
          { once: true }
        );
      });

      if (!navigator.serviceWorker.controller) {
        if (!sjSwBootAttempted) {
          pushAppLog("warn", "Still not controlled by service worker; reloading once");
          reloadForServiceWorkerControl();
          return;
        }
        pushAppLog("warn", "Proceeding without active service worker controller");
      }
    }

    const { ScramjetController } = await import("/scram/scramjet.bundle.js");

    async function initControllerOnce({ memoryDb = false, softTimeout = false } = {}) {
      if (memoryDb) {
        const dbShim = createMemoryDbShim();
        class ScramjetControllerMemoryDb extends ScramjetController {
          async openIDB() {
            this.db = dbShim;
            return dbShim;
          }
        }
        pushAppLog("debug", "Creating ScramjetController with memory DB", { config: SCRAMJET_CONFIG });
        controller = new ScramjetControllerMemoryDb(SCRAMJET_CONFIG);
      } else {
        pushAppLog("debug", "Creating ScramjetController with real DB", { config: SCRAMJET_CONFIG });
        controller = new ScramjetController(SCRAMJET_CONFIG);
      }

      if (softTimeout) {
        const result = await waitWithSoftTimeout(controller.init(), 6000);
        if (result.timedOut) {
          pushAppLog("warn", "Scramjet init soft-timeout reached; continuing startup");
        }
        return;
      }

      await withTimeout(
        controller.init(),
        6000,
        "Scramjet init timed out while opening local storage/database"
      );
    }

    try {
      await initControllerOnce();
    } catch (initErr) {
      const msg = String(initErr?.message || initErr || "");
      const isSchemaIssue = msg.includes("object stores was not found");
      const isTimeout = msg.includes("timed out");
      if (!isSchemaIssue && !isTimeout) throw initErr;

      await hardResetScramjetState();
      pushAppLog("warn", "Scramjet state reset applied; retrying init");

      try {
        await initControllerOnce();
      } catch (retryErr) {
        pushAppLog("warn", "Normal Scramjet init still failing; switching to in-memory DB fallback");
        let fallbackSucceeded = false;

        try {
          await initControllerOnce({ memoryDb: true, softTimeout: true });
          pushAppLog("warn", "Running Scramjet with in-memory DB fallback");
          fallbackSucceeded = true;
          // Continue normal startup path.
        } catch (fallbackErr) {
          pushAppLog("error", "In-memory DB fallback failed", fallbackErr);
        }

        if (fallbackSucceeded) {
          // Fallback init is good enough to continue startup.
        } else {
          if (!sjRecoveryAttempted) {
            pushAppLog("warn", "Retry failed; reloading once for clean recovery");
            reloadForScramjetRecovery();
            return;
          }
          throw retryErr;
        }
      }
    }
    pushAppLog("info", "Scramjet initialization succeeded");
    
    // Send config to service worker so it can handle proxied requests
    if (navigator.serviceWorker.controller) {
      pushAppLog("debug", "Sending Scramjet config to service worker");
      navigator.serviceWorker.controller.postMessage({
        type: "SCRAMJET_CONFIG",
        payload: SCRAMJET_CONFIG,
      });
    }
  } catch (err) {
    pushAppLog("error", "Scramjet initialization failed", err);
    showError(`Scramjet init failed: ${err.message}`);
    return;
  }

  // ── 3. Show app UI ────────────────────────────────────────────────────────
  $loading.hidden = true;
  $app.hidden     = false;
  pushAppLog("info", "UI ready");

  function navigateTo(url) {
    pushAppLog("debug", "navigateTo called", { url, controllerExists: !!controller, frameExists: !!scramFrame?.frame });
    
    if (!scramFrame) {
      pushAppLog("debug", "Creating Scramjet frame", { controllerExists: !!controller });
      try {
        // Check if controller has createFrame method
        if (!controller || typeof controller.createFrame !== 'function') {
          pushAppLog("error", "Controller does not have createFrame method", { 
            controllerType: typeof controller,
            methods: Object.getOwnPropertyNames(Object.getPrototypeOf(controller || {}))
          });
          return;
        }
        
        scramFrame = controller.createFrame();
        pushAppLog("debug", "Frame created", { frameType: typeof scramFrame, frameKeys: Object.keys(scramFrame || {}) });
        
        if (!scramFrame || !scramFrame.frame) {
          pushAppLog("error", "Frame creation resulted in null or invalid frame", { scramFrame });
          return;
        }
        
        // Add event listeners to track frame behavior
        if (scramFrame.frame && scramFrame.frame.tagName === "IFRAME") {
          scramFrame.frame.addEventListener("load", () => {
            pushAppLog("debug", "Frame load event fired", { src: scramFrame.frame.src });
          });
          scramFrame.frame.addEventListener("error", (err) => {
            pushAppLog("error", "Frame error event fired", { error: String(err) });
          });
          pushAppLog("debug", "Frame event listeners added");
        }
        
        $frameHost.appendChild(scramFrame.frame);
        pushAppLog("debug", "Frame appended to DOM", { frameHostChildren: $frameHost.children.length, tagName: scramFrame.frame.tagName });
      } catch (err) {
        pushAppLog("error", "Failed to create frame", { error: String(err), stack: err.stack });
        return;
      }
    }
    
    $homePg.hidden = true;
    $frameHost.hidden = false;
    
    pushAppLog("info", "navigateTo -> go", url);
    try {
      if (typeof scramFrame.go !== 'function') {
        pushAppLog("error", "Frame does not have go method", { frameKeys: Object.keys(scramFrame) });
        return;
      }
      
      // Call go() and track result
      const result = scramFrame.go(url);
      pushAppLog("debug", "Frame navigation initiated", { url, returnType: typeof result });
      
      // If result is a promise, wait for it
      if (result && typeof result.catch === 'function') {
        result.catch(err => {
          pushAppLog("error", "Frame navigation promise rejected", { error: String(err) });
        });
      }
    } catch (err) {
      pushAppLog("error", "Frame navigation failed", { error: String(err), stack: err.stack });
    }
  }

  // ── 4. Handle ?url= from Flutter app ─────────────────────────────────────
  const params    = new URLSearchParams(window.location.search);
  const targetUrl = params.get("url");
  if (targetUrl) {
    const url = normaliseUrl(targetUrl);
    if (url) {
      $input.value    = url;
      navigateTo(url);
      return;
    }
  }

  // ── 5. Wire up URL bar ────────────────────────────────────────────────────
  $form.addEventListener("submit", (e) => {
    e.preventDefault();
    const url = normaliseUrl($input.value);
    if (!url) return;
    navigateTo(url);
  });

  // Quick-access cards
  document.querySelectorAll(".quick-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.dataset.url;
      if (!url) return;
      $input.value   = url;
      navigateTo(url);
    });
  });

  // Home button — navigate back to the JetVeil new-tab page
  $home.addEventListener("click", () => {
    history.pushState(null, "", "/");
    $input.value   = "";
    $homePg.hidden = false;
    $frameHost.hidden = true;
  });
}

main().catch((err) => showError(String(err)));
