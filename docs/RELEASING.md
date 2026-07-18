# Releasing TokenTopper

TokenTopper releases are prepared by Release Please and published to npm from GitHub Actions with provenance. The npm credential is stored only as the masked GitHub Actions secret `NPMJS_TOKEN`; it must never appear in repository files, logs, local shell history, or chat.

## One-time repository setup

1. Revoke any npm token exposed outside npm or GitHub's encrypted secret form. Exposed tokens must be considered compromised.
2. Create a package-scoped npm publishing token for `tokentopper` and save it as the repository Actions secret `NPMJS_TOKEN`. Never print or paste its value into a workflow, issue, log, or chat.
3. In GitHub, create an environment named `npm`. Add required reviewers if releases should require a human approval at the final publish boundary.
4. Allow Release Please to maintain its release PR using one of these approaches:
   - preferred: have a Kalmantic organization owner allow GitHub Actions to create pull requests;
   - fallback: create a fine-grained GitHub token limited to `Kalmantic/tokentopper` with Contents and Pull requests read/write access, then save it as the repository Actions secret `RELEASE_PLEASE_TOKEN`.
   The current Kalmantic organization policy blocks the built-in GitHub token, so one of these actions is required before merging the distribution PR.
5. Protect `main` and require the CI checks before merge.
6. Enable GitHub secret scanning and push protection for the repository.

`RELEASE_PLEASE_TOKEN`, when needed, is a GitHub automation credential only. npm publishing uses only `NPMJS_TOKEN`. Rotate the npm credential according to its configured expiry and immediately after suspected exposure.

## Normal release flow

1. Merge changes using Conventional Commit subjects:
   - `fix:` for a patch release;
   - `feat:` for a minor release;
   - `feat!:` or another `!` type for a breaking release. Before `1.0.0`, the repository's Release Please configuration turns this into a minor release.
2. CI runs `npm run check` on Node.js 22 and 24 across Linux, macOS, and Windows.
3. Release Please updates a release PR containing the next version and changelog.
4. Review and merge the release PR.
5. The same release workflow creates the Git tag and GitHub Release, checks out the tagged commit, reruns the full package gate, and publishes with npm provenance.
6. `scripts/verify-release.mjs` waits for registry propagation and verifies the version, `latest` tag, description, integrity, provenance, clean installation, and CLI version.
7. After npm verification passes, the release workflow attaches the exact npm tarball, its SHA-256 checksum, and a CycloneDX SBOM to the GitHub Release.

All external GitHub Actions are pinned to immutable commit SHAs. Dependabot should update those pins through reviewed pull requests rather than changing them during a release run. The publish job also pins the npm CLI version so authentication and provenance behavior do not drift unexpectedly.

Do not edit `package.json` to make an ad hoc release after Release Please is enabled. Put version changes through its release PR so the source, lockfile, tag, GitHub Release, and npm registry remain aligned.

## Prereleases

The stable workflow publishes only to `latest`. Add a dedicated prerelease workflow before publishing beta builds. That workflow must use a prerelease version and an explicit non-stable dist-tag such as:

```sh
npm publish --provenance --access public --tag next
```

Never put a prerelease on `latest`.

## Failure and recovery

### Publish failed before npm accepted the version

Fix the workflow or npm-token configuration, then rerun the failed publish job. A version may be retried only if `npm view tokentopper@<version>` confirms it does not exist.

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
node scripts/verify-release.mjs 0.3.0
```
