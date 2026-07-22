import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregate,
  aggregateV2,
  indexFor,
  tierFor,
  toPublicAggregate,
  toPublicAggregateV2,
  validateAggregateV2,
} from "../src/report";
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

test("v2 keeps signed daily token, tool, model, session, and web-call detail", () => {
  const records: Rec[] = [
    {
      ts: "2026-07-01T00:00:00.000Z",
      day: "2026-07-01",
      tool: "claude",
      provider: "anthropic",
      model: "claude-sonnet-4",
      sessionId: "shared-id",
      input: 100,
      output: 20,
      cacheWrite: 10,
      cacheRead: 30,
      webSearch: 2,
      webFetch: 1,
    },
    {
      ts: "2026-07-01T01:00:00.000Z",
      day: "2026-07-01",
      tool: "codex",
      provider: "openai",
      model: "gpt-5.3-codex",
      sessionId: "shared-id",
      input: 200,
      output: 50,
      cacheWrite: 0,
      cacheRead: 100,
      webSearch: 0,
      webFetch: 0,
    },
    {
      ts: "2026-07-02T02:00:00.000Z",
      day: "",
      tool: "gemini",
      provider: "google",
      model: "gemini-2.5-pro",
      sessionId: "gemini-1",
      input: 300,
      output: 80,
      cacheWrite: 0,
      cacheRead: 40,
      webSearch: 0,
      webFetch: 0,
    },
  ];

  const result = aggregateV2(records, "9.9.9", Date.parse("2026-07-03T00:00:00.000Z"));
  assert.equal(result.schema, "tokentopper/2");
  assert.deepEqual(Object.keys(result.byDay), ["2026-07-01", "2026-07-02"]);
  assert.equal(result.byDay["2026-07-01"]?.tokens, 510);
  assert.equal(result.byDay["2026-07-01"]?.inputTokens, 300);
  assert.equal(result.byDay["2026-07-01"]?.sessions, 2, "same raw ID from two agents is two sessions");
  assert.equal(result.byDay["2026-07-01"]?.webSearches, 2);
  assert.equal(result.byDay["2026-07-01"]?.byTool.claude?.tokens, 160);
  assert.equal(result.byDay["2026-07-01"]?.byTool.codex?.byModel["gpt-5.3-codex"]?.cacheReadTokens, 100);
  assert.equal(result.byDay["2026-07-02"]?.byModel["gemini-2.5-pro"]?.outputTokens, 80);
  assert.deepEqual(validateAggregateV2(result), []);
});

test("v2 excludes records that cannot be assigned a valid UTC day", () => {
  const invalid: Rec = {
    ts: "not-a-timestamp",
    day: "",
    tool: "opencode",
    provider: "openai",
    model: "gpt-5",
    sessionId: "invalid",
    input: 100,
    output: 10,
    cacheWrite: 0,
    cacheRead: 0,
    webSearch: 0,
    webFetch: 0,
  };
  const result = aggregateV2([invalid], "9.9.9", Date.parse("2026-07-03T00:00:00.000Z"));
  assert.equal(result.totals.tokens, 0);
  assert.equal(result.window.activeDays, 0);
  assert.deepEqual(result.byDay, {});
  assert.deepEqual(validateAggregateV2(result), []);
});

test("v2 supports every agent, mixed models, zero cost, and large counters", () => {
  const tools: Array<Pick<Rec, "tool" | "provider" | "model">> = [
    { tool: "claude", provider: "anthropic", model: "claude-opus-4" },
    { tool: "codex", provider: "openai", model: "gpt-5.3-codex" },
    { tool: "opencode", provider: "openai", model: "gpt-5" },
    { tool: "gemini", provider: "google", model: "gemini-2.5-pro" },
  ];
  const records = tools.map((tool, index): Rec => ({
    ts: `2026-07-0${index + 1}T00:00:00.000Z`,
    day: `2026-07-0${index + 1}`,
    ...tool,
    sessionId: `session-${index}`,
    input: index === 2 ? 5_000_000_000 : 100,
    output: 20,
    cacheWrite: 10,
    cacheRead: 30,
    webSearch: 0,
    webFetch: 0,
    costUSD: index === 2 ? 0 : undefined,
  }));
  records.push({ ...records[0]!, model: "claude-sonnet-4", sessionId: "mixed-model" });

  const result = aggregateV2(records, "9.9.9", Date.parse("2026-07-05T00:00:00.000Z"));
  assert.deepEqual(Object.keys(result.byDay["2026-07-03"]!.byTool), ["opencode"]);
  assert.equal(result.byDay["2026-07-03"]!.inputTokens, 5_000_000_000);
  assert.equal(result.byDay["2026-07-03"]!.costUSD, 0);
  assert.deepEqual(Object.keys(result.byDay["2026-07-01"]!.byModel), ["claude-opus-4", "claude-sonnet-4"]);
  assert.deepEqual(validateAggregateV2(result), []);
});

test("v2 validator rejects modified nested counters and category totals", () => {
  const result = aggregateV2([
    {
      ts: "2026-07-01T00:00:00.000Z",
      day: "2026-07-01",
      tool: "claude",
      provider: "anthropic",
      model: "claude-sonnet-4",
      sessionId: "session-1",
      input: 100,
      output: 20,
      cacheWrite: 10,
      cacheRead: 30,
      webSearch: 0,
      webFetch: 0,
    },
  ], "9.9.9", Date.parse("2026-07-03T00:00:00.000Z"));
  result.byDay["2026-07-01"]!.byTool.claude!.inputTokens += 1;
  const errors = validateAggregateV2(result);
  assert.ok(errors.some((error) => error.includes("token categories")));
  assert.ok(errors.some((error) => error.includes("does not reconcile")));
});

test("public v2 aggregate removes machine identity without dropping comparison detail", () => {
  const result = aggregateV2([], "9.9.9", Date.parse("2026-07-03T00:00:00.000Z"));
  const publicResult = toPublicAggregateV2(result);
  const serialized = JSON.stringify(publicResult);
  assert.equal(publicResult.schema, "tokentopper-summary/2");
  assert.equal("machine" in publicResult, false);
  assert.equal(serialized.includes(result.machine.id), false);
  assert.deepEqual(publicResult.byDay, {});
});
