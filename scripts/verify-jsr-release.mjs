import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const jsrConfig = JSON.parse(readFileSync(resolve(root, "jsr.json"), "utf8"));
const expectedVersion = process.argv[2];
const statusOnly = process.argv[3] === "--status";
assert.match(
  expectedVersion ?? "",
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/,
  "usage: verify-jsr-release.mjs <version> [--status]",
);
assert.equal(jsrConfig.version, expectedVersion, "JSR config version does not match");

const packageMatch = jsrConfig.name.match(/^@([a-z0-9-]+)\/([a-z0-9-]+)$/);
assert(packageMatch, "invalid JSR package name");
const [, scope, packageName] = packageMatch;
const registryBase = new URL(process.env.TOKENTOPPER_JSR_REGISTRY_URL ?? "https://jsr.io");
const npmBase = new URL(process.env.TOKENTOPPER_JSR_NPM_URL ?? "https://npm.jsr.io");
const packageBase = new URL(`${jsrConfig.name}/`, ensureTrailingSlash(registryBase));
const compatibilityName = `@jsr/${scope}__${packageName}`;
const attempts = positiveInteger(process.env.TOKENTOPPER_JSR_VERIFY_ATTEMPTS ?? "24", "attempts");
const retryDelayMs = positiveInteger(process.env.TOKENTOPPER_JSR_VERIFY_DELAY_MS ?? "5000", "retry delay");

function ensureTrailingSlash(url) {
  return url.href.endsWith("/") ? url : new URL(`${url.href}/`);
}

function positiveInteger(value, label) {
  const parsed = Number.parseInt(value, 10);
  assert(Number.isSafeInteger(parsed) && parsed > 0, `${label} must be a positive integer`);
  return parsed;
}

function digest(algorithm, bytes, encoding = "hex") {
  return createHash(algorithm).update(bytes).digest(encoding);
}

async function request(url, { allowNotFound = false, maxBytes = 20 * 1024 * 1024 } = {}) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json, application/octet-stream;q=0.9",
      "user-agent": "tokentopper-jsr-verifier",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (allowNotFound && response.status === 404) return undefined;
  assert(response.ok, `${url} returned HTTP ${response.status}`);
  const declaredSize = Number(response.headers.get("content-length"));
  assert(!Number.isFinite(declaredSize) || declaredSize <= maxBytes, `${url} exceeds the size limit`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert(bytes.length <= maxBytes, `${url} exceeds the size limit`);
  return bytes;
}

async function json(url, options) {
  const bytes = await request(url, options);
  return bytes ? JSON.parse(bytes.toString("utf8")) : undefined;
}

async function packageMetadata() {
  return json(new URL("meta.json", packageBase), { allowNotFound: true, maxBytes: 5 * 1024 * 1024 });
}

function isPublished(metadata) {
  return Boolean(metadata?.versions?.[expectedVersion]);
}

if (statusOnly) {
  const metadata = await packageMetadata();
  if (!isPublished(metadata)) {
    console.log(`${jsrConfig.name}@${expectedVersion} is not published`);
    process.exitCode = 2;
  } else {
    console.log(`${jsrConfig.name}@${expectedVersion} is already published`);
  }
} else {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await verify();
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        console.error(`JSR verification attempt ${attempt}/${attempts} failed: ${error.message}`);
        await new Promise((resolveDelay) => setTimeout(resolveDelay, retryDelayMs));
      }
    }
  }
  if (lastError) throw lastError;
}

async function verify() {
  const metadata = await packageMetadata();
  assert(metadata, `${jsrConfig.name} package metadata is missing`);
  assert.equal(metadata.scope, scope, "JSR scope does not match");
  assert.equal(metadata.name, packageName, "JSR package name does not match");
  assert(isPublished(metadata), `${jsrConfig.name}@${expectedVersion} is not published`);
  assert.notEqual(metadata.versions[expectedVersion].yanked, true, "JSR version is yanked");

  const versionMetadata = await json(new URL(`${expectedVersion}_meta.json`, packageBase), {
    maxBytes: 10 * 1024 * 1024,
  });
  assert.deepEqual(versionMetadata.exports, jsrConfig.exports, "JSR exports do not match jsr.json");
  assert(versionMetadata.manifest && typeof versionMetadata.manifest === "object", "JSR manifest is missing");

  for (const required of ["/README.md", "/LICENSE", "/package.json"]) {
    assert(versionMetadata.manifest[required], `JSR manifest is missing ${required}`);
  }

  for (const [exportName, target] of Object.entries(jsrConfig.exports)) {
    assert.match(target, /^\.\/[A-Za-z0-9_./-]+$/, `invalid target for export ${exportName}`);
    const manifestPath = `/${target.slice(2)}`;
    const entry = versionMetadata.manifest[manifestPath];
    assert(entry, `JSR manifest is missing export target ${manifestPath}`);
    assert(Number.isSafeInteger(entry.size) && entry.size > 0, `${manifestPath} has an invalid size`);
    assert.match(entry.checksum, /^sha256-[a-f0-9]{64}$/, `${manifestPath} has an invalid checksum`);
    const moduleBytes = await request(new URL(`${expectedVersion}/${target.slice(2)}`, packageBase));
    assert.equal(moduleBytes.length, entry.size, `${manifestPath} size does not match`);
    assert.equal(`sha256-${digest("sha256", moduleBytes)}`, entry.checksum, `${manifestPath} checksum does not match`);
  }

  const compatibilityUrl = new URL(compatibilityName, ensureTrailingSlash(npmBase));
  const compatibility = await json(compatibilityUrl, { maxBytes: 10 * 1024 * 1024 });
  assert.equal(compatibility.name, compatibilityName, "JSR npm-compatibility package name does not match");
  const published = compatibility.versions?.[expectedVersion];
  assert(published, `JSR npm-compatibility version ${expectedVersion} is missing`);
  assert.equal(published.version, expectedVersion, "JSR npm-compatibility version does not match");
  assert.match(published.dist?.integrity ?? "", /^sha512-[A-Za-z0-9+/]+={0,2}$/, "compatibility integrity is missing");
  assert.match(published.dist?.shasum ?? "", /^[a-fA-F0-9]{40}$/, "compatibility shasum is missing");
  const tarballUrl = new URL(published.dist.tarball);
  assert.equal(tarballUrl.origin, npmBase.origin, "compatibility tarball has an unexpected origin");
  const tarball = await request(tarballUrl, { maxBytes: 50 * 1024 * 1024 });
  assert.equal(digest("sha1", tarball), published.dist.shasum.toLowerCase(), "compatibility tarball shasum differs");
  assert.equal(
    `sha512-${digest("sha512", tarball, "base64")}`,
    published.dist.integrity,
    "compatibility tarball integrity differs",
  );

  console.log(`verified public JSR release ${jsrConfig.name}@${expectedVersion}`);
  console.log(`verified ${Object.keys(jsrConfig.exports).length} exports and ${compatibilityName} integrity`);
}
