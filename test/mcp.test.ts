import assert from "node:assert/strict";
import test from "node:test";

import { handleMessage } from "../src/mcp";
import type { Rec } from "../src/usage";

const RECS: Rec[] = [
  {
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
  },
];

const load = async () => RECS;

function parse(response: string | null): { id: unknown; result?: any; error?: any } {
  assert.ok(response, "expected a response");
  return JSON.parse(response) as { id: unknown; result?: any; error?: any };
}

test("initialize handshake returns server info and echoes protocol version", async () => {
  const res = parse(
    await handleMessage(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } },
      "9.9.9",
      load,
    ),
  );
  assert.equal(res.result.protocolVersion, "2025-03-26");
  assert.equal(res.result.serverInfo.name, "tokentopper");
  assert.equal(res.result.serverInfo.version, "9.9.9");
  assert.deepEqual(res.result.capabilities, { tools: {} });
});

test("notifications produce no response", async () => {
  assert.equal(await handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, "9.9.9", load), null);
});

test("tools/list exposes the two read-only tools", async () => {
  const res = parse(await handleMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, "9.9.9", load));
  assert.deepEqual(
    res.result.tools.map((t: { name: string }) => t.name),
    ["usage_summary", "usage_report"],
  );
});

test("tools/call usage_report returns rows, totals, and insight", async () => {
  const res = parse(
    await handleMessage(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "usage_report", arguments: { report: "daily" } },
      },
      "9.9.9",
      load,
    ),
  );
  const payload = JSON.parse(res.result.content[0].text);
  assert.equal(payload.report, "daily");
  assert.equal(payload.rows[0].key, "2026-07-01");
  assert.equal(payload.totals.tokens, 200);
  assert.equal(payload.insight.month, "2026-07");
  assert.equal(res.result.isError, false);
});

test("tools/call usage_summary excludes machine identity", async () => {
  const res = parse(
    await handleMessage(
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "usage_summary", arguments: {} } },
      "9.9.9",
      load,
    ),
  );
  const payload = JSON.parse(res.result.content[0].text);
  assert.equal(payload.schema, "tokentopper-summary/1");
  assert.equal("machine" in payload, false);
});

test("unknown methods return -32601; unknown tools return isError", async () => {
  const res = parse(await handleMessage({ jsonrpc: "2.0", id: 5, method: "resources/list" }, "9.9.9", load));
  assert.equal(res.error.code, -32601);
  const bad = parse(
    await handleMessage(
      { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "nope", arguments: {} } },
      "9.9.9",
      load,
    ),
  );
  assert.equal(bad.result.isError, true);
});
