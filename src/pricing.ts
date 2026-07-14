// USD per 1,000,000 tokens, by provider. Public list prices; approximate for
// OpenAI's gpt-5 family. Cost is a secondary "spend" signal — token counts are
// the headline — so a blended default is fine when a model is unknown.
export interface Price {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

const ANTHROPIC: Record<"opus" | "sonnet" | "haiku", Price> = {
  opus: { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  sonnet: { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  haiku: { input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08 },
};
const OPENAI: Price = { input: 1.25, output: 10, cacheWrite: 1.25, cacheRead: 0.125 };

export function priceFor(provider: string, model: string): Price {
  if (provider === "openai") return OPENAI;
  const m = (model || "").toLowerCase();
  if (m.includes("opus")) return ANTHROPIC.opus;
  if (m.includes("haiku")) return ANTHROPIC.haiku;
  return ANTHROPIC.sonnet;
}

export interface TokenSplit {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export function costUSD(provider: string, model: string, u: TokenSplit): number {
  const p = priceFor(provider, model);
  return (
    (u.input * p.input + u.output * p.output + u.cacheWrite * p.cacheWrite + u.cacheRead * p.cacheRead) /
    1_000_000
  );
}
