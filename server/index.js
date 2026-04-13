import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { createBareServer } from "@tomphttp/bare-server-node";
import express from "express";
import { createServer } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const publicPath = fileURLToPath(new URL("./public/", import.meta.url));
const bare = createBareServer("/bare/");
const app = express();

app.use((_, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  next();
});

app.use(express.static(publicPath));
app.use("/uv/", express.static(uvPath));

app.use((req, res) => {
  if (bare.shouldRoute(req)) {
    bare.routeRequest(req, res);
    return;
  }

  res.status(404).sendFile(join(publicPath, "404.html"));
});

if (!process.env.VERCEL) {
  const server = createServer();

  server.on("request", (req, res) => {
    if (bare.shouldRoute(req)) {
      bare.routeRequest(req, res);
      return;
    }

    app(req, res);
  });

  server.on("upgrade", (req, socket, head) => {
    if (bare.shouldRoute(req)) {
      bare.routeUpgrade(req, socket, head);
      return;
    }

    socket.end();
  });

  const port = Number.parseInt(process.env.PORT || "8080", 10);

  server.listen({ port }, () => {
    console.log(`JetVeil proxy listening on http://localhost:${port}`);
  });
}

// Vercel uses serverless handlers. HTTP upgrade handling is not available.
export default app;
