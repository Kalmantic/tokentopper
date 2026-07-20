import assert from "node:assert/strict";
import test from "node:test";

import {
  blocksReport,
  dailyReport,
  filterByDay,
  monthlyReport,
  normalizeDay,
  sessionReport,
  totalsOf,
  weekStart,
  weeklyReport,
} from "../src/breakdown";
import type { Rec } from "../src/usage";

function rec(overrides: Partial<Rec>): Rec {
  return {
    ts: "2026-07-01T10:00:00.000Z",
    day: "2026-07-01",
    tool: "claude",
    provider: "anthropic",
    model: "claude-sonnet-4",
    sessionId: "s1",
    input: 100,
    output: 50,
    cacheWrite: 10,
    cacheRead: 40,
    webSearch: 0,
    webFetch: 0,
    ...overrides,
  };
}

test("normalizeDay accepts YYYY-MM-DD and YYYYMMDD, rejects garbage", () => {
  assert.equal(normalizeDay("2026-07-01"), "2026-07-01");
  assert.equal(normalizeDay("20260701"), "2026-07-01");
  assert.equal(normalizeDay("last tuesday"), null);
  assert.equal(normalizeDay("2026-13-45"), null);
});

test("filterByDay is inclusive on both ends and rejects invalid input", () => {
  const recs = [
    rec({ day: "2026-06-30" }),
    rec({ day: "2026-07-01" }),
    rec({ day: "2026-07-02" }),
  ];
  const filtered = filterByDay(recs, { since: "20260701", until: "2026-07-01" });
  assert.deepEqual(filtered.map((r) => r.day), ["2026-07-01"]);
  assert.throws(() => filterByDay(recs, { since: "not-a-date" }), /Invalid --since/);
});

test("dailyReport groups by day with per-model breakdown", () => {
  const rows = dailyReport([
    rec({}),
    rec({ model: "claude-opus-4-8", input: 200, output: 100, cacheWrite: 0, cacheRead: 0 }),
    rec({ day: "2026-07-02", ts: "2026-07-02T09:00:00.000Z" }),
  ]);
  assert.deepEqual(rows.map((r) => r.key), ["2026-07-01", "2026-07-02"]);
  const first = rows[0]!;
  assert.equal(first.tokens, 500);
  assert.equal(first.input, 300);
  assert.equal(first.requests, 2);
  assert.deepEqual(first.models, ["claude-opus-4-8", "claude-sonnet-4"]);
  assert.equal(first.byModel["claude-sonnet-4"]?.tokens, 200);
  assert.equal(first.byModel["claude-opus-4-8"]?.tokens, 300);
  assert.ok(first.costUSD > 0);
});

test("weekStart floors to the preceding Sunday", () => {
  assert.equal(weekStart("2026-07-01"), "2026-06-28"); // Wednesday -> Sunday
  assert.equal(weekStart("2026-06-28"), "2026-06-28"); // Sunday stays
  assert.equal(weekStart("2026-07-04"), "2026-06-28"); // Saturday, same week
  assert.equal(weekStart("2026-07-05"), "2026-07-05"); // next Sunday
});

test("weeklyReport and monthlyReport bucket across boundaries", () => {
  const recs = [
    rec({ day: "2026-06-28" }),
    rec({ day: "2026-07-04" }),
    rec({ day: "2026-07-05" }),
  ];
  assert.deepEqual(weeklyReport(recs).map((r) => [r.key, r.requests]), [
    ["2026-06-28", 2],
    ["2026-07-05", 1],
  ]);
  assert.deepEqual(monthlyReport(recs).map((r) => [r.key, r.requests]), [
    ["2026-06", 1],
    ["2026-07", 2],
  ]);
});

test("sessionReport groups by tool+session and tracks last activity", () => {
  const rows = sessionReport([
    rec({ sessionId: "a", day: "2026-07-01" }),
    rec({ sessionId: "a", day: "2026-07-03" }),
    rec({ sessionId: "a", tool: "codex", provider: "openai", model: "gpt-5.3-codex", day: "2026-07-02" }),
  ]);
  assert.deepEqual(rows.map((r) => r.key), ["codex:a", "claude:a"]);
  assert.equal(rows[1]?.lastActivity, "2026-07-03");
  assert.equal(rows[1]?.requests, 2);
  assert.equal(rows[0]?.tool, "codex");
});

test("blocksReport opens 5-hour windows floored to the hour", () => {
  const rows = blocksReport(
    [
      rec({ ts: "2026-07-01T10:25:00.000Z" }),
      rec({ ts: "2026-07-01T14:59:00.000Z" }), // inside 10:00-15:00
      rec({ ts: "2026-07-01T15:00:00.000Z" }), // first tick of the next block
    ],
    {},
    Date.parse("2026-07-01T16:00:00.000Z"),
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.start, "2026-07-01T10:00:00.000Z");
  assert.equal(rows[0]?.end, "2026-07-01T15:00:00.000Z");
  assert.equal(rows[0]?.requests, 2);
  assert.equal(rows[0]?.isActive, false);
  assert.equal(rows[1]?.start, "2026-07-01T15:00:00.000Z");
  assert.equal(rows[1]?.isActive, true);
});

test("filterByDay --tool restricts to one agent and rejects unknown tools", () => {
  const recs = [rec({}), rec({ tool: "codex", provider: "openai", model: "gpt-5.3-codex" })];
  assert.deepEqual(filterByDay(recs, { tool: "codex" }).map((r) => r.tool), ["codex"]);
  assert.throws(() => filterByDay(recs, { tool: "copilot" }), /Unknown --tool/);
});

test("rows carry a per-tool breakdown", () => {
  const rows = dailyReport([
    rec({}),
    rec({ tool: "gemini", provider: "google", model: "gemini-2.5-pro", input: 300 }),
  ]);
  const row = rows[0]!;
  assert.equal(row.byTool["claude"]?.tokens, 200);
  assert.equal(row.byTool["gemini"]?.tokens, 400);
});

test("active block reports burn rate and end-of-window projection", () => {
  const now = Date.parse("2026-07-01T11:00:00.000Z"); // 60 min into the 10:00 block
  const rows = blocksReport([rec({ ts: "2026-07-01T10:00:00.000Z" })], {}, now);
  const block = rows[0]!;
  assert.equal(block.isActive, true);
  assert.equal(block.burnRateTokensPerMin, Math.round(200 / 60));
  // 200 tokens in 60 min, 240 min remain: 200 + (200/60)*240 = 1000
  assert.equal(block.projectedTokens, 1000);
  assert.ok((block.projectedCostUSD ?? 0) >= block.costUSD);
  const closed = blocksReport([rec({ ts: "2026-07-01T10:00:00.000Z" })], {}, Date.parse("2026-07-02T00:00:00.000Z"));
  assert.equal(closed[0]?.burnRateTokensPerMin, null);
  assert.equal(closed[0]?.projectedTokens, null);
});

test("totalsOf sums rows and rounds cost", () => {
  const rows = dailyReport([rec({}), rec({ day: "2026-07-02" })]);
  const total = totalsOf(rows);
  assert.equal(total.tokens, 400);
  assert.equal(total.requests, 2);
  assert.equal(total.costUSD, Math.round(total.costUSD * 100) / 100);
});
