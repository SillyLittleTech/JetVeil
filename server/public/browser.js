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
const $tabStrip = document.getElementById("tab-strip");
const $navBack = document.getElementById("nav-back");
const $navForward = document.getElementById("nav-forward");
const $navReload = document.getElementById("nav-reload");
const $navNewTab = document.getElementById("nav-new-tab");
const $navCloseTab = document.getElementById("nav-close-tab");
const $navSettings = document.getElementById("nav-settings");
const $debugBtn = document.getElementById("debug-btn");
const $debugToggle = document.getElementById("debug-toggle");
const $debugToggleError = document.getElementById("debug-toggle-error");
const $debugPanel = document.getElementById("debug-panel");
const $debugClose = document.getElementById("debug-close");
const $debugContent = document.getElementById("debug-content");
const $debugPause = document.getElementById("debug-pause");
const $debugCopy = document.getElementById("debug-copy");
const $browserPrefsPanel = document.getElementById("browser-prefs-panel");
const $browserPrefsClose = document.getElementById("browser-prefs-close");
const $browserPrefsForm = document.getElementById("browser-prefs-form");
const $bypassHostsInput = document.getElementById("bypass-hosts");
const $compactToolbar = document.getElementById("compact-toolbar");
const $accentPresets = document.getElementById("accent-presets");

const appLogs = [];
const MAX_APP_LOGS = 300;
let serverLogs = [];
let debugPanelOpen = false;
let debugPanelPaused = false;
let debugPollTimer = null;

const sjBootParams = new URLSearchParams(window.location.search);
const sjRecoveryAttempted = sjBootParams.get("sj_recover") === "1";
const sjSwBootAttempted = sjBootParams.get("sj_sw") === "1";
const SERVICE_WORKER_VERSION = "2026-04-17-1";

const SCRAMJET_CONFIG = {
  prefix: "/scramjet/",
  files: {
    wasm: "/scram/scramjet.wasm.wasm",
    all: "/scram/scramjet.all.js",
    sync: "/scram/scramjet.sync.js",
  },
};

const ACCENT_PRESETS = [
  { name: "Jet Cyan", color: "#00E5FF" },
  { name: "Neon Violet", color: "#AB47BC" },
  { name: "Emerald", color: "#00E676" },
  { name: "Solar Orange", color: "#FF6D00" },
  { name: "Rose Red", color: "#FF1744" },
  { name: "Sky Blue", color: "#40C4FF" },
];

const BROWSER_PREFS_KEY = "jetveil-browser-prefs";

const DEFAULT_BROWSER_PREFS = {
  bypassHostsText: "",
  compactToolbar: false,
  accentColor: "#00E5FF",
};

let browserPrefs = loadBrowserPrefs();
let browserPrefsOpen = false;
let tabs = [];
let activeTabId = null;
let tabSequence = 0;
let controller = null;

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

function loadBrowserPrefs() {
  try {
    const raw = localStorage.getItem(BROWSER_PREFS_KEY);
    if (!raw) return { ...DEFAULT_BROWSER_PREFS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_BROWSER_PREFS,
      ...parsed,
      bypassHostsText: String(parsed?.bypassHostsText ?? ""),
      compactToolbar: Boolean(parsed?.compactToolbar ?? false),
      accentColor: String(parsed?.accentColor ?? DEFAULT_BROWSER_PREFS.accentColor),
    };
  } catch {
    return { ...DEFAULT_BROWSER_PREFS };
  }
}

function saveBrowserPrefs() {
  try {
    localStorage.setItem(BROWSER_PREFS_KEY, JSON.stringify(browserPrefs));
  } catch {
    // Ignore storage failures; preferences are best-effort.
  }
}

function getBypassRules() {
  return browserPrefs.bypassHostsText
    .split(/[\n,]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .map((entry) => entry.replace(/^https?:\/\//, "").split("/")[0]);
}

function hexToRgb(hex) {
  const normalized = String(hex).trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function applyBrowserAccent(accentColor) {
  const fallback = DEFAULT_BROWSER_PREFS.accentColor;
  const rgb = hexToRgb(accentColor) ?? hexToRgb(fallback);
  if (!rgb) return;

  const accent = `#${String(accentColor || fallback).replace(/^#/, "")}`;
  document.documentElement.style.setProperty("--accent", accent);
  document.documentElement.style.setProperty(
    "--accent-dim",
    `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`
  );

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute("content", accent);
}

function renderAccentPresets() {
  if (!$accentPresets) return;

  $accentPresets.innerHTML = "";

  ACCENT_PRESETS.forEach(({ name, color }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "accent-preset";
    button.setAttribute("aria-label", name);

    if (browserPrefs.accentColor?.toLowerCase() === color.toLowerCase()) {
      button.classList.add("selected");
    }

    const swatch = document.createElement("span");
    swatch.className = "accent-preset-swatch";
    swatch.style.background = color;

    const label = document.createElement("span");
    label.className = "accent-preset-label";
    label.textContent = name;

    button.append(swatch, label);
    button.addEventListener("click", () => {
      browserPrefs = {
        ...browserPrefs,
        accentColor: color,
      };
      saveBrowserPrefs();
      applyBrowserAccent(color);
      renderAccentPresets();
      pushAppLog("info", "Browser accent updated", { color, name });
    });

    $accentPresets.appendChild(button);
  });
}

function isBypassedUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  const host = url.hostname.toLowerCase();
  return getBypassRules().some((rule) => {
    if (rule.startsWith("*.")) {
      const suffix = rule.slice(1);
      return host === rule.slice(2) || host.endsWith(suffix);
    }
    return host === rule || host.endsWith(`.${rule}`);
  });
}

function formatTabLabel(rawUrl) {
  if (!rawUrl) return "New Tab";
  try {
    const url = new URL(rawUrl);
    return url.hostname || rawUrl;
  } catch {
    return rawUrl;
  }
}

function getActiveTab() {
  return tabs.find((tab) => tab.id === activeTabId) ?? null;
}

function syncToolbarState() {
  const activeTab = getActiveTab();
  const hasFrame = Boolean(activeTab?.frame || activeTab?.directFrame);

  if ($navBack) $navBack.disabled = !hasFrame;
  if ($navForward) $navForward.disabled = !hasFrame;
  if ($navReload) $navReload.disabled = !hasFrame;
  if ($navCloseTab) $navCloseTab.disabled = tabs.length === 0;

  if ($input && activeTab?.url && document.activeElement !== $input) {
    $input.value = activeTab.url;
  }
}

function updateLayoutMode() {
  document.body.classList.toggle("compact-toolbar", browserPrefs.compactToolbar);
}

function updateBrowserTheme() {
  applyBrowserAccent(browserPrefs.accentColor);
  updateLayoutMode();
  renderAccentPresets();
}

function setBrowserPrefsOpen(open) {
  browserPrefsOpen = open;
  if ($browserPrefsPanel) $browserPrefsPanel.hidden = !open;
  if (open) {
    $bypassHostsInput.value = browserPrefs.bypassHostsText;
    $compactToolbar.checked = browserPrefs.compactToolbar;
  }
}

function updateTabButton(tab) {
  if (!tab.button) return;
  tab.button.classList.toggle("active", tab.id === activeTabId);
  tab.label.textContent = tab.title || formatTabLabel(tab.url);
  tab.button.title = tab.url || "New tab";
}

function updateAllTabButtons() {
  tabs.forEach(updateTabButton);
}

function ensureFrameForTab(tab) {
  if (tab.frame) return tab.frame;

  const frame = controller.createFrame();
  frame.frame.hidden = true;
  frame.frame.classList.add("scramjet-frame");

  frame.addEventListener("navigate", (event) => {
    tab.url = event.url;
    tab.title = formatTabLabel(event.url);
    updateTabButton(tab);
    syncToolbarState();
  });

  frame.addEventListener("urlchange", (event) => {
    tab.url = event.url;
    tab.title = formatTabLabel(event.url);
    updateTabButton(tab);
    syncToolbarState();
  });

  frame.frame.addEventListener("load", () => {
    try {
      const win = frame.frame.contentWindow;
      if (!win || win.__jetveilDarkModePatched) return;

      const originalMatchMedia = typeof win.matchMedia === "function"
        ? win.matchMedia.bind(win)
        : null;

      if (originalMatchMedia) {
        win.matchMedia = (query) => {
          const normalized = String(query || "").toLowerCase();
          if (normalized.includes("prefers-color-scheme: dark")) {
            return {
              matches: true,
              media: String(query || ""),
              onchange: null,
              addEventListener() {},
              removeEventListener() {},
              addListener() {},
              removeListener() {},
              dispatchEvent() { return false; },
            };
          }
          return originalMatchMedia(query);
        };
      }

      if (win.document?.documentElement) {
        win.document.documentElement.style.colorScheme = "dark";
        win.document.documentElement.style.setProperty("color-scheme", "dark");
      }

      win.__jetveilDarkModePatched = true;
    } catch {
      // Best-effort only; some frames may reject script access.
    }
  });

  tab.frame = frame;
  $frameHost.appendChild(frame.frame);
  return frame;
}

function ensureDirectFrameForTab(tab) {
  if (tab.directFrame) return tab.directFrame;

  const iframe = document.createElement("iframe");
  iframe.hidden = true;
  iframe.classList.add("direct-frame");
  iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");

  const frame = {
    frame: iframe,
    currentUrl: "",
    go(rawUrl) {
      this.currentUrl = rawUrl;
      tab.url = rawUrl;
      tab.title = formatTabLabel(rawUrl);
      updateTabButton(tab);
      syncToolbarState();
      iframe.src = rawUrl;
    },
    back() {
      try {
        iframe.contentWindow?.history.back();
      } catch (error) {
        pushAppLog("warn", "Direct frame back failed", { error: String(error) });
      }
    },
    forward() {
      try {
        iframe.contentWindow?.history.forward();
      } catch (error) {
        pushAppLog("warn", "Direct frame forward failed", { error: String(error) });
      }
    },
    reload() {
      try {
        iframe.contentWindow?.location.reload();
      } catch {
        if (this.currentUrl) {
          iframe.src = this.currentUrl;
        }
      }
    },
  };

  iframe.addEventListener("load", () => {
    if (!frame.currentUrl) return;
    tab.url = frame.currentUrl;
    tab.title = formatTabLabel(frame.currentUrl);
    updateTabButton(tab);
    syncToolbarState();

    window.setTimeout(() => {
      if (!tab.directFrame || tab.mode !== "direct" || tab.url !== frame.currentUrl) return;
      try {
        const currentHref = iframe.contentWindow?.location?.href;
        if (currentHref === "about:blank" || currentHref === "about:srcdoc") {
          pushAppLog("warn", "Bypassed site refused embedding; opening directly", { rawUrl: frame.currentUrl });
          window.location.assign(frame.currentUrl);
        }
      } catch {
        // If the frame is cross-origin and accessible only by the browser,
        // the destination likely loaded successfully.
      }
    }, 1200);
  });

  tab.directFrame = frame;
  $frameHost.appendChild(iframe);
  return frame;
}

function showTab(tabId) {
  activeTabId = tabId;

  tabs.forEach((tab) => {
    const isActive = tab.id === tabId;
    if (tab.frame?.frame) tab.frame.frame.hidden = !(isActive && tab.mode === "proxied");
    if (tab.directFrame?.frame) tab.directFrame.frame.hidden = !(isActive && tab.mode === "direct");
  });

  const activeTab = getActiveTab();
  const hasFrame = Boolean(activeTab?.frame || activeTab?.directFrame);
  $homePg.hidden = hasFrame;
  $frameHost.hidden = !hasFrame;

  if (activeTab?.url) {
    $input.value = activeTab.url;
  } else {
    $input.value = "";
  }

  updateAllTabButtons();
  syncToolbarState();
}

function createTab({ title = "New Tab", url = "", activate = true } = {}) {
  const tab = {
    id: `tab-${++tabSequence}`,
    title,
    url,
    mode: "proxied",
    frame: null,
    directFrame: null,
    button: null,
    label: null,
  };

  const button = document.createElement("button");
  button.type = "button";
  button.className = "tab-chip";

  const label = document.createElement("span");
  label.className = "tab-chip-label";
  label.textContent = title;

  const close = document.createElement("span");
  close.className = "tab-chip-close";
  close.textContent = "×";
  close.setAttribute("aria-hidden", "true");

  button.append(label, close);
  button.addEventListener("click", () => showTab(tab.id));
  close.addEventListener("click", (event) => {
    event.stopPropagation();
    closeTab(tab.id);
  });

  tab.button = button;
  tab.label = label;
  tabs.push(tab);
  $tabStrip.appendChild(button);
  updateTabButton(tab);

  if (activate) showTab(tab.id);

  if (url) {
    navigateTab(tab, url);
  }

  return tab;
}

function closeTab(tabId) {
  if (tabs.length <= 1) {
    const tab = getActiveTab() ?? tabs[0];
    if (!tab) return;

    tab.button?.classList.add("active");
    tab.frame?.frame?.remove();
    tab.directFrame?.frame?.remove();
    tab.frame = null;
    tab.directFrame = null;
    tab.mode = "home";
    tab.url = "";
    tab.title = "Home";
    updateTabButton(tab);
    showTab(tab.id);
    syncToolbarState();
    return;
  }

  const index = tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) return;

  const [tab] = tabs.splice(index, 1);
  tab.button?.remove();
  tab.frame?.frame?.remove();
  tab.directFrame?.frame?.remove();

  if (activeTabId === tabId) {
    const nextTab = tabs[index] ?? tabs[index - 1] ?? tabs[0] ?? null;
    if (nextTab) showTab(nextTab.id);
  } else {
    syncToolbarState();
  }
}

function navigateTab(tab, rawUrl) {
  if (!tab) return;

  if (isBypassedUrl(rawUrl)) {
    const frame = ensureDirectFrameForTab(tab);
    tab.mode = "direct";
    tab.url = rawUrl;
    tab.title = formatTabLabel(rawUrl);
    updateTabButton(tab);
    showTab(tab.id);
    pushAppLog("info", "Bypassing proxy for URL", { rawUrl });
    frame.go(rawUrl);
    return;
  }

  const frame = ensureFrameForTab(tab);
  tab.mode = "proxied";
  tab.url = rawUrl;
  tab.title = formatTabLabel(rawUrl);
  updateTabButton(tab);
  showTab(tab.id);
  frame.go(rawUrl);
}

function navigateTo(rawUrl) {
  let tab = getActiveTab();
  if (!tab) {
    tab = createTab({ activate: true });
  }
  navigateTab(tab, rawUrl);
}

function activeFrame() {
  const activeTab = getActiveTab();
  return activeTab?.mode === "direct"
    ? activeTab.directFrame
    : activeTab?.frame ?? activeTab?.directFrame ?? null;
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
    : "JetVeil couldn't start the proxy backend.";
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
  try {
    pushAppLog("info", "Initializing Scramjet controller");
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service workers are not supported in this environment");
    }

    await navigator.serviceWorker.register(`/scramjet.sw.js?v=${SERVICE_WORKER_VERSION}`, {
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

  updateBrowserTheme();

  if (!tabs.length) {
    createTab({ activate: true });
  } else if (activeTabId) {
    showTab(activeTabId);
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

  // Browser controls
  $navBack?.addEventListener("click", () => activeFrame()?.back());
  $navForward?.addEventListener("click", () => activeFrame()?.forward());
  $navReload?.addEventListener("click", () => activeFrame()?.reload());
  $navNewTab?.addEventListener("click", () => createTab({ activate: true }));
  $navCloseTab?.addEventListener("click", () => closeTab(activeTabId));
  $navSettings?.addEventListener("click", () => setBrowserPrefsOpen(!browserPrefsOpen));

  $home.addEventListener("click", () => {
    createTab({ activate: true });
  });

  $browserPrefsClose?.addEventListener("click", () => setBrowserPrefsOpen(false));
  $browserPrefsForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    browserPrefs = {
      ...browserPrefs,
      bypassHostsText: $bypassHostsInput.value,
      compactToolbar: $compactToolbar.checked,
    };
    saveBrowserPrefs();
    updateBrowserTheme();
    setBrowserPrefsOpen(false);
    syncToolbarState();
    pushAppLog("info", "Browser preferences saved");
  });

  window.addEventListener("keydown", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;

    const key = event.key.toLowerCase();
    if (key === "l") {
      event.preventDefault();
      $input.focus();
      $input.select();
    } else if (key === "t") {
      event.preventDefault();
      createTab({ activate: true });
    } else if (key === "w") {
      event.preventDefault();
      closeTab(activeTabId);
    } else if (key === "r") {
      event.preventDefault();
      activeFrame()?.reload();
    }
  });
}

main().catch((err) => showError(String(err)));
