# One usage report for Claude Code, Codex, OpenCode, and Gemini CLI

TokenTopper combines Claude Code, Codex, OpenCode, and Gemini CLI into one local
usage score while preserving agent and model attribution. Run one command; no
per-agent configuration is required for standard installations.

```sh
npx tokentopper@latest
```

The summary shows the combined run-rate first and adds an agent section when
more than one supported source is present:

```text
  By tool
    claude                  120.0M   $230.40
    codex                    52.0M    $99.84
    opencode                 18.0M    $34.56
    gemini                   10.0M    $19.20
```

For detailed reports:

```sh
npx tokentopper@latest daily --by-tool --breakdown
npx tokentopper@latest monthly --since 2026-01-01
npx tokentopper@latest share
npx tokentopper@latest json --schema 2 --pretty
```

The readers use these local stores:

- Claude Code: JSONL below Claude project roots;
- Codex: rollout JSONL below the Codex sessions root;
- OpenCode: read-only `opencode*.db` SQLite, with historical JSON fallback;
- Gemini CLI: append-only session JSONL below `.gemini/tmp/*/chats`.

Token categories are normalized into input, output, cache creation, and cache
read. Cost is an estimate when the source does not provide it. Different agents
record sessions and token fields differently, so the
[compatibility document](../COMPATIBILITY.md) describes every mapping and
deduplication rule.

All discovery and aggregation happen locally. The default command does not
contact the TokenTopper API, and the privacy-safe JSON and Markdown summaries
exclude machine identity. Publishing a signed aggregate is always an explicit
`export` or `sync` action.

