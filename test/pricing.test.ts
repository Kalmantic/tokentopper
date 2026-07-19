import assert from "node:assert/strict";
import test from "node:test";

import { costUSD, priceFor } from "../src/pricing";

test("Gemini pricing distinguishes current Pro and Flash families", () => {
  assert.deepEqual(priceFor("google", "gemini-2.5-pro"), {
    input: 1.25,
    output: 10,
    cacheWrite: 1.25,
    cacheRead: 0.125,
  });
  assert.deepEqual(priceFor("google", "gemini-2.5-flash"), {
    input: 0.3,
    output: 2.5,
    cacheWrite: 0.3,
    cacheRead: 0.03,
  });
  assert.equal(costUSD("google", "gemini-2.5-flash", {
    input: 1_000_000,
    output: 1_000_000,
    cacheWrite: 0,
    cacheRead: 1_000_000,
  }), 2.83);
});
