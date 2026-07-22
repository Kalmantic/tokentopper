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
  aggregateV2,
  indexFor,
  tierFor,
  TIERS,
  toPublicAggregate,
  toPublicAggregateV2,
  validateAggregateV2,
} from "./report.ts";
export type {
  Aggregate,
  AggregateV2,
  DailyModelUsage,
  DailyToolUsage,
  DailyUsage,
  DetailedUsage,
  PublicAggregate,
  PublicAggregateV2,
} from "./report.ts";
export {
  activityStreak,
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
  periodComparison,
  sessionReport,
  totalsOf,
  weeklyReport,
  weekStart,
} from "./breakdown.ts";
export type { ActivityStreak, BlockRow, Insight, ModelUsage, PeriodComparison, ReportOptions, ReportRow, SessionRow, ToolUsage } from "./breakdown.ts";
export type { Rec } from "./usage.ts";
export {
  comparisonMetrics,
  EFFICIENCY_MIN_ACTIVE_DAYS,
  EFFICIENCY_MIN_COST_USD,
} from "./comparison.ts";
export type { ComparisonMetrics } from "./comparison.ts";
export {
  DEFAULT_AGGREGATE_VALIDATION_LIMITS,
  validateSignedAggregateV2,
} from "./verify.ts";
export type {
  AggregateValidationLimits,
  AggregateValidationResult,
} from "./verify.ts";
export { canonical, verifySigned } from "./sign.ts";
export type { Signed } from "./sign.ts";
