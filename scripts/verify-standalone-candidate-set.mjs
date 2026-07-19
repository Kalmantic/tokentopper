import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const directory = resolve(process.argv[2] || "");
const expectedVersion = process.argv[3];
const expectedCommit = process.argv[4];
if (!process.argv[2] || !expectedVersion || !expectedCommit) {
  throw new Error("usage: node scripts/verify-standalone-candidate-set.mjs <directory> <version> <source-commit>");
}
assert.match(expectedVersion, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z][0-9A-Za-z.-]*)?$/, "invalid release version");
assert.match(expectedCommit, /^[a-f0-9]{40}$/, "invalid source commit");

const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const names = readdirSync(directory).sort();
const escapedVersion = expectedVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const manifestPattern = new RegExp(`^tokentopper-${escapedVersion}-(linux|macos|windows)-(x64|arm64)\\.manifest\\.json$`);
const manifests = names.filter((name) => manifestPattern.test(name));
assert.equal(manifests.length, 3, "candidate set must contain exactly three platform manifests");

const seenPlatforms = new Set();
const expectedFiles = new Set();
for (const manifestName of manifests) {
  const match = manifestName.match(manifestPattern);
  assert(match);
  const [, platform, arch] = match;
  assert(!seenPlatforms.has(platform), `candidate set contains duplicate ${platform} build`);
  seenPlatforms.add(platform);

  const artifactName = manifestName.replace(/\.manifest\.json$/, "");
  const archiveName = `${artifactName}${platform === "windows" ? ".zip" : ".tar.gz"}`;
  const checksumName = `${archiveName}.sha256`;
  const sbomName = `${artifactName}.cdx.json`;
  for (const name of [manifestName, archiveName, checksumName, sbomName]) {
    assert(existsSync(join(directory, name)), `candidate sidecar is missing ${name}`);
    expectedFiles.add(name);
  }

  const manifest = JSON.parse(readFileSync(join(directory, manifestName), "utf8"));
  assert.equal(manifest.schemaVersion, 1, `${manifestName} schema mismatch`);
  assert.equal(manifest.name, "tokentopper", `${manifestName} package mismatch`);
  assert.equal(manifest.version, expectedVersion, `${manifestName} version mismatch`);
  assert.equal(manifest.platform, platform, `${manifestName} platform mismatch`);
  assert.equal(manifest.arch, arch, `${manifestName} architecture mismatch`);
  assert.equal(manifest.sourceCommit, expectedCommit, `${manifestName} source commit mismatch`);
  assert.equal(manifest.runtime?.name, "bun", `${manifestName} runtime mismatch`);
  assert.match(manifest.runtime?.version || "", /^\d+\.\d+\.\d+/, `${manifestName} runtime version is missing`);

  const checksum = readFileSync(join(directory, checksumName), "utf8").trim();
  const checksumMatch = checksum.match(/^([a-f0-9]{64})  (.+)$/);
  assert(checksumMatch, `${checksumName} format is invalid`);
  assert.equal(checksumMatch[2], archiveName, `${checksumName} archive name mismatch`);
  assert.equal(checksumMatch[1], hash(join(directory, archiveName)), `${archiveName} checksum mismatch`);

  const sbom = JSON.parse(readFileSync(join(directory, sbomName), "utf8"));
  assert.equal(sbom.bomFormat, "CycloneDX", `${sbomName} format mismatch`);
  assert.equal(sbom.specVersion, "1.6", `${sbomName} spec mismatch`);
  assert.equal(sbom.metadata?.component?.name, "tokentopper", `${sbomName} component mismatch`);
  assert.equal(sbom.metadata?.component?.version, expectedVersion, `${sbomName} version mismatch`);
  assert.equal(sbom.components?.[0]?.name, "Bun", `${sbomName} runtime component mismatch`);
  assert.equal(sbom.components?.[0]?.version, manifest.runtime.version, `${sbomName} runtime version mismatch`);
  const properties = Object.fromEntries((sbom.metadata?.component?.properties || []).map(({ name, value }) => [name, value]));
  assert.equal(properties["tokentopper:platform"], platform, `${sbomName} platform property mismatch`);
  assert.equal(properties["tokentopper:architecture"], arch, `${sbomName} architecture property mismatch`);
  assert.equal(properties["tokentopper:source-commit"], expectedCommit, `${sbomName} source commit property mismatch`);
}

assert.deepEqual([...seenPlatforms].sort(), ["linux", "macos", "windows"]);
assert.deepEqual(names, [...expectedFiles].sort(), `unexpected candidate files: ${names.filter((name) => !expectedFiles.has(name)).join(", ")}`);
console.log(`verified standalone release candidates ${expectedVersion} from ${expectedCommit}`);
