/**
 * Public, runtime-portable TokenTopper calculation API.
 *
 * The CLI remains the primary product. This entrypoint exposes only aggregate
 * calculation primitives; it does not read a user's home directory or publish
 * usage automatically.
 *
 * @module
 */

export {
  aggregate,
  indexFor,
  tierFor,
  TIERS,
  toPublicAggregate,
} from "./report.ts";
export type { Aggregate, PublicAggregate } from "./report.ts";
export {
  BENCHMARK_TOKENS_PER_MONTH,
  BENCHMARK_TOKENS_PER_WORKDAY,
  BENCHMARK_WORKDAYS_PER_MONTH,
  benchmarkInsight,
  BLOCK_HOURS,
  blocksReport,
  dailyReport,
  filterByDay,
  monthlyReport,
  normalizeDay,
  sessionReport,
  totalsOf,
  weeklyReport,
  weekStart,
} from "./breakdown.ts";
export type { BlockRow, Insight, ModelUsage, ReportOptions, ReportRow, SessionRow, ToolUsage } from "./breakdown.ts";
export type { Rec } from "./usage.ts";
