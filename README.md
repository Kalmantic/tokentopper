# tokentopper

Score your Claude Code usage into a **Fancy AI Usage Index**, see your tier on the
2027 curve, and rank among the Token Masters at
[openfactoryai.com/tools/tokentopper](https://openfactoryai.com/tools/tokentopper/).

```sh
npx tokentopper@latest            # your run-rate, tier, and Index
npx tokentopper@latest export     # write a signed.json to upload
npx tokentopper@latest sync       # sign and push it automatically
```

## What it reads

Your local Claude Code transcripts in `~/.claude/projects` (and
`~/.config/claude/projects`, or `$CLAUDE_CONFIG_DIR`). It counts tokens
(input, output, cache write, cache read), attributes cost per model, and derives
your run-rate, active days, sessions, and tool calls.

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

## Credits

Usage-reading approach inspired by [ccusage](https://github.com/ryoppippi/ccusage)
(MIT). TokenTopper is a Kalmantic / OpenFactoryAI tool.

MIT © Kalmantic
