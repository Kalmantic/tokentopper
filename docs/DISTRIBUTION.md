# TokenTopper distribution channels

## Decision

npm is TokenTopper's primary installation channel. Every successful stable release is also represented by an immutable Git tag and GitHub Release containing the npm tarball, its SHA-256 checksum, and a CycloneDX SBOM.

This gives users two supported acquisition paths without multiplying release implementations:

| Channel | Audience | Status | Verification |
| --- | --- | --- | --- |
| `npx tokentopper@latest` | Most users; no persistent install | Primary | npm integrity and provenance, packed-CLI smoke test |
| `npx tokentopper@next` | Opt-in preview users | Supported prerelease | Explicit non-stable dist-tag, provenance, clean-install verification, and stable `latest` preservation |
| `npm install --global tokentopper` | Frequent CLI users | Supported | Same npm artifact and provenance |
| Exact npm version, such as `npx tokentopper@<version>` | Reproducible use and CI | Supported | Immutable version plus registry integrity |
| GitHub Release npm tarball | Auditing, mirroring, restricted environments | Supported mirror | Public re-download, npm integrity parity, SHA-256 checksum, SBOM, Git tag, and npm provenance |
| `pnpm dlx tokentopper@latest` | pnpm users; no persistent install | Supported npm client | Exact-version execution is tested against the live npm artifact |
| Other compatible npm-registry clients | Users of alternate JavaScript package managers | Best effort | They consume the npm artifact, but are not separate release channels |

## Runtime and registry matrix

| Channel | Command or package | Delivery model |
| --- | --- | --- |
| npm / Node.js | `npx tokentopper@latest` | Primary signed npm release |
| npm prerelease | `npx tokentopper@next` | Opt-in preview channel; never replaces `latest` |
| pnpm | `pnpm dlx tokentopper@latest` | Executes the same npm artifact; pinned pnpm smoke-tested weekly |
| Bun | `bunx tokentopper@latest` | Executes the same npm artifact with Bun |
| Deno | `deno run -A npm:tokentopper@latest` | Executes the npm artifact through Deno's npm compatibility layer |
| Nix | `nix run github:Kalmantic/tokentopper` | Builds the repository flake with Node.js 24 and the locked npm graph |
| JSR | `@openfactoryai/tokentopper` | Source module and CLI export; publication awaits JSR scope authorization |
| Claude + Codex Agent Skill | `npx tokentopper@latest skill install` | One portable, consent-gated skill copied from the npm artifact |

`pnpm dlx` and `bunx` are not separate registry publications. They resolve npm
packages and their `bin` entry. Deno can likewise consume the npm artifact directly.
These paths must execute the exact package version in CI before being advertised.

Preview builds use the npm `next` dist-tag through the manually approved prerelease
path documented in `RELEASING.md`. Automation captures and rechecks `latest` around
publication, verifies the exact preview through a clean install, and marks its
GitHub Release as a prerelease. Preview builds are not part of the weekly stable
distribution smoke and are never selected by an unqualified install.

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
After authorization, the idempotent workflow publishes only a missing version and
then verifies immutable JSR metadata, every exported module checksum, the generated
npm-compatibility tarball integrity, and Deno API/CLI execution.

The repository flake makes `nix run` available immediately. Inclusion in the central
Nixpkgs collection is prepared from the current stable tag in
`nix/nixpkgs-package.nix`. A path-scoped workflow injects that expression into a
current Nixpkgs checkout, requires a sandboxed source build, and runs the installed
CLI plus its privacy-safe JSON smoke test. The central-package submission is tracked
in [NixOS/nixpkgs#543426](https://github.com/NixOS/nixpkgs/pull/543426).

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
by compatibility CI. It builds native Linux, macOS, and Windows archives with a
versioned manifest, SHA-256 sidecar, and CycloneDX SBOM. CI extracts each archive
into a clean temporary directory, rejects unexpected or linked files, verifies
every embedded hash and sidecar, and then uses synthetic fixtures to test Claude,
Codex, OpenCode SQLite, summary, JSON, export, Ed25519 key creation, configuration
permissions, Agent Skill installation, and a local mocked sync.

On pushes to `main`, GitHub Actions downloads the exact three verified archives,
creates keyless SLSA build provenance through GitHub and the public Sigstore/Rekor
infrastructure, and immediately verifies every archive against this repository.
This privileged job is deliberately excluded from pull requests so untrusted code
never receives an OIDC token or attestation write access.

Every GitHub Release now starts a separate candidate workflow from the immutable
release tag. It repeats the native build and full clean-archive checks on all three
operating systems, rejects an incomplete or mixed-commit candidate set, creates
keyless provenance for the exact archives, and retains them as private Actions
artifacts for 30 days. It deliberately has no permission or command to attach the
unsigned candidates to the public GitHub Release.

Prototype and release-candidate archives remain Actions artifacts rather than
public downloads. The remaining promotion gates are macOS signing/notarization,
Windows Authenticode signing, signed release attachment, and public post-download
verification.

If a future standalone artifact is compromised or incorrectly signed, disable the
standalone publication job first, remove only the affected binary assets and their
sidecars from the GitHub Release, and leave the immutable tag, source archive, npm
release, and incident record intact. Publish a corrected new version; never replace
an archive under an existing version. Revoke the affected Apple or Windows signing
identity with its provider, document the affected versions and hashes in a security
advisory and release notes, and regenerate Homebrew/Scoop metadata only from the
new verified release. npm remains the rollback installation path throughout.

Until that gate is met, npm plus audited GitHub Release assets is the smaller and more reliable distribution system.
