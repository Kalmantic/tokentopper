import { hostname, platform } from "node:os";
import { costUSD } from "./pricing";
import { machineId } from "./sign";
import type { Rec } from "./usage";

// The eight rungs of the ladder, by annualized token run-rate.
// Anchors: Trailblazer = 5B/month (60B/yr), Titan > 100B/yr, Legend > 250B/yr.
export const TIERS: { name: string; max: number }[] = [
  { name: "Curious", max: 1e9 },
  { name: "Tinkerer", max: 5e9 },
  { name: "Operator", max: 15e9 },
  { name: "Builder", max: 30e9 },
  { name: "Accelerant", max: 60e9 },
  { name: "Trailblazer", max: 100e9 },
  { name: "Titan", max: 250e9 },
  { name: "Legend", max: Infinity },
];

export function tierFor(annualTokens: number): string {
  for (const t of TIERS) if (annualTokens < t.max) return t.name;
  return "Legend";
}

// Professional AI Usage Index: a local 0..100 estimate, log-scaled from 100M/yr (0) to
// 250B/yr (100). The authoritative, rank-relative Index is computed server-side.
export function indexFor(annualTokens: number): number {
  const lo = Math.log10(1e8);
  const hi = Math.log10(250e9);
  const v = Math.log10(Math.max(1, annualTokens));
  return Math.round(Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100)) * 10) / 10;
}

export interface Aggregate {
  schema: "tokentopper/1";
  generatedAt: string;
  tool: { name: "tokentopper"; version: string };
  window: { from: string; to: string; spanDays: number; activeDays: number };
  totals: {
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    costUSD: number;
    requests: number;
    sessions: number;
    webSearches: number;
    webFetches: number;
  };
  runRate: { tokensPerYear: number; costPerYear: number; basis: string };
  index: number;
  tier: string;
  byModel: Record<string, { tokens: number; costUSD: number; requests: number }>;
  byTool: Record<string, { tokens: number; costUSD: number; requests: number }>;
  byDay: Record<string, { tokens: number; costUSD: number }>;
  machine: { id: string; hostname: string; os: string };
}

export interface DetailedUsage {
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  costUSD: number;
  requests: number;
  sessions: number;
  webSearches: number;
  webFetches: number;
}

export interface DailyModelUsage extends DetailedUsage {}

export interface DailyToolUsage extends DetailedUsage {
  byModel: Record<string, DailyModelUsage>;
}

export interface DailyUsage extends DetailedUsage {
  byModel: Record<string, DailyModelUsage>;
  byTool: Record<string, DailyToolUsage>;
}

/**
 * The comparison-ready signed schema. Unlike `tokentopper/1`, every day keeps
 * enough detail for historical and per-agent leaderboards to be reproduced by
 * a verifier without receiving raw session logs.
 */
export interface AggregateV2 extends Omit<Aggregate, "schema" | "byDay"> {
  schema: "tokentopper/2";
  byDay: Record<string, DailyUsage>;
}

export type PublicAggregate = Omit<Aggregate, "schema" | "machine"> & {
  schema: "tokentopper-summary/1";
};

export type PublicAggregateV2 = Omit<AggregateV2, "schema" | "machine"> & {
  schema: "tokentopper-summary/2";
};

// Script-friendly output excludes stable machine IDs and hostnames so piping
// it into another tool does not widen the privacy surface.
export function toPublicAggregate(agg: Aggregate): PublicAggregate {
  const { schema: _schema, machine: _machine, ...rest } = agg;
  return { schema: "tokentopper-summary/1", ...rest };
}

export function toPublicAggregateV2(agg: AggregateV2): PublicAggregateV2 {
  const { schema: _schema, machine: _machine, ...rest } = agg;
  return { schema: "tokentopper-summary/2", ...rest };
}

const DAY_MS = 86_400_000;

export function aggregate(recs: Rec[], version: string, now: number): Aggregate {
  const totals = {
    tokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    costUSD: 0,
    requests: 0,
    sessions: 0,
    webSearches: 0,
    webFetches: 0,
  };
  const byModel: Aggregate["byModel"] = {};
  const byTool: Aggregate["byTool"] = {};
  const byDay: Aggregate["byDay"] = {};
  const sessions = new Set<string>();
  let minTs = Infinity;
  let maxTs = -Infinity;

  for (const r of recs) {
    const tokens = r.input + r.output + r.cacheWrite + r.cacheRead;
    const cost = r.costUSD ?? costUSD(r.provider, r.model, {
      input: r.input,
      output: r.output,
      cacheWrite: r.cacheWrite,
      cacheRead: r.cacheRead,
    });

    totals.tokens += tokens;
    totals.inputTokens += r.input;
    totals.outputTokens += r.output;
    totals.cacheCreationTokens += r.cacheWrite;
    totals.cacheReadTokens += r.cacheRead;
    totals.costUSD += cost;
    totals.requests += 1;
    totals.webSearches += r.webSearch;
    totals.webFetches += r.webFetch;
    sessions.add(r.sessionId);

    const m = (byModel[r.model] ??= { tokens: 0, costUSD: 0, requests: 0 });
    m.tokens += tokens;
    m.costUSD += cost;
    m.requests += 1;

    const tl = (byTool[r.tool] ??= { tokens: 0, costUSD: 0, requests: 0 });
    tl.tokens += tokens;
    tl.costUSD += cost;
    tl.requests += 1;

    if (r.day) {
      const d = (byDay[r.day] ??= { tokens: 0, costUSD: 0 });
      d.tokens += tokens;
      d.costUSD += cost;
    }

    const t = Date.parse(r.ts);
    if (!Number.isNaN(t)) {
      if (t < minTs) minTs = t;
      if (t > maxTs) maxTs = t;
    }
  }

  totals.sessions = sessions.size;
  totals.costUSD = round2(totals.costUSD);

  const from = Number.isFinite(minTs) ? new Date(minTs).toISOString() : "";
  const to = Number.isFinite(maxTs) ? new Date(maxTs).toISOString() : "";
  const spanDays = Number.isFinite(minTs) && Number.isFinite(maxTs) ? Math.max(1, Math.round((maxTs - minTs) / DAY_MS) + 1) : 0;

  // Per-day rate over the observed period, annualized with 30% expected growth.
  const GROWTH = 1.3;
  const days = Math.max(1, spanDays);
  const tokensPerYear = Math.round((totals.tokens / days) * 365 * GROWTH);
  const costPerYear = round2((totals.costUSD / days) * 365 * GROWTH);

  for (const k of Object.keys(byModel)) byModel[k]!.costUSD = round2(byModel[k]!.costUSD);
  for (const k of Object.keys(byTool)) byTool[k]!.costUSD = round2(byTool[k]!.costUSD);
  for (const k of Object.keys(byDay)) byDay[k]!.costUSD = round2(byDay[k]!.costUSD);

  return {
    schema: "tokentopper/1",
    generatedAt: new Date(now).toISOString(),
    tool: { name: "tokentopper", version },
    window: { from, to, spanDays, activeDays: Object.keys(byDay).length },
    totals,
    runRate: { tokensPerYear, costPerYear, basis: `${days}d observed x365 x1.3` },
    index: indexFor(tokensPerYear),
    tier: tierFor(tokensPerYear),
    byModel,
    byTool,
    byDay,
    machine: { id: machineId(), hostname: hostname(), os: platform() },
  };
}

interface MutableDetailedUsage extends DetailedUsage {
  sessionIds: Set<string>;
}

interface MutableDailyModelUsage extends MutableDetailedUsage {}

interface MutableDailyToolUsage extends MutableDetailedUsage {
  byModel: Record<string, MutableDailyModelUsage>;
}

interface MutableDailyUsage extends MutableDetailedUsage {
  byModel: Record<string, MutableDailyModelUsage>;
  byTool: Record<string, MutableDailyToolUsage>;
}

function emptyDetailedUsage(): MutableDetailedUsage {
  return {
    tokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    costUSD: 0,
    requests: 0,
    sessions: 0,
    webSearches: 0,
    webFetches: 0,
    sessionIds: new Set<string>(),
  };
}

function addDetailedUsage(target: MutableDetailedUsage, rec: Rec, cost: number, sessionKey: string): void {
  const tokens = rec.input + rec.output + rec.cacheWrite + rec.cacheRead;
  target.tokens += tokens;
  target.inputTokens += rec.input;
  target.outputTokens += rec.output;
  target.cacheCreationTokens += rec.cacheWrite;
  target.cacheReadTokens += rec.cacheRead;
  target.costUSD += cost;
  target.requests += 1;
  target.webSearches += rec.webSearch;
  target.webFetches += rec.webFetch;
  target.sessionIds.add(sessionKey);
}

function finishDetailedUsage(value: MutableDetailedUsage): DetailedUsage {
  const { sessionIds, ...rest } = value;
  return { ...rest, costUSD: round2(rest.costUSD), sessions: sessionIds.size };
}

function recordDay(rec: Rec): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(rec.day)) {
    const parsed = new Date(`${rec.day}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === rec.day) return rec.day;
  }
  const timestamp = new Date(rec.ts);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString().slice(0, 10);
}

function detailedDays(recs: Rec[]): Record<string, DailyUsage> {
  const days: Record<string, MutableDailyUsage> = {};
  for (const rec of recs) {
    const day = recordDay(rec);
    if (!day) continue;
    const cost = rec.costUSD ?? costUSD(rec.provider, rec.model, {
      input: rec.input,
      output: rec.output,
      cacheWrite: rec.cacheWrite,
      cacheRead: rec.cacheRead,
    });
    const daily = (days[day] ??= { ...emptyDetailedUsage(), byModel: {}, byTool: {} });
    const sessionKey = `${rec.tool}:${rec.sessionId}`;
    addDetailedUsage(daily, rec, cost, sessionKey);

    const model = (daily.byModel[rec.model] ??= { ...emptyDetailedUsage() });
    addDetailedUsage(model, rec, cost, sessionKey);

    const tool = (daily.byTool[rec.tool] ??= { ...emptyDetailedUsage(), byModel: {} });
    addDetailedUsage(tool, rec, cost, rec.sessionId);
    const toolModel = (tool.byModel[rec.model] ??= { ...emptyDetailedUsage() });
    addDetailedUsage(toolModel, rec, cost, rec.sessionId);
  }

  const result: Record<string, DailyUsage> = {};
  for (const day of Object.keys(days).sort()) {
    const source = days[day]!;
    const byModel: Record<string, DailyModelUsage> = {};
    for (const model of Object.keys(source.byModel).sort()) {
      byModel[model] = finishDetailedUsage(source.byModel[model]!);
    }
    const byTool: Record<string, DailyToolUsage> = {};
    for (const toolName of Object.keys(source.byTool).sort()) {
      const sourceTool = source.byTool[toolName]!;
      const toolModels: Record<string, DailyModelUsage> = {};
      for (const model of Object.keys(sourceTool.byModel).sort()) {
        toolModels[model] = finishDetailedUsage(sourceTool.byModel[model]!);
      }
      byTool[toolName] = { ...finishDetailedUsage(sourceTool), byModel: toolModels };
    }
    result[day] = { ...finishDetailedUsage(source), byModel, byTool };
  }
  return result;
}

/**
 * Build the additive v2 payload without changing the established v1 CLI/API
 * contract. Records without a valid UTC day (including a recoverable day from
 * their timestamp) are excluded because a historical rank must be reproducible.
 */
export function aggregateV2(recs: Rec[], version: string, now: number): AggregateV2 {
  const dated = recs.flatMap((rec) => {
    const day = recordDay(rec);
    return day ? [{ ...rec, day }] : [];
  });
  const base = aggregate(dated, version, now);
  const { schema: _schema, byDay: _byDay, ...rest } = base;
  return { ...rest, schema: "tokentopper/2", byDay: detailedDays(dated) };
}

const COUNT_KEYS = [
  "tokens",
  "inputTokens",
  "outputTokens",
  "cacheCreationTokens",
  "cacheReadTokens",
  "requests",
  "sessions",
  "webSearches",
  "webFetches",
] as const;

function validateDetailedUsage(value: DetailedUsage, path: string, errors: string[]): void {
  for (const key of COUNT_KEYS) {
    if (!Number.isSafeInteger(value[key]) || value[key] < 0) errors.push(`${path}.${key} must be a non-negative safe integer`);
  }
  if (!Number.isFinite(value.costUSD) || value.costUSD < 0) errors.push(`${path}.costUSD must be a non-negative finite number`);
  const tokenSum = value.inputTokens + value.outputTokens + value.cacheCreationTokens + value.cacheReadTokens;
  if (value.tokens !== tokenSum) errors.push(`${path}.tokens does not equal its token categories`);
}

function summed(items: DetailedUsage[], key: keyof DetailedUsage): number {
  return items.reduce((total, item) => total + item[key], 0);
}

function validatePartition(parent: DetailedUsage, children: DetailedUsage[], path: string, errors: string[], sessionsPartition: boolean): void {
  for (const key of COUNT_KEYS) {
    if (key === "sessions" && !sessionsPartition) continue;
    if (summed(children, key) !== parent[key]) errors.push(`${path}.${key} does not reconcile to its children`);
  }
  const childCost = summed(children, "costUSD");
  if (Math.abs(childCost - parent.costUSD) > Math.max(0.01, children.length * 0.01)) {
    errors.push(`${path}.costUSD does not reconcile to its children`);
  }
}

/** Return every structural/reconciliation error in a comparison-ready payload. */
export function validateAggregateV2(agg: AggregateV2): string[] {
  const errors: string[] = [];
  if (agg.schema !== "tokentopper/2") errors.push("schema must be tokentopper/2");
  const days = Object.entries(agg.byDay);
  for (const [day, value] of days) {
    const parsedDay = new Date(`${day}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(parsedDay.getTime()) || parsedDay.toISOString().slice(0, 10) !== day) {
      errors.push(`byDay.${day} is not a valid UTC date key`);
    }
    validateDetailedUsage(value, `byDay.${day}`, errors);
    const models = Object.values(value.byModel);
    const tools = Object.values(value.byTool);
    for (const [model, modelValue] of Object.entries(value.byModel)) validateDetailedUsage(modelValue, `byDay.${day}.byModel.${model}`, errors);
    for (const [toolName, toolValue] of Object.entries(value.byTool)) {
      validateDetailedUsage(toolValue, `byDay.${day}.byTool.${toolName}`, errors);
      const toolModels = Object.values(toolValue.byModel);
      for (const [model, modelValue] of Object.entries(toolValue.byModel)) {
        validateDetailedUsage(modelValue, `byDay.${day}.byTool.${toolName}.byModel.${model}`, errors);
      }
      validatePartition(toolValue, toolModels, `byDay.${day}.byTool.${toolName}.byModel`, errors, false);
    }
    validatePartition(value, models, `byDay.${day}.byModel`, errors, false);
    validatePartition(value, tools, `byDay.${day}.byTool`, errors, true);
  }

  const dayValues = days.map(([, value]) => value);
  const totalMap: Record<keyof DetailedUsage, number> = {
    tokens: agg.totals.tokens,
    inputTokens: agg.totals.inputTokens,
    outputTokens: agg.totals.outputTokens,
    cacheCreationTokens: agg.totals.cacheCreationTokens,
    cacheReadTokens: agg.totals.cacheReadTokens,
    costUSD: agg.totals.costUSD,
    requests: agg.totals.requests,
    sessions: agg.totals.sessions,
    webSearches: agg.totals.webSearches,
    webFetches: agg.totals.webFetches,
  };
  validateDetailedUsage(totalMap, "totals", errors);
  validatePartition(totalMap, dayValues, "byDay", errors, false);
  if (agg.window.activeDays !== days.length) errors.push("window.activeDays does not equal the number of daily buckets");
  return errors;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
