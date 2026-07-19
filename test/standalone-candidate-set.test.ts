import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const verifier = resolve("scripts/verify-standalone-candidate-set.mjs");
const version = "0.5.0";
const sourceCommit = "a".repeat(40);

function writeCandidate(directory: string, platform: "linux" | "macos" | "windows", arch: "x64" | "arm64") {
  const base = `tokentopper-${version}-${platform}-${arch}`;
  const archiveName = `${base}${platform === "windows" ? ".zip" : ".tar.gz"}`;
  const archive = Buffer.from(`${platform} candidate`);
  writeFileSync(join(directory, archiveName), archive);
  writeFileSync(join(directory, `${archiveName}.sha256`), `${createHash("sha256").update(archive).digest("hex")}  ${archiveName}\n`);
  writeFileSync(join(directory, `${base}.manifest.json`), JSON.stringify({
    schemaVersion: 1,
    name: "tokentopper",
    version,
    platform,
    arch,
    runtime: { name: "bun", version: "1.3.14" },
    sourceCommit,
    files: [],
  }));
  writeFileSync(join(directory, `${base}.cdx.json`), JSON.stringify({
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    metadata: {
      component: {
        name: "tokentopper",
        version,
        properties: [
          { name: "tokentopper:platform", value: platform },
          { name: "tokentopper:architecture", value: arch },
          { name: "tokentopper:source-commit", value: sourceCommit },
        ],
      },
    },
    components: [{ name: "Bun", version: "1.3.14" }],
  }));
  return archiveName;
}

test("standalone candidate verifier requires one immutable build per operating system", () => {
  const directory = mkdtempSync(join(tmpdir(), "tokentopper-candidates-"));
  try {
    const linuxArchive = writeCandidate(directory, "linux", "x64");
    writeCandidate(directory, "macos", "arm64");
    writeCandidate(directory, "windows", "x64");
    const verified = spawnSync(process.execPath, [verifier, directory, version, sourceCommit], { encoding: "utf8" });
    assert.equal(verified.status, 0, verified.stderr);
    assert.match(verified.stdout, /verified standalone release candidates/);

    writeFileSync(join(directory, linuxArchive), "tampered");
    const rejected = spawnSync(process.execPath, [verifier, directory, version, sourceCommit], { encoding: "utf8" });
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /checksum mismatch/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
