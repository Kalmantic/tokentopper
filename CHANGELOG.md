# Changelog

## [0.4.2](https://github.com/Kalmantic/tokentopper/compare/tokentopper-v0.4.1...tokentopper-v0.4.2) (2026-07-19)


### Bug Fixes

* document compatibility boundaries ([#26](https://github.com/Kalmantic/tokentopper/issues/26)) ([0b338c4](https://github.com/Kalmantic/tokentopper/commit/0b338c462f8a4ce573603b89f952320a1b879200))

## [0.4.1](https://github.com/Kalmantic/tokentopper/compare/tokentopper-v0.4.0...tokentopper-v0.4.1) (2026-07-19)


### Bug Fixes

* handle Deno release age gate ([#24](https://github.com/Kalmantic/tokentopper/issues/24)) ([7221126](https://github.com/Kalmantic/tokentopper/commit/722112682d0692bba44dd95610b136a9598128ff))
* verify live distribution channels ([#22](https://github.com/Kalmantic/tokentopper/issues/22)) ([904d887](https://github.com/Kalmantic/tokentopper/commit/904d887ba85acf40b0f753e9dc4ee5b889d7b416))

## [0.4.0](https://github.com/Kalmantic/tokentopper/compare/tokentopper-v0.3.0...tokentopper-v0.4.0) (2026-07-18)


### Features

* add OpenCode SQLite/JSON usage ingestion with database-first deduplication ([#10](https://github.com/Kalmantic/tokentopper/pull/10))
* distribute through Bun, Deno, JSR, and a reproducible four-system Nix flake ([#10](https://github.com/Kalmantic/tokentopper/pull/10))
* ship a consent-gated TokenTopper Agent Skill installer for Claude and Codex ([#10](https://github.com/Kalmantic/tokentopper/pull/10))
* document OpenCode and agent skill distribution ([#11](https://github.com/Kalmantic/tokentopper/pull/11)) ([617ba9c](https://github.com/Kalmantic/tokentopper/commit/617ba9c4e3ccbc51020d418677189a8d2d7047af))

## [0.3.0](https://github.com/Kalmantic/tokentopper/compare/tokentopper-v0.2.5...tokentopper-v0.3.0) (2026-07-18)


### ⚠ BREAKING CHANGES

* supported Node.js versions are now the maintained Node.js 22 and 24 LTS lines.

### Features

* attach audited GitHub release assets ([33c9752](https://github.com/Kalmantic/tokentopper/commit/33c9752dd93cbcaa3d559f6bfaa2408451b12d17))
* automate verified npm distribution ([7f71fa4](https://github.com/Kalmantic/tokentopper/commit/7f71fa494cbc026a216d0ae4e527f4b502bcb2e8))
* build the TokenTopper growth loop ([e8d970e](https://github.com/Kalmantic/tokentopper/commit/e8d970ebf4ef01732a5eb23b5120414181022e38))


### Bug Fixes

* authenticate npm publish with repository secret ([b47263e](https://github.com/Kalmantic/tokentopper/commit/b47263e9dc6a33f37b750225f259cd27827e04bb))
* make package verifier portable ([46cd1bc](https://github.com/Kalmantic/tokentopper/commit/46cd1bcad7c66cd3db14a17c10dc03eb35cff313))
* pin dependency review to a commit ([56631b7](https://github.com/Kalmantic/tokentopper/commit/56631b79d21d076d185d0dc7b798e3ddf02c6ee4))
