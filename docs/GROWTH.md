# TokenTopper growth system

The target is not a one-day spike. The target is a compounding loop in which a developer gets a useful private result, optionally publishes a verified rank, shares it, and brings another developer to the one-command experience.

## Baseline

Recorded on 2026-07-18, four days after the repository was created:

- npm downloads: 1,236 lifetime, with all downloads occurring in the latest week;
- GitHub stars: 0;
- GitHub forks: 0;
- supported usage sources: Claude Code, Codex, and OpenCode;
- primary install path: `npx tokentopper@latest`;
- public destination: [openfactoryai.com/tools/tokentopper](https://openfactoryai.com/tools/tokentopper/).

The npm number is encouraging but should not be treated as 1,236 activated users. Registry downloads include retries, mirrors, automated installs, and CI. The zero-star baseline suggests the immediate problem is converting curiosity into trust, repeat use, and sharing.

## Positioning

TokenTopper owns this sentence:

> Your Professional AI Usage Index for Claude Code, Codex, and OpenCode.

It should be discoverable for accurate phrases such as:

- Claude Code usage tracker;
- Claude Code token usage;
- Codex usage tracker;
- Codex token usage;
- OpenCode usage tracker;
- OpenCode token usage;
- AI coding agent usage analytics;
- developer AI usage score;
- coding-agent leaderboard;
- ccusage alternative for Claude Code plus Codex.

Do not target “prompt tokenizer,” “context-window calculator,” “Vercel AI SDK middleware,” or generic OpenAI token-counter traffic. TokenTopper does not solve those problems, and misleading acquisition produces immediate churn.

## North-star and guardrail metrics

The north-star metric is **weekly verified active users**: distinct opted-in users who successfully sync a valid aggregate during the week. This is closer to retained value than npm downloads.

Track these weekly:

| Funnel stage | Metric | Source |
| --- | --- | --- |
| Discovery | npm downloads by week and month | public npm downloads API |
| Interest | repository visitors, stars, README-to-site clicks | GitHub Insights and tagged links |
| Activation | successful non-empty local summaries | opt-in, privacy-preserving telemetry only if introduced |
| Verification | valid exports and syncs | TokenTopper API aggregate events |
| Sharing | profile shares, badge impressions, referral clicks | website events with explicit purpose |
| Retention | verified users active in consecutive weeks | pseudonymous account-level aggregates |

Never collect prompts, responses, code, paths, or branch names to measure growth. Do not add default-on analytics to the CLI merely to improve a dashboard.

## The three growth loops

### 1. Rank loop

`npx tokentopper` → useful score → verified profile → shareable rank/card → viewer runs the same command.

Highest-leverage product work:

- a clean share card for every verified profile;
- copy buttons for LinkedIn, X, and a GitHub profile README;
- a verified badge with tier and index;
- referral attribution from shared profiles to the install command;
- percentile context based only on valid, comparable aggregates.

### 2. Search loop

Answer a real coding-agent usage question → show the exact local command → explain privacy and methodology → link to the source and leaderboard.

Every article must solve the stated problem without requiring TokenTopper. The package is the fastest executable path, not an advertisement inserted into unrelated content.

### 3. Ecosystem loop

Add a supported usage source or stable output surface → become useful in more developer setups → earn inclusion in dotfiles, AI workstation templates, tutorials, and comparison guides.

Relevant integrations are OpenCode ingestion, stable JSON output, a verified badge, and import/export interoperability. Vercel AI SDK, LangChain, Express middleware, React wrappers, and ESLint plugins are not natural integrations for a local coding-agent usage reader.

## 90-day execution plan

### Days 1–14: conversion foundation

- [x] Put the one-command result and real CLI output above the README fold.
- [x] Align npm, GitHub, and CLI wording on Professional AI Usage Index.
- [x] Add accurate npm keywords and GitHub topics.
- [x] Document privacy before asking users to publish.
- [ ] Publish the verified `0.4.0` npm and JSR releases (owner actions are tracked in GitHub issues #14 and #15).
- [ ] Add a website install CTA that preserves the exact `npx tokentopper@latest` command.
- [ ] Add a visible GitHub star link after a user gets a useful result.
- [ ] Add tagged README and profile links so referrals can be attributed without CLI telemetry.

### Days 15–30: share loop

- [ ] Create a deterministic social card for verified profiles.
- [ ] Add copyable Markdown for a GitHub profile badge.
- [x] Add `tokentopper json` and `--json` with a documented, machine-safe versioned output schema.
- [ ] Add a copyable summary that excludes machine identifiers and private paths.
- [ ] Publish the first four search-led guides from the content queue.
- [ ] Launch once on Hacker News and relevant communities with the methodology and source code, not a promotional slogan.

### Days 31–60: ecosystem coverage

- [x] Add OpenCode ingestion with fixture-based parity tests.
- [ ] Publish a compatibility document for every supported agent and file format.
- [ ] Create an “AI developer setup” example that includes TokenTopper as an optional observability tool.
- [ ] Ask maintainers of genuinely relevant coding-agent lists and setup templates for inclusion after the integration is stable.
- [ ] Interview at least ten activated users before starting any companion package.

### Days 61–90: retention and proof

- [ ] Add week-over-week and month-over-month comparisons locally.
- [ ] Show methodology, sample size, and freshness beside percentile claims.
- [ ] Publish an anonymized aggregate usage report only when cohort size is safe.
- [ ] Turn the best-performing guide into a short terminal demo video.
- [ ] Review acquisition by activated and retained users, not raw clicks.
- [ ] Decide whether demand justifies standalone executables and Homebrew/Scoop using the gate in `DISTRIBUTION.md`.

## Twelve-week content queue

Each guide should contain an answer in the first paragraph, the exact command, sample output, supported file locations, privacy behavior, limitations, and a link to the implementation.

1. How to check Claude Code token usage locally
2. How to check Codex CLI token usage locally
3. One usage report for Claude Code and Codex
4. What Claude Code cache-read tokens mean for cost
5. How TokenTopper calculates annual AI coding run-rate
6. Professional AI Usage Index methodology and tier boundaries
7. How to export a tamper-evident AI usage report with Ed25519
8. ccusage and TokenTopper: choosing a local usage workflow
9. How to keep coding-agent analytics private
10. Measuring AI coding adoption without reading prompts or source code
11. Building a GitHub profile badge from verified coding-agent usage
12. What we learned from the first 90 days of TokenTopper

One strong guide per week is enough. Update or retire pages that do not answer their query; do not manufacture thin variants for every keyword.

## Launch checklist

- the current npm release installs in a clean environment;
- README command and sample output match the release;
- CI, provenance, checksum, and SBOM are public;
- the website repeats the privacy boundary accurately;
- issues and contribution instructions are ready before traffic arrives;
- the launch post explains the problem, implementation, limitations, and roadmap;
- every community post follows its self-promotion rules and includes affiliation;
- someone is available to answer issues and fix onboarding failures for 48 hours.

## Milestones

- **1,000 qualified users:** README conversion, private local value, and a reliable verified-profile funnel.
- **10,000 monthly downloads:** recurring search traffic plus a share card developers actually post.
- **50,000 monthly downloads:** three or more supported coding agents and inclusion in relevant setup templates or guides.
- **100,000 monthly downloads:** a default recommendation for measuring coding-agent usage, driven by retained usefulness rather than package fragmentation.

Do not create `tokentopper-react`, an ESLint plugin, or other companion packages to inflate download counts. Split a package only when it owns a stable API, has independent users, and reduces integration cost.
