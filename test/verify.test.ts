import assert from "node:assert/strict";
import { generateKeyPairSync, sign as edSign } from "node:crypto";
import test from "node:test";

import { aggregateV2 } from "../src/report";
import { canonical, type Signed } from "../src/sign";
import { validateSignedAggregateV2 } from "../src/verify";
import type { Rec } from "../src/usage";

const now = Date.parse("2026-07-03T00:00:00.000Z");
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

function signed(mutate?: (payload: ReturnType<typeof aggregateV2>) => void): Signed<ReturnType<typeof aggregateV2>> {
  const payload = aggregateV2(records, "9.9.9", now);
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const machineId = "0123456789abcdef";
  payload.machine.id = machineId;
  mutate?.(payload);
  return {
    schema: "tokentopper-signed/1",
    alg: "ed25519",
    machineId,
    publicKey: Buffer.from(publicPem).toString("base64"),
    signature: edSign(null, Buffer.from(canonical(payload)), privateKey).toString("base64"),
    payload,
  };
}

test("server validator accepts a bounded, signed, reconciled v2 envelope", () => {
  assert.deepEqual(validateSignedAggregateV2(signed(), { now }), { ok: true, errors: [] });
});

test("server validator never throws for malformed or unserialisable input", () => {
  assert.equal(validateSignedAggregateV2(null, { now }).ok, false);
  assert.equal(validateSignedAggregateV2({ payload: { byDay: null } }, { now }).ok, false);
  assert.equal(validateSignedAggregateV2({ bigint: 1n }, { now }).ok, false);
});

test("server validator rejects tampering and installation identity mismatch", () => {
  const tampered = signed();
  tampered.payload.byDay["2026-07-01"]!.outputTokens += 1;
  assert.deepEqual(validateSignedAggregateV2(tampered, { now }).errors, ["envelope signature is invalid"]);

  const mismatch = signed();
  mismatch.machineId = "ffffffffffffffff";
  assert.deepEqual(validateSignedAggregateV2(mismatch, { now }).errors, ["payload.machine.id must match envelope.machineId"]);
});

test("server validator enforces size, time, key, and cost-ratio policy", () => {
  const envelope = signed();
  assert.match(validateSignedAggregateV2(envelope, { now, limits: { maxEnvelopeBytes: 10 } }).errors[0]!, /exceeds/);

  const future = signed((payload) => { payload.generatedAt = "2026-07-04T00:00:00.000Z"; });
  assert.match(validateSignedAggregateV2(future, { now }).errors.join("\n"), /generatedAt is too far in the future/);

  const bounded = signed();
  assert.match(validateSignedAggregateV2(bounded, { now, limits: { maxModelsPerDay: 0 } }).errors.join("\n"), /byModel exceeds/);
  const expensive = signed((payload) => {
    payload.totals.costUSD = 10;
    const day = payload.byDay["2026-07-01"]!;
    day.costUSD = 10;
    day.byModel["claude-sonnet-4"]!.costUSD = 10;
    day.byTool.claude!.costUSD = 10;
    day.byTool.claude!.byModel["claude-sonnet-4"]!.costUSD = 10;
  });
  assert.match(validateSignedAggregateV2(expensive, { now }).errors.join("\n"), /cost\/token ratio/);
});
