# How to check Claude Code token usage locally

Run `npx tokentopper@latest` to read Claude Code's local usage records and see
token totals, estimated cost, annual run-rate, tier, and Index. The default
summary also includes any other supported coding agents found on the machine.

```sh
npx tokentopper@latest
```

To isolate Claude Code and inspect different periods:

```sh
npx tokentopper@latest daily --tool claude
npx tokentopper@latest weekly --tool claude --breakdown
npx tokentopper@latest monthly --tool claude --since 2026-01-01
```

Typical report headings remain aligned for terminal scanning:

```text
  Date          Input       Output     Cache W      Cache R        Total       Cost
  2026-07-21     18.2M        1.8M      450.0K        9.4M        29.9M     $78.40
```

TokenTopper recursively reads Claude Code assistant-message JSONL records under
`~/.claude/projects`, `~/.config/claude/projects`, and every configured
`$CLAUDE_CONFIG_DIR/projects` root. It deduplicates streaming or resumed message
records and uses input, output, cache-creation, cache-read, model, session, and
web-tool counters.

Local summaries make no network request. Prompt text, response text, source
code, project paths, branches, and commit messages are not retained in aggregate
records. Only an explicit `export` or `sync` produces publishable data.

Claude Code normally removes old transcripts according to its
`cleanupPeriodDays` setting, so TokenTopper cannot reconstruct records that the
agent has already deleted. See the [compatibility guide](../COMPATIBILITY.md) for
retention and custom-root details.

