import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const archive = resolve(process.argv[2] || "");
const checksumPath = resolve(process.argv[3] || `${archive}.sha256`);
if (!process.argv[2]) throw new Error("usage: node scripts/standalone-archive-check.mjs <archive> [checksum]");
const expected = readFileSync(checksumPath, "utf8").trim().match(/^([a-f0-9]{64})  (.+)$/);
assert.ok(expected, "invalid SHA-256 sidecar format");
assert.equal(expected[2], basename(archive));
assert.equal(createHash("sha256").update(readFileSync(archive)).digest("hex"), expected[1]);
const artifactName = basename(archive).replace(/(?:\.tar\.gz|\.zip)$/, "");
const sidecarManifest = readFileSync(join(dirname(archive), `${artifactName}.manifest.json`), "utf8");
const sidecarSbom = readFileSync(join(dirname(archive), `${artifactName}.cdx.json`), "utf8");

function filesUnder(path, prefix = "") {
  const files = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...filesUnder(join(path, entry.name), relative));
    else if (entry.isFile()) files.push(relative);
    else throw new Error(`archive contains a link or special file: ${relative}`);
  }
  return files;
}

const temp = mkdtempSync(join(tmpdir(), "tokentopper-archive-"));
try {
  const tar = process.platform === "win32"
    ? join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe")
    : "tar";
  const unpacked = spawnSync(tar, ["-xf", archive, "-C", temp], { encoding: "utf8" });
  assert.equal(unpacked.status, 0, unpacked.stderr || unpacked.stdout);
  const roots = readdirSync(temp, { withFileTypes: true });
  assert.equal(roots.length, 1, "archive must contain exactly one top-level directory");
  assert.ok(roots[0].isDirectory());
  const directory = join(temp, roots[0].name);
  const internalManifest = readFileSync(join(directory, "manifest.json"), "utf8");
  const internalSbom = readFileSync(join(directory, "sbom.cdx.json"), "utf8");
  assert.equal(internalManifest, sidecarManifest, "manifest sidecar differs from archive");
  assert.equal(internalSbom, sidecarSbom, "SBOM sidecar differs from archive");
  const manifest = JSON.parse(internalManifest);
  const sbom = JSON.parse(internalSbom);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(sbom.bomFormat, "CycloneDX");
  assert.equal(sbom.specVersion, "1.6");
  assert.equal(sbom.metadata.component.version, manifest.version);
  assert.equal(sbom.components[0].version, manifest.runtime.version);

  const expectedFiles = [
    process.platform === "win32" ? "tokentopper.exe" : "tokentopper",
    "skills/tokentopper/SKILL.md",
    "skills/tokentopper/agents/openai.yaml",
  ];
  assert.deepEqual(manifest.files.map((file) => file.path).sort(), expectedFiles.sort());
  assert.deepEqual(filesUnder(directory).sort(), [...expectedFiles, "manifest.json", "sbom.cdx.json"].sort());
  for (const file of manifest.files) {
    const path = join(directory, ...file.path.split("/"));
    assert.equal(statSync(path).size, file.size);
    assert.equal(createHash("sha256").update(readFileSync(path)).digest("hex"), file.sha256);
  }

  const binary = join(directory, process.platform === "win32" ? "tokentopper.exe" : "tokentopper");
  if (process.platform !== "win32") chmodSync(binary, 0o755);
  const checked = spawnSync(process.execPath, [resolve(import.meta.dirname, "standalone-check.mjs"), binary], {
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(checked.status, 0, checked.stderr || checked.stdout);
  process.stdout.write(checked.stdout);
  console.log(`verified archive ${basename(archive)}`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
