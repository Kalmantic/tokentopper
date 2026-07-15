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

// Fancy AI Usage Index: a local 0..100 estimate, log-scaled from 100M/yr (0) to
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

  // Run-rate = the stronger of this month and last month, annualized with a
  // modest growth factor, so a partial or quiet month never understates you.
  const d0 = new Date(now);
  const ym = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;
  const curYM = ym(d0.getUTCFullYear(), d0.getUTCMonth());
  const prevY = d0.getUTCMonth() === 0 ? d0.getUTCFullYear() - 1 : d0.getUTCFullYear();
  const prevM = d0.getUTCMonth() === 0 ? 11 : d0.getUTCMonth() - 1;
  const lastYM = ym(prevY, prevM);
  let curMonthTokens = 0;
  let curMonthCost = 0;
  let lastMonthTokens = 0;
  let lastMonthCost = 0;

  for (const r of recs) {
    const tokens = r.input + r.output + r.cacheWrite + r.cacheRead;
    const cost = costUSD(r.provider, r.model, {
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
    const mo = r.day.slice(0, 7);
    if (mo === curYM) {
      curMonthTokens += tokens;
      curMonthCost += cost;
    } else if (mo === lastYM) {
      lastMonthTokens += tokens;
      lastMonthCost += cost;
    }
  }

  totals.sessions = sessions.size;
  totals.costUSD = round2(totals.costUSD);

  const from = Number.isFinite(minTs) ? new Date(minTs).toISOString() : "";
  const to = Number.isFinite(maxTs) ? new Date(maxTs).toISOString() : "";
  const spanDays = Number.isFinite(minTs) && Number.isFinite(maxTs) ? Math.max(1, Math.round((maxTs - minTs) / DAY_MS) + 1) : 0;

  const GROWTH = 1.2;
  const tokensPerYear = Math.round(Math.max(curMonthTokens, lastMonthTokens) * 12 * GROWTH);
  const costPerYear = round2(Math.max(curMonthCost, lastMonthCost) * 12 * GROWTH);

  for (const k of Object.keys(byModel)) byModel[k]!.costUSD = round2(byModel[k]!.costUSD);
  for (const k of Object.keys(byTool)) byTool[k]!.costUSD = round2(byTool[k]!.costUSD);
  for (const k of Object.keys(byDay)) byDay[k]!.costUSD = round2(byDay[k]!.costUSD);

  return {
    schema: "tokentopper/1",
    generatedAt: new Date(now).toISOString(),
    tool: { name: "tokentopper", version },
    window: { from, to, spanDays, activeDays: Object.keys(byDay).length },
    totals,
    runRate: { tokensPerYear, costPerYear, basis: "max(this, last month) x12 x1.2" },
    index: indexFor(tokensPerYear),
    tier: tierFor(tokensPerYear),
    byModel,
    byTool,
    byDay,
    machine: { id: machineId(), hostname: hostname(), os: platform() },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
