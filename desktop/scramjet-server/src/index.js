/**
 * JetVeil desktop backend — local ScramJet server.
 *
 * This server is intended for desktop builds only and is started locally
 * by the Flutter app. It keeps the existing ScramJet routing behavior while
 * the web/Vercel deployment uses Ultraviolet in `/server`.
 */

import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createBareServer } from "@tomphttp/bare-server-node";
import { lookup as mimeLookup } from "mime-types";

import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { bareModulePath } from "@mercuryworkshop/bare-as-module3";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicPath = resolve(join(__dirname, "../public"));
const scramjetBase = resolve(scramjetPath);
const baremuxBase = resolve(baremuxPath);
const baremodBase = resolve(bareModulePath);

const bare = createBareServer("/bare/");

function safeJoin(base, rel) {
  let decoded;
  try {
    decoded = decodeURIComponent(rel.split("?")[0]);
  } catch {
    return null;
  }
  const normalised = normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "");
  const full = resolve(join(base, normalised));
  if (!full.startsWith(base + "/") && full !== base) return null;
  return full;
}

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

export default function handler(req, res) {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");

  const rawUrl = req.url ?? "/";
  const url = rawUrl.split("?")[0];

  if (bare.shouldRoute(req)) {
    return bare.routeRequest(req, res);
  }

  if (url.startsWith("/scramjet/")) {
    const rel = url.slice("/scramjet/".length);
    return serveFile(res, safeJoin(scramjetBase, rel));
  }

  if (url.startsWith("/scram/")) {
    const rel = url.slice("/scram/".length);
    return serveFile(res, safeJoin(scramjetBase, rel));
  }

  if (url.startsWith("/baremux/")) {
    const rel = url.slice("/baremux/".length);
    return serveFile(res, safeJoin(baremuxBase, rel));
  }

  if (url.startsWith("/baremod/")) {
    const rel = url.slice("/baremod/".length);
    return serveFile(res, safeJoin(baremodBase, rel));
  }

  const relPath = url === "/" ? "index.html" : url;
  const candidate = safeJoin(publicPath, relPath);
  if (candidate && existsSync(candidate) && statSync(candidate).isFile()) {
    return serveFile(res, candidate);
  }

  return serveFile(res, join(publicPath, "index.html"));
}

const PORT = parseInt(process.env.PORT ?? "8080", 10);

const server = createServer()
  .on("request", (req, res) => handler(req, res))
  .on("upgrade", (_req, socket) => {
    socket.end();
  });

server.listen(PORT, "127.0.0.1", () => {
  console.log(`JetVeil desktop ScramJet server on http://127.0.0.1:${PORT}`);
});

process.on("SIGINT", () => {
  server.close();
  process.exit(0);
});
process.on("SIGTERM", () => {
  server.close();
  process.exit(0);
});
