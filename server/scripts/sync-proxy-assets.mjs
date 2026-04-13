import { cpSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { bareModulePath } from "@mercuryworkshop/bare-as-module3";

const here = fileURLToPath(new URL(".", import.meta.url));
const publicRoot = resolve(here, "../public");

function syncDir(label, sourcePath, targetName) {
  const targetPath = resolve(publicRoot, targetName);
  rmSync(targetPath, { recursive: true, force: true });
  mkdirSync(targetPath, { recursive: true });
  cpSync(sourcePath, targetPath, { recursive: true });
  console.log(`synced ${label} -> ${targetPath}`);
}

syncDir("scramjet", scramjetPath, "scram");
syncDir("bare-mux", baremuxPath, "baremux");
syncDir("bare-as-module3", bareModulePath, "baremod");
