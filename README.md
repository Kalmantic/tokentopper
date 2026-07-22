# tokentopper

[![npm version](https://img.shields.io/npm/v/tokentopper?logo=npm)](https://www.npmjs.com/package/tokentopper)
[![npm downloads](https://img.shields.io/npm/dm/tokentopper?logo=npm)](https://www.npmjs.com/package/tokentopper)
[![CI](https://github.com/Kalmantic/tokentopper/actions/workflows/ci.yml/badge.svg)](https://github.com/Kalmantic/tokentopper/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/Kalmantic/tokentopper/badge)](https://scorecard.dev/viewer/?uri=github.com/Kalmantic/tokentopper)
[![license](https://img.shields.io/npm/l/tokentopper)](LICENSE)

### One command. Four coding agents. One verified usage score.

TokenTopper turns the usage already recorded by **Claude Code, Codex, OpenCode,
and Gemini CLI** into a private local dashboard: annual token run-rate, estimated
cost, tier, Professional AI Usage Index, and detailed activity reports. Publish a
signed aggregate only when you want a verified leaderboard rank.

```sh
npx tokentopper@latest
```

No account, config file, or API key is required for your local score.
[See verified TokenTopper ranks](https://openfactoryai.com/tools/tokentopper/?utm_source=readme&utm_medium=package&utm_campaign=tokentopper).

## Your AI usage, formatted for the terminal

The default command answers the useful questions first: how much you use coding
agents, what that pace costs, and how it compares.

```text
  TokenTopper · Professional AI Usage Index

  Run-rate      6.33B tokens/yr   ($12.1K/yr · 15d observed x365 x1.3)
  Tier          Operator   · Index 53/100 (local estimate)

  All-time      200.0M tokens   $384.00   1,284 requests, 96 sessions
  Window        2026-07-01 → 2026-07-15 · 12 active days
  Tools         20 web searches, 10 web fetches

  By tool
    claude                  120.0M   $230.40
    codex                    52.0M   $99.84
    opencode                 18.0M   $34.56
    gemini                   10.0M   $19.20

  By model
    claude-sonnet-4         120.0M   $230.40
    gpt-5.3-codex            52.0M   $99.84
    gemini-2.5-pro           10.0M   $19.20
```

Your prompts, responses, source code, file paths, and branch names are never
included in the aggregate. Nothing is uploaded unless you explicitly run
`export` or `sync`.

## Why TokenTopper

| Need | What you get |
| --- | --- |
| One view across agents | Claude Code, Codex, OpenCode, and Gemini CLI combined without losing agent/model attribution |
| Understand the bill | Input, output, cache-write, cache-read, and model-aware cost estimates |
| See working rhythm | Daily, weekly, monthly, per-session, and live 5-hour billing-block reports |
| Compare your pace | Annual run-rate, eight tiers, 0–100 Index, and an AI-first benchmark |
| Prove a public rank | Canonical Ed25519-signed aggregate; the private key stays on your machine |
| Automate safely | Machine-readable JSON, signed sync, a read-only MCP server, and an Agent Skill |

## Install and run

TokenTopper supports the maintained Node.js 22 and 24 LTS lines. Run the current release without installing it:

```sh
npx tokentopper@latest            # your run-rate, tier, and Index
npx tokentopper@latest export     # write a signed.json to upload
npx tokentopper@latest sync       # sign and push it automatically
```

Or install the CLI globally:

```sh
npm install --global tokentopper
tokentopper
```

The same npm release runs through pnpm, Bun, and Deno. Deno permissions are broad
because the CLI discovers local agent logs and can optionally write config or sync
over the network:

```sh
pnpm dlx tokentopper@latest
bunx tokentopper@latest
deno run -A npm:tokentopper@latest
```

Deno 2.9+ holds newly published dependencies for 24 hours by default. During that
window, wait for the age gate or explicitly run
`deno run -A --minimum-dependency-age=0 npm:tokentopper@latest` after reviewing the
npm provenance.

Nix users can build and run the repository flake directly:

```sh
nix run github:Kalmantic/tokentopper
```

The calculation API is also prepared for JSR as `@openfactoryai/tokentopper`;
registry publication requires the JSR scope/package to be linked to this repository.

## What it does

TokenTopper is a local **AI token usage tracker**: it tracks **Claude token usage**
(Claude Code), **Codex token usage**, **OpenCode usage**, and **Gemini CLI usage**.
It combines coding-agent usage into one comparable score:

- annualized token run-rate and estimated model cost;
- Professional AI Usage Index from 0 to 100;
- eight usage tiers from Curious to Legend;
- daily, weekly, monthly, session, and 5-hour billing-block reports;
- week-over-week/month-over-month deltas plus current and longest active streaks;
- per-model and per-agent breakdowns, nested agent → model with `--by-tool`;
- a benchmark insight that tells you whether you are ahead of, or falling
  behind, an AI-first engineer's pace of ~5B tokens/month (~250M per working day);
- optional Ed25519-signed exports for a verified, shareable leaderboard rank —
  see where you stand globally, by country, and by city.

```text
tokentopper daily

  Date             Input   Output   Cache Write   Cache Read     Total    Cost
  2026-07-01       3,500    2,800           300       13,000    19,600   $0.16  ▮▮▮▮▮▮▮▮▮▮
  2026-07-08       3,000    1,200            50          700     4,950   $0.03  ▮▮▮
  ─────────────────────────────────────────────────────────────────────────────
  Total            6,500    4,000           350       13,700    24,550   $0.19
```

The active billing block in `tokentopper blocks` shows a live burn rate and the
projected end-of-window usage, so you can see where the current 5-hour window is
heading before it closes.

Every report ends with an insight that compares your latest month to the
benchmark pace, so you always know whether you are pushing your AI tools hard
enough — and how to publish your rank if you are:

```text
  Insight   An AI-first engineer runs ~5.00B tokens/month (~250.0M per working day).
            Your 2026-07 pace: 1.2B tokens (24% of benchmark, ~60.0M/workday).
            You're falling behind — push your AI tools to the limit and let them work for you.
  Rank      See where you stand globally, by country, and by city:
            tokentopper export → upload at https://openfactoryai.com/tools/tokentopper/
```

TokenTopper measures historical usage recorded by supported AI coding agents. It is
not a prompt tokenizer, context-window calculator, or middleware library.

## Supported terminals

| Terminal | Status |
| --- | --- |
| **Claude Code** | ✅ Supported |
| **Codex** | ✅ Supported |
| **OpenCode** | ✅ Supported (SQLite and JSON storage) |
| **Gemini CLI** | ✅ Supported (current JSONL session records) |
| GitHub Copilot & more | 🛣️ On the roadmap |

**Claude Code, Codex, OpenCode, and Gemini CLI are supported today. Other AI coding tools are on the roadmap.**
One index across every coding agent you use.

## What it reads

Your local **Claude Code** transcripts in `~/.claude/projects` (and
`~/.config/claude/projects`, or `$CLAUDE_CONFIG_DIR`) and your **Codex** sessions in
`~/.codex/sessions`, plus OpenCode's `~/.local/share/opencode/opencode.db` (with
`storage/message/**/*.json` fallback), and Gemini CLI sessions below
`~/.gemini/tmp/*/chats` (or `$GEMINI_CLI_HOME/.gemini/tmp`). It counts tokens
(input, output, cache write, cache read), attributes cost per model, and derives
your run-rate, active days, sessions, and tool calls. More terminals are on the roadmap.

**It does not retain or transmit prompt or response content, file paths, or branch
names.** Only aggregate counts, model names, and dates are kept, and nothing leaves
your machine until you run `export` or `sync`.

## signed.json

`tokentopper export` writes a tamper-evident `signed.json`: the aggregate payload
plus an **Ed25519 signature** over its canonical form, and the public key. The
leaderboard binds your public key to your account on first upload and verifies the
signature on every one, so a rank can't be forged by editing the file after export.
Your private key stays in `~/.tokentopper/key.json`.

## Share a verified rank

1. Run `npx tokentopper@latest` to see your private local score.
2. Run `npx tokentopper@latest export --pretty` to create `signed.json`.
3. Upload it at [openfactoryai.com/tools/tokentopper](https://openfactoryai.com/tools/tokentopper/?utm_source=readme&utm_medium=package&utm_campaign=tokentopper) or link once and use `tokentopper sync`.
4. See where you rank globally, by country, and by city — and defend it.

The signature makes the aggregate tamper-evident after export. Publishing is opt-in;
local scoring remains private.

For local automation, `tokentopper json --pretty` prints aggregate usage without a
hostname or machine identifier. Its stable default schema is
`tokentopper-summary/1`. The additive comparison-ready schema is available with
`tokentopper json --schema 2`, `tokentopper export --schema 2`, and opt-in
`tokentopper sync --schema 2`; it adds signed daily token categories plus nested
agent/model detail without changing the human-readable terminal reports. Sync
continues to default to v1 until the production API migration is complete.

For a copyable Markdown result, run `tokentopper share`. It includes the
run-rate, tier, local Index, aggregate usage, and agent names, but excludes
session IDs, model names, machine identity, hostnames, and private paths.

## Commands

| Command | Does |
|---|---|
| `tokentopper` | Print run-rate, tier, Index, top models (default) |
| `tokentopper daily` | Per-day tokens (input/output/cache) and cost, with activity bars |
| `tokentopper weekly` | Per-week report (weeks start Sunday) |
| `tokentopper monthly` | Per-month report |
| `tokentopper session` | Per-session report across every supported agent |
| `tokentopper blocks` | 5-hour billing blocks; the active block shows burn rate and an end-of-window projection |
| `tokentopper json [--pretty] [--schema 1\|2]` | Print machine-safe aggregate JSON for scripts |
| `tokentopper share` | Print a privacy-safe, copyable Markdown score card |
| `tokentopper export [--out f] [--pretty] [--schema 1\|2]` | Write `signed.json` |
| `tokentopper sync [--schema 1\|2] [--watch] [--interval min]` | Sign and POST to TokenTopper; v1 remains the default |
| `tokentopper login --token <t>` | Link this machine |
| `tokentopper skill install` | Install the TokenTopper Agent Skill for Claude, Codex, and Gemini CLI |
| `tokentopper mcp` | Run a read-only MCP server so agents can query your usage locally |

Every report accepts `--since`/`--until` (YYYY-MM-DD or YYYYMMDD), `--tool
<claude|codex|opencode|gemini>` to isolate one agent, `--breakdown` for per-model
rows, `--by-tool` for agent rows with each agent's models nested beneath them,
`--compact` to drop the cache columns on narrow terminals, `--no-cost` to hide
the cost column, and `--json [--pretty]` for scriptable output
(`tokentopper-report/1` schema with rows and totals). Unlike single-agent
trackers, one report covers Claude Code, Codex, OpenCode, and Gemini CLI
together, and the active billing block includes a live burn rate and projected
end-of-window usage.

## MCP server

`tokentopper mcp` runs a Model Context Protocol server over stdio so your coding
agent can query your own usage. It is **read-only and local-only** by design: no
filesystem writes, no network, and it exposes only the same privacy-safe
aggregates the CLI prints — never prompts, file paths, or machine identity.
Register it with a stdio MCP client, e.g. for Claude Code:

```sh
claude mcp add tokentopper -- npx tokentopper@latest mcp
```

Tools exposed: `usage_summary` (aggregate totals, run-rate, tier, index) and
`usage_report` (daily/weekly/monthly/session/blocks rows with totals and the
benchmark insight).

## Claude, Codex, and Gemini skill

Install one portable, privacy-first Agent Skill into all three assistants:

```sh
npx tokentopper@latest skill install
```

Use `--claude`, `--codex`, or `--gemini` for one target, and `--force` to update an existing
installation. The skill defaults to local inspection and requires explicit consent
before export or upload.

## Multiple machines

Sign in on the website, create a CLI login command, and run it on every machine you
want in the same aggregate. Each installation is bound to its own Ed25519 signing
key. The website lets you label devices (for example, **Work Mac**) or remove them;
a later signed sync deliberately re-adds that installation.

## Privacy & visibility

Private by default. You only appear on the public leaderboard if you opt in and
connect LinkedIn at the site.

## Development and releases

Run `npm run check` to typecheck, test the usage readers, build the CLI, pack the
publishable tarball, install it in an isolated directory, and smoke-test its commands.
The automated release process and recovery steps are documented in
[`docs/RELEASING.md`](docs/RELEASING.md). Supported distribution channels and
the standalone-executable adoption gate are documented in
[`docs/DISTRIBUTION.md`](docs/DISTRIBUTION.md).
Exact local data formats, privacy boundaries, runtime limitations, and common fixes
are documented in [`docs/COMPATIBILITY.md`](docs/COMPATIBILITY.md).
The signed v1/v2 aggregate contract, comparison formulas, reconciliation rules,
and multi-machine merge semantics are documented in
[`docs/SCHEMA.md`](docs/SCHEMA.md).
The run-rate, Index, tiers, benchmark, pricing limitations, efficiency
eligibility, and UTC period rules are documented in
[`docs/METHODOLOGY.md`](docs/METHODOLOGY.md).

Growth experiments and the path from useful CLI to repeatable discovery are tracked
in [`docs/GROWTH.md`](docs/GROWTH.md). Contributions are welcome; start with
[`CONTRIBUTING.md`](CONTRIBUTING.md).

Security issues should be reported privately using the process in
[`SECURITY.md`](SECURITY.md). The assets, trust boundaries, controls, and residual
risks are documented in [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md).
Production health checks and the privacy-safe incident response process are
documented in [`docs/OPERATIONS.md`](docs/OPERATIONS.md).

## Guides

- [Check Claude Code token usage locally](docs/guides/claude-code-token-usage.md)
- [Check Codex CLI token usage locally](docs/guides/codex-token-usage.md)
- [Combine Claude Code, Codex, OpenCode, and Gemini CLI](docs/guides/multi-agent-usage-report.md)
- [Understand cache-read tokens and estimated cost](docs/guides/cache-read-tokens.md)
- [Add TokenTopper to an AI development workstation](docs/guides/ai-developer-setup.md)

## Credits

Usage-reading approach inspired by [ccusage](https://github.com/ryoppippi/ccusage)
(MIT). TokenTopper is a Kalmantic / OpenFactoryAI tool.

If TokenTopper gives you a useful view of your AI coding habits, star the repository
and share your verified rank. That is the growth loop.

MIT © Kalmantic
