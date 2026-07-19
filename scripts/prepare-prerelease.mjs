import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = process.env.TOKENTOPPER_PRERELEASE_ROOT
  ? resolve(process.env.TOKENTOPPER_PRERELEASE_ROOT)
  : scriptRoot;
const version = process.argv[2];

assert.match(
  version ?? "",
  /^\d+\.\d+\.\d+-[0-9A-Za-z][0-9A-Za-z.-]*$/,
  "usage: prepare-prerelease.mjs <x.y.z-prerelease>",
);

function readJson(name) {
  return JSON.parse(readFileSync(resolve(root, name), "utf8"));
}

function writeJson(name, value) {
  writeFileSync(resolve(root, name), `${JSON.stringify(value, null, 2)}\n`);
}

const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");
const jsr = readJson("jsr.json");

assert.equal(packageJson.name, "tokentopper", "unexpected package.json package name");
assert.equal(packageLock.name, packageJson.name, "package-lock.json package name mismatch");
assert.equal(packageLock.packages?.[""]?.name, packageJson.name, "package-lock root package name mismatch");
assert.equal(jsr.name, "@openfactoryai/tokentopper", "unexpected JSR package name");

packageJson.version = version;
packageLock.version = version;
packageLock.packages[""].version = version;
jsr.version = version;

writeJson("package.json", packageJson);
writeJson("package-lock.json", packageLock);
writeJson("jsr.json", jsr);

console.log(`prepared tokentopper prerelease ${version}`);
