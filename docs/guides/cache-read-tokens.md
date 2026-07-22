# What Claude Code cache-read tokens mean for cost

Cache-read tokens are input tokens reused from a provider-side prompt cache.
They still count toward TokenTopper's total usage, but their estimated unit price
is usually lower than ordinary input. Use the daily report to see cache creation
and cache reads separately.

```sh
npx tokentopper@latest daily --tool claude
```

```text
  Date          Input       Output     Cache W      Cache R        Total       Cost
  2026-07-21      2.1M      850.0K      320.0K       18.4M        21.7M     $18.92
```

TokenTopper's accounting identity is:

```text
total = input + output + cache creation + cache read
```

For Claude Code, `cache_creation_input_tokens` becomes cache creation and
`cache_read_input_tokens` becomes cache read. Repeated streaming records for one
message keep the maximum observed counter so they are not added more than once.

Estimated cost multiplies each category by the package's model price table. It
is not an invoice: subscription terms, provider price changes, model aliases,
regional pricing, and discounts can differ. Use cost as a comparison signal and
token counters as the primary measurement. The full assumptions are in the
[methodology](../METHODOLOGY.md).

Cache rate for comparison-ready schema 2 is `cache-read tokens / total tokens`.
A high value indicates substantial input reuse; it does not by itself establish
better code quality, productivity, or outcomes.

The reader never retains cached prompt content. It uses only the numeric usage
counters written by Claude Code, and local reports make no network request.

