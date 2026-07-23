import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const expectedVersion = process.argv[2];
assert.match(
  expectedVersion ?? "",
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/,
  "usage: verify-github-release-assets.mjs <version>",
);

const repository = process.env.GITHUB_REPOSITORY ?? repositoryFromPackage(packageJson.repository?.url);
assert.match(repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "invalid GitHub repository");

const tag = `${packageJson.name}-v${expectedVersion}`;
const tarballName = `${packageJson.name}-${expectedVersion}.tgz`;
const checksumName = `${tarballName}.sha256`;
const sbomName = `${packageJson.name}-${expectedVersion}.cdx.json`;
const attempts = positiveInteger(process.env.TOKENTOPPER_RELEASE_VERIFY_ATTEMPTS ?? "12", "attempts");
const retryDelayMs = positiveInteger(process.env.TOKENTOPPER_RELEASE_VERIFY_DELAY_MS ?? "5000", "retry delay");

function repositoryFromPackage(value) {
  const normalized = String(value ?? "")
    .replace(/^git\+/, "")
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/\.git$/, "");
  const match = normalized.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/);
  return match ? `${match[1]}/${match[2]}` : "";
}

function positiveInteger(value, label) {
  const parsed = Number.parseInt(value, 10);
  assert(Number.isSafeInteger(parsed) && parsed > 0, `${label} must be a positive integer`);
  return parsed;
}

function digest(algorithm, bytes, encoding = "hex") {
  return createHash(algorithm).update(bytes).digest(encoding);
}

async function request(
  url,
  { githubApi = false, maxBytes = 20 * 1024 * 1024, accept = "application/octet-stream" } = {},
) {
  const headers = {
    accept: githubApi ? "application/vnd.github+json" : accept,
    "user-agent": "tokentopper-release-verifier",
  };
  if (githubApi && process.env.GH_TOKEN) {
    headers.authorization = `Bearer ${process.env.GH_TOKEN}`;
    headers["x-github-api-version"] = "2022-11-28";
  }

  const response = await fetch(url, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  assert(response.ok, `${url} returned HTTP ${response.status}`);
  const declaredSize = Number(response.headers.get("content-length"));
  assert(!Number.isFinite(declaredSize) || declaredSize <= maxBytes, `${url} exceeds the size limit`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert(bytes.length <= maxBytes, `${url} exceeds the size limit`);
  return bytes;
}

async function json(url, options) {
  return JSON.parse((await request(url, { ...options, accept: "application/json" })).toString("utf8"));
}

function requireAsset(release, name) {
  const matches = release.assets.filter((asset) => asset.name === name);
  assert.equal(matches.length, 1, `expected exactly one uploaded ${name} asset`);
  const asset = matches[0];
  assert.equal(asset.state, "uploaded", `${name} is not fully uploaded`);
  assert(asset.size > 0, `${name} is empty`);
  assert.match(asset.browser_download_url, /^https:\/\/github\.com\//, `${name} has an invalid download URL`);
  return asset;
}

async function verify() {
  const release = await json(
    `https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`,
    { githubApi: true, maxBytes: 2 * 1024 * 1024 },
  );
  assert.equal(release.tag_name, tag, "GitHub Release tag does not match");
  assert.equal(release.draft, false, "GitHub Release is still a draft");
  assert.equal(release.prerelease, expectedVersion.includes("-"), "GitHub prerelease status does not match version");
  assert(Array.isArray(release.assets), "GitHub Release assets are missing");

  const assetNames = release.assets.map((asset) => asset.name);
  assert.equal(new Set(assetNames).size, assetNames.length, "GitHub Release contains duplicate asset names");
  const tarballAsset = requireAsset(release, tarballName);
  const checksumAsset = requireAsset(release, checksumName);
  const sbomAsset = requireAsset(release, sbomName);

  const [tarball, checksum, sbom, packument] = await Promise.all([
    request(tarballAsset.browser_download_url),
    request(checksumAsset.browser_download_url, { maxBytes: 1024 }),
    request(sbomAsset.browser_download_url, { maxBytes: 5 * 1024 * 1024 }),
    json(`https://registry.npmjs.org/${encodeURIComponent(packageJson.name)}`, {
      maxBytes: 10 * 1024 * 1024,
    }),
  ]);
  const published = packument.versions?.[expectedVersion];
  assert(published, `npm version ${expectedVersion} is missing`);

  assert.equal(tarball.length, tarballAsset.size, "tarball size differs from GitHub metadata");
  assert.equal(checksum.length, checksumAsset.size, "checksum size differs from GitHub metadata");
  assert.equal(sbom.length, sbomAsset.size, "SBOM size differs from GitHub metadata");

  const sha256 = digest("sha256", tarball);
  assert.equal(checksum.toString("utf8"), `${sha256}  ${tarballName}\n`, "SHA-256 sidecar is invalid");
  assert.equal(published.name, packageJson.name, "npm package name does not match");
  assert.equal(published.version, expectedVersion, "npm package version does not match");
  assert.equal(digest("sha1", tarball), published.dist?.shasum, "GitHub tarball differs from npm shasum");
  assert.equal(
    `sha512-${digest("sha512", tarball, "base64")}`,
    published.dist?.integrity,
    "GitHub tarball differs from npm integrity",
  );

  const parsedSbom = JSON.parse(sbom.toString("utf8"));
  assert.equal(parsedSbom.bomFormat, "CycloneDX", "release SBOM is not CycloneDX");
  assert.equal(parsedSbom.metadata?.component?.name, packageJson.name, "SBOM package name does not match");
  assert.equal(parsedSbom.metadata?.component?.version, expectedVersion, "SBOM package version does not match");

  console.log(`verified GitHub Release mirror ${repository}@${tag}`);
  console.log(`tarball ${tarballName} sha256:${sha256}`);
}

let lastError;
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    await verify();
    lastError = undefined;
    break;
  } catch (error) {
    lastError = error;
    if (attempt < attempts) {
      console.error(`GitHub Release verification attempt ${attempt}/${attempts} failed: ${error.message}`);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, retryDelayMs));
    }
  }
}

if (lastError) {
  throw lastError;
}
