/**
 * JetVeil — Ultraviolet web server (Vercel-optimized)
 *
 * Modeled after the legacy ACProx Vercel server layout:
 * - express app for static/vendor routing
 * - bare server routing in front of express
 * - bare upgrade handling for environments that support it
 */

import express from "express";
import { createServer } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { createBareServer } from "@tomphttp/bare-server-node";
import { bareModulePath } from "@mercuryworkshop/bare-as-module3";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const publicPath = fileURLToPath(new URL("../public/", import.meta.url));
const bare = createBareServer("/bare/");

const app = express();
app.use(express.static(publicPath));
app.use("/uv/", express.static(uvPath));
app.use("/baremux/", express.static(baremuxPath));
app.use("/baremod/", express.static(bareModulePath));

// Keep SPA behavior for JetVeil while matching ACProx's server style.
app.use((req, res) => {
  res.sendFile(join(publicPath, "index.html"));
});

/**
 * Main HTTP handler for Vercel serverless usage.
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 */
export default function handler(req, res) {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");

  if (bare.shouldRoute(req)) {
    return bare.routeRequest(req, res);
  }

  return app(req, res);
}

if (!process.env.VERCEL) {
  const PORT = parseInt(process.env.PORT ?? "8080", 10);

  const server = createServer();
  server.on("request", (req, res) => handler(req, res));
  server.on("upgrade", (req, socket, head) => {
    if (bare.shouldRoute(req)) {
      bare.routeUpgrade(req, socket, head);
    } else {
      socket.end();
    }
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`JetVeil server running on http://localhost:${PORT}`);
  });

  process.on("SIGINT", () => {
    server.close();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    server.close();
    process.exit(0);
  });
}

