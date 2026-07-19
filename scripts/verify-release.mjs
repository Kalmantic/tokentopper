import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const name = "tokentopper";
const expectedVersion = process.argv[2];
const usage = "usage: verify-release.mjs <version> [--tag <dist-tag>] [--preserve-latest <version>]";
assert.match(expectedVersion ?? "", /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, usage);

let expectedTag = "latest";
let preservedLatest;
for (let index = 3; index < process.argv.length; index += 2) {
  const flag = process.argv[index];
  const value = process.argv[index + 1];
  assert(value, usage);
  if (flag === "--tag") {
    expectedTag = value;
  } else if (flag === "--preserve-latest") {
    preservedLatest = value;
  } else {
    assert.fail(usage);
  }
}

assert.match(expectedTag, /^[A-Za-z][0-9A-Za-z._-]*$/, "invalid npm dist-tag");
if (expectedTag === "latest") {
  assert(!expectedVersion.includes("-"), "a prerelease must not be verified against latest");
  assert.equal(preservedLatest, undefined, "--preserve-latest is only valid for a non-stable dist-tag");
} else {
  assert(expectedVersion.includes("-"), "a non-stable dist-tag requires a prerelease version");
  assert.match(preservedLatest ?? "", /^\d+\.\d+\.\d+$/, "a prerelease must preserve an exact stable latest version");
}

const registry = (process.env.NPM_REGISTRY_URL || "https://registry.npmjs.org").replace(/\/$/, "");

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let packument;
for (let attempt = 1; attempt <= 12; attempt += 1) {
  const response = await fetch(`${registry}/${name}`);
  if (response.ok) {
    packument = await response.json();
    if (packument.versions?.[expectedVersion]) break;
  }
  if (attempt < 12) await sleep(5_000);
}

const published = packument?.versions?.[expectedVersion];
assert(published, `${name}@${expectedVersion} did not appear in the registry`);
assert.equal(packument["dist-tags"]?.[expectedTag], expectedVersion, `${expectedTag} dist-tag does not match the release`);
if (preservedLatest) {
  assert.equal(packument["dist-tags"]?.latest, preservedLatest, "latest dist-tag changed during prerelease publication");
}
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
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--registry", registry, `${name}@${expectedVersion}`],
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

console.log(`verified public release ${name}@${expectedVersion} on ${expectedTag}`);
