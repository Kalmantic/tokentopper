import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const name = "tokentopper";
const expectedVersion = process.argv[2];
assert.match(expectedVersion ?? "", /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, "usage: verify-release.mjs <version>");

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let packument;
for (let attempt = 1; attempt <= 12; attempt += 1) {
  const response = await fetch(`https://registry.npmjs.org/${name}`);
  if (response.ok) {
    packument = await response.json();
    if (packument.versions?.[expectedVersion]) break;
  }
  if (attempt < 12) await sleep(5_000);
}

const published = packument?.versions?.[expectedVersion];
assert(published, `${name}@${expectedVersion} did not appear in the registry`);
assert.equal(packument["dist-tags"]?.latest, expectedVersion, "latest dist-tag does not match the release");
assert.equal(published.version, expectedVersion);
assert.match(published.description, /Professional AI Usage Index/);
assert.match(published.description, /Claude Code, Codex, and OpenCode/);
assert.match(published.description, /roadmap/i);
assert.match(published.dist?.integrity ?? "", /^sha512-/);
assert(published.dist?.attestations?.url, "npm provenance attestation is missing");

const temp = mkdtempSync(join(tmpdir(), "tokentopper-release-check-"));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
try {
  const installDir = join(temp, "install");
  const homeDir = join(temp, "home");
  mkdirSync(installDir, { recursive: true });
  mkdirSync(homeDir, { recursive: true });
  writeFileSync(join(installDir, "package.json"), '{"private":true}\n');
  const install = spawnSync(
    npm,
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", `${name}@${expectedVersion}`],
    { cwd: installDir, encoding: "utf8" },
  );
  assert.equal(install.status, 0, `${install.stdout}\n${install.stderr}`);

  const bin = join(installDir, "node_modules", ".bin", process.platform === "win32" ? `${name}.cmd` : name);
  const execution = spawnSync(bin, ["--version"], {
    cwd: installDir,
    encoding: "utf8",
    env: { ...process.env, HOME: homeDir, USERPROFILE: homeDir },
  });
  assert.equal(execution.status, 0, `${execution.stdout}\n${execution.stderr}`);
  assert.equal(execution.stdout.trim(), expectedVersion);
} finally {
  rmSync(temp, { recursive: true, force: true });
}

console.log(`verified public release ${name}@${expectedVersion}`);
