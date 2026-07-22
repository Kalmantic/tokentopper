import assert from "node:assert/strict";
import { generateKeyPairSync, sign as edSign } from "node:crypto";
import test from "node:test";

import { aggregate, aggregateV2 } from "../src/report";
import { canonical, verifySigned, type Signed } from "../src/sign";
import type { Rec } from "../src/usage";

const records: Rec[] = [{
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
  webSearch: 1,
  webFetch: 0,
}];

function signed<T>(payload: T): Signed<T> {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  return {
    schema: "tokentopper-signed/1",
    alg: "ed25519",
    machineId: "test-machine",
    publicKey: Buffer.from(publicPem).toString("base64"),
    signature: edSign(null, Buffer.from(canonical(payload)), privateKey).toString("base64"),
    payload,
  };
}

test("canonical signatures round-trip for v1 and v2 payloads", () => {
  const now = Date.parse("2026-07-03T00:00:00.000Z");
  assert.equal(verifySigned(signed(aggregate(records, "9.9.9", now))), true);
  assert.equal(verifySigned(signed(aggregateV2(records, "9.9.9", now))), true);
});

test("changing v2 daily or nested detail invalidates the signature", () => {
  const payload = aggregateV2(records, "9.9.9", Date.parse("2026-07-03T00:00:00.000Z"));
  const envelope = signed(payload);
  assert.equal(verifySigned(envelope), true);

  payload.byDay["2026-07-01"]!.outputTokens += 1;
  assert.equal(verifySigned(envelope), false);
});

test("canonical form is stable across object key insertion order", () => {
  assert.equal(canonical({ z: 1, nested: { b: 2, a: 1 }, a: 2 }), canonical({ a: 2, nested: { a: 1, b: 2 }, z: 1 }));
});
