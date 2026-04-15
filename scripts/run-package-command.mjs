import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const packageFolder = process.argv[2];
const command = process.argv[3];

if (!packageFolder || !command) {
  console.error("Usage: node scripts/run-package-command.mjs <package-folder> <npm-script>");
  process.exit(1);
}

const packageDir = resolve(rootDir, packageFolder);
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function run(commandName, args, cwd) {
  const result = spawnSync(commandName, args, {
    cwd,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 0) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function ensureDependencies() {
  const nodeModulesPath = resolve(packageDir, "node_modules");
  if (existsSync(nodeModulesPath)) return;
  run(npmCommand, ["ci"], packageDir);
}

ensureDependencies();
run(npmCommand, ["run", command], packageDir);