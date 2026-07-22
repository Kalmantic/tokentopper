import assert from "node:assert/strict";
import test from "node:test";

import {
  comparisonMetrics,
  EFFICIENCY_MIN_ACTIVE_DAYS,
  EFFICIENCY_MIN_COST_USD,
} from "../src/comparison";
import { aggregateV2 } from "../src/report";
import type { Rec } from "../src/usage";

function rec(day: number, costUSD: number): Rec {
  return {
    ts: `2026-07-${String(day).padStart(2, "0")}T00:00:00.000Z`,
    day: `2026-07-${String(day).padStart(2, "0")}`,
    tool: "claude",
    provider: "anthropic",
    model: "claude-sonnet-4",
    sessionId: `session-${day}`,
    input: 100,
    output: 20,
    cacheWrite: 10,
    cacheRead: 30,
    webSearch: 0,
    webFetch: 0,
    costUSD,
  };
}

test("comparison formulas match the documented leaderboard definitions", () => {
  const result = aggregateV2([rec(1, 20)], "9.9.9", Date.parse("2026-07-11T00:00:00.000Z"));
  const metrics = comparisonMetrics(result);
  assert.equal(metrics.outputPerDollar, 1);
  assert.equal(metrics.cacheRate, 30 / 160);
  assert.equal(metrics.outputRatio, 20 / 130);
  assert.equal(metrics.efficiencyEligible, false);
});

test("efficiency eligibility requires both cost and active-day floors", () => {
  const records = Array.from({ length: EFFICIENCY_MIN_ACTIVE_DAYS }, (_, index) =>
    rec(index + 1, EFFICIENCY_MIN_COST_USD / EFFICIENCY_MIN_ACTIVE_DAYS),
  );
  const metrics = comparisonMetrics(aggregateV2(records, "9.9.9", Date.parse("2026-07-11T00:00:00.000Z")));
  assert.equal(metrics.eligibility.minimumCostUSD, 100);
  assert.equal(metrics.eligibility.minimumActiveDays, 10);
  assert.equal(metrics.efficiencyEligible, true);
});

test("zero denominators produce stable zero metrics", () => {
  const metrics = comparisonMetrics(aggregateV2([], "9.9.9", Date.parse("2026-07-11T00:00:00.000Z")));
  assert.equal(metrics.outputPerDollar, 0);
  assert.equal(metrics.cacheRate, 0);
  assert.equal(metrics.outputRatio, 0);
});
