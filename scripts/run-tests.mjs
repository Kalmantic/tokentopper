import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Build the test file list here rather than relying on `test/*.test.ts`.
// cmd.exe never expands globs, and Node's --test only learned to expand them in
// Node 22, so the shell form silently worked on POSIX and failed on Windows for
// every supported release below 22.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const testDir = join(root, "test");
const files = readdirSync(testDir)
  .filter((name) => name.endsWith(".test.ts"))
  .sort()
  .map((name) => join(testDir, name));

if (files.length === 0) throw new Error(`no *.test.ts files found in ${testDir}`);

const tsx = resolve(root, "node_modules", "tsx", "dist", "cli.mjs");
const { status } = spawnSync(process.execPath, [tsx, "--test", ...files], { stdio: "inherit" });
process.exit(status ?? 1);
