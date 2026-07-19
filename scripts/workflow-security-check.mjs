import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflowsDir = resolve(root, ".github/workflows");
const workflowNames = readdirSync(workflowsDir).filter((name) => /\.ya?ml$/.test(name));
const workflows = new Map(
  workflowNames.map((name) => [
    name,
    readFileSync(resolve(workflowsDir, name), "utf8").replace(/\r\n?/g, "\n"),
  ]),
);

const release = workflows.get("release.yml");
const jsr = workflows.get("jsr.yml");
const standaloneCandidates = workflows.get("standalone-candidates.yml");
assert(release, "release.yml is missing");
assert(jsr, "jsr.yml is missing");
assert(standaloneCandidates, "standalone-candidates.yml is missing");

function job(source, name) {
  const marker = `\n  ${name}:\n`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `workflow job ${name} is missing`);
  const bodyStart = start + marker.length;
  const next = source.slice(bodyStart).search(/\n  [A-Za-z0-9_-]+:\n/);
  return next === -1 ? source.slice(bodyStart) : source.slice(bodyStart, bodyStart + next);
}

function occurrences(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

const forbiddenCredential = /\b(?:NODE_AUTH_TOKEN|NPM_TOKEN|NPMJS_TOKEN)\b|_authToken/i;
for (const [name, source] of workflows) {
  assert(!forbiddenCredential.test(source), `${name} contains a reusable npm credential variable`);
}

for (const [name, source] of [["release.yml", release], ["jsr.yml", jsr]]) {
  assert.match(source, /\npermissions: \{\}\n/, `${name} must deny permissions at workflow scope`);
  assert.doesNotMatch(source, /^\s+cache:\s+npm\s*$/m, `${name} must not reuse an npm dependency cache`);
}

assert.match(standaloneCandidates, /\npermissions: \{\}\n/, "standalone-candidates.yml must deny permissions at workflow scope");
assert.doesNotMatch(standaloneCandidates, /^\s+cache:\s+npm\s*$/m, "standalone release candidates must not reuse an npm dependency cache");
const candidateBuild = job(standaloneCandidates, "build");
assert.match(candidateBuild, /\n          package-manager-cache: false\n/, "standalone candidate builds must disable package-manager caching");
assert.doesNotMatch(candidateBuild, /\n      id-token: write\n/, "standalone candidate builds must not receive an OIDC identity");
const candidateAttest = job(standaloneCandidates, "attest");
assert.match(candidateAttest, /\n      id-token: write\n/, "standalone candidate attestation must mint a short-lived OIDC identity");
assert.match(candidateAttest, /\n      attestations: write\n/, "standalone candidate attestation must write provenance");
assert.doesNotMatch(standaloneCandidates, /\bgh release upload\b/, "unsigned standalone candidates must not be attached to a public release");

for (const name of ["publish", "recover-release", "publish-prerelease"]) {
  const source = job(release, name);
  assert.match(source, /\n    environment: npm\n/, `${name} must use the protected npm environment`);
  assert.match(source, /\n      id-token: write\n/, `${name} must mint a short-lived OIDC identity`);
  assert.match(source, /\n          package-manager-cache: false\n/, `${name} must disable package-manager caching`);
  assert.equal(occurrences(source, /^\s+run:\s+npm publish\b/gm), 1, `${name} must contain exactly one npm publish command`);
}

const assetJob = job(release, "release-assets");
assert.match(assetJob, /\n          package-manager-cache: false\n/, "release-assets must disable package-manager caching");
assert.doesNotMatch(assetJob, /\n      id-token: write\n/, "release-assets must not receive an OIDC identity");

const nixMirrorJob = job(release, "update-nix-mirror");
assert.match(nixMirrorJob, /\n    needs: \[release-please, release-assets\]\n/, "Nix mirror updates must wait for verified release assets");
assert.match(nixMirrorJob, /\n          persist-credentials: false\n/, "Nix mirror checkouts must not persist a credential");
assert.match(nixMirrorJob, /\n          GH_TOKEN: \$\{\{ secrets\.RELEASE_PLEASE_TOKEN \|\| github\.token \}\}\n/, "Nix mirror PRs must use only the repository-scoped GitHub automation token");
assert.doesNotMatch(nixMirrorJob, /\n      id-token: write\n/, "Nix mirror updates must not receive an OIDC identity");
assert.doesNotMatch(nixMirrorJob, /\bnpm publish\b|\bjsr publish\b/, "Nix mirror updates must not publish to a registry");

const jsrPublish = job(jsr, "publish");
assert.match(jsrPublish, /\n    environment: jsr\n/, "JSR publish must use the protected jsr environment");
assert.match(jsrPublish, /\n      id-token: write\n/, "JSR publish must mint a short-lived OIDC identity");
assert.match(jsrPublish, /\n          package-manager-cache: false\n/, "JSR publish must disable package-manager caching");
assert.equal(occurrences(jsrPublish, /^\s+run:.*\bjsr publish\b/gm), 1, "JSR publish must contain exactly one registry publish command");

console.log("verified release workflow OIDC, environment, cache, and credential policy");
