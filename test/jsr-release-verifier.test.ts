import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const { version } = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as { version: string };
const modules = {
  "/src/mod.ts": Buffer.from("export const indexFor = (value: number) => value;\n"),
  "/src/cli.ts": Buffer.from(`console.log('${version}');\n`),
};
const tarball = Buffer.from("fixture JSR compatibility tarball");

function hash(algorithm: string, bytes: Buffer, encoding: "hex" | "base64" = "hex") {
  return createHash(algorithm).update(bytes).digest(encoding);
}

test("JSR verifier checks status, module hashes, exports, and compatibility integrity", async () => {
  let published = true;
  let base = "";
  const server = createServer((request, response) => {
    const path = request.url ?? "";
    if (path === "/@openfactoryai/tokentopper/meta.json") {
      if (!published) return void respond(response, 404, "not found");
      return void respondJson(response, {
        scope: "openfactoryai",
        name: "tokentopper",
        latest: version,
        versions: { [version]: {} },
      });
    }
    if (path === `/@openfactoryai/tokentopper/${version}_meta.json`) {
      return void respondJson(response, {
        manifest: {
          "/README.md": { size: 1, checksum: `sha256-${"0".repeat(64)}` },
          "/LICENSE": { size: 1, checksum: `sha256-${"0".repeat(64)}` },
          "/package.json": { size: 1, checksum: `sha256-${"0".repeat(64)}` },
          ...Object.fromEntries(
            Object.entries(modules).map(([pathName, bytes]) => [
              pathName,
              { size: bytes.length, checksum: `sha256-${hash("sha256", bytes)}` },
            ]),
          ),
        },
        exports: { ".": "./src/mod.ts", "./cli": "./src/cli.ts" },
      });
    }
    const moduleMatch = path.match(new RegExp(`^/@openfactoryai/tokentopper/${version}(/src/(?:mod|cli)\\.ts)$`));
    if (moduleMatch) return void respond(response, 200, modules[moduleMatch[1] as keyof typeof modules]);
    if (path === "/npm/@jsr/openfactoryai__tokentopper") {
      return void respondJson(response, {
        name: "@jsr/openfactoryai__tokentopper",
        "dist-tags": { latest: version },
        versions: {
          [version]: {
            name: "@jsr/openfactoryai__tokentopper",
            version,
            dist: {
              tarball: `${base}/npm/tokentopper.tgz`,
              shasum: hash("sha1", tarball).toUpperCase(),
              integrity: `sha512-${hash("sha512", tarball, "base64")}`,
            },
          },
        },
      });
    }
    if (path === "/npm/tokentopper.tgz") return void respond(response, 200, tarball);
    respond(response, 404, "not found");
  });

  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  assert(address && typeof address !== "string");
  base = `http://127.0.0.1:${address.port}`;
  const env = {
    ...process.env,
    TOKENTOPPER_JSR_REGISTRY_URL: base,
    TOKENTOPPER_JSR_NPM_URL: `${base}/npm`,
    TOKENTOPPER_JSR_VERIFY_ATTEMPTS: "1",
    TOKENTOPPER_JSR_VERIFY_DELAY_MS: "1",
  };

  try {
    const verified = await execFileAsync(
      process.execPath,
      [resolve(root, "scripts/verify-jsr-release.mjs"), version],
      { cwd: root, env },
    );
    assert.equal(verified.stdout.trim(), `verified public JSR release @openfactoryai/tokentopper@${version}`);

    const status = await execFileAsync(
      process.execPath,
      [resolve(root, "scripts/verify-jsr-release.mjs"), version, "--status"],
      { cwd: root, env },
    );
    assert.match(status.stdout, /is already published/);

    published = false;
    await assert.rejects(
      execFileAsync(
        process.execPath,
        [resolve(root, "scripts/verify-jsr-release.mjs"), version, "--status"],
        { cwd: root, env },
      ),
      (error: NodeJS.ErrnoException & { code?: number }) => error.code === 2,
    );
  } finally {
    await new Promise<void>((resolveClose, rejectClose) =>
      server.close((error) => (error ? rejectClose(error) : resolveClose())),
    );
  }
});

function respondJson(response: import("node:http").ServerResponse, value: unknown) {
  respond(response, 200, JSON.stringify(value), "application/json");
}

function respond(
  response: import("node:http").ServerResponse,
  status: number,
  body: string | Buffer,
  contentType = "application/octet-stream",
) {
  response.writeHead(status, { "content-type": contentType });
  response.end(body);
}
