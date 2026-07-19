import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFileSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const binary = resolve(process.argv[2] || "");
if (!process.argv[2]) throw new Error("usage: node scripts/package-standalone.mjs <executable>");
const directory = dirname(binary);
const outputRoot = dirname(directory);
const artifactName = basename(directory);
const manifestPath = join(directory, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function filesUnder(path, prefix = "") {
  const files = [];
  for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = join(path, entry.name);
    if (entry.isDirectory()) files.push(...filesUnder(absolute, relative));
    else if (entry.isFile() && entry.name !== "manifest.json" && entry.name !== "sbom.cdx.json") {
      files.push({ path: relative, size: statSync(absolute).size, sha256: sha256(absolute) });
    } else if (!entry.isFile()) {
      throw new Error(`standalone package cannot contain links or special files: ${relative}`);
    }
  }
  return files;
}

manifest.files = filesUnder(directory);
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

const binaryFile = manifest.files.find((file) => file.path === basename(binary));
if (!binaryFile) throw new Error("compiled executable is missing from the manifest");
const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.6",
  version: 1,
  metadata: {
    component: {
      type: "application",
      "bom-ref": `pkg:npm/tokentopper@${manifest.version}`,
      name: "tokentopper",
      version: manifest.version,
      purl: `pkg:npm/tokentopper@${manifest.version}`,
      hashes: [{ alg: "SHA-256", content: binaryFile.sha256 }],
      licenses: [{ license: { id: "MIT" } }],
      properties: [
        { name: "tokentopper:platform", value: manifest.platform },
        { name: "tokentopper:architecture", value: manifest.arch },
        ...(manifest.sourceCommit ? [{ name: "tokentopper:source-commit", value: manifest.sourceCommit }] : []),
      ],
    },
  },
  components: [{
    type: "framework",
    "bom-ref": `pkg:generic/bun@${manifest.runtime.version}`,
    name: "Bun",
    version: manifest.runtime.version,
    purl: `pkg:generic/bun@${manifest.runtime.version}`,
  }],
};
const sbomPath = join(directory, "sbom.cdx.json");
writeFileSync(sbomPath, JSON.stringify(sbom, null, 2) + "\n");

const extension = process.platform === "win32" ? ".zip" : ".tar.gz";
const archive = join(outputRoot, artifactName + extension);
const args = process.platform === "win32"
  ? ["-a", "-cf", archive, "-C", outputRoot, artifactName]
  : ["-czf", archive, "-C", outputRoot, artifactName];
const packed = spawnSync("tar", args, { encoding: "utf8" });
if (packed.status !== 0) throw new Error(`archive creation failed: ${packed.stderr || packed.stdout}`);

const checksum = sha256(archive);
writeFileSync(`${archive}.sha256`, `${checksum}  ${basename(archive)}\n`);
copyFileSync(manifestPath, join(outputRoot, `${artifactName}.manifest.json`));
copyFileSync(sbomPath, join(outputRoot, `${artifactName}.cdx.json`));

console.log(archive);
