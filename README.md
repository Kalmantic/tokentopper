# tokentopper

[![npm version](https://img.shields.io/npm/v/tokentopper?logo=npm)](https://www.npmjs.com/package/tokentopper)
[![npm downloads](https://img.shields.io/npm/dm/tokentopper?logo=npm)](https://www.npmjs.com/package/tokentopper)
[![CI](https://github.com/Kalmantic/tokentopper/actions/workflows/ci.yml/badge.svg)](https://github.com/Kalmantic/tokentopper/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/tokentopper)](LICENSE)

**Your Professional AI Usage Index for Claude Code, Codex, OpenCode, and Gemini CLI.** See your annual
token run-rate, cost estimate, tier, and verified rank with one command — and break your
AI token usage down by day, week, month, session, or 5-hour billing block.

```sh
npx tokentopper@latest
```

Example output from the real CLI using synthetic usage data:

```text
TokenTopper · Professional AI Usage Index

Run-rate      6.33B tokens/yr   ($12.1K/yr · 15d observed x365 x1.3)
Tier          Operator   · Index 53/100 (local estimate)

All-time      200.0M tokens   $384.00   2 requests, 2 sessions
Window        2026-07-01 → 2026-07-15 · 2 active days
Tools         20 web searches, 10 web fetches

By model
  claude-sonnet-4          200.0M   $384.00
```

No signup is required for a local score. TokenTopper reads local usage records but
does not retain or transmit prompt or response content, source code, file paths, or
branch names.

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
- per-model and per-agent breakdowns;
- optional Ed25519-signed exports for a verified, shareable leaderboard rank.

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
3. Upload it at [openfactoryai.com/tools/tokentopper](https://openfactoryai.com/tools/tokentopper/) or link once and use `tokentopper sync`.

The signature makes the aggregate tamper-evident after export. Publishing is opt-in;
local scoring remains private.

For local automation, `tokentopper json --pretty` prints aggregate usage without a
hostname or machine identifier. Its schema is `tokentopper-summary/1`.

## Commands

| Command | Does |
|---|---|
| `tokentopper` | Print run-rate, tier, Index, top models (default) |
| `tokentopper daily` | Per-day tokens (input/output/cache) and cost, with activity bars |
| `tokentopper weekly` | Per-week report (weeks start Sunday) |
| `tokentopper monthly` | Per-month report |
| `tokentopper session` | Per-session report across every supported agent |
| `tokentopper blocks` | 5-hour billing blocks; the active block shows burn rate and an end-of-window projection |
| `tokentopper json [--pretty]` | Print machine-safe aggregate JSON for scripts |
| `tokentopper export [--out f] [--pretty]` | Write `signed.json` |
| `tokentopper sync [--watch] [--interval min]` | Sign and POST to TokenTopper |
| `tokentopper login --token <t>` | Link this machine |
| `tokentopper skill install` | Install the TokenTopper Agent Skill for Claude, Codex, and Gemini CLI |

Every report accepts `--since`/`--until` (YYYY-MM-DD or YYYYMMDD), `--tool
<claude|codex|opencode|gemini>` to isolate one agent, `--breakdown` for per-model
rows, `--by-tool` for per-agent rows, and `--json [--pretty]` for scriptable
output (`tokentopper-report/1` schema with rows and totals). Unlike
single-agent trackers, one report covers Claude Code, Codex, OpenCode, and
Gemini CLI together, and the active billing block includes a live burn rate and
projected end-of-window usage.

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

Growth experiments and the path from useful CLI to repeatable discovery are tracked
in [`docs/GROWTH.md`](docs/GROWTH.md). Contributions are welcome; start with
[`CONTRIBUTING.md`](CONTRIBUTING.md).

## Credits

Usage-reading approach inspired by [ccusage](https://github.com/ryoppippi/ccusage)
(MIT). TokenTopper is a Kalmantic / OpenFactoryAI tool.

If TokenTopper gives you a useful view of your AI coding habits, star the repository
and share your verified rank. That is the growth loop.

MIT © Kalmantic
