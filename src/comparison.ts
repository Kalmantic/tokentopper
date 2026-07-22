import type { Aggregate, AggregateV2 } from "./report";

// Efficiency rankings are noisy for tiny samples. These public constants keep
// the client, API, methodology page, and future leaderboard eligibility aligned.
export const EFFICIENCY_MIN_COST_USD = 100;
export const EFFICIENCY_MIN_ACTIVE_DAYS = 10;

export interface ComparisonMetrics {
  outputPerDollar: number;
  cacheRate: number;
  outputRatio: number;
  efficiencyEligible: boolean;
  eligibility: {
    minimumCostUSD: number;
    minimumActiveDays: number;
    costUSD: number;
    activeDays: number;
  };
}

/**
 * Metrics used by sortable comparison views. Ratios remain raw numbers so each
 * presentation can choose its own rounding without changing rank order.
 */
export function comparisonMetrics(aggregate: Aggregate | AggregateV2): ComparisonMetrics {
  const { totals, window } = aggregate;
  const nonCacheTokens = totals.tokens - totals.cacheReadTokens;
  return {
    outputPerDollar: totals.costUSD > 0 ? totals.outputTokens / totals.costUSD : 0,
    cacheRate: totals.tokens > 0 ? totals.cacheReadTokens / totals.tokens : 0,
    outputRatio: nonCacheTokens > 0 ? totals.outputTokens / nonCacheTokens : 0,
    efficiencyEligible:
      totals.costUSD >= EFFICIENCY_MIN_COST_USD && window.activeDays >= EFFICIENCY_MIN_ACTIVE_DAYS,
    eligibility: {
      minimumCostUSD: EFFICIENCY_MIN_COST_USD,
      minimumActiveDays: EFFICIENCY_MIN_ACTIVE_DAYS,
      costUSD: totals.costUSD,
      activeDays: window.activeDays,
    },
  };
}
