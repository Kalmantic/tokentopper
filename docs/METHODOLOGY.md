# TokenTopper methodology

TokenTopper measures coding-agent API usage found in local records. It does not
measure developer skill, code quality, productivity, or business impact. Token
and cost comparisons are descriptive usage signals, not performance scores.

## Token accounting

For each request:

```text
total tokens = input + output + cache creation + cache read
```

The CLI adds those counters across Claude Code, Codex, OpenCode, and Gemini CLI.
Requests, sessions, web searches, and web fetches are separate counters and do
not contribute to the token total. Provider records differ, so the
[compatibility document](COMPATIBILITY.md) describes each reader's source and
known limitations.

## Annual run-rate

The displayed run-rate uses the inclusive observed calendar span:

```text
observed days   = max(1, round((latest timestamp - earliest timestamp) / 1 day) + 1)
tokens per year = round(total tokens / observed days * 365 * 1.3)
cost per year   = round cents(total estimated cost / observed days * 365 * 1.3)
```

The `1.3` factor is TokenTopper's explicit growth assumption. It is not a
prediction or an industry standard. A short observation window is volatile, so
the UI must show the basis beside the run-rate and must not present it as actual
annual consumption.

## Professional AI Usage Index

The local Index maps annualized tokens onto a logarithmic 0–100 scale. The
anchors are 100 million tokens/year at 0 and 250 billion tokens/year at 100;
values outside that range are clamped, then rounded to one decimal place.

```text
Index = clamp(0, 100,
  (log10(tokens/year) - log10(100M)) /
  (log10(250B) - log10(100M)) * 100)
```

This is a stable local estimate, not a percentile. A server rank or percentile
must be labelled separately and include cohort size and freshness.

## Tiers

The first upper bound greater than the annualized token run-rate wins:

| Tier | Annualized tokens |
| --- | ---: |
| Curious | under 1B |
| Tinkerer | 1B to under 5B |
| Operator | 5B to under 15B |
| Builder | 15B to under 30B |
| Accelerant | 30B to under 60B |
| Trailblazer | 60B to under 100B |
| Titan | 100B to under 250B |
| Legend | 250B or more |

The benchmark pace is 5 billion tokens/month. Workday pace divides the latest
UTC month's usage by 20. It is a reference point, not an eligibility gate.

## Estimated cost and pricing freshness

When an upstream record supplies cost, TokenTopper uses it. Otherwise it
estimates cost from the model table in `src/pricing.ts`, in USD per million
tokens. Estimates are package-versioned and can differ from invoices because of
provider price changes, model aliases, regional pricing, subscriptions, batch
discounts, and incomplete upstream fields.

The price table does not currently carry an independently audited freshness
timestamp. Cost must therefore be labelled **estimated**, and cost-derived
leaderboards must display the TokenTopper version used. Updating the table and
adding a visible verified-as-of date remains a release responsibility.

## Comparison metrics and eligibility

The comparison-ready schema defines:

```text
Output/$     = output tokens / estimated cost
Cache rate   = cache-read tokens / total tokens
Output ratio = output tokens / (total tokens - cache-read tokens)
```

A zero denominator produces zero. Ranking uses unrounded values. Efficiency
leaderboards require at least $100 estimated cost and 10 active UTC days; users
below either floor remain eligible for token, run-rate, and cost views.

## Periods, streaks, and rank order

Daily keys are UTC dates. Weeks start on Sunday, months are UTC calendar months,
and period deltas compare the latest bucket with its immediately preceding
bucket. A streak is a run of consecutive active UTC dates; the current streak
ends on the latest recorded active day, not necessarily today.

For equal public metrics, the future leaderboard should sort by annualized
tokens descending, then a stable public profile identifier ascending. The API
must define this tie-break contract before launch. Every rank must show the
calculation period, eligible cohort size, aggregate generation time, and latest
accepted sync time. The repository does not yet contain that API or website
implementation, so those requirements remain open in the parity TODO.

## Privacy and verification

The public JSON summary omits hostname and machine ID. Signed exports contain a
pseudonymous installation ID and public key but never prompts, responses,
source code, file paths, repository names, branches, or commit messages. See the
[schema contract](SCHEMA.md) for signature, reconciliation, and multi-machine
merge requirements.
