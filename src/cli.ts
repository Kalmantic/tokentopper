#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { collectAll } from "./usage";
import { aggregate, TIERS, toPublicAggregate, type Aggregate } from "./report";
import { signAggregate, type Signed } from "./sign";
import { readConfig, resolveEndpoint, resolveToken, writeConfig } from "./config";
import packageJson from "../package.json" with { type: "json" };

const VERSION = packageJson.version;
const SITE = "https://openfactoryai.com/tools/tokentopper/";
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const argv = process.argv.slice(2);
const command = argv.find((a) => !a.startsWith("-")) ?? "summary";

function flag(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const next = argv[i + 1];
  return next && !next.startsWith("--") ? next : "true";
}
function has(name: string): boolean {
  return argv.includes(`--${name}`);
}

// ---------- formatting ----------
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;

function fmtTokens(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}
function fmtUSD(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

async function build(): Promise<Aggregate | null> {
  const recs = await collectAll();
  if (recs.length === 0) return null;
  return aggregate(recs, VERSION, Date.now());
}

function noData(): never {
  console.error(
    "No AI CLI usage found.\n" +
      dim("Looked for Claude Code, Codex, OpenCode, and Gemini CLI local usage.\n") +
      dim("Use a coding agent for a bit, then run this again."),
  );
  process.exit(1);
}

// ---------- commands ----------
function summary(agg: Aggregate): void {
  const rr = agg.runRate.tokensPerYear;
  const models = Object.entries(agg.byModel).sort((a, b) => b[1].tokens - a[1].tokens);

  console.log("");
  console.log(`  ${bold("TokenTopper")} ${dim("· Professional AI Usage Index")}`);
  console.log("");
  console.log(`  Run-rate      ${bold(green(fmtTokens(rr) + " tokens/yr"))}   ${dim("(" + fmtUSD(agg.runRate.costPerYear) + "/yr · " + agg.runRate.basis + ")")}`);
  console.log(`  Tier          ${bold(agg.tier)}   ${dim("· Index " + agg.index + "/100 (local estimate)")}`);
  console.log("");
  console.log(`  All-time      ${fmtTokens(agg.totals.tokens)} tokens   ${fmtUSD(agg.totals.costUSD)}   ${dim(agg.totals.requests + " requests, " + agg.totals.sessions + " sessions")}`);
  console.log(`  Window        ${dim((agg.window.from.slice(0, 10) || "?") + " → " + (agg.window.to.slice(0, 10) || "?") + " · " + agg.window.activeDays + " active days")}`);
  console.log(`  Tools         ${dim(agg.totals.webSearches + " web searches, " + agg.totals.webFetches + " web fetches")}`);
  const tools = Object.entries(agg.byTool).sort((a, b) => b[1].tokens - a[1].tokens);
  if (tools.length > 1) {
    console.log("");
    console.log(`  ${dim("By tool")}`);
    for (const [t, v] of tools) {
      console.log(`    ${t.padEnd(22)} ${fmtTokens(v.tokens).padStart(8)}   ${fmtUSD(v.costUSD)}`);
    }
  }
  if (models.length) {
    console.log("");
    console.log(`  ${dim("By model")}`);
    for (const [m, v] of models.slice(0, 5)) {
      console.log(`    ${m.padEnd(22)} ${fmtTokens(v.tokens).padStart(8)}   ${fmtUSD(v.costUSD)}`);
    }
  }
  const idx = TIERS.findIndex((t) => t.name === agg.tier);
  const next = TIERS[idx + 1];
  console.log("");
  if (next && Number.isFinite(next.max)) {
    console.log(`  ${dim("Next rung:")} ${next.name} at ${fmtTokens(TIERS[idx]!.max)}/yr. ${dim("Trailblazer starts at 5B/month (60B/yr).")}`);
  }
  console.log(`  ${dim("Publish your rank:")} tokentopper export ${dim("→ signed.json, then upload at")} ${SITE}`);
  console.log("");
}

function doExport(agg: Aggregate): void {
  const signed = signAggregate(agg);
  const out = resolve(flag("out") || "signed.json");
  writeFileSync(out, JSON.stringify(signed, null, has("pretty") ? 2 : 0));
  console.log(`${green("✓")} Wrote ${bold(out)}`);
  console.log(dim(`  ${fmtTokens(agg.runRate.tokensPerYear)}/yr · ${agg.tier} · signed (ed25519), no raw logs included.`));
  console.log(dim(`  Upload it at ${SITE}`));
}

function doJson(agg: Aggregate): void {
  console.log(JSON.stringify(toPublicAggregate(agg), null, has("pretty") ? 2 : 0));
}

async function doSync(agg: Aggregate): Promise<void> {
  const endpoint = resolveEndpoint(flag("endpoint"));
  const token = resolveToken(flag("token"));
  if (!token) {
    console.error(
      "Not linked yet. Get a token:\n" +
        dim(`  1. Sign in at ${SITE}\n`) +
        dim("  2. Copy your CLI token\n") +
        dim("  3. tokentopper login --token <token>"),
    );
    process.exit(1);
  }
  const signed = signAggregate(agg);
  await push(endpoint, token, signed);

  if (has("watch")) {
    const minutes = Number(flag("interval") ?? 360);
    console.log(dim(`Watching. Re-syncing every ${minutes} min. Ctrl-C to stop.`));
    setInterval(
      () => {
        void build().then((fresh) => { if (fresh) return push(endpoint, token, signAggregate(fresh)); });
      },
      Math.max(1, minutes) * 60_000,
    );
  }
}

async function push(endpoint: string, token: string, signed: Signed<Aggregate>): Promise<void> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(signed),
    });
    if (!res.ok) {
      console.error(`${res.status} ${res.statusText} from ${endpoint}`);
      return;
    }
    console.log(`${green("✓")} Synced ${fmtTokens(signed.payload.runRate.tokensPerYear)}/yr to TokenTopper.`);
  } catch (e) {
    console.error(`Sync failed: ${(e as Error).message}`);
  }
}

function doLogin(): void {
  const token = flag("token");
  const endpoint = flag("endpoint");
  if (token) {
    writeConfig({ token, ...(endpoint ? { endpoint } : {}) });
    console.log(`${green("✓")} Linked. Run ${bold("tokentopper sync")} to publish your rank.`);
    return;
  }
  const cfg = readConfig();
  console.log(
    (cfg.token ? `Already linked.\n` : "") +
      "To link this machine:\n" +
      dim(`  1. Sign in at ${SITE}\n`) +
      dim("  2. Copy your CLI token\n") +
      dim("  3. tokentopper login --token <token>"),
  );
}

function doSkillInstall(): void {
  if (!argv.includes("install")) {
    console.log("Usage: tokentopper skill install [--claude] [--codex] [--gemini] [--force]");
    return;
  }
  const source = [
    join(PACKAGE_ROOT, "skills", "tokentopper"),
    join(dirname(process.execPath), "skills", "tokentopper"),
    join(dirname(process.execPath), "..", "share", "tokentopper", "skills", "tokentopper"),
  ].find(existsSync);
  if (!source) {
    console.error("The TokenTopper skill is missing from this package.");
    process.exit(1);
  }
  const selected = has("claude") || has("codex") || has("gemini");
  const targets = [
    ...(!selected || has("claude") ? [join(homedir(), ".claude", "skills", "tokentopper")] : []),
    ...(!selected || has("codex") ? [join(process.env.CODEX_HOME || join(homedir(), ".codex"), "skills", "tokentopper")] : []),
    ...(!selected || has("gemini") ? [join(process.env.GEMINI_CLI_HOME || homedir(), ".gemini", "skills", "tokentopper")] : []),
  ];
  for (const target of targets) {
    if (existsSync(target) && !has("force")) {
      console.error(`${target} already exists. Re-run with --force to update it.`);
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target, { recursive: true, force: has("force") });
    console.log(`${green("✓")} Installed TokenTopper skill at ${target}`);
  }
}

function help(): void {
  console.log(`
${bold("tokentopper")} ${dim("v" + VERSION)} — your Professional AI Usage Index for Claude Code, Codex, OpenCode, and Gemini CLI.

${bold("Usage")}
  tokentopper                 Show your run-rate, tier, and Index (default)
  tokentopper json            Print machine-safe aggregate JSON
  tokentopper export          Write a signed.json you can upload
  tokentopper sync            Sign and push your usage to TokenTopper
  tokentopper login           Link this machine with your CLI token
  tokentopper skill install   Install the Agent Skill for Claude, Codex, and Gemini

${bold("Options")}
  --out <file>     export: output path (default signed.json)
  --json           Print machine-safe aggregate JSON
  --pretty         json/export: pretty-print the JSON
  --endpoint <url> sync/login: override the upload endpoint
  --token <token>  sync/login: your CLI token
  --watch          sync: keep running and re-sync on an interval
  --interval <min> sync --watch: minutes between syncs (default 360)
  --claude        skill install: install only for Claude
  --codex         skill install: install only for Codex
  --gemini        skill install: install only for Gemini CLI
  --force         skill install: replace an existing TokenTopper skill
  -v, --version    Print version
  -h, --help       Print this help

Supports Claude Code, Codex, OpenCode, and Gemini CLI today; GitHub Copilot is on the roadmap.
Reads supported local session stores, including ~/.gemini/tmp. Only counts,
models, and days leave your machine, and only when you export or sync. Ranks at
${SITE}
`);
}

async function main(): Promise<void> {
  if (has("version") || has("v") || command === "version") return void console.log(VERSION);
  if (has("help") || has("h") || command === "help") return help();

  if (command === "login") return doLogin();
  if (command === "skill") return doSkillInstall();

  const agg = await build();
  if (!agg) noData();
  if (has("json")) return doJson(agg);

  switch (command) {
    case "json":
      return doJson(agg);
    case "export":
      return doExport(agg);
    case "sync":
      return doSync(agg);
    case "summary":
      return summary(agg);
    default:
      console.error(`Unknown command "${command}".`);
      help();
      process.exit(1);
  }
}

void main();
