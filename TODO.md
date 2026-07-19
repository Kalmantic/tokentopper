# TokenTopper distribution TODO

Goal: make TokenTopper easy to install, safe to publish, and verifiably usable on every supported platform.

## Current baseline

- [x] Publish `tokentopper` on npm.
- [x] Publish `0.4.1` with the complete Professional AI Usage Index description.
- [x] Document Claude Code, Codex, and OpenCode as supported today.
- [x] Label Gemini CLI, GitHub Copilot, and other untested tools as roadmap items.
- [ ] Confirm every npm access token exposed during early releases is revoked in the npm account. The repository has no npm token secret and uses OIDC.
- [x] Keep package metadata, README, lockfile, CLI help, Git tag, GitHub Release, and npm aligned through Release Please.

## P0: make every package verifiable

- [x] Add `typecheck`, `test`, `check`, and `pack:check` package scripts.
- [x] Add fixture-based tests for Claude Code and Codex usage parsing.
- [x] Add CLI smoke tests for `--help`, `--version`, default output, `export`, and a safe mocked `sync`.
- [x] Test the packed tarball, not only the source tree: run `npm pack`, install it in a temporary directory, and execute its binary.
- [x] Assert that the tarball contains only `dist`, `README.md`, `LICENSE`, and package metadata.
- [x] Validate that package version, CLI version, lockfile version, and release tag agree.
- [x] Support maintained Node.js LTS lines only: Node.js 22 and 24 are enforced in `engines`, CI, the build target, and documentation.

Exit condition: `npm run check` proves the exact tarball intended for publication works without reading real user data or contacting production.

## P1: continuous integration

- [x] Add GitHub Actions CI for pull requests and `main`.
- [x] Run checks on Linux, macOS, and Windows across the supported Node versions.
- [x] Cache npm dependencies without caching build output.
- [x] Upload the dry-run tarball as a CI artifact for inspection.
- [x] Add dependency review and least-privilege workflow permissions.
- [x] Pin every external GitHub Action and the release npm CLI to immutable versions.
- [x] Add weekly Dependabot updates for npm development dependencies and pinned Actions.
- [x] Enable GitHub secret scanning and push protection in repository settings.
- [x] Protect `main` so the required checks must pass before merge.

Exit condition: a clean checkout passes build, tests, and packed-binary smoke tests on all supported platforms.

## P2: automate npm releases

- [x] Add a GitHub Actions npm trusted-publishing job using OIDC instead of reusable npm publish tokens.
- [x] Register `.github/workflows/release.yml` as the trusted publisher in npm package settings.
- [x] Configure the repository-scoped `RELEASE_PLEASE_TOKEN` fallback so Release Please can operate under the current organization policy.
- [x] Require npm provenance for every automated release.
- [x] Restrict the GitHub `npm` deployment environment to protected branches.
- [x] Use Release Please for this single-package repository; reconsider Changesets only if it becomes a monorepo.
- [x] Generate release notes and a changelog from merged Conventional Commits.
- [x] Publish stable versions to `latest`.
- [ ] Add a dedicated `next` or `beta` workflow before publishing the first prerelease.
- [x] Require the full P0/P1 package checks before the publish job can run.
- [x] Verify the registry after publication: version, dist-tag, description, integrity, provenance, install, and CLI execution.
- [x] Add a release runbook covering failed jobs, npm deprecation of a bad version, and dist-tag repair. Never attempt to overwrite a published version.

Exit condition: merging an approved release PR creates the tag, GitHub release, provenance-backed npm release, and verification report without a local credential.

## P3: broaden distribution carefully

npm remains the primary channel because it already supports `npx`, global installs, `pnpm dlx`, and compatible npm-registry clients. Add more channels only when they improve installation for users who do not have Node.

- [x] Improve the README install section with `npx tokentopper@latest` as the primary path and global installation as an optional path.
- [ ] Add a troubleshooting section for Node version, permissions, local data locations, and network-free scoring.
- [ ] Evaluate standalone executables for Linux, macOS, and Windows. Confirm the packaging approach works with filesystem discovery, Ed25519 keys, and native platform paths before adopting it.
- [ ] If standalone executables pass evaluation, publish versioned GitHub Release archives plus SHA-256 checksums and an SBOM.
- [ ] After stable standalone releases exist, add a Homebrew tap for macOS/Linux and Scoop manifests for Windows.
- [ ] Consider WinGet only after signing and update automation are reliable.
- [ ] Do not add Docker as an end-user install channel unless a server or CI use case appears; TokenTopper needs access to host-local agent usage files.
- [ ] Do not add a curl-to-shell installer until artifacts are signed, checksummed, and rollback behavior is documented.
- [x] Document npm as the primary channel and publish its tarball, checksum, and SBOM as audited GitHub Release assets.
- [x] Document the evidence gate that must be met before standalone executables, Homebrew, or Scoop are adopted.
- [x] Run a weekly clean-environment smoke test against the live npm artifact through npm, bunx, the Bun runtime, Deno, and the immutable tagged Nix flake.
- [ ] Publish `@openfactoryai/tokentopper` to JSR after the scope owner authorizes the triggering GitHub actor (GitHub issue #14).

Exit condition: each supported install command is automated, tested in a clean environment, documented, and produces the same TokenTopper version.

## P4: product reach and tool coverage

- [x] Keep npm, GitHub, CLI help, and the OpenFactoryAI TokenTopper page aligned on the phrase "Professional AI Usage Index."
- [x] Show a clear support matrix: Claude Code, Codex, and OpenCode supported; other tools labeled roadmap until tested.
- [x] Add OpenCode ingestion with fixtures and parity tests.
- [ ] Research Gemini CLI and GitHub Copilot data formats before promising support dates.
- [ ] Add a public compatibility document explaining which local files are read and which data can leave the machine.
- [x] Add privacy-safe release health checks for registry provenance and clean installation across supported runtimes.
- [ ] Add operational monitoring for sync API errors and opt-in user feedback.

## Recommended execution order

1. Authorize the existing JSR OIDC workflow at the `@openfactoryai` scope and publish the current version.
2. Enable GitHub Actions for the API and website repositories at the Kalmantic organization level (GitHub issue #16).
3. Add API/site deployment workflows with post-deploy verification once Actions is enabled.
4. Add troubleshooting and compatibility documentation for every supported local data format.
5. Research Gemini CLI and GitHub Copilot one format at a time, with fixtures before release.
6. Prototype standalone executables only if demand justifies the distribution gate.

## Distribution definition of done

A TokenTopper release is complete only when:

- source, lockfile, tag, CLI output, and registry version match;
- CI passes against the packed artifact on every supported platform;
- npm shows the intended description, dist-tag, integrity, and provenance;
- a clean user environment can install and run it using documented commands;
- no prompt content, response content, code, or reusable publishing credential is exposed;
- release notes and rollback/deprecation instructions are available.
