# How to check Codex CLI token usage locally

Run `npx tokentopper@latest daily --tool codex` for a local Codex-only usage
report. It reads Codex's recorded token-count events; no OpenAI API key or
TokenTopper account is required.

```sh
npx tokentopper@latest daily --tool codex
```

Useful alternatives include:

```sh
npx tokentopper@latest weekly --tool codex --breakdown
npx tokentopper@latest session --tool codex
npx tokentopper@latest json --schema 2 --pretty
```

The default combined summary uses the same terminal layout:

```text
  Run-rate      6.33B tokens/yr   ($12.1K/yr · 15d observed x365 x1.3)
  Tier          Operator   · Index 53/100 (local estimate)
```

TokenTopper recursively reads `rollout-*.jsonl` files under
`~/.codex/sessions` or `$CODEX_HOME/sessions`. It consumes only `token_count`
events and handles both per-turn counters and cumulative deltas. Replayed parent
history in forked or spawned sessions is skipped.

The reader keeps timestamp, model, session identity, and token counters in
memory long enough to aggregate them. It does not retain prompts, responses,
source code, file paths, repository names, branch names, or commits. `summary`,
reports, and `json` remain local; `export` and `sync` are explicit actions.

If no Codex records appear, confirm that the current user can read the session
root and that `CODEX_HOME` points to the same configuration used by Codex. See
the [compatibility guide](../COMPATIBILITY.md) for the exact contract.

