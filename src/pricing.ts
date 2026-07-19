// USD per 1,000,000 tokens, by provider. Public list prices; approximate for
// OpenAI's gpt-5 family and unknown model variants. Cost is a secondary "spend"
// signal — token counts are the headline.
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
const GOOGLE = {
  pro25: { input: 1.25, output: 10, cacheWrite: 1.25, cacheRead: 0.125 },
  flash25: { input: 0.3, output: 2.5, cacheWrite: 0.3, cacheRead: 0.03 },
  pro31: { input: 2, output: 12, cacheWrite: 2, cacheRead: 0.2 },
  flash3: { input: 0.5, output: 3, cacheWrite: 0.5, cacheRead: 0.05 },
  flashLite31: { input: 0.25, output: 1.5, cacheWrite: 0.25, cacheRead: 0.025 },
} satisfies Record<string, Price>;

export function priceFor(provider: string, model: string): Price {
  if (provider === "openai") return OPENAI;
  const m = (model || "").toLowerCase();
  if (provider === "google") {
    if (m.includes("3.1-flash-lite")) return GOOGLE.flashLite31;
    if (m.includes("3.1-pro")) return GOOGLE.pro31;
    if (m.includes("3-flash")) return GOOGLE.flash3;
    if (m.includes("2.5-pro")) return GOOGLE.pro25;
    return GOOGLE.flash25;
  }
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
