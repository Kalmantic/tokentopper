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
export type { BlockRow, ModelUsage, ReportOptions, ReportRow, SessionRow } from "./breakdown.ts";
export type { Rec } from "./usage.ts";
