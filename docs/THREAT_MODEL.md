# TokenTopper threat model

Snapshot date: 2026-07-22

## Security objective

TokenTopper should calculate useful coding-agent usage locally while making it
difficult for the CLI, a dependency, a forged export, or a compromised delivery
path to expose transcript content or impersonate a linked installation.

The primary privacy invariant is narrower than "we do not upload prompts": raw
prompt/response content, source code, repository paths, file paths, project names,
branch names, and commit content must never enter TokenTopper's normalized `Rec`
records or signed payloads.

## Assets

| Asset | Why it matters | Expected location |
| --- | --- | --- |
| Agent session stores | Can contain prompts, responses, code, paths, and usage | Agent-owned directories under the user's home directory |
| Normalized usage | Counts, dates, model/tool names, pseudonymous session IDs in memory | Process memory only |
| Ed25519 private key | Authenticates one installation's exports | `~/.tokentopper/key.json`, mode `0600` |
| CLI bearer token | Authorizes sync to an account | `~/.tokentopper/config.json`, mode `0600`, or process environment |
| Signed aggregate | Contains usage, dates, models, machine metadata, and public key | User-selected export path or HTTPS request body |
| Public profile/rank | User-controlled disclosure of aggregate usage and location | Hosted service |
| Release authority | Can publish executable code under the package name | Protected GitHub/npm/JSR environments and OIDC identities |

## Trust boundaries and data flow

```text
agent-owned local logs
        |
        | read-only parsing; discard content and paths
        v
normalized Rec[] in memory ----> local terminal / privacy-safe JSON / MCP
        |
        | explicit export or sync only
        v
aggregate payload --Ed25519--> signed envelope --HTTPS--> sync API
                                                       |
                                                       v
                                             private account/profile
                                                       |
                                                       | explicit opt-in
                                                       v
                                                public leaderboard
```

Additional boundaries:

- npm/JSR/Nix/GitHub Releases deliver code into a process that can read local
  agent logs, so provenance and dependency controls are security boundaries;
- the MCP client can request aggregate reports but the MCP server is stdio-only,
  read-only, and has no network path;
- the CLI token authenticates the account while the Ed25519 signature
  authenticates the installation snapshot; neither substitutes for the other.

## Threats and controls

### Accidental content exfiltration

**Threat:** a parser copies prompt text, response text, file paths, or project
identity into normalized records, error output, JSON, or sync payloads.

**Controls:** the `Rec` type contains only timestamps, agent/provider/model,
session identity, numeric usage, and cost; parsers select fields explicitly;
fixtures include private-looking content and assert only counts survive; public
JSON strips hostname/machine identity; compatibility docs enumerate every field.

**Residual risk:** a model string or malformed upstream identifier could itself
contain unexpected sensitive text. Server and future schema validation must
enforce type, length, and character limits before public display.

### Unexpected network or filesystem mutation

**Threat:** local scoring contacts production, MCP writes files, or a report
changes agent-owned data.

**Controls:** summary/report/JSON paths contain no fetch; source readers open
SQLite read-only; MCP exposes read-only aggregate tools; only `export`, `login`,
`skill install`, and `sync` have documented writes, and only `sync` uses network.
Packaged smoke tests use isolated homes and a mocked sync endpoint.

### Forged or replayed rank data

**Threat:** an attacker edits `signed.json`, binds another key to an account,
replays a stale snapshot, or causes retry double-counting.

**Controls:** canonical Ed25519 signatures cover the complete payload; private
keys remain local; the API binds public keys to accounts; v2 reconciliation
rejects inconsistent nested data; the merge contract is full-snapshot,
per-public-key, timestamp-ordered, and idempotent.

**Residual risk:** signatures prove possession of an installation key, not that
an upstream coding agent billed the claimed tokens. Server plausibility checks,
identity verification, eligibility floors, and visible methodology reduce but do
not eliminate fabricated local logs or a compromised endpoint.

### Credential and key theft

**Threat:** another local process reads the signing key or bearer token.

**Controls:** key/config files are created with `0600`; private keys are never
exported; tokens can be supplied through the environment; removing a hosted
device excludes its snapshot; npm publishing uses short-lived OIDC rather than a
repository npm token.

**Residual risk:** file modes do not protect against malware or another process
running as the same OS user. Users should revoke the CLI link, remove the device,
and report possible exposure. The hosted service needs auditable token/device
revocation and session invalidation.

### Malicious local records and denial of service

**Threat:** malformed/huge JSONL, SQLite rows, extreme counters, deep directory
trees, or crafted names consume resources or corrupt output.

**Controls:** parsers ignore malformed records, normalize finite counters, dedupe
known replay patterns, never execute record content, and use read-only database
access. V2 validates safe integers and finite costs.

**Residual risk:** current discovery is synchronous and has no universal file,
record, depth, or total-byte budget. Bounded parsing and adversarial fixtures are
recommended before claiming resistance to hostile local stores.

### Supply-chain compromise

**Threat:** a dependency, mutable Action, publishing credential, or release asset
is replaced with malicious code that can read local logs.

**Controls:** exact lockfile installs; dependency review, CodeQL, OSV scanning,
and OpenSSF Scorecard; immutable Action SHAs; protected release environments;
npm/JSR trusted publishing with OIDC; npm provenance; SHA-256 and CycloneDX
assets; packed-tarball and clean-install smoke tests; immutable Git tags.

**Residual risk:** provenance proves build origin, not code safety. Maintainer
review, minimal runtime dependencies, independent checks, and rapid deprecation
remain necessary.

### Public-profile privacy mistakes

**Threat:** a private user appears publicly, location becomes public without
consent, or removed-device history remains ranked.

**Controls:** local/private is the default; publication is a distinct opt-in;
identity verification gates public profiles; location is optional; device removal
is defined to remove its snapshot from the account aggregate.

**Residual risk:** API and website controls live outside this public repository.
Their authorization, deletion, retention, and regression tests must be audited in
their authoritative repositories before the end-to-end claim is complete.

## Security evidence

- `npm run check` verifies workflow policy, types, parser/report/signature tests,
  the built package, isolated installation, CLI behavior, and mocked sync.
- `scripts/workflow-security-check.mjs` rejects reusable npm credentials and
  mutable external Action refs, and checks protected OIDC release boundaries.
- `.github/workflows/osv-scanner.yml` reports known dependency vulnerabilities.
- `.github/workflows/scorecard.yml` publishes Scorecard and SARIF results.
- `docs/SCHEMA.md` defines signed-v2 reconciliation and merge invariants.
- `SECURITY.md` defines private reporting and immutable fix-forward response.

## Review triggers

Revisit this model when adding a new data source, collected field, network call,
server schema, public metric, project/output mapping feature, install channel,
runtime dependency, or signing/publishing mechanism.

