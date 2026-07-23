# Releasing TokenTopper

TokenTopper releases are prepared by Release Please and published to npm from GitHub Actions through npm Trusted Publishing. GitHub's short-lived OIDC identity replaces long-lived npm write tokens and npm automatically attaches provenance.

## One-time repository setup

1. Revoke any npm token exposed outside npm. Exposed tokens must be considered compromised; TokenTopper does not require a write token.
2. In the npm package settings for `tokentopper`, add a GitHub Actions trusted publisher with organization `Kalmantic`, repository `tokentopper`, workflow filename `release.yml`, environment `npm`, and the `npm publish` action allowed.
3. In GitHub, create an environment named `npm`. Add required reviewers if releases should require a human approval at the final publish boundary. The environment name must exactly match the npm trusted-publisher configuration.
4. Allow Release Please to maintain its release PR using one of these approaches:
   - preferred: have a Kalmantic organization owner allow GitHub Actions to create pull requests;
   - fallback: create a fine-grained GitHub token limited to `Kalmantic/tokentopper` with Contents and Pull requests read/write access, then save it as the repository Actions secret `RELEASE_PLEASE_TOKEN`.
   TokenTopper currently uses the repository-scoped `RELEASE_PLEASE_TOKEN` fallback.
5. Protect `main` and require the CI checks before merge.
6. Enable GitHub secret scanning and push protection for the repository.

`RELEASE_PLEASE_TOKEN`, when needed, is a GitHub automation credential only. npm publishing uses OIDC and must not receive `NODE_AUTH_TOKEN` or an npm write-token secret.

## Normal release flow

1. Merge changes using Conventional Commit subjects:
   - `fix:` for a patch release;
   - `feat:` for a minor release;
   - `feat!:` or another `!` type for a breaking release. Before `1.0.0`, the repository's Release Please configuration turns this into a minor release.
2. CI runs `npm run check` on Node.js 18, 20, 22, 24, and 26 across Linux, macOS, and Windows.
3. Release Please updates a release PR containing the next version and changelog.
4. Review and merge the release PR.
5. The same release workflow creates the Git tag and GitHub Release, checks out the tagged commit, reruns the full package gate, and publishes through npm Trusted Publishing with automatic provenance.
6. `scripts/verify-release.mjs` waits for registry propagation and verifies the version, `latest` tag, description, integrity, provenance, clean installation, and CLI version.
7. After npm verification passes, the release workflow attaches the exact npm tarball, its SHA-256 checksum, and a CycloneDX SBOM to the GitHub Release.
8. The workflow downloads those public assets again, validates their names and sizes, verifies the checksum and SBOM metadata, and proves the mirrored tarball has the same SHA-1 and SHA-512 integrity as npm. The weekly live-distribution smoke test repeats this check.
9. After the stable release is verified, the workflow uses `nix-update` to refresh the repository's Nixpkgs expression, performs a sandboxed build and CLI smoke test, and opens an `automation/nix-<version>` pull request for review. It does not merge the mirror change or publish to Nixpkgs.

All external GitHub Actions are pinned to immutable commit SHAs. Dependabot should update those pins through reviewed pull requests rather than changing them during a release run. The publish job also pins the npm CLI version so authentication and provenance behavior do not drift unexpectedly.

Publishing and release-asset jobs explicitly disable setup-node's package-manager
cache. Ordinary CI may cache downloaded dependencies for speed, but a release build
must resolve the committed lockfile without restoring a dependency cache. The
`npm run workflow:check` gate enforces this distinction, requires the protected
deployment environments and job-scoped OIDC permissions, and rejects reusable npm
credential variables anywhere under `.github/workflows`.

Do not edit `package.json` to make an ad hoc release after Release Please is enabled. Put version changes through its release PR so the source, lockfile, tag, GitHub Release, and npm registry remain aligned.

## Prereleases

The stable workflow publishes only to `latest`. Prereleases use the dedicated,
manual `publish-next` path in the same `release.yml` file because npm permits only
one trusted publisher per package and validates its exact workflow filename. The
path uses the protected `npm` environment and OIDC; it never needs an npm token.

Prepare and review the prerelease on a branch:

```sh
npm run prerelease:prepare -- 0.6.0-beta.0
npm ci
npm run check
```

The preparation command accepts only prerelease SemVer and updates `package.json`,
the root package versions in `package-lock.json`, and `jsr.json` together. Merge
that change through a normal pull request with green CI. On the resulting protected
commit, create and push the exact immutable tag `tokentopper-v0.6.0-beta.0`.

In **Actions → Release → Run workflow**, run from `main` with:

- operation: `publish-next`;
- tag: `tokentopper-v0.6.0-beta.0`;
- version: `0.6.0-beta.0`.

The job proves the tag, package, lockfile, and JSR versions agree; records the
current stable `latest`; runs the full package gate; publishes with
`npm publish --provenance --access public --tag next`; verifies public provenance,
integrity, clean installation, and CLI execution; proves `latest` did not move;
then creates a GitHub prerelease with the tarball, checksum, and CycloneDX SBOM.
It is safe to rerun for recovery while that exact version still owns `next`.

Test a prerelease explicitly with `npx tokentopper@next --version`. Never put a
prerelease on `latest`, and never reuse or move an immutable prerelease tag.

## Failure and recovery

### Publish failed before npm accepted the version

Fix the workflow or npm trusted-publisher configuration, then rerun the failed publish job. A version may be retried only if `npm view tokentopper@<version>` confirms it does not exist.

For a stable recovery, select `recover-stable` and provide the existing release tag
and exact version. For a prerelease recovery, rerun `publish-next` with the same
immutable tag and version. If `next` has intentionally advanced to a newer build,
do not move it backward merely to recover old GitHub assets.

### npm accepted the version but verification failed

Do not rerun `npm publish` and do not try to overwrite the version. Inspect the failed assertion:

- If only the dist-tag is wrong, repair it with `npm dist-tag add tokentopper@<version> latest` after confirming the target version.
- If the package itself is bad, deprecate it with a precise message, fix forward, and release a new patch.
- If provenance is missing, do not claim the release is provenance-backed. Fix the workflow authentication and release a new patch.

### A bad release is already `latest`

Move `latest` back to the last verified version, deprecate the bad version, and immediately prepare a fixed release. Dist-tag changes affect new installs but do not remove an immutable published version.

### GitHub release exists but npm publish failed

Keep the tag immutable. Correct the external configuration and rerun only the publish job if the npm version is still unused. Record the incident in the GitHub Release notes if publication was materially delayed.

## Local verification

Local checks do not publish:

```sh
npm ci
npm run check
npm pack --dry-run
```

Post-release verification for an exact version:

```sh
node scripts/verify-release.mjs <version>
node scripts/verify-github-release-assets.mjs <version>
```

JSR publication is idempotent: the workflow checks immutable registry metadata
before publishing, then verifies export-module hashes, the npm-compatibility
tarball integrity, and Deno API/CLI execution. After correcting external scope
authorization, rerun **Publish JSR** from `main`; an existing version is verified
without attempting to overwrite it.
