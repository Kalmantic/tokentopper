// USD per 1,000,000 tokens. Public Claude API list prices; override per model as
// needed. Cache-write is the 5-minute ephemeral rate; cache-read is the discounted
// re-use rate. Unknown models fall back to the Sonnet tier so cost is never zero-ed
// silently.
export interface Price {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

const TABLE: Record<"opus" | "sonnet" | "haiku", Price> = {
  opus: { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  sonnet: { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  haiku: { input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08 },
};

export function priceFor(model: string): Price {
  const m = (model || "").toLowerCase();
  if (m.includes("opus")) return TABLE.opus;
  if (m.includes("haiku")) return TABLE.haiku;
  return TABLE.sonnet;
}

export interface TokenSplit {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export function costUSD(model: string, u: TokenSplit): number {
  const p = priceFor(model);
  return (
    (u.input * p.input +
      u.output * p.output +
      u.cacheWrite * p.cacheWrite +
      u.cacheRead * p.cacheRead) /
    1_000_000
  );
}
