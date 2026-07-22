# TokenTopper aggregate schemas

This document is the interoperability contract for the CLI, sync API, website,
and independent verifiers. It describes aggregate data only. TokenTopper never
puts prompts, responses, source code, file paths, branch names, commit messages,
or repository identity in either schema.

## Envelopes and payloads

`tokentopper export` signs a payload with the installation's Ed25519 private key
and writes a `tokentopper-signed/1` envelope:

```json
{
  "schema": "tokentopper-signed/1",
  "alg": "ed25519",
  "machineId": "pseudonymous-installation-id",
  "publicKey": "base64-spki-public-key",
  "signature": "base64-signature-over-canonical-payload",
  "payload": {}
}
```

The envelope version and payload version are independent. The signature covers
the recursively key-sorted canonical JSON representation of the complete
payload. Changing a nested daily counter invalidates the signature.

## `tokentopper/1`

Version 1 is the stable default used by `export`, `sync`, and `json`. It contains
all-time token categories and shallow all-time model/agent breakdowns. Daily
buckets contain only tokens and cost.

This is sufficient for the existing run-rate, tier, Index, and all-time rank. It
is not sufficient to reproduce historical efficiency or per-agent rankings.

## `tokentopper/2`

Version 2 is additive and comparison-ready. Generate it without changing the
terminal presentation:

```sh
tokentopper json --schema 2 --pretty
tokentopper export --schema 2 --pretty
tokentopper sync --schema 2
```

The sync command keeps version 1 as its default during migration. Version 2 is
an explicit opt-in until the production API accepts and validates it.

Each `byDay[YYYY-MM-DD]` value contains:

- `inputTokens`, `outputTokens`, `cacheCreationTokens`, `cacheReadTokens`, and
  their `tokens` total;
- estimated `costUSD`;
- request and unique session counts;
- web search and web fetch counts;
- `byTool`, with one nested `byModel` map per agent;
- `byModel`, for model-first aggregation across agents.

Only records with a valid UTC day are rankable. If a record's `day` is missing,
the CLI recovers the UTC day from its timestamp. A record with neither is
excluded from v2 instead of being assigned an unverifiable period.

### Reconciliation invariants

A consumer must reject a v2 payload when any of these conditions fails:

1. token and count fields are non-negative safe integers;
2. cost is finite and non-negative;
3. `tokens` equals input + output + cache creation + cache read;
4. each day reconciles to its agent and model child buckets;
5. top-level token categories, requests, and tool calls reconcile to all days;
6. `window.activeDays` equals the number of daily buckets;
7. every daily key is a real `YYYY-MM-DD` UTC calendar date.

Session counts are distinct-set counts, not additive in every hierarchy. A
session that changes models counts once for the day but once under each model it
used. Session IDs are namespaced by agent before the daily distinct count, so a
Claude and Codex session with the same raw ID remain two sessions.

`validateAggregateV2` implements these structural and reconciliation rules for
the library and is intended to be ported or reused by the API. Signature checks,
identity binding, payload-size limits, and temporal policy remain server gates.

`validateSignedAggregateV2` is the non-throwing untrusted-input entry point. It
adds envelope/schema checks, Ed25519 verification, installation-ID binding,
serialized-size and child-key limits, future/oldest-date policy, and a configurable
maximum cost-per-million-tokens ratio before accepting the reconciliation result.
Its defaults are exported as `DEFAULT_AGGREGATE_VALIDATION_LIMITS`; the API must
still bind the verified public key to the authenticated account and enforce
transactional multi-machine merge semantics.

## Comparison metrics

`comparisonMetrics` is the normative calculation:

- **Output/$** = output tokens / estimated cost;
- **Cache rate** = cache-read tokens / total tokens;
- **Output ratio** = output tokens / (total tokens - cache-read tokens).

A zero denominator returns zero. Raw ratios are used for sorting; display
rounding must not change rank order.

Efficiency boards require both $100 estimated spend and 10 active days. Users
below either floor can still rank by annual run-rate, total tokens, and cost, but
their efficiency position is shown as unqualified. The exported constants
`EFFICIENCY_MIN_COST_USD` and `EFFICIENCY_MIN_ACTIVE_DAYS` are authoritative.

Cost is an estimate based on TokenTopper's model price table, not a provider
invoice. A leaderboard must show the methodology and pricing freshness beside
cost-derived claims.

## Multi-machine merge contract

The API should treat every bound Ed25519 public key as one installation snapshot:

1. verify the envelope and v2 reconciliation rules before opening a transaction;
2. key the snapshot by account + public key, not by the user-editable device label;
3. accept an identical payload as an idempotent retry;
4. replace that installation's prior full snapshot only when the signed
   `generatedAt` is not older than the stored snapshot;
5. permit counters to decrease in a newer valid full snapshot because parsers can
   correct upstream rewinds or stale records;
6. recompute the account aggregate from active installation snapshots;
7. removing a device removes its snapshot from the aggregate; a later signed sync
   deliberately reactivates it.

The server must not combine retries by summing them. Histories copied between two
different machines can still represent the same upstream activity; because v2
does not expose raw session IDs, users should not import the same log archive on
multiple linked installations.

Recommended server limits include maximum envelope bytes, daily buckets, agent
and model keys per day, model-name length, future clock skew, and oldest accepted
date. These are operational policy and must be tested in the API repository.

## Rollout

1. CLI/library ships v2 generation while v1 remains the default.
2. API accepts, verifies, stores, and serves both versions.
3. Website reads v2 for historical comparison views and clearly marks v1-only
   profiles as awaiting a fresh sync.
4. After deployed-client adoption and rollback testing, `export` and `sync` can
   move to v2 by default in a separately announced compatibility change.
