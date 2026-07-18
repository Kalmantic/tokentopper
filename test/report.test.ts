import assert from "node:assert/strict";
import test from "node:test";

import { aggregate, indexFor, tierFor, toPublicAggregate } from "../src/report";
import type { Rec } from "../src/usage";

test("tier and index boundaries remain stable", () => {
  assert.equal(tierFor(999_999_999), "Curious");
  assert.equal(tierFor(1_000_000_000), "Tinkerer");
  assert.equal(tierFor(250_000_000_000), "Legend");
  assert.equal(indexFor(100_000_000), 0);
  assert.equal(indexFor(250_000_000_000), 100);
});

test("aggregate combines Claude and Codex without losing tool attribution", () => {
  const records: Rec[] = [
    {
      ts: "2026-07-01T00:00:00.000Z",
      day: "2026-07-01",
      tool: "claude",
      provider: "anthropic",
      model: "claude-sonnet-4",
      sessionId: "claude-1",
      input: 100,
      output: 20,
      cacheWrite: 10,
      cacheRead: 30,
      webSearch: 1,
      webFetch: 0,
    },
    {
      ts: "2026-07-02T00:00:00.000Z",
      day: "2026-07-02",
      tool: "codex",
      provider: "openai",
      model: "gpt-5.3-codex",
      sessionId: "codex-1",
      input: 200,
      output: 50,
      cacheWrite: 0,
      cacheRead: 100,
      webSearch: 0,
      webFetch: 0,
    },
  ];

  const result = aggregate(records, "9.9.9", Date.parse("2026-07-03T00:00:00.000Z"));
  assert.equal(result.tool.version, "9.9.9");
  assert.equal(result.totals.tokens, 510);
  assert.equal(result.totals.requests, 2);
  assert.equal(result.totals.sessions, 2);
  assert.equal(result.byTool.claude?.tokens, 160);
  assert.equal(result.byTool.codex?.tokens, 350);
  assert.equal(result.window.spanDays, 2);
  assert.equal(result.window.activeDays, 2);
});

test("public aggregate excludes machine identity", () => {
  const result = aggregate([], "9.9.9", Date.parse("2026-07-03T00:00:00.000Z"));
  const publicResult = toPublicAggregate(result);
  const serialized = JSON.stringify(publicResult);

  assert.equal(publicResult.schema, "tokentopper-summary/1");
  assert.equal("machine" in publicResult, false);
  assert.equal(serialized.includes(result.machine.id), false);
  assert.equal(serialized.includes(result.machine.hostname), false);
});
