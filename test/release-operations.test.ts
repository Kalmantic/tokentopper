import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";

const root = resolve(import.meta.dirname, "..");
const fixtureRoot = mkdtempSync(join(tmpdir(), "tokentopper-release-operations-"));

function run(command: string, args: string[], env = process.env) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>((resolveRun) => {
    const child = spawn(command, args, { env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status) => resolveRun({ status, stdout, stderr }));
  });
}

after(() => rmSync(fixtureRoot, { recursive: true, force: true }));

test("prepare-prerelease updates every package version atomically", () => {
  const target = join(fixtureRoot, "prepare");
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, "package.json"), '{"name":"tokentopper","version":"0.5.0","private":true}\n');
  writeFileSync(
    join(target, "package-lock.json"),
    '{"name":"tokentopper","version":"0.5.0","lockfileVersion":3,"packages":{"":{"name":"tokentopper","version":"0.5.0"}}}\n',
  );
  writeFileSync(join(target, "jsr.json"), '{"name":"@openfactoryai/tokentopper","version":"0.5.0","exports":{".":"./src/mod.ts"}}\n');

  const result = spawnSync(process.execPath, [join(root, "scripts/prepare-prerelease.mjs"), "0.6.0-beta.1"], {
    encoding: "utf8",
    env: { ...process.env, TOKENTOPPER_PRERELEASE_ROOT: target },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /prepared tokentopper prerelease 0\.6\.0-beta\.1/);
  assert.equal(JSON.parse(readFileSync(join(target, "package.json"), "utf8")).version, "0.6.0-beta.1");
  const lock = JSON.parse(readFileSync(join(target, "package-lock.json"), "utf8"));
  assert.equal(lock.version, "0.6.0-beta.1");
  assert.equal(lock.packages[""].version, "0.6.0-beta.1");
  const jsr = JSON.parse(readFileSync(join(target, "jsr.json"), "utf8"));
  assert.equal(jsr.version, "0.6.0-beta.1");
  assert.deepEqual(jsr.exports, { ".": "./src/mod.ts" });
});

test("prepare-prerelease rejects a stable version before writing", () => {
  const result = spawnSync(process.execPath, [join(root, "scripts/prepare-prerelease.mjs"), "0.6.0"], {
    encoding: "utf8",
    env: { ...process.env, TOKENTOPPER_PRERELEASE_ROOT: join(fixtureRoot, "missing") },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /usage: prepare-prerelease/);
});

const prerelease = "0.6.0-beta.1";
const stable = "0.5.0";
let registryUrl = "";
let tarball = Buffer.alloc(0);
let integrity = "";

const server = createServer((request, response) => {
  if (request.url === "/tokentopper") {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({
      "dist-tags": { latest: stable, next: prerelease },
      versions: {
        [prerelease]: {
          name: "tokentopper",
          version: prerelease,
          description: "Professional AI Usage Index for Claude Code, Codex, and OpenCode. More tools are on the roadmap.",
          bin: { tokentopper: "cli.js" },
          dist: {
            integrity,
            tarball: `${registryUrl}/tokentopper/-/tokentopper-${prerelease}.tgz`,
            attestations: { url: `${registryUrl}/attestations/${prerelease}` },
          },
        },
      },
    }));
    return;
  }
  if (request.url === `/tokentopper/-/tokentopper-${prerelease}.tgz`) {
    response.setHeader("content-type", "application/octet-stream");
    response.end(tarball);
    return;
  }
  response.statusCode = 404;
  response.end("not found");
});

before(async () => {
  const packageDir = join(fixtureRoot, "registry-package");
  const outputDir = join(fixtureRoot, "registry-tarball");
  mkdirSync(packageDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(
    join(packageDir, "package.json"),
    `${JSON.stringify({ name: "tokentopper", version: prerelease, bin: { tokentopper: "cli.js" }, files: ["cli.js"] })}\n`,
  );
  writeFileSync(join(packageDir, "cli.js"), `#!/usr/bin/env node\nconsole.log(${JSON.stringify(prerelease)});\n`);
  chmodSync(join(packageDir, "cli.js"), 0o755);
  const packed = spawnSync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", outputDir], {
    cwd: packageDir,
    encoding: "utf8",
  });
  assert.equal(packed.status, 0, packed.stderr);
  const filename = JSON.parse(packed.stdout)[0].filename;
  tarball = readFileSync(join(outputDir, filename));
  integrity = `sha512-${createHash("sha512").update(tarball).digest("base64")}`;
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  assert(address && typeof address === "object");
  registryUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
});

test("release verifier accepts next while proving latest is preserved", async () => {
  const result = await run(
    process.execPath,
    [join(root, "scripts/verify-release.mjs"), prerelease, "--tag", "next", "--preserve-latest", stable],
    { ...process.env, NPM_REGISTRY_URL: registryUrl },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /verified public release tokentopper@0\.6\.0-beta\.1 on next/);
});

test("release verifier refuses to treat a prerelease as latest", () => {
  const result = spawnSync(process.execPath, [join(root, "scripts/verify-release.mjs"), prerelease], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /prerelease must not be verified against latest/);
});
