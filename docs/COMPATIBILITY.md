# TokenTopper compatibility and troubleshooting

TokenTopper reads usage records written by supported local coding agents, reduces
them to aggregate counts, and calculates the Professional AI Usage Index locally.
It does not retain or transmit prompt text, response text, source code, file paths,
or branch names.

## Supported runtimes and install paths

| Path | Support | Notes |
| --- | --- | --- |
| Node.js 22 and 24 | Supported | Primary runtime and the runtime used by the Nix flake |
| `npx` / global npm install | Supported | Runs the provenance-backed npm artifact |
| `pnpm dlx` | Supported | Runs the same npm artifact; current pnpm is pinned in live smoke tests |
| `bunx` | Supported | Runs the npm package executable; `bunx --bun` is also tested |
| Deno 2.9 | Supported | Runs the npm artifact through `deno run`; requires filesystem permissions |
| Nix flake | Supported | Every release is tested through its immutable Git tag |
| JSR | Prepared, not published | Publication awaits `@openfactoryai` scope authorization |

The weekly `Live distribution smoke` workflow uses a clean environment to check
npm provenance and installation, the primary `npx` command, pinned `pnpm dlx`,
`bunx`, the Bun runtime, Deno, and the tagged Nix flake at the same exact version.

## Usage-source compatibility

### Claude Code

- Roots: `~/.claude/projects`, `~/.config/claude/projects`, and each
  `$CLAUDE_CONFIG_DIR` entry followed by `/projects`.
- Format: recursive `*.jsonl` files.
- Records: assistant messages containing a `usage` object.
- Fields used: timestamp, session ID, message ID, model, input/output/cache token
  counts, and web search/fetch counts.
- Deduplication: message ID, falling back to UUID or the local file/timestamp pair.
  Duplicate lines for one message (streaming partials, history copied forward on
  session resume) keep the maximum value per counter.
- Web tools: client-side `WebSearch`/`WebFetch` `tool_use` blocks are counted in
  addition to the API's `server_tool_use` counters, which stay zero in local
  Claude Code transcripts.

`CLAUDE_CONFIG_DIR` may contain a comma-separated list of configuration roots.

**Retention:** Claude Code deletes transcripts under its projects directory after
`cleanupPeriodDays` (30 days by default), so history older than that is
unrecoverable by any reader. To preserve long-run usage history, raise it in
`~/.claude/settings.json`, for example `{ "cleanupPeriodDays": 3650 }`, and run
`tokentopper sync` regularly so your aggregate survives local cleanup.

### Codex

- Roots: `~/.codex/sessions` and `$CODEX_HOME/sessions` when `CODEX_HOME` is set.
- Format: recursive `rollout-*.jsonl` files.
- Records: `event_msg` entries whose payload type is `token_count`.
- Fields used: timestamp, model, input/output/reasoning/cache token counts, and
  cumulative totals when per-turn usage is absent.
- Deduplication: identical timestamp/token tuples; replayed parent history is
  skipped for forked or spawned sessions.

### OpenCode

- Roots: `~/.local/share/opencode` and each comma-separated
  `$OPENCODE_DATA_DIR` entry.
- Current format: read-only SQLite databases named `opencode.db` or
  `opencode-*.db`, using the `message` table's `id`, `session_id`, and JSON `data`.
- Historical fallback: `storage/message/**/*.json`.
- Fields used: creation time, session, provider, model, token counts, and the cost
  recorded by OpenCode when present.
- Deduplication: message ID. SQLite records replace matching JSON fallback records.

SQLite ingestion uses Node's `node:sqlite` on supported Node versions and Bun's
native `bun:sqlite` driver under Bun. Deno still reads OpenCode's historical JSON
fallback when no compatible SQLite API is available; use Node.js or Bun for
complete current OpenCode database coverage.

### Gemini CLI

- Roots: `~/.gemini/tmp` and `$GEMINI_CLI_HOME/.gemini/tmp` when
  `GEMINI_CLI_HOME` is set.
- Current format: recursive JSONL session records below each project's `chats`
  directory, including nested subagent sessions.
- Records: Gemini messages containing the upstream `tokens` summary.
- Fields used: timestamp, message ID, session ID, model, prompt, candidate,
  thinking, cached, and total token counts.
- Deduplication: later append-only updates replace earlier records with the same
  message ID. Rewind records remove the rewound message and everything after it;
  message checkpoints replace the in-memory message set.

Gemini's prompt count includes cached input, so TokenTopper subtracts cached
tokens from ordinary input before placing them in the cache-read bucket. Positive
residuals in the upstream total—such as separately reported tool prompt tokens—are
counted as input. Prompt and response content in the session records is never kept.
The reader follows Gemini CLI's published
[`TokensSummary`](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/services/chatRecordingTypes.ts)
and append-only
[`ChatRecordingService`](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/services/chatRecordingService.ts)
contracts. Cost remains an estimate using standard
[Gemini Developer API list prices](https://ai.google.dev/gemini-api/docs/pricing);
free-tier, Vertex AI, and enterprise billing may differ.

### GitHub Copilot CLI

GitHub documents full session files under `~/.copilot/session-state` and a local
SQLite session store at `~/.copilot/session-store.db`, but does not currently
publish a stable token-field schema for either. TokenTopper therefore does not
inspect those private formats yet. Copilot remains on the roadmap until a public
schema or supported local export can be fixture-tested without guessing. See
GitHub's documentation for the current
[Copilot CLI session locations](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/chronicle).

## Local data and network boundary

The default `tokentopper` summary and `tokentopper json` commands make no network
request. Pricing and index calculations are bundled with the package.

| Operation | Data produced or transmitted |
| --- | --- |
| `tokentopper` | Terminal-only aggregate summary |
| `tokentopper json` | Aggregate counts, models, tools, dates, cost estimate, tier, and index; excludes hostname and machine ID |
| `tokentopper export` | Signed aggregate including OS, hostname, pseudonymous machine ID, and public signing key; no raw log content or private paths |
| `tokentopper sync` | Sends the same signed aggregate to the configured HTTPS endpoint after explicit login |

The Ed25519 private key stays in `~/.tokentopper/key.json`, created with mode
`0600`. The optional CLI token and endpoint are stored in
`~/.tokentopper/config.json`, also created with mode `0600`. A CLI flag or the
`TOKENTOPPER_TOKEN` / `TOKENTOPPER_ENDPOINT` environment variable can override the
stored configuration.

## Enterprise data handling

TokenTopper's local reader does not require an organization-wide API credential
and does not modify agent-owned session stores. An enterprise deployment should
classify the derived aggregate as employee usage telemetry even though it excludes
prompt and source content.

| Question | Answer |
| --- | --- |
| What is read? | The documented usage fields in supported local agent stores; files and SQLite databases are opened locally and read-only |
| What is derived? | UTC dates, token categories, model/agent totals, sessions, tool calls, cost estimates, run-rate, tier, and Index |
| What leaves the machine? | Nothing for summary, reports, JSON, or MCP; explicit export writes locally, and explicit sync sends the signed aggregate described above |
| What direct identifiers are included? | Export/sync includes hostname, OS, pseudonymous machine ID, and signing public key; public JSON excludes machine identity |
| What content is excluded? | Prompts, responses, source code, repository/file paths, project names, branches, commit messages, and the signing private key |
| Who controls visibility? | Local is the default; hosted publication and optional location are separate user opt-ins |
| How should access be revoked? | Remove the hosted device/profile link and CLI token; delete local `config.json` after revocation; rotate/relink after suspected key exposure |

Organizations should define a retention period for hosted daily aggregates, give
users a deletion/export path, document whether administrators can view private
usage, and avoid using token volume alone as a productivity or performance score.
Costs are model-price estimates rather than invoices, and a signature establishes
installation-key possession rather than the business value or authorship of work.

For managed endpoints, restrict read access to agent session directories, protect
`~/.tokentopper` with the user's OS account controls, pin the exact package version
after verifying npm provenance, and route sync only to an approved HTTPS endpoint.
Review [`THREAT_MODEL.md`](THREAT_MODEL.md) before changing the collection or
publication boundary.

## Troubleshooting

### `Unsupported engine` or syntax errors

Check `node --version`. TokenTopper supports Node.js 22 and 24. Upgrade Node or use
the repository Nix flake instead of forcing an older Node release.

### `No AI CLI usage found`

1. Confirm at least one supported agent has completed a session and written usage.
2. Check the roots above and any custom `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, or
   `OPENCODE_DATA_DIR`, or `GEMINI_CLI_HOME` value.
3. Confirm the current user can read those directories and files.
4. For current OpenCode SQLite data, run TokenTopper with Node.js 22/24 or Bun.

One unreadable or malformed source does not stop the other sources; it simply
contributes no records.

### Deno cannot resolve a newly published version

Deno 2.9 holds new dependencies for 24 hours by default. Wait for the age gate, or
after checking npm provenance run:

```sh
deno run -A --minimum-dependency-age=0 npm:tokentopper@latest
```

`-A` is broad because the CLI must discover local usage files and may write its
config/key or contact the sync endpoint. Use the Node.js CLI if that permission
surface is not acceptable.

### OpenCode SQLite data is missing under Deno

The OpenCode database reader uses `node:sqlite` under Node and `bun:sqlite` under
Bun. Deno can run the CLI and read JSON fallback records, but it does not currently
have a supported SQLite path.

### `Not linked yet` or an HTTP 401 during sync

Sign in at the TokenTopper site, create a CLI login command, and run it on that
machine. Re-run `tokentopper login` to inspect link state. Check an overridden
endpoint or token environment variable if the stored login is unexpectedly ignored.

### Local scoring while offline

Use `tokentopper` or `tokentopper json`; both remain local. `sync` is the only CLI
command that uploads. `export` writes a local file for a later, explicit upload.
