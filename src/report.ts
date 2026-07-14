import { costUSD } from "./pricing";
import type { Rec } from "./usage";

// The eight rungs of the ladder, by annualized token run-rate.
export const TIERS: { name: string; max: number }[] = [
  { name: "Curious", max: 10e6 },
  { name: "Tinkerer", max: 50e6 },
  { name: "Operator", max: 250e6 },
  { name: "Builder", max: 1e9 },
  { name: "Accelerant", max: 5e9 },
  { name: "Trailblazer", max: 25e9 },
  { name: "Titan", max: 100e9 },
  { name: "Legend", max: Infinity },
];

export function tierFor(annualTokens: number): string {
  for (const t of TIERS) if (annualTokens < t.max) return t.name;
  return "Legend";
}

// Fancy AI Usage Index: a local 0..100 estimate, log-scaled from 1M/yr (0) to
// 100B/yr (100). The authoritative, rank-relative Index is computed server-side.
export function indexFor(annualTokens: number): number {
  const lo = Math.log10(1e6);
  const hi = Math.log10(1e11);
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
  runRate: { tokensPerYear: number; costPerYear: number; basisDays: number };
  index: number;
  tier: string;
  byModel: Record<string, { tokens: number; costUSD: number; requests: number }>;
  byDay: Record<string, { tokens: number; costUSD: number }>;
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
  const byDay: Aggregate["byDay"] = {};
  const sessions = new Set<string>();
  let minTs = Infinity;
  let maxTs = -Infinity;

  // trailing-30-day window for the run-rate projection
  const times = recs.map((r) => Date.parse(r.ts)).filter((t) => !Number.isNaN(t));
  const latest = times.length ? Math.max(...times) : now;
  const cutoff = latest - 30 * DAY_MS;
  let trailing30Tokens = 0;
  let trailing30Cost = 0;

  for (const r of recs) {
    const tokens = r.input + r.output + r.cacheWrite + r.cacheRead;
    const cost = costUSD(r.model, {
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

    if (r.day) {
      const d = (byDay[r.day] ??= { tokens: 0, costUSD: 0 });
      d.tokens += tokens;
      d.costUSD += cost;
    }

    const t = Date.parse(r.ts);
    if (!Number.isNaN(t)) {
      if (t < minTs) minTs = t;
      if (t > maxTs) maxTs = t;
      if (t >= cutoff) {
        trailing30Tokens += tokens;
        trailing30Cost += cost;
      }
    }
  }

  totals.sessions = sessions.size;
  totals.costUSD = round2(totals.costUSD);

  const from = Number.isFinite(minTs) ? new Date(minTs).toISOString() : "";
  const to = Number.isFinite(maxTs) ? new Date(maxTs).toISOString() : "";
  const spanDays = Number.isFinite(minTs) && Number.isFinite(maxTs) ? Math.max(1, Math.round((maxTs - minTs) / DAY_MS) + 1) : 0;

  const basisDays = 30;
  const tokensPerYear = Math.round((trailing30Tokens / basisDays) * 365);
  const costPerYear = round2((trailing30Cost / basisDays) * 365);

  for (const k of Object.keys(byModel)) byModel[k]!.costUSD = round2(byModel[k]!.costUSD);
  for (const k of Object.keys(byDay)) byDay[k]!.costUSD = round2(byDay[k]!.costUSD);

  return {
    schema: "tokentopper/1",
    generatedAt: new Date(now).toISOString(),
    tool: { name: "tokentopper", version },
    window: { from, to, spanDays, activeDays: Object.keys(byDay).length },
    totals,
    runRate: { tokensPerYear, costPerYear, basisDays },
    index: indexFor(tokensPerYear),
    tier: tierFor(tokensPerYear),
    byModel,
    byDay,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
