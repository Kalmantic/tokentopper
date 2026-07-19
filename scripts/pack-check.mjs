import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import {
  mkdtempSync,
  mkdirSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCli = process.env.npm_execpath;
assert(npmCli, "pack:check must run through npm so npm_execpath is available");
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

  const packResult = run(process.execPath, [npmCli, "pack", "--ignore-scripts", "--json", "--pack-destination", temp]);
  const packed = JSON.parse(packResult.stdout)[0];
  assert.equal(packed.name, packageJson.name);
  assert.equal(packed.version, packageJson.version);
  assert.deepEqual(
    packed.files.map((file) => file.path).sort(),
    ["LICENSE", "README.md", "dist/cli.js", "package.json", "skills/tokentopper/SKILL.md", "skills/tokentopper/agents/openai.yaml"],
    "published tarball contains unexpected files",
  );

  const installDir = join(temp, "install");
  const homeDir = join(temp, "home");
  mkdirSync(installDir, { recursive: true });
  mkdirSync(homeDir, { recursive: true });
  writeFileSync(join(installDir, "package.json"), '{"private":true,"type":"module"}\n');
  const tarball = join(temp, packed.filename);
  run(process.execPath, [npmCli, "install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], { cwd: installDir });

  const installedPackage = JSON.parse(readFileSync(join(installDir, "node_modules", packageJson.name, "package.json"), "utf8"));
  assert.equal(installedPackage.bin?.tokentopper, "dist/cli.js");
  const bin = join(installDir, "node_modules", packageJson.name, installedPackage.bin.tokentopper);
  const env = {
    ...process.env,
    HOME: homeDir,
    USERPROFILE: homeDir,
    CLAUDE_CONFIG_DIR: join(homeDir, ".claude"),
    CODEX_HOME: join(homeDir, ".codex"),
    GEMINI_CLI_HOME: homeDir,
  };

  const cli = (args, options = {}) => run(process.execPath, [bin, ...args], options);
  const cliAsync = (args, options = {}) => runAsync(process.execPath, [bin, ...args], options);
  assert.equal(cli(["--version"], { cwd: installDir, env }).stdout.trim(), packageJson.version);
  assert.match(cli(["--help"], { cwd: installDir, env }).stdout, /Professional AI Usage Index/);
  assert.match(cli(["skill", "install", "--claude"], { cwd: installDir, env }).stdout, /Installed TokenTopper skill/);
  assert.equal(existsSync(join(homeDir, ".claude", "skills", "tokentopper", "SKILL.md")), true);
  assert.match(cli(["skill", "install", "--gemini"], { cwd: installDir, env }).stdout, /Installed TokenTopper skill/);
  assert.equal(existsSync(join(homeDir, ".gemini", "skills", "tokentopper", "SKILL.md")), true);

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
  const geminiFixtureDir = join(homeDir, ".gemini", "tmp", "pack-check", "chats");
  mkdirSync(geminiFixtureDir, { recursive: true });
  writeFileSync(
    join(geminiFixtureDir, "session-2026-07-01T11-00-pack.jsonl"),
    [
      JSON.stringify({
        sessionId: "gemini-pack-check",
        projectHash: "pack-check",
        startTime: "2026-07-01T11:00:00.000Z",
        lastUpdated: "2026-07-01T11:01:00.000Z",
      }),
      JSON.stringify({
        id: "gemini-pack-message",
        timestamp: "2026-07-01T11:00:01.000Z",
        type: "gemini",
        model: "gemini-2.5-flash",
        tokens: { input: 50, output: 10, cached: 20, thoughts: 5, total: 65 },
      }),
    ].join("\n") + "\n",
  );
  assert.match(cli([], { cwd: installDir, env }).stdout, /TokenTopper/);

  const jsonSummary = JSON.parse(cli(["json", "--pretty"], { cwd: installDir, env }).stdout);
  assert.equal(jsonSummary.schema, "tokentopper-summary/1");
  assert.equal("machine" in jsonSummary, false);
  assert.deepEqual(Object.keys(jsonSummary.byTool).sort(), ["claude", "gemini"]);

  const exportPath = join(temp, "signed.json");
  cli(["export", "--out", exportPath, "--pretty"], { cwd: installDir, env });
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
    await cliAsync(
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
