# TokenTopper distribution channels

## Decision

npm is TokenTopper's primary installation channel. Every successful stable release is also represented by an immutable Git tag and GitHub Release containing the npm tarball, its SHA-256 checksum, and a CycloneDX SBOM.

This gives users two supported acquisition paths without multiplying release implementations:

| Channel | Audience | Status | Verification |
| --- | --- | --- | --- |
| `npx tokentopper@latest` | Most users; no persistent install | Primary | npm integrity and provenance, packed-CLI smoke test |
| `npm install --global tokentopper` | Frequent CLI users | Supported | Same npm artifact and provenance |
| Exact npm version, such as `npx tokentopper@<version>` | Reproducible use and CI | Supported | Immutable version plus registry integrity |
| GitHub Release npm tarball | Auditing, mirroring, restricted environments | Supported mirror | SHA-256 checksum, SBOM, Git tag, and npm provenance |
| `pnpm dlx` and compatible npm-registry clients | Users of alternate JavaScript package managers | Best effort | They consume the npm artifact, but are not separate release channels |

## Runtime and registry matrix

| Channel | Command or package | Delivery model |
| --- | --- | --- |
| npm / Node.js | `npx tokentopper@latest` | Primary signed npm release |
| Bun | `bunx tokentopper@latest` | Executes the same npm artifact with Bun |
| Deno | `deno run -A npm:tokentopper@latest` | Executes the npm artifact through Deno's npm compatibility layer |
| Nix | `nix run github:Kalmantic/tokentopper` | Builds the repository flake with Node.js 24 and the locked npm graph |
| JSR | `@openfactoryai/tokentopper` | Source module and CLI export; publication awaits JSR scope authorization |
| Claude + Codex Agent Skill | `npx tokentopper@latest skill install` | One portable, consent-gated skill copied from the npm artifact |

`bunx` is not a separate registry publication. It resolves npm packages and their
`bin` entry. Deno can likewise consume the npm artifact directly. These paths must
execute the exact package version in CI before being advertised.

Deno 2.9+ applies a 24-hour minimum dependency age by default. The live release
smoke test deliberately passes `--minimum-dependency-age=0` so a new release is
verified immediately; users can keep Deno's default gate and wait, or opt out after
checking npm provenance.

JSR is a module registry, so TokenTopper exposes pure aggregate calculation APIs at
the default export and the executable source at `@openfactoryai/tokentopper/cli`.
The `openfactoryai` scope and `tokentopper` package exist at JSR and are linked to
`Kalmantic/tokentopper`. Publishing uses OIDC and no long-lived registry token. The
remaining owner action is to authorize the triggering GitHub user as a scope member
or disable the scope's “Restrict publishing to members” policy (GitHub issue #14).

The repository flake makes `nix run` available immediately. Inclusion in the central
Nixpkgs collection is a separate upstream contribution made after a stable tagged
release has been verified.

## Why not more channels yet

TokenTopper reads local Claude Code, Codex, and OpenCode data. A Docker image would isolate it from the files it needs and force users into broad host mounts, so Docker is not an appropriate end-user channel.

A curl-to-shell installer would add a high-trust bootstrap path without improving the artifact. It remains out of scope unless releases have platform-native signed executables and a documented rollback path.

Homebrew, Scoop, and WinGet become useful only when TokenTopper has standalone executables for users without Node.js. Wrapping `npm install` in another package manager would create maintenance and failure modes without removing the Node.js prerequisite.

## Standalone executable gate

Prototype standalone executables only when demand from users without Node.js justifies their size and signing cost. Adoption requires all of the following:

- Linux, macOS, and Windows artifacts built on their native GitHub runners;
- the same parser, summary, export, and mocked-sync tests as the npm tarball;
- platform signing where available, plus checksums and SBOMs;
- local data discovery and key-file permissions verified on every platform;
- automated release attachment and clean-machine installation tests;
- a Homebrew tap and Scoop manifest generated from the verified release metadata, not maintained by hand.

The repository contains a Bun-based prototype, pinned to the same Bun version used
by compatibility CI. It builds on native Linux, macOS, and Windows runners and uses
synthetic fixtures to verify Claude, Codex, OpenCode SQLite, summary, JSON, export,
Ed25519 key creation, configuration permissions, Agent Skill installation, and a
local mocked sync. Prototype artifacts are short-lived CI artifacts rather than
release downloads. This proves runtime portability without bypassing the remaining
code-signing, archive-checksum, SBOM, and clean-install requirements.

Until that gate is met, npm plus audited GitHub Release assets is the smaller and more reliable distribution system.
