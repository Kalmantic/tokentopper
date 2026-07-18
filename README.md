# tokentopper

Measure how much you actually use **Claude Code** and **Codex**. tokentopper scores
your **Professional AI Usage Index**, shows your run-rate and your tier on the 2027 curve,
and ranks you among the Token Masters at
[openfactoryai.com/tools/tokentopper](https://openfactoryai.com/tools/tokentopper/).

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

## Supported terminals

| Terminal | Status |
| --- | --- |
| **Claude Code** | ✅ Supported |
| **Codex** | ✅ Supported |
| **OpenCode** | 🛣️ On the roadmap |
| Gemini CLI, GitHub Copilot & more | 🛣️ On the roadmap |

**Claude Code and Codex are supported today. OpenCode and other AI coding tools are on the roadmap.**
One index across every coding agent you use.

## What it reads

Your local **Claude Code** transcripts in `~/.claude/projects` (and
`~/.config/claude/projects`, or `$CLAUDE_CONFIG_DIR`) and your **Codex** sessions in
`~/.codex/sessions`. It counts tokens (input, output, cache write, cache read),
attributes cost per model, and derives your run-rate, active days, sessions, and
tool calls. **OpenCode and more terminals are on the roadmap.**

**It never reads prompt or response content, file paths, or branch names.** Only
aggregate counts, model names, and dates are computed, and nothing leaves your
machine until you run `export` or `sync`.

## signed.json

`tokentopper export` writes a tamper-evident `signed.json`: the aggregate payload
plus an **Ed25519 signature** over its canonical form, and the public key. The
leaderboard binds your public key to your account on first upload and verifies the
signature on every one, so a rank can't be forged by editing the file after export.
Your private key stays in `~/.tokentopper/key.json`.

## Commands

| Command | Does |
|---|---|
| `tokentopper` | Print run-rate, tier, Index, top models (default) |
| `tokentopper export [--out f] [--pretty]` | Write `signed.json` |
| `tokentopper sync [--watch] [--interval min]` | Sign and POST to TokenTopper |
| `tokentopper login --token <t>` | Link this machine |

## Privacy & visibility

Private by default. You only appear on the public leaderboard if you opt in and
connect LinkedIn at the site.

## Development and releases

Run `npm run check` to typecheck, test the usage readers, build the CLI, pack the
publishable tarball, install it in an isolated directory, and smoke-test its commands.
The automated release process and recovery steps are documented in
[`docs/RELEASING.md`](docs/RELEASING.md).

## Credits

Usage-reading approach inspired by [ccusage](https://github.com/ryoppippi/ccusage)
(MIT). TokenTopper is a Kalmantic / OpenFactoryAI tool.

MIT © Kalmantic
