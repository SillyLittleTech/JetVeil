/**
 * copy-assets.mjs — JetVeil pre-deployment asset builder
 *
 * Copies static dist files from node_modules into public/ subdirectories so
 * that Vercel's @vercel/node Lambda can serve them via createReadStream without
 * relying on node_modules being accessible at Lambda runtime.
 *
 * Also creates public/scram/scramjet.worker.js, which scramjet v2 expects but
 * does not ship — it is a copy of scramjet.js (the v2 unified runtime bundle
 * works in both page and worker contexts).
 *
 * Output layout:
 *   public/scram/       ← @mercuryworkshop/scramjet dist (+ scramjet.worker.js)
 *   public/controller/  ← @mercuryworkshop/scramjet-controller dist
 *   public/bam/         ← @mercuryworkshop/bare-as-module3 dist
 */

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

const __dirname  = fileURLToPath(new URL(".", import.meta.url));
const root       = resolve(join(__dirname, ".."));          // server/
const nodeModules = join(root, "node_modules");
const publicDir  = join(root, "public");

// ─── Source directories ───────────────────────────────────────────────────────

const scramjetDist   = join(nodeModules, "@mercuryworkshop", "scramjet",              "dist");
const controllerDist = join(nodeModules, "@mercuryworkshop", "scramjet-controller",   "dist");
const bamDist        = join(nodeModules, "@mercuryworkshop", "bare-as-module3",        "dist");

for (const [label, dir] of [
  ["@mercuryworkshop/scramjet dist",            scramjetDist],
  ["@mercuryworkshop/scramjet-controller dist", controllerDist],
  ["@mercuryworkshop/bare-as-module3 dist",     bamDist],
]) {
  if (!existsSync(dir)) {
    console.error(`ERROR: ${label} not found at ${dir}`);
    console.error("Run 'npm install' first.");
    process.exit(1);
  }
}

// ─── Output directories ───────────────────────────────────────────────────────

const outScram      = join(publicDir, "scram");
const outController = join(publicDir, "controller");
const outBam        = join(publicDir, "bam");

for (const dir of [outScram, outController, outBam]) {
  mkdirSync(dir, { recursive: true });
}

// ─── Copy dist trees ──────────────────────────────────────────────────────────

cpSync(scramjetDist,   outScram,      { recursive: true });
cpSync(controllerDist, outController, { recursive: true });
cpSync(bamDist,        outBam,        { recursive: true });

// ─── Create scramjet.worker.js shim ──────────────────────────────────────────
//
// Scramjet v2 dropped the separate worker bundle; the unified scramjet.js
// works in both page and worker (importScripts) contexts.  However, some
// scramjet initialisation paths still request <scramjetPrefix>/scramjet.worker.js
// before the prefix config can be overridden.  Serving scramjet.js content
// under that filename satisfies the request without any runtime overhead.

const workerShimSrc  = join(scramjetDist, "scramjet.js");
const workerShimDest = join(outScram, "scramjet.worker.js");
writeFileSync(workerShimDest, readFileSync(workerShimSrc));

console.log("copy-assets: done");
console.log(`  public/scram/       ← scramjet dist (+ scramjet.worker.js shim)`);
console.log(`  public/controller/  ← scramjet-controller dist`);
console.log(`  public/bam/         ← bare-as-module3 dist`);
