# CCRank parity gap and TODO

Snapshot date: 2026-07-22

## Scope

The parity target is CCRank's public product experience, not its implementation
stack or its Claude-specific branding. TokenTopper should keep its stronger
multi-agent, signed-export, local-first, and supply-chain guarantees.

Sources reviewed:

- the current TokenTopper CLI, schemas, tests, README, and live TokenTopper page;
- the live CCRank landing page, leaderboard, history, and public profile;
- `makash/ccrank` at the current `main` branch, including its database migrations,
  upload API, profile/card routes, and CLI documentation.

## Executive gap

TokenTopper already meets or exceeds CCRank on local collection, supported agents,
reporting, tamper-evident uploads, privacy defaults, multi-machine identity, and
release security. Its material gap is the public comparison loop:

1. upload enough daily detail to calculate comparable metrics;
2. rank public users by several metrics and time windows;
3. give each public user a useful activity profile;
4. turn that profile into a shareable card.

The current `tokentopper/1` payload blocks honest implementation of that loop.
It contains all-time input/output/cache totals, but each `byDay` entry contains
only total tokens and cost. The server therefore cannot calculate historical
output efficiency, cache rate, output ratio, per-agent time windows, or a full
activity heatmap from a signed source.

## Capability matrix

| Capability | CCRank | TokenTopper now | Decision |
| --- | --- | --- | --- |
| Local usage ingestion | Claude/Codex-oriented ccusage flow; additional CLI readers exist | Claude Code, Codex, OpenCode, Gemini CLI | Already ahead |
| Local reports | Upload-oriented | Daily, weekly, monthly, session, 5-hour blocks, model/agent breakdowns | Already ahead |
| Tamper evidence | Bearer-token upload and server validation | Ed25519-signed canonical aggregate | Already ahead; preserve |
| Multi-machine aggregation | Named source per upload | Per-installation signing keys and device management | Already ahead; harden merge tests |
| Public leaderboard | Cost, tokens, output/$, cache rate, output ratio | Annual-token rank is present, but not a complete sortable/time-filtered board | P0/P1 gap |
| Time travel | Daily, weekly, monthly leaderboard with date navigation | Local period reports; no equivalent public history view | P1 gap |
| Agent filters | All, Claude, Codex | Local `--tool` filtering; public per-agent board not evidenced | P1 gap; expose all four agents |
| Public profile | Totals, efficiency, title, last active, platform breakdown | Verified code/badge flow and aggregate profile API exist; rich public activity profile is incomplete | P1 gap |
| Activity heatmap | 365 days; cost, tokens, activity toggle | Daily totals exist locally; no public heatmap | P1 gap |
| Social card | Public page plus SVG/PNG and social sharing | Verified badge/share actions exist | Validate rather than rebuild |
| Identity/privacy | Google OAuth, invite-only account, sharing toggle | Google sign-in, private-by-default profile, LinkedIn gate for public visibility | Equivalent with a different trust model |
| Tiers | Spend-based titles | Eight run-rate tiers plus 0–100 Index | Equivalent and better differentiated; do not copy thresholds |
| Device controls | Upload source tracking | Rename/remove installations; signed sync can re-add | Already ahead |
| Project/commit metadata | Optional repository descriptions and 28-day commit counts | Explicitly excludes file paths, branch names, and per-project grouping | Intentional non-parity |
| Invites/admin/self-hosting | Invite codes, admin panel, Cloudflare self-hosting | Central hosted service | Not required for user-facing parity |

## Prioritized TODO

### P0 — unblock trustworthy comparison data

- [x] Define `tokentopper/2` as a versioned, additive signed payload. Keep the
  `tokentopper/1` verifier/read path during migration.
- [x] Expand each daily bucket to include input, output, cache creation, cache
  read, total tokens, cost, requests, sessions, web searches, and web fetches.
- [x] Add daily agent buckets and daily model buckets so time-range and agent
  filters are computed from signed data instead of inferred from all-time totals.
- [x] Specify invariants: non-negative safe integers, finite cost, UTC date keys,
  sum of token categories equals total, child buckets reconcile to the day, and
  aggregate totals reconcile to all days.
- [x] Decide and document efficiency formulas before exposing ranks. Suggested
  compatibility formulas are `output / cost`, `cacheRead / totalTokens`, and
  `output / (totalTokens - cacheRead)`, but label them clearly and guard zero
  denominators.
- [x] Add an eligibility floor for efficiency boards to prevent tiny samples
  winning (CCRank uses at least $100 spend and 10 active days). Choose a
  TokenTopper-appropriate threshold and show it in the UI.
- [x] Add fixtures proving v2 aggregation across every supported agent, mixed
  models, missing days, zero-cost records, and large counters.
- [x] Add canonical-signature and round-trip tests for v1 and v2, including
  rejection of a modified daily or nested bucket.
- [x] Add a bounded, non-throwing untrusted-input validator for the signed v2
  envelope, installation-ID binding, dates, key cardinality, size, reconciliation,
  and implausible cost/token ratios, with API-portable tests.
- [x] Define server merge semantics for repeat uploads and multiple machines:
  idempotent per signing key, no double-counting on retry, monotonic replacement
  for cumulative days, and correct handling of corrected/decreased source data.
- [ ] Add server-side validation for signature, schema, reconciliation, date
  sanity, implausible cost/token ratios, and payload limits before accepting a
  rankable submission. The reusable validator exists here; API integration and
  authenticated public-key binding remain in the private API repository.

Exit condition: the backend can reproduce all-time, daily, weekly, monthly, and
per-agent metrics solely from verified signed payloads, and retrying the same
machine upload cannot change the result.

### P1 — ship the core CCRank comparison loop

- [ ] Build a public leaderboard with sorts for annual run-rate (TokenTopper's
  default), total tokens, estimated cost, output/$, cache rate, and output ratio.
- [ ] Add All time, Daily, Weekly, and Monthly ranges with previous/next date
  navigation and an explicit UTC boundary.
- [ ] Add All agents, Claude, Codex, OpenCode, and Gemini filters. Preserve the
  active sort, period, and date in filter links and shareable URLs.
- [ ] Show rank, identity, tier, metric value, active days, last active date, and
  contributing-agent badges in each row.
- [ ] Keep private users out of public rows while still showing their private
  rank after sign-in. Require the existing identity-verification rule before a
  profile becomes public.
- [ ] Create a stable public profile URL with run-rate, Index, tier, global rank,
  total/input/output/cache tokens, estimated cost, active days, last active date,
  requests, sessions, and agent/model mix.
- [ ] Add a 365-day activity heatmap with token, cost, and session toggles. Define
  whether a "session" is unique per agent/day and test cross-agent ID collisions.
- [ ] Add recent 30/90-day trend charts and week-over-week/month-over-month deltas
  using real data. Do not show the live page's illustrative charts as user data.
- [ ] Surface country and city rank on the profile and badge when the user opts
  into location; normalize location values to avoid duplicate cohorts.
- [ ] Validate the existing verified badge end to end: SVG/PNG rendering, profile
  link, Open Graph metadata, LinkedIn/X/Bluesky share URLs, image download, cache
  invalidation, private-profile behavior, and accessibility text.
- [ ] Add pagination, deterministic tie-breaking, empty states, responsive table
  behavior, and rate limits before opening the full board.
- [ ] Add API/contract tests for every sort × period × agent combination and UI
  smoke tests for anonymous, private owner, and public verified-user views.

Exit condition: a new user can install, upload or sync, see a private rank, opt
in, appear on every applicable leaderboard, open a data-backed public profile,
and share a verified card.

### P2 — close secondary experience gaps

- [ ] Show rank movement and metric deltas immediately after upload/sync.
- [x] Add current and longest activity streaks, with UTC semantics documented.
- [ ] Add a source/device comparison view without publishing hostnames or stable
  machine identifiers.
- [ ] Add personal CSV/JSON export for the server-held daily aggregates and a
  delete-my-cloud-data flow.
- [x] Document run-rate, Index, tiers, pricing limitations, efficiency formulas,
  eligibility thresholds, tie-breaking, and rank-freshness requirements.
- [ ] Surface that methodology, cohort size, and freshness beside every website
  rank and percentile.
- [ ] Display cohort size and data freshness beside every rank or percentile.
- [ ] Add opt-in weekly rank/usage summaries only after notification preferences,
  unsubscribe, and retention behavior are defined.
- [ ] Consider favorite tools or a short public bio only if profile interviews
  show that these improve sharing; they are decorative parity, not core parity.

### P3 — product extensions, not parity blockers

- [ ] Design organization/team leaderboards only after the current org mock is
  replaced with a consent model, roles, membership lifecycle, and aggregate
  privacy thresholds.
- [ ] Explore output-to-usage measurement with privacy-safe user-entered outcomes
  or external contribution links; do not silently inspect repositories.
- [ ] Consider invite/referral mechanics only if controlled growth is required.
- [ ] Consider a self-hosted server only if enterprise or community demand
  justifies supporting a second deployment model.

## Deliberate non-goals

- Do not copy CCRank's spend-based title thresholds. TokenTopper's annualized
  multi-agent tiers and Index are its product distinction.
- Do not upload repository paths, branch names, commit messages, diffs, prompts,
  responses, or per-project usage to obtain superficial parity with CCRank's Git
  metadata views. Any future output mapping needs a separate consent and threat
  model.
- Do not weaken signed submissions into bearer-token-only trust. Authentication
  identifies the account; the per-installation signature authenticates the data
  source.
- Do not claim organization charts, background incremental sync, percentiles, or
  efficiency coaching from illustrative/demo UI until production APIs and tests
  back them.

## Recommended execution order

1. Ship the v2 schema and reconciliation tests in this repository.
2. Add backward-compatible API ingestion and multi-machine merge tests in the API
   repository.
3. Build the sortable/time-filtered leaderboard and stable public profile in the
   website repository.
4. Validate the badge/share loop and add heatmaps/trends.
5. Add deltas, streaks, data export/deletion, and methodology documentation.
