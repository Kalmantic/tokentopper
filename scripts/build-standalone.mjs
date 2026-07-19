import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

if (typeof Bun === "undefined") {
  throw new Error("standalone builds require the pinned Bun runtime");
}

const root = resolve(import.meta.dirname, "..");
const { version } = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const os = { darwin: "macos", linux: "linux", win32: "windows" }[process.platform];
const arch = { arm64: "arm64", x64: "x64" }[process.arch];
if (!os || !arch) throw new Error(`unsupported standalone target: ${process.platform}/${process.arch}`);

const name = `tokentopper-${version}-${os}-${arch}`;
const directory = resolve(root, "standalone-artifacts", name);
const executable = resolve(directory, process.platform === "win32" ? "tokentopper.exe" : "tokentopper");

rmSync(directory, { recursive: true, force: true });
mkdirSync(directory, { recursive: true });

const result = await Bun.build({
  entrypoints: [resolve(root, "src/cli.ts")],
  compile: { outfile: executable },
  minify: true,
  sourcemap: "none",
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  throw new Error("standalone compilation failed");
}

// The executable stays self-contained for usage/reporting. Agent Skill source is
// intentionally shipped beside it so users can inspect the exact instructions
// before installing them into Claude or Codex.
cpSync(resolve(root, "skills"), resolve(directory, "skills"), { recursive: true });
writeFileSync(resolve(directory, "manifest.json"), JSON.stringify({
  schemaVersion: 1,
  name: "tokentopper",
  version,
  platform: os,
  arch,
  runtime: { name: "bun", version: Bun.version },
  sourceCommit: process.env.TOKENTOPPER_SOURCE_COMMIT || process.env.GITHUB_SHA || null,
}, null, 2) + "\n");

console.log(executable);
