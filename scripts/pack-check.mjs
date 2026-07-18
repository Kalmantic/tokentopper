import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const temp = mkdtempSync(join(tmpdir(), "tokentopper-pack-check-"));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed (${result.status})\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }
  return result;
}

function runAsync(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: root, ...options });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (status) => {
      if (status === 0) resolvePromise({ stdout, stderr });
      else reject(new Error(`${command} ${args.join(" ")} failed (${status})\n${stdout}\n${stderr}`));
    });
  });
}

try {
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
  assert.equal(lock.version, packageJson.version, "lockfile version must match package version");
  assert.equal(lock.packages[""].version, packageJson.version, "root lock package version must match");

  const packResult = run(npm, ["pack", "--ignore-scripts", "--json", "--pack-destination", temp]);
  const packed = JSON.parse(packResult.stdout)[0];
  assert.equal(packed.name, packageJson.name);
  assert.equal(packed.version, packageJson.version);
  assert.deepEqual(
    packed.files.map((file) => file.path).sort(),
    ["LICENSE", "README.md", "dist/cli.js", "package.json"],
    "published tarball contains unexpected files",
  );

  const installDir = join(temp, "install");
  const homeDir = join(temp, "home");
  mkdirSync(installDir, { recursive: true });
  mkdirSync(homeDir, { recursive: true });
  writeFileSync(join(installDir, "package.json"), '{"private":true,"type":"module"}\n');
  const tarball = join(temp, packed.filename);
  run(npm, ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], { cwd: installDir });

  const bin = join(installDir, "node_modules", ".bin", process.platform === "win32" ? "tokentopper.cmd" : "tokentopper");
  const env = {
    ...process.env,
    HOME: homeDir,
    USERPROFILE: homeDir,
    CLAUDE_CONFIG_DIR: join(homeDir, ".claude"),
    CODEX_HOME: join(homeDir, ".codex"),
  };

  assert.equal(run(bin, ["--version"], { cwd: installDir, env }).stdout.trim(), packageJson.version);
  assert.match(run(bin, ["--help"], { cwd: installDir, env }).stdout, /Professional AI Usage Index/);

  const fixtureDir = join(homeDir, ".claude", "projects", "pack-check");
  mkdirSync(fixtureDir, { recursive: true });
  writeFileSync(
    join(fixtureDir, "session.jsonl"),
    `${JSON.stringify({
      type: "assistant",
      timestamp: "2026-07-01T10:00:00.000Z",
      sessionId: "pack-check",
      message: {
        id: "pack-check-message",
        model: "claude-sonnet-4",
        usage: { input_tokens: 100, output_tokens: 25 },
      },
    })}\n`,
  );
  assert.match(run(bin, [], { cwd: installDir, env }).stdout, /TokenTopper/);

  const exportPath = join(temp, "signed.json");
  run(bin, ["export", "--out", exportPath, "--pretty"], { cwd: installDir, env });
  const signed = JSON.parse(readFileSync(exportPath, "utf8"));
  assert.equal(signed.schema, "tokentopper-signed/1");
  assert.equal(signed.payload.tool.version, packageJson.version);

  let received;
  const server = createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      received = { authorization: request.headers.authorization, body: JSON.parse(body) };
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"ok":true}');
    });
  });
  await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  try {
    const address = server.address();
    assert(address && typeof address === "object");
    await runAsync(
      bin,
      ["sync", "--token", "pack-check-token", "--endpoint", `http://127.0.0.1:${address.port}/usage`],
      { cwd: installDir, env },
    );
  } finally {
    await new Promise((resolvePromise, reject) => server.close((error) => error ? reject(error) : resolvePromise()));
  }
  assert.equal(received?.authorization, "Bearer pack-check-token");
  assert.equal(received?.body.schema, "tokentopper-signed/1");

  console.log(`verified ${packageJson.name}@${packageJson.version} tarball and CLI`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
