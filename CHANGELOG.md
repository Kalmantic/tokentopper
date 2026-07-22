# Changelog

## [0.9.0](https://github.com/Kalmantic/tokentopper/compare/tokentopper-v0.8.0...tokentopper-v0.9.0) (2026-07-22)


### Features

* add CCRank parity foundation ([#68](https://github.com/Kalmantic/tokentopper/issues/68)) ([c6b97aa](https://github.com/Kalmantic/tokentopper/commit/c6b97aab9d11f41ef70724fd16e4806a0077a7f7))

## [0.8.0](https://github.com/Kalmantic/tokentopper/compare/tokentopper-v0.7.1...tokentopper-v0.8.0) (2026-07-20)


### Features

* read-only MCP server mode, compact and no-cost report flags ([#64](https://github.com/Kalmantic/tokentopper/issues/64)) ([3a41809](https://github.com/Kalmantic/tokentopper/commit/3a41809adec75eff9729187759c5289facdc1cf1))

## [0.7.1](https://github.com/Kalmantic/tokentopper/compare/tokentopper-v0.7.0...tokentopper-v0.7.1) (2026-07-20)


### Bug Fixes

* **cli:** align nested report rows and pad activity bars ([#63](https://github.com/Kalmantic/tokentopper/issues/63)) ([073d994](https://github.com/Kalmantic/tokentopper/commit/073d9948ad3a4569f5a09b498693bc8226cfb9b9))
* count client-side web tools and dedup Claude records by max ([#61](https://github.com/Kalmantic/tokentopper/issues/61)) ([57066bd](https://github.com/Kalmantic/tokentopper/commit/57066bd4d73207727f1846ecd292664bdb5ef1ab))

## [0.7.0](https://github.com/Kalmantic/tokentopper/compare/tokentopper-v0.6.1...tokentopper-v0.7.0) (2026-07-20)


### Features

* add daily, weekly, monthly, session, and blocks usage reports ([#56](https://github.com/Kalmantic/tokentopper/issues/56)) ([539e29e](https://github.com/Kalmantic/tokentopper/commit/539e29e8ec33e43d25bb54dc9e0ad9f619a8ab28))
* agent-then-model breakdown, benchmark insight, and geo rank prompt ([#59](https://github.com/Kalmantic/tokentopper/issues/59)) ([1462858](https://github.com/Kalmantic/tokentopper/commit/1462858426ac19605d797c9d1d3452f3cad8c8a8))

## [0.6.1](https://github.com/Kalmantic/tokentopper/compare/tokentopper-v0.6.0...tokentopper-v0.6.1) (2026-07-19)


### Bug Fixes

* **jsr:** make Bun SQLite import analyzable ([#52](https://github.com/Kalmantic/tokentopper/issues/52)) ([9f5491e](https://github.com/Kalmantic/tokentopper/commit/9f5491e8588b890212520428eee9938e8c5e1919))

## [0.6.0](https://github.com/Kalmantic/tokentopper/compare/tokentopper-v0.5.1...tokentopper-v0.6.0) (2026-07-19)


### Features

* **usage:** add Gemini CLI support ([#50](https://github.com/Kalmantic/tokentopper/issues/50)) ([b7c163a](https://github.com/Kalmantic/tokentopper/commit/b7c163abfcdcfcc9d5d874f8e585c450adca2025))


### Bug Fixes

* **nix:** enable structured attributes ([#47](https://github.com/Kalmantic/tokentopper/issues/47)) ([73aac3c](https://github.com/Kalmantic/tokentopper/commit/73aac3cf05ee207f5aac050996f65fe4148f2e97))

## [0.5.1](https://github.com/Kalmantic/tokentopper/compare/tokentopper-v0.5.0...tokentopper-v0.5.1) (2026-07-19)


### Bug Fixes

* **distro:** stage immutable standalone release candidates ([#42](https://github.com/Kalmantic/tokentopper/issues/42)) ([0a41595](https://github.com/Kalmantic/tokentopper/commit/0a4159544a2add018d71ad7805767adff820781c))
* **test:** follow package version in release fixtures ([#44](https://github.com/Kalmantic/tokentopper/issues/44)) ([6dee0e0](https://github.com/Kalmantic/tokentopper/commit/6dee0e008b7d3f10973fd172ae32bbb2377d2bcb))

## [0.5.0](https://github.com/Kalmantic/tokentopper/compare/tokentopper-v0.4.2...tokentopper-v0.5.0) (2026-07-19)


### Features

* verify standalone distribution prototype ([#29](https://github.com/Kalmantic/tokentopper/issues/29)) ([0043c68](https://github.com/Kalmantic/tokentopper/commit/0043c68763969bb009cb95d90554a3c2a2e34c8e))

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
