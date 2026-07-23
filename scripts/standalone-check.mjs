import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const binary = resolve(process.argv[2] || "");
if (!process.argv[2] || !existsSync(binary)) throw new Error("usage: node scripts/standalone-check.mjs <executable>");
if (process.platform !== "win32") chmodSync(binary, 0o755);

const root = mkdtempSync(join(tmpdir(), "tokentopper-standalone-"));
const home = join(root, "home");
const claude = join(root, "claude");
const codex = join(root, "codex");
const opencode = join(root, "opencode");
const geminiHome = join(root, "gemini-home");
const sentinel = "PRIVATE_PROMPT_AND_CODE_MUST_NOT_ESCAPE";

mkdirSync(home, { recursive: true });
mkdirSync(join(claude, "projects", "fixture"), { recursive: true });
mkdirSync(join(codex, "sessions", "2026", "07", "19"), { recursive: true });
mkdirSync(opencode, { recursive: true });
mkdirSync(join(geminiHome, ".gemini", "tmp", "project-hash", "chats"), { recursive: true });

writeFileSync(join(claude, "projects", "fixture", "session.jsonl"), JSON.stringify({
  type: "assistant",
  timestamp: "2026-07-17T10:00:00.000Z",
  sessionId: "claude-fixture",
  prompt: sentinel,
  message: {
    id: "claude-message",
    model: "claude-sonnet-4",
    content: sentinel,
    usage: { input_tokens: 100, output_tokens: 25, cache_creation_input_tokens: 10, cache_read_input_tokens: 20 },
  },
}) + "\n");

writeFileSync(join(codex, "sessions", "2026", "07", "19", "rollout-2026-07-18T11-00-00-fixture.jsonl"), [
  JSON.stringify({ type: "session_meta", payload: { model: "gpt-5-codex", instructions: sentinel } }),
  JSON.stringify({
    type: "event_msg",
    timestamp: "2026-07-18T11:00:01.000Z",
    payload: {
      type: "token_count",
      info: { last_token_usage: { input_tokens: 80, cached_input_tokens: 30, output_tokens: 20, reasoning_output_tokens: 5, total_tokens: 105 } },
    },
  }),
].join("\n") + "\n");

const db = new DatabaseSync(join(opencode, "opencode.db"));
db.exec("CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT, data TEXT NOT NULL)");
db.prepare("INSERT INTO message (id, session_id, data) VALUES (?, ?, ?)").run(
  "opencode-message",
  "opencode-fixture",
  JSON.stringify({
    id: "opencode-message",
    role: "assistant",
    providerID: "openai",
    modelID: "gpt-5-opencode",
    content: sentinel,
    time: { created: 1784372400000 },
    tokens: { input: 60, output: 15, cache: { read: 5, write: 2 }, total: 82 },
  }),
);
db.close();

writeFileSync(
  join(geminiHome, ".gemini", "tmp", "project-hash", "chats", "session-2026-07-19T12-00-fixture.jsonl"),
  [
    JSON.stringify({
      sessionId: "gemini-fixture",
      projectHash: "project-hash",
      startTime: "2026-07-19T12:00:00.000Z",
      lastUpdated: "2026-07-19T12:01:00.000Z",
    }),
    JSON.stringify({
      id: "gemini-message",
      timestamp: "2026-07-19T12:00:01.000Z",
      type: "gemini",
      model: "gemini-2.5-flash",
      content: sentinel,
      tokens: { input: 70, output: 12, cached: 20, thoughts: 3, total: 85 },
    }),
  ].join("\n") + "\n",
);

const env = {
  ...process.env,
  HOME: home,
  USERPROFILE: home,
  CLAUDE_CONFIG_DIR: claude,
  CODEX_HOME: codex,
  OPENCODE_DATA_DIR: opencode,
  GEMINI_CLI_HOME: geminiHome,
  NO_COLOR: "1",
};

function run(args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(binary, args, { env, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (status) => resolveRun({ status, stdout, stderr }));
  });
}

function assertPrivate(output) {
  assert.equal(output.includes(sentinel), false, "private fixture content escaped the reader");
}

try {
  const packageJson = JSON.parse(readFileSync(resolve(dirname(dirname(fileURLToPath(import.meta.url))), "package.json"), "utf8"));
  const version = await run(["--version"]);
  assert.equal(version.status, 0, version.stderr);
  assert.equal(version.stdout.trim(), packageJson.version);

  const jsonResult = await run(["json"]);
  assert.equal(jsonResult.status, 0, jsonResult.stderr);
  assertPrivate(jsonResult.stdout);
  const report = JSON.parse(jsonResult.stdout);
  assert.deepEqual(Object.keys(report.byTool).sort(), ["claude", "codex", "gemini", "opencode"]);
  assert.ok(report.byModel["gpt-5-opencode"], "compiled runtime did not read OpenCode SQLite");
  assert.ok(report.byModel["gemini-2.5-flash"], "compiled runtime did not read Gemini CLI JSONL");

  const summary = await run([]);
  assert.equal(summary.status, 0, summary.stderr);
  assert.match(summary.stdout, /Professional AI Usage Index/);
  assertPrivate(summary.stdout);

  const signedPath = join(root, "signed.json");
  const exported = await run(["export", "--out", signedPath]);
  assert.equal(exported.status, 0, exported.stderr);
  assertPrivate(readFileSync(signedPath, "utf8"));
  const keyPath = join(home, ".tokentopper", "key.json");
  assert.ok(existsSync(keyPath), "export did not create an Ed25519 key");
  if (process.platform !== "win32") assert.equal(statSync(keyPath).mode & 0o777, 0o600);

  const login = await run(["login", "--token", "fixture-token"]);
  assert.equal(login.status, 0, login.stderr);
  const configPath = join(home, ".tokentopper", "config.json");
  assert.ok(existsSync(configPath), "login did not create config");
  if (process.platform !== "win32") assert.equal(statSync(configPath).mode & 0o777, 0o600);

  const skill = await run(["skill", "install", "--force"]);
  assert.equal(skill.status, 0, skill.stderr);
  assert.ok(existsSync(join(home, ".claude", "skills", "tokentopper", "SKILL.md")));
  assert.ok(existsSync(join(codex, "skills", "tokentopper", "SKILL.md")));
  assert.ok(existsSync(join(geminiHome, ".gemini", "skills", "tokentopper", "SKILL.md")));

  let uploaded = "";
  let authorization = "";
  const server = createServer((request, response) => {
    authorization = request.headers.authorization || "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => { uploaded += chunk; });
    request.on("end", () => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"ok":true}');
    });
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    const sync = await run(["sync", "--endpoint", `http://127.0.0.1:${address.port}/sync`, "--token", "fixture-token"]);
    assert.equal(sync.status, 0, sync.stderr);
    assert.match(sync.stdout, /Synced/);
  } finally {
    await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
  }
  assert.equal(authorization, "Bearer fixture-token");
  assertPrivate(uploaded);
  const envelope = JSON.parse(uploaded);
  assert.equal(envelope.payload.tool.version, packageJson.version);
  assert.ok(envelope.signature && envelope.publicKey);

  console.log(`verified standalone ${packageJson.version} on ${process.platform}/${process.arch}`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
