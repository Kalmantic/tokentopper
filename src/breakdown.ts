import { costUSD } from "./pricing";
import type { Rec } from "./usage";

// ccusage-style report buckets: daily, weekly, monthly, per-session, and
// 5-hour billing blocks. Pure functions over Rec[] so they stay fixture-testable
// and never touch the filesystem or network.

export interface ReportOptions {
  since?: string; // inclusive, YYYY-MM-DD or YYYYMMDD
  until?: string; // inclusive, YYYY-MM-DD or YYYYMMDD
  tool?: string; // restrict to one agent: claude | codex | opencode | gemini
}

export interface ModelUsage {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  tokens: number;
  costUSD: number;
  requests: number;
}

export interface ToolUsage extends ModelUsage {
  byModel: Record<string, ModelUsage>;
}

export interface ReportRow extends ModelUsage {
  key: string;
  models: string[];
  byModel: Record<string, ModelUsage>;
  byTool: Record<string, ToolUsage>;
}

export interface SessionRow extends ReportRow {
  tool: Rec["tool"];
  sessionId: string;
  lastActivity: string; // YYYY-MM-DD
}

export interface BlockRow extends ReportRow {
  start: string; // ISO timestamp, floored to the hour
  end: string; // start + 5h
  firstActivity: string;
  lastActivity: string;
  isActive: boolean;
  // Set only on the active block: observed burn rate and where the block is
  // headed if it continues at that pace until the window closes.
  burnRateTokensPerMin: number | null;
  projectedTokens: number | null;
  projectedCostUSD: number | null;
}

export const BLOCK_HOURS = 5;
const BLOCK_MS = BLOCK_HOURS * 3_600_000;

// Accepts YYYY-MM-DD or ccusage-style YYYYMMDD; returns YYYY-MM-DD or null.
export function normalizeDay(value: string): string | null {
  const m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const day = `${m[1]}-${m[2]}-${m[3]}`;
  return Number.isNaN(Date.parse(`${day}T00:00:00Z`)) ? null : day;
}

const TOOLS = new Set(["claude", "codex", "opencode", "gemini"]);

export function filterByDay(recs: Rec[], opts: ReportOptions = {}): Rec[] {
  const since = opts.since ? normalizeDay(opts.since) : null;
  const until = opts.until ? normalizeDay(opts.until) : null;
  if (opts.since && !since) throw new Error(`Invalid --since date "${opts.since}". Use YYYY-MM-DD.`);
  if (opts.until && !until) throw new Error(`Invalid --until date "${opts.until}". Use YYYY-MM-DD.`);
  const tool = opts.tool?.toLowerCase();
  if (tool && !TOOLS.has(tool)) {
    throw new Error(`Unknown --tool "${opts.tool}". Use one of: ${[...TOOLS].join(", ")}.`);
  }
  if (!since && !until && !tool) return recs;
  return recs.filter(
    (r) =>
      (!tool || r.tool === tool) &&
      (!since && !until ? true : r.day !== "" && (!since || r.day >= since) && (!until || r.day <= until)),
  );
}

function recCost(r: Rec): number {
  return (
    r.costUSD ??
    costUSD(r.provider, r.model, {
      input: r.input,
      output: r.output,
      cacheWrite: r.cacheWrite,
      cacheRead: r.cacheRead,
    })
  );
}

function emptyUsage(): ModelUsage {
  return { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, tokens: 0, costUSD: 0, requests: 0 };
}

function add(u: ModelUsage, r: Rec, cost: number): void {
  u.input += r.input;
  u.output += r.output;
  u.cacheWrite += r.cacheWrite;
  u.cacheRead += r.cacheRead;
  u.tokens += r.input + r.output + r.cacheWrite + r.cacheRead;
  u.costUSD += cost;
  u.requests += 1;
}

function finishRow<T extends ReportRow>(row: T): T {
  row.costUSD = round2(row.costUSD);
  for (const m of Object.values(row.byModel)) m.costUSD = round2(m.costUSD);
  for (const t of Object.values(row.byTool)) {
    t.costUSD = round2(t.costUSD);
    for (const m of Object.values(t.byModel)) m.costUSD = round2(m.costUSD);
  }
  row.models = Object.keys(row.byModel).sort();
  return row;
}

function addToTool(row: ReportRow, r: Rec, cost: number): void {
  const t = (row.byTool[r.tool] ??= { ...emptyUsage(), byModel: {} });
  add(t, r, cost);
  add((t.byModel[r.model] ??= emptyUsage()), r, cost);
}

function bucket(recs: Rec[], keyOf: (r: Rec) => string | null): ReportRow[] {
  const rows = new Map<string, ReportRow>();
  for (const r of recs) {
    const key = keyOf(r);
    if (!key) continue;
    let row = rows.get(key);
    if (!row) {
      row = { key, models: [], byModel: {}, byTool: {}, ...emptyUsage() };
      rows.set(key, row);
    }
    const cost = recCost(r);
    add(row, r, cost);
    add((row.byModel[r.model] ??= emptyUsage()), r, cost);
    addToTool(row, r, cost);
  }
  return [...rows.values()].map(finishRow).sort((a, b) => a.key.localeCompare(b.key));
}

export function dailyReport(recs: Rec[], opts: ReportOptions = {}): ReportRow[] {
  return bucket(filterByDay(recs, opts), (r) => r.day || null);
}

// Weeks start on Sunday (ccusage's default) and are keyed by the week's start date.
export function weekStart(day: string): string | null {
  const t = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

export function weeklyReport(recs: Rec[], opts: ReportOptions = {}): ReportRow[] {
  return bucket(filterByDay(recs, opts), (r) => (r.day ? weekStart(r.day) : null));
}

export function monthlyReport(recs: Rec[], opts: ReportOptions = {}): ReportRow[] {
  return bucket(filterByDay(recs, opts), (r) => (r.day ? r.day.slice(0, 7) : null));
}

export function sessionReport(recs: Rec[], opts: ReportOptions = {}): SessionRow[] {
  const rows = new Map<string, SessionRow>();
  for (const r of filterByDay(recs, opts)) {
    const key = `${r.tool}:${r.sessionId}`;
    let row = rows.get(key);
    if (!row) {
      row = {
        key,
        tool: r.tool,
        sessionId: r.sessionId,
        lastActivity: "",
        models: [],
        byModel: {},
        byTool: {},
        ...emptyUsage(),
      };
      rows.set(key, row);
    }
    const cost = recCost(r);
    add(row, r, cost);
    add((row.byModel[r.model] ??= emptyUsage()), r, cost);
    addToTool(row, r, cost);
    if (r.day > row.lastActivity) row.lastActivity = r.day;
  }
  return [...rows.values()]
    .map(finishRow)
    .sort((a, b) => a.lastActivity.localeCompare(b.lastActivity) || a.key.localeCompare(b.key));
}

// 5-hour billing windows, ccusage-style: a block opens at the first request's
// timestamp floored to the UTC hour and spans 5 hours; a request past the end
// opens the next block. Gaps produce no rows.
export function blocksReport(recs: Rec[], opts: ReportOptions = {}, now: number = Date.now()): BlockRow[] {
  const timed = filterByDay(recs, opts)
    .map((r) => ({ r, t: Date.parse(r.ts) }))
    .filter((x) => !Number.isNaN(x.t))
    .sort((a, b) => a.t - b.t);

  const rows: BlockRow[] = [];
  let current: BlockRow | null = null;
  let endMs = 0;
  for (const { r, t } of timed) {
    if (!current || t >= endMs) {
      const startMs = Math.floor(t / 3_600_000) * 3_600_000;
      endMs = startMs + BLOCK_MS;
      current = {
        key: new Date(startMs).toISOString(),
        start: new Date(startMs).toISOString(),
        end: new Date(endMs).toISOString(),
        firstActivity: r.ts,
        lastActivity: r.ts,
        isActive: now >= startMs && now < endMs,
        burnRateTokensPerMin: null,
        projectedTokens: null,
        projectedCostUSD: null,
        models: [],
        byModel: {},
        byTool: {},
        ...emptyUsage(),
      };
      rows.push(current);
    }
    const cost = recCost(r);
    add(current, r, cost);
    add((current.byModel[r.model] ??= emptyUsage()), r, cost);
    addToTool(current, r, cost);
    if (r.ts > current.lastActivity) current.lastActivity = r.ts;
  }
  for (const row of rows) {
    if (!row.isActive) continue;
    // Burn rate over time actually elapsed inside the block; the projection
    // assumes the same pace holds until the window closes.
    const startMs = Date.parse(row.start);
    const elapsedMin = Math.max(1, (now - startMs) / 60_000);
    const rate = row.tokens / elapsedMin;
    const remainingMin = Math.max(0, (Date.parse(row.end) - now) / 60_000);
    row.burnRateTokensPerMin = Math.round(rate);
    row.projectedTokens = Math.round(row.tokens + rate * remainingMin);
    row.projectedCostUSD = round2(row.costUSD + (row.costUSD / elapsedMin) * remainingMin);
  }
  return rows.map(finishRow);
}

// Benchmark: an AI-first engineer runs ~5B tokens/month across coding agents,
// or ~250M per working day over a 20-workday month. The insight compares the
// user's most recent active month against that pace.
export const BENCHMARK_TOKENS_PER_MONTH = 5_000_000_000;
export const BENCHMARK_WORKDAYS_PER_MONTH = 20;
export const BENCHMARK_TOKENS_PER_WORKDAY: number = BENCHMARK_TOKENS_PER_MONTH / BENCHMARK_WORKDAYS_PER_MONTH;

export interface Insight {
  month: string; // YYYY-MM of the most recent active month
  monthTokens: number;
  perWorkdayTokens: number; // monthTokens spread over 20 working days
  benchmarkShare: number; // monthTokens / BENCHMARK_TOKENS_PER_MONTH
  ahead: boolean; // at or above the benchmark pace
}

export function benchmarkInsight(recs: Rec[]): Insight | null {
  const months = monthlyReport(recs);
  const latest = months[months.length - 1];
  if (!latest) return null;
  return {
    month: latest.key,
    monthTokens: latest.tokens,
    perWorkdayTokens: Math.round(latest.tokens / BENCHMARK_WORKDAYS_PER_MONTH),
    benchmarkShare: latest.tokens / BENCHMARK_TOKENS_PER_MONTH,
    ahead: latest.tokens >= BENCHMARK_TOKENS_PER_MONTH,
  };
}

export function totalsOf(rows: ReportRow[]): ModelUsage {
  const total = emptyUsage();
  for (const row of rows) {
    total.input += row.input;
    total.output += row.output;
    total.cacheWrite += row.cacheWrite;
    total.cacheRead += row.cacheRead;
    total.tokens += row.tokens;
    total.costUSD += row.costUSD;
    total.requests += row.requests;
  }
  total.costUSD = round2(total.costUSD);
  return total;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
