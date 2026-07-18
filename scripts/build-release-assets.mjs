import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const expectedVersion = process.argv[2] ?? packageJson.version;
assert.equal(expectedVersion, packageJson.version, "release version must match package.json");

const npmCli = process.env.npm_execpath;
assert(npmCli, "release:assets must run through npm so npm_execpath is available");
const outputDir = resolve(root, "release-artifacts");
rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

function npm(args) {
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

const pack = JSON.parse(npm(["pack", "--ignore-scripts", "--json", "--pack-destination", outputDir]))[0];
assert.equal(pack.name, packageJson.name);
assert.equal(pack.version, expectedVersion);
const tarballPath = resolve(outputDir, pack.filename);
const sha256 = createHash("sha256").update(readFileSync(tarballPath)).digest("hex");
writeFileSync(resolve(outputDir, `${pack.filename}.sha256`), `${sha256}  ${pack.filename}\n`);

const sbomText = npm(["sbom", "--sbom-format", "cyclonedx"]);
const sbom = JSON.parse(sbomText);
assert.equal(sbom.bomFormat, "CycloneDX");
assert.equal(sbom.metadata?.component?.name, packageJson.name);
assert.equal(sbom.metadata?.component?.version, expectedVersion);
writeFileSync(
  resolve(outputDir, `${packageJson.name}-${expectedVersion}.cdx.json`),
  `${JSON.stringify(sbom, null, 2)}\n`,
);

console.log(`built release assets for ${packageJson.name}@${expectedVersion}`);
