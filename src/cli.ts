#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { collectAll } from "./usage";
import { aggregate, TIERS, toPublicAggregate, type Aggregate } from "./report";
import {
  BENCHMARK_TOKENS_PER_MONTH,
  BENCHMARK_TOKENS_PER_WORKDAY,
  benchmarkInsight,
  blocksReport,
  dailyReport,
  monthlyReport,
  sessionReport,
  totalsOf,
  weeklyReport,
  type BlockRow,
  type ReportOptions,
  type ReportRow,
  type SessionRow,
} from "./breakdown";
import type { Rec } from "./usage";
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
function summary(agg: Aggregate, recs: Rec[]): void {
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
    console.log("");
  }
  printInsight(recs);
}

// ---------- ccusage-style reports ----------
const fmtNum = (n: number) => n.toLocaleString("en-US");
const fmtCost = (n: number) => `$${n.toFixed(2)}`;

const REPORTS = ["daily", "weekly", "monthly", "session", "sessions", "blocks"] as const;
type ReportCommand = (typeof REPORTS)[number];

function reportOptions(): ReportOptions {
  return { since: flag("since"), until: flag("until"), tool: flag("tool") };
}

function printInsight(recs: Rec[]): void {
  const insight = benchmarkInsight(recs);
  if (!insight) return;
  const share = insight.benchmarkShare;
  const pace =
    share >= 1
      ? `${share.toFixed(1)}× the benchmark`
      : `${share * 100 >= 1 ? (share * 100).toFixed(0) : share * 100 >= 0.01 ? (share * 100).toFixed(2) : "<0.01"}% of benchmark`;
  console.log(`  ${bold("Insight")}   ${dim(`An AI-first engineer runs ~${fmtTokens(BENCHMARK_TOKENS_PER_MONTH)} tokens/month (~${fmtTokens(BENCHMARK_TOKENS_PER_WORKDAY)} per working day).`)}`);
  console.log(`            Your ${insight.month} pace: ${bold(fmtTokens(insight.monthTokens))} tokens (${pace}, ~${fmtTokens(insight.perWorkdayTokens)}/workday).`);
  console.log(
    insight.ahead
      ? `            ${green("You're ahead of the pack — claim your verified rank before someone takes it.")}`
      : `            You're falling behind — push your AI tools to the limit and let them work for you.`,
  );
  console.log(`  ${bold("Rank")}      See where you stand ${bold("globally, by country, and by city")}:`);
  console.log(`            ${green("tokentopper export")} ${dim("→ upload signed.json at")} ${SITE}`);
  console.log("");
}

function fmtLeft(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  return min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}m` : `${min}m`;
}

function printReport(
  title: string,
  labelHeader: string,
  rows: { label: string; row: ReportRow; note?: string }[],
  perUnit?: string,
): void {
  if (rows.length === 0) {
    console.log(dim(`No usage in the selected window.`));
    return;
  }
  const width = Math.max(labelHeader.length, "Total".length, ...rows.map((r) => r.label.length));
  const cell = (s: string, w = 12) => s.padStart(w);
  const line = (label: string, u: ReturnType<typeof totalsOf>) =>
    `  ${label.padEnd(width)}${cell(fmtNum(u.input))}${cell(fmtNum(u.output))}${cell(fmtNum(u.cacheWrite), 13)}${cell(fmtNum(u.cacheRead), 13)}${cell(fmtNum(u.tokens), 15)}${cell(fmtCost(u.costUSD), 12)}`;
  const maxTokens = Math.max(1, ...rows.map((r) => r.row.tokens));
  const bar = (tokens: number) => "▮".repeat(Math.max(1, Math.round((tokens / maxTokens) * 14)));

  console.log("");
  console.log(`  ${bold(title)}`);
  console.log("");
  console.log(dim(`  ${labelHeader.padEnd(width)}${cell("Input")}${cell("Output")}${cell("Cache Write", 13)}${cell("Cache Read", 13)}${cell("Total", 15)}${cell("Cost", 12)}`));
  for (const { label, row, note } of rows) {
    console.log(`${line(label, row)}  ${green(bar(row.tokens))}${note ? `  ${dim(note)}` : ""}`);
    if (has("by-tool")) {
      // Agent first, then that agent's models nested beneath it.
      for (const [tool, usage] of Object.entries(row.byTool)) {
        console.log(dim(line(`  ${tool}`, usage)));
        for (const [model, mu] of Object.entries(usage.byModel)) console.log(dim(line(`    ${model}`, mu)));
      }
    } else if (has("breakdown")) {
      for (const [model, usage] of Object.entries(row.byModel)) console.log(dim(line(`  ${model}`, usage)));
    }
  }
  console.log(dim(`  ${"".padEnd(width + 77, "─")}`));
  const totals = totalsOf(rows.map((r) => r.row));
  console.log(bold(line("Total", totals)));
  if (perUnit && rows.length > 1) {
    console.log(dim(`  Avg/${perUnit}: ${fmtNum(Math.round(totals.tokens / rows.length))} tokens · $${(totals.costUSD / rows.length).toFixed(2)} across ${rows.length} ${perUnit}s`));
  }
  console.log("");
}

function reportRows(command: ReportCommand, recs: Awaited<ReturnType<typeof collectAll>>): {
  title: string;
  labelHeader: string;
  perUnit?: string;
  rows: { label: string; row: ReportRow; note?: string }[];
  raw: ReportRow[] | SessionRow[] | BlockRow[];
} {
  const opts = reportOptions();
  if (command === "daily") {
    const raw = dailyReport(recs, opts);
    return { title: "Daily usage", labelHeader: "Date", perUnit: "day", raw, rows: raw.map((row) => ({ label: row.key, row, note: row.models.join(", ") })) };
  }
  if (command === "weekly") {
    const raw = weeklyReport(recs, opts);
    return { title: "Weekly usage (weeks start Sunday)", labelHeader: "Week of", perUnit: "week", raw, rows: raw.map((row) => ({ label: row.key, row, note: row.models.join(", ") })) };
  }
  if (command === "monthly") {
    const raw = monthlyReport(recs, opts);
    return { title: "Monthly usage", labelHeader: "Month", perUnit: "month", raw, rows: raw.map((row) => ({ label: row.key, row, note: row.models.join(", ") })) };
  }
  if (command === "blocks") {
    const raw = blocksReport(recs, opts);
    return {
      title: "Billing blocks (5-hour windows, UTC)",
      labelHeader: "Block start",
      raw,
      rows: raw.map((row) => ({
        label: row.start.slice(0, 16).replace("T", " "),
        row,
        note: row.isActive
          ? `${green("ACTIVE")} · ${fmtLeft(Date.parse(row.end) - Date.now())} left · ${fmtNum(row.burnRateTokensPerMin ?? 0)} tok/min · on pace for ${fmtTokens(row.projectedTokens ?? 0)} (${fmtCost(row.projectedCostUSD ?? 0)})`
          : row.models.join(", "),
      })),
    };
  }
  const raw = sessionReport(recs, opts);
  return {
    title: "Sessions",
    labelHeader: "Session",
    raw,
    rows: raw.map((row) => ({
      label: `${row.tool} ${row.sessionId.slice(0, 8)}`,
      row,
      note: `last ${row.lastActivity} · ${row.models.join(", ")}`,
    })),
  };
}

function doReport(command: ReportCommand, recs: Awaited<ReturnType<typeof collectAll>>): void {
  let report;
  try {
    report = reportRows(command, recs);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
  if (has("json")) {
    const name = command === "sessions" ? "session" : command;
    console.log(JSON.stringify(
      { schema: "tokentopper-report/1", report: name, rows: report.raw, totals: totalsOf(report.raw) },
      null,
      has("pretty") ? 2 : 0,
    ));
    return;
  }
  printReport(report.title, report.labelHeader, report.rows, report.perUnit);
  if (report.rows.length > 0) printInsight(recs);
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
  tokentopper daily           Per-day tokens and cost (ccusage-style report)
  tokentopper weekly          Per-week tokens and cost (weeks start Sunday)
  tokentopper monthly         Per-month tokens and cost
  tokentopper session         Per-session tokens and cost
  tokentopper blocks          5-hour billing blocks, with the active block marked
  tokentopper json            Print machine-safe aggregate JSON
  tokentopper export          Write a signed.json you can upload
  tokentopper sync            Sign and push your usage to TokenTopper
  tokentopper login           Link this machine with your CLI token
  tokentopper skill install   Install the Agent Skill for Claude, Codex, and Gemini

${bold("Options")}
  --out <file>     export: output path (default signed.json)
  --json           Print machine-safe aggregate JSON (reports: rows + totals)
  --since <date>   reports: include days on or after this date (YYYY-MM-DD)
  --until <date>   reports: include days on or before this date (YYYY-MM-DD)
  --tool <name>    reports: only one agent (claude, codex, opencode, gemini)
  --breakdown      reports: add per-model rows under each line
  --by-tool        reports: add per-agent rows with each agent's models nested
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

  if ((REPORTS as readonly string[]).includes(command)) {
    const recs = await collectAll();
    if (recs.length === 0) noData();
    return doReport(command as ReportCommand, recs);
  }

  const recs = await collectAll();
  if (recs.length === 0) noData();
  const agg = aggregate(recs, VERSION, Date.now());
  if (has("json")) return doJson(agg);

  switch (command) {
    case "json":
      return doJson(agg);
    case "export":
      return doExport(agg);
    case "sync":
      return doSync(agg);
    case "summary":
      return summary(agg, recs);
    default:
      console.error(`Unknown command "${command}".`);
      help();
      process.exit(1);
  }
}

void main();
