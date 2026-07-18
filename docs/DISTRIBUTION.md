# TokenTopper distribution channels

## Decision

npm is TokenTopper's primary installation channel. Every successful stable release is also represented by an immutable Git tag and GitHub Release containing the npm tarball, its SHA-256 checksum, and a CycloneDX SBOM.

This gives users two supported acquisition paths without multiplying release implementations:

| Channel | Audience | Status | Verification |
| --- | --- | --- | --- |
| `npx tokentopper@latest` | Most users; no persistent install | Primary | npm integrity and provenance, packed-CLI smoke test |
| `npm install --global tokentopper` | Frequent CLI users | Supported | Same npm artifact and provenance |
| Exact npm version, such as `npx tokentopper@0.3.0` | Reproducible use and CI | Supported | Immutable version plus registry integrity |
| GitHub Release npm tarball | Auditing, mirroring, restricted environments | Supported mirror | SHA-256 checksum, SBOM, Git tag, and npm provenance |
| `pnpm dlx` and compatible npm-registry clients | Users of alternate JavaScript package managers | Best effort | They consume the npm artifact, but are not separate release channels |

## Runtime and registry matrix

| Channel | Command or package | Delivery model |
| --- | --- | --- |
| npm / Node.js | `npx tokentopper@latest` | Primary signed npm release |
| Bun | `bunx tokentopper@latest` | Executes the same npm artifact with Bun |
| Deno | `deno run -A npm:tokentopper@latest` | Executes the npm artifact through Deno's npm compatibility layer |
| Nix | `nix run github:Kalmantic/tokentopper` | Builds the repository flake with Node.js 24 and the locked npm graph |
| JSR | `@openfactoryai/tokentopper` | Source module and CLI export; requires one-time JSR scope/package linking |

`bunx` is not a separate registry publication. It resolves npm packages and their
`bin` entry. Deno can likewise consume the npm artifact directly. These paths must
execute the exact package version in CI before being advertised.

JSR is a module registry, so TokenTopper exposes pure aggregate calculation APIs at
the default export and the executable source at `@openfactoryai/tokentopper/cli`.
Before the first publish, create the `openfactoryai` scope and `tokentopper` package
at JSR, link it to `Kalmantic/tokentopper`, and create the GitHub `jsr` environment.
The JSR workflow then publishes with OIDC and no long-lived registry token.

The repository flake makes `nix run` available immediately. Inclusion in the central
Nixpkgs collection is a separate upstream contribution made after a stable tagged
release has been verified.

## Why not more channels yet

TokenTopper reads local Claude Code and Codex data. A Docker image would isolate it from the files it needs and force users into broad host mounts, so Docker is not an appropriate end-user channel.

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

Until that gate is met, npm plus audited GitHub Release assets is the smaller and more reliable distribution system.
