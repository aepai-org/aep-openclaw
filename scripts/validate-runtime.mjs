import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
function resolveOpenClawCli(startDirectory) {
  let currentDirectory = startDirectory;
  while (true) {
    const candidate = join(currentDirectory, "node_modules", "openclaw", "openclaw.mjs");
    if (existsSync(candidate)) return candidate;
    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      throw new Error("Unable to locate the installed OpenClaw CLI");
    }
    currentDirectory = parentDirectory;
  }
}

const openclawCli = resolveOpenClawCli(packageRoot);
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("npm_execpath is required for package validation");
const validationRoot = mkdtempSync(join(tmpdir(), "aep-openclaw-validation-"));
const stateDir = join(validationRoot, "state");
const environment = { ...process.env, OPENCLAW_STATE_DIR: stateDir };

try {
  const packOutput = execFileSync(
    process.execPath,
    [npmCli, "pack", "--pack-destination", validationRoot, "--json"],
    { cwd: packageRoot, encoding: "utf8" },
  );
  const [{ filename }] = JSON.parse(packOutput);
  const tarball = join(validationRoot, filename);
  assert.equal(readFileSync(tarball).length > 0, true);

  execFileSync(
    process.execPath,
    [openclawCli, "plugins", "install", `npm-pack:${tarball}`, "--force"],
    { cwd: packageRoot, env: environment, stdio: "ignore" },
  );
  const inspection = JSON.parse(
    execFileSync(
      process.execPath,
      [openclawCli, "plugins", "inspect", "aep", "--runtime", "--json"],
      { cwd: packageRoot, env: environment, encoding: "utf8" },
    ),
  );
  const help = execFileSync(
    process.execPath,
    [openclawCli, "connect", "--help"],
    { cwd: packageRoot, env: environment, encoding: "utf8" },
  );

  assert.equal(inspection.plugin.status, "loaded");
  assert.deepEqual(inspection.plugin.toolNames, ["aep_task_bridge", "aep_result_bridge"]);
  assert.equal(inspection.diagnostics.length, 0);
  assert.match(help, /aep\s+Register this OpenClaw Agent with AEP/);
  process.stdout.write("OpenClaw package install/runtime inspection passed\n");
} finally {
  rmSync(validationRoot, { recursive: true, force: true });
}
