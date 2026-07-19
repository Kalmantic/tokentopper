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
| `bunx` | Supported | Runs the npm package executable; `bunx --bun` is also tested |
| Deno 2.9 | Supported | Runs the npm artifact through `deno run`; requires filesystem permissions |
| Nix flake | Supported | Every release is tested through its immutable Git tag |
| JSR | Prepared, not published | Publication awaits `@openfactoryai` scope authorization |

The weekly `Live distribution smoke` workflow installs the public release in a
clean environment and checks npm provenance, npm installation, `bunx`, the Bun
runtime, Deno, and the tagged Nix flake at the same exact version.

## Usage-source compatibility

### Claude Code

- Roots: `~/.claude/projects`, `~/.config/claude/projects`, and each
  `$CLAUDE_CONFIG_DIR` entry followed by `/projects`.
- Format: recursive `*.jsonl` files.
- Records: assistant messages containing a `usage` object.
- Fields used: timestamp, session ID, message ID, model, input/output/cache token
  counts, and web search/fetch counts.
- Deduplication: message ID, falling back to UUID or the local file/timestamp pair.

`CLAUDE_CONFIG_DIR` may contain a comma-separated list of configuration roots.

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

## Troubleshooting

### `Unsupported engine` or syntax errors

Check `node --version`. TokenTopper supports Node.js 22 and 24. Upgrade Node or use
the repository Nix flake instead of forcing an older Node release.

### `No AI CLI usage found`

1. Confirm at least one supported agent has completed a session and written usage.
2. Check the roots above and any custom `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, or
   `OPENCODE_DATA_DIR` value.
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
