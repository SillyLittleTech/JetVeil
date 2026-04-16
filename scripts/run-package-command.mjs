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
const npmCommand = "npm";

function run(commandName, args, cwd) {
  const result = spawnSync(commandName, args, {
    cwd,
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 0) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function installDependencies(folder, args = ["ci"]) {
  const targetDir = resolve(rootDir, folder);
  const nodeModulesPath = resolve(targetDir, "node_modules");
  if (existsSync(nodeModulesPath)) return;

  run(npmCommand, args, targetDir);
}

function ensureDependencies() {
  // Desktop builds bundle the local server runtime, so make sure its
  // dependencies exist before packaging. Scramjet's install hook currently
  // rejects npm, so we skip package scripts for the server install.
  if (packageFolder === "desktop") {
    installDependencies("server", ["ci", "--ignore-scripts"]);
  }

  installDependencies(packageFolder);
}

ensureDependencies();
run(npmCommand, ["run", command], packageDir);
