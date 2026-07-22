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
const scorecard = workflows.get("scorecard.yml");
const osvScanner = workflows.get("osv-scanner.yml");
const apiHealth = workflows.get("api-health.yml");
assert(release, "release.yml is missing");
assert(jsr, "jsr.yml is missing");
assert(standaloneCandidates, "standalone-candidates.yml is missing");
assert(scorecard, "scorecard.yml is missing");
assert(osvScanner, "osv-scanner.yml is missing");
assert(apiHealth, "api-health.yml is missing");

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
  for (const match of source.matchAll(/^\s+uses:\s+([^\s@]+)@([^\s#]+)/gm)) {
    const [, action, ref] = match;
    if (action.startsWith("./")) continue;
    assert.match(ref, /^[0-9a-f]{40}$/, `${name} must pin ${action} to an immutable commit`);
  }
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

const scorecardAnalysis = job(scorecard, "analysis");
assert.match(scorecard, /\npermissions: read-all\n/, "scorecard.yml must default to read-only permissions");
assert.match(scorecard, /\n  workflow_dispatch:\n/, "Scorecard must support manual verification runs");
for (const permission of ["checks", "contents", "issues", "pull-requests"]) {
  assert.match(scorecardAnalysis, new RegExp(`\\n      ${permission}: read\\n`), `Scorecard must read ${permission}`);
}
assert.match(scorecardAnalysis, /\n      security-events: write\n/, "Scorecard must write its SARIF result");
assert.match(scorecardAnalysis, /\n      id-token: write\n/, "Scorecard publishing must use OIDC");
assert.match(scorecardAnalysis, /\n          persist-credentials: false\n/, "Scorecard checkout must not persist credentials");
assert.match(scorecardAnalysis, /\n          publish_results: true\n/, "Scorecard must publish results for the public badge");

const osvScan = job(osvScanner, "scan");
assert.match(osvScanner, /\npermissions: \{\}\n/, "osv-scanner.yml must deny permissions at workflow scope");
assert.match(osvScan, /\n      fail-on-vuln: false\n/, "OSV Scanner is a signal-only gate until its baseline is established");
assert.match(osvScan, /\n      upload-sarif: true\n/, "OSV Scanner must publish findings to code scanning");

const apiHealthJob = job(apiHealth, "health");
assert.match(apiHealth, /\npermissions: \{\}\n/, "api-health.yml must deny permissions at workflow scope");
assert.match(apiHealth, /\n    - cron: "17,47 \* \* \* \*"\n/, "API health must run twice per hour");
assert.match(apiHealthJob, /HEALTH_URL: https:\/\/[^\s]+\/health\n/, "API health must use an HTTPS health endpoint");
assert.match(apiHealthJob, /curl --fail --silent --show-error/, "API health must fail on HTTP errors");
assert.doesNotMatch(apiHealthJob, /authorization|signed\.json|machineId|publicKey|secrets\./i, "API health must not send credentials or usage identity");

console.log("verified release, scanner, and health workflow security policy");
