import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { createBareServer } from "@tomphttp/bare-server-node";
import { bareModulePath } from "@mercuryworkshop/bare-as-module3";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import express from "express";
import { createServer } from "node:http";
import { hostname } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const publicPath = fileURLToPath(new URL("./public/", import.meta.url));

const bare = createBareServer("/bare/");
const app = express();

app.use(express.static(publicPath));
app.use("/uv/", express.static(uvPath));
app.use("/baremux/", express.static(baremuxPath));
app.use("/baremod/", express.static(bareModulePath));

app.use((req, res) => {
  res.sendFile(join(publicPath, "index.html"));
});

const server = createServer();

server.on("request", (req, res) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");

  if (bare.shouldRoute(req)) {
    bare.routeRequest(req, res);
  } else {
    app(req, res);
  }
});

server.on("upgrade", (req, socket, head) => {
  if (bare.shouldRoute(req)) {
    bare.routeUpgrade(req, socket, head);
  } else {
    socket.end();
  }
});

let port = parseInt(process.env.PORT || "");

if (isNaN(port)) port = 8080;

server.on("listening", () => {
  const address = server.address();

  console.log("Listening on:");
  console.log(`\thttp://localhost:${address.port}`);
  console.log(`\thttp://${hostname()}:${address.port}`);
  console.log(
    `\thttp://${
      address.family === "IPv6" ? `[${address.address}]` : address.address
    }:${address.port}`,
  );
});

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

function shutdown(signal) {
  console.log(`${signal} signal received: closing HTTP server`);

  Promise.all([
    new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) {
          console.error("Error closing server:", err);
          reject(err);
        } else {
          console.log("Server closed successfully.");
          resolve();
        }
      });
    }),
    new Promise((resolve, reject) => {
      bare.close((err) => {
        if (err) {
          console.error("Error closing bare connection:", err);
          reject(err);
        } else {
          console.log("Bare connection closed successfully.");
          resolve();
        }
      });
    }),
  ])
    .then(() => {
      console.log("All resources closed, exiting process.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Error during shutdown:", err);
      process.exit(1);
    });
}

server.listen({ port });
