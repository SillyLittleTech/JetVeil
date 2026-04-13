/**
 * JetVeil — Scramjet proxy server
 *
 * Handles:
 *  - /bare/   → bare-server-node HTTP proxy (Vercel-compatible, no WebSockets needed)
 *  - /scram/  → Scramjet static files (SW, runtime JS)
 *  - /baremux/→ bare-mux client worker
 *  - /*       → JetVeil public UI (index.html + assets)
 *
 * Deploy to Vercel: one-click, free tier, no extra configuration.
 */

import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createBareServer } from "@tomphttp/bare-server-node";
import { lookup as mimeLookup } from "mime-types";

import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { createRequire } from "node:module";

// ─── Paths ────────────────────────────────────────────────────────────────────

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicPath = resolve(join(__dirname, "../public"));
const scramjetBase = resolve(scramjetPath);
const baremuxBase  = resolve(baremuxPath);
const require = createRequire(import.meta.url);
const bareAsModule3Entrypoint = require.resolve("@mercuryworkshop/bare-as-module3");
const bareAsModule3Base = resolve(
  join(dirname(bareAsModule3Entrypoint), "../dist")
);

// ─── In-memory debug logs ───────────────────────────────────────────────────

const MAX_DEBUG_LOGS = 400;
const serverDebugLogs = [];

function addServerLog(level, message, data = undefined) {
  serverDebugLogs.push({
    ts: new Date().toISOString(),
    level,
    message,
    data,
  });
  if (serverDebugLogs.length > MAX_DEBUG_LOGS) {
    serverDebugLogs.shift();
  }
}

addServerLog("info", "JetVeil server module loaded", {
  node: process.version,
  platform: process.platform,
});

// ─── Bare server (HTTP proxy transport) ──────────────────────────────────────

const bare = createBareServer("/bare/");

// ─── Path helpers ─────────────────────────────────────────────────────────────

/**
 * Safely resolves a URL path segment against a base directory.
 *
 * Strips query strings, normalises the path, and confirms the resolved
 * absolute path is still inside `base` — preventing directory traversal.
 *
 * @param {string} base   Absolute base directory (already resolved).
 * @param {string} rel    Relative path from the URL (untrusted user input).
 * @returns {string|null} Absolute path inside base, or null if traversal detected.
 */
function safeJoin(base, rel) {
  // Strip query string and decode percent-encoding
  let decoded;
  try {
    decoded = decodeURIComponent(rel.split("?")[0]);
  } catch {
    // Malformed percent-encoding — treat as not found rather than crashing
    return null;
  }
  // Normalise to remove ".." sequences
  const normalised = normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "");
  const full = resolve(join(base, normalised));
  // Reject if the resolved path escapes the base directory
  if (!full.startsWith(base + "/") && full !== base) return null;
  return full;
}

// ─── Static file helper ───────────────────────────────────────────────────────

/**
 * Streams a file to the response, or sends a 404 if not found.
 * @param {import("node:http").ServerResponse} res
 * @param {string|null} filePath  Absolute path to the file (null → 404).
 */
function serveFile(res, filePath) {
  if (!filePath) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
    return;
  }
  try {
    const stat = statSync(filePath);
    if (!stat.isFile()) throw new Error("not a file");
    const mime = mimeLookup(filePath) || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": mime,
      "Content-Length": stat.size,
    });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
  }
}

// ─── Request handler ──────────────────────────────────────────────────────────

/**
 * Main HTTP handler — exported for Vercel serverless and also used by the
 * standalone Node.js server below.
 *
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 */
export default function handler(req, res) {
  // Security headers required for Scramjet's SharedArrayBuffer usage
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");

  const rawUrl = req.url ?? "/";
  const url = rawUrl.split("?")[0]; // strip query string for routing

  addServerLog("request", "HTTP request", {
    method: req.method,
    url: rawUrl,
  });

  // ── Debug endpoint ────────────────────────────────────────────────────────
  if (url === "/__debug/logs") {
    const payload = JSON.stringify({
      now: new Date().toISOString(),
      logs: serverDebugLogs,
    });
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Length": Buffer.byteLength(payload),
    });
    res.end(payload);
    return;
  }

  // ── Bare proxy ─────────────────────────────────────────────────────────────
  if (bare.shouldRoute(req)) {
    return bare.routeRequest(req, res);
  }

  // ── Scramjet static files ──────────────────────────────────────────────────
  if (url.startsWith("/scram/")) {
    const rel = url.slice("/scram/".length);
    return serveFile(res, safeJoin(scramjetBase, rel));
  }

  // ── bare-mux client worker ─────────────────────────────────────────────────
  if (url.startsWith("/baremux/")) {
    const rel = url.slice("/baremux/".length);
    return serveFile(res, safeJoin(baremuxBase, rel));
  }

  // ── bare-as-module3 transport files for bare-mux ────────────────────────
  if (url.startsWith("/transports/bare-as-module3/")) {
    const rel = url.slice("/transports/bare-as-module3/".length);
    return serveFile(res, safeJoin(bareAsModule3Base, rel));
  }

  // ── Public UI (JetVeil frontend) ───────────────────────────────────────────
  const relPath = url === "/" ? "index.html" : url;
  const candidate = safeJoin(publicPath, relPath);
  if (candidate && existsSync(candidate) && statSync(candidate).isFile()) {
    return serveFile(res, candidate);
  }

  // SPA fallback — always serve index.html for unmatched routes
  return serveFile(res, join(publicPath, "index.html"));
}

/**
 * Creates a Node HTTP server that serves JetVeil + Scramjet endpoints.
 *
 * The returned server is not listening yet.
 */
export function createJetVeilServer() {
  return createServer()
    .on("request", (req, res) => handler(req, res))
    .on("upgrade", (req, socket, _head) => {
      // Wisp WebSocket support for self-hosted deployments.
      addServerLog("warn", "Upgrade request rejected", {
        url: req.url,
      });
      socket.end();
    });
}

/**
 * Starts the JetVeil server and resolves with bound runtime details.
 *
 * @param {{port?: number, host?: string}} [options]
 */
export function startJetVeilServer(options = {}) {
  const {
    port = parseInt(process.env.PORT ?? "8080", 10),
    host = process.env.HOST ?? "127.0.0.1",
  } = options;

  const server = createJetVeilServer();

  return new Promise((resolveStart, rejectStart) => {
    server.once("error", (err) => rejectStart(err));
    server.listen(port, host, () => {
      const address = server.address();
      const boundPort =
        address && typeof address === "object" ? address.port : port;
      const url = `http://${host}:${boundPort}`;
      addServerLog("info", "JetVeil server listening", {
        host,
        port: boundPort,
        url,
      });
      resolveStart({
        server,
        host,
        port: boundPort,
        url,
        close: () =>
          new Promise((resolveClose, rejectClose) => {
            server.close((err) => {
              if (err) rejectClose(err);
              else resolveClose();
            });
          }),
      });
    });
  });
}

// ─── Standalone Node.js server (local dev / Render / Docker) ─────────────────
// Vercel imports `handler` directly; this block is skipped in that environment.

const isDirectRun =
  !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (!process.env.VERCEL && isDirectRun) {
  startJetVeilServer({
    port: parseInt(process.env.PORT ?? "8080", 10),
    host: "0.0.0.0",
  })
    .then(({ url, server }) => {
      console.log(`JetVeil server running on ${url}`);

      process.on("SIGINT", () => {
        server.close();
        process.exit(0);
      });
      process.on("SIGTERM", () => {
        server.close();
        process.exit(0);
      });
    })
    .catch((err) => {
      console.error("Failed to start JetVeil server:", err);
      process.exit(1);
    });
}

