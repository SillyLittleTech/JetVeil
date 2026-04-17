import { ScramjetServiceWorker } from "/scram/scramjet.bundle.js";

const scramjet = new ScramjetServiceWorker();
let configReady = false;
let scramjetConfig = null;
const DEFAULT_SCRAMJET_CONFIG = {
  prefix: "/scramjet/",
  files: {
    wasm: "/scram/scramjet.wasm.wasm",
    all: "/scram/scramjet.all.js",
    sync: "/scram/scramjet.sync.js",
  },
};

function normaliseConfigShape(config) {
  if (!config || typeof config !== "object") return { ...DEFAULT_SCRAMJET_CONFIG };
  const candidate = config.config && typeof config.config === "object"
    ? config.config
    : config;

  return {
    ...DEFAULT_SCRAMJET_CONFIG,
    ...candidate,
    files: {
      ...DEFAULT_SCRAMJET_CONFIG.files,
      ...(candidate.files && typeof candidate.files === "object" ? candidate.files : {}),
    },
  };
}

function isPrefixConfigError(err) {
  return String(err?.message || err || "").includes("reading 'prefix'");
}

function applyConfigToRuntime(config) {
  const normalized = normaliseConfigShape(config);

  // Scramjet reads config from both instance and global contexts depending on
  // internal code path; set both to avoid undefined config at route/fetch time.
  scramjet.config = normalized;
  globalThis.$scramjet = {
    ...(globalThis.$scramjet && typeof globalThis.$scramjet === "object"
      ? globalThis.$scramjet
      : {}),
    ...normalized,
    config: normalized,
  };
}

async function ensureConfig() {
  if (configReady) {
    if (!scramjet.config?.prefix) applyConfigToRuntime(scramjet.config ?? scramjetConfig);
    return;
  }
  
  // If config was sent via postMessage, use it
  if (scramjetConfig) {
    applyConfigToRuntime(scramjetConfig);
    configReady = true;
    return;
  }
  
  try {
    await scramjet.loadConfig();
    applyConfigToRuntime(scramjet.config ?? globalThis.$scramjet);
    configReady = true;
  } catch (err) {
    console.error('[SW] Failed to load Scramjet config:', err);
    // Keep runtime alive with default config so route/fetch calls cannot crash.
    applyConfigToRuntime(DEFAULT_SCRAMJET_CONFIG);
    configReady = true;
  }
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "SCRAMJET_CONFIG") {
    scramjetConfig = event.data.payload;
    applyConfigToRuntime(scramjetConfig);
    configReady = true;
    console.log('[SW] Received Scramjet config:', scramjetConfig);
  }
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    (async () => {
      const reqUrl = new URL(event.request.url);
      const looksLikeScramjetRoute = reqUrl.pathname.startsWith("/scramjet/");
      const isFrameRequest = event.request.destination === "document" || event.request.destination === "iframe";

      try {
        await ensureConfig();
        let routeResult = false;
        try {
          routeResult = Boolean(scramjet.route(event));
        } catch (routeErr) {
          if (!isPrefixConfigError(routeErr)) throw routeErr;
          applyConfigToRuntime(scramjet.config ?? scramjetConfig ?? DEFAULT_SCRAMJET_CONFIG);
          routeResult = Boolean(scramjet.route(event));
        }

        // Log all requests for debugging
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: "sw-fetch",
              url: event.request.url,
              method: event.request.method,
              isScramjetRoute: looksLikeScramjetRoute,
              routeResult,
              isFrameRequest,
            });
          });
        });

        if (routeResult || looksLikeScramjetRoute) {
          try {
            return await scramjet.fetch(event);
          } catch (fetchErr) {
            if (!isPrefixConfigError(fetchErr)) throw fetchErr;
            applyConfigToRuntime(scramjet.config ?? scramjetConfig ?? DEFAULT_SCRAMJET_CONFIG);
            return await scramjet.fetch(event);
          }
        }

        return fetch(event.request);
      } catch (err) {
        // Log error for debugging
        console.error('[SW] Fetch error:', err, { url: event.request.url });
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: "sw-error",
              url: event.request.url,
              error: String(err),
            });
          });
        });

        // Do not fall back to app HTML for Scramjet routes; that creates a
        // recursive app-in-iframe failure mode.
        if (looksLikeScramjetRoute) {
          try {
            return await scramjet.fetch(event);
          } catch {
            const reason = String(err?.message || err || "Unknown Scramjet error");
            const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>JetVeil couldn't open this page</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0d0d17;
        --panel: #151522;
        --panel-2: #1e1e2e;
        --text: #f5f7fb;
        --muted: #a8b0c2;
        --accent: #00e5ff;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: radial-gradient(circle at top, #19192a 0, var(--bg) 60%);
        color: var(--text);
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      }
      .card {
        width: min(640px, calc(100vw - 32px));
        padding: 28px;
        border-radius: 24px;
        background: linear-gradient(180deg, rgba(21,21,34,.98), rgba(13,13,23,.98));
        border: 1px solid rgba(255,255,255,.08);
        box-shadow: 0 24px 80px rgba(0,0,0,.45);
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(0,229,255,.12);
        color: var(--accent);
        font-weight: 700;
      }
      h1 {
        margin: 18px 0 10px;
        font-size: 28px;
        line-height: 1.1;
      }
      p { color: var(--muted); line-height: 1.55; }
      .panel {
        margin-top: 18px;
        padding: 16px;
        border-radius: 16px;
        background: var(--panel);
        border: 1px solid rgba(255,255,255,.07);
      }
      .actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 20px;
      }
      button {
        appearance: none;
        border: 0;
        border-radius: 12px;
        padding: 12px 16px;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      .primary { background: var(--accent); color: #081016; }
      .secondary { background: var(--panel-2); color: var(--text); }
      code {
        display: block;
        margin-top: 10px;
        padding: 12px;
        border-radius: 12px;
        background: rgba(255,255,255,.05);
        color: #ffb199;
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-word;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="badge">JetVeil proxy error</div>
      <h1>This page couldn't be loaded through Scramjet.</h1>
      <p>
        JetVeil hit a proxy/runtime issue while opening this site. You can retry,
        or check the advanced debug panel for more details.
      </p>
      <div class="panel">
        <strong>What happened</strong>
        <code>${reason.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code>
      </div>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Retry</button>
        <button class="secondary" onclick="history.back()">Go Back</button>
      </div>
    </main>
  </body>
</html>`;
            return new Response(html, {
              status: 502,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            });
          }
        }
        return fetch(event.request);
      }
    })()
  );
});
