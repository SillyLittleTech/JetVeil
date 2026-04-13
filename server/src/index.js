/**
 * JetVeil — Scramjet proxy server
 *
 * Handles:
 *  - /bare/   → bare-server-node HTTP proxy (Vercel-compatible, no WebSockets needed)
 *  - /scram/  → Scramjet static files (SW, runtime JS)
 *  - /baremux/→ bare-mux client worker/runtime files
 *  - /baremod/→ bare-as-module3 transport files
 *  - /*       → JetVeil public UI (index.html + assets)
 *
 * Deploy to Vercel: one-click, free tier, no extra configuration.
 */

import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createBareServer } from "@tomphttp/bare-server-node";
import { lookup as mimeLookup } from "mime-types";

// ─── Paths ────────────────────────────────────────────────────────────────────

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicPath = resolve(join(__dirname, "../public"));
const scramjetBase = resolve(join(publicPath, "scram"));
const baremuxBase = resolve(join(publicPath, "baremux"));
const baremodBase = resolve(join(publicPath, "baremod"));

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

  // ── bare transport module (bare-as-module3) ───────────────────────────────
  if (url.startsWith("/baremod/")) {
    const rel = url.slice("/baremod/".length);
    return serveFile(res, safeJoin(baremodBase, rel));
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

// ─── Standalone Node.js server (local dev / Render / Docker) ─────────────────
// Vercel imports `handler` directly; this block is skipped in that environment.

if (!process.env.VERCEL) {
  const PORT = parseInt(process.env.PORT ?? "8080", 10);

  const server = createServer()
    .on("request", (req, res) => handler(req, res))
    .on("upgrade", (req, socket, _head) => {
      // Wisp WebSocket support for self-hosted deployments
      socket.end();
    });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`JetVeil server running on http://localhost:${PORT}`);
  });

  process.on("SIGINT",  () => { server.close(); process.exit(0); });
  process.on("SIGTERM", () => { server.close(); process.exit(0); });
}

