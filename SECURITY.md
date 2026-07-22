# Security policy

TokenTopper reads sensitive local coding-agent records. Security and privacy
reports are welcome, including issues that could expose transcript content,
source paths, signing keys, CLI credentials, or release-publishing authority.

## Supported versions

Until TokenTopper reaches 1.0, security fixes are released only on the newest
version published to npm's `latest` tag. Users should upgrade with:

```sh
npx tokentopper@latest --version
```

Older versions may receive a deprecation notice but are not patched in place;
npm versions and Git tags are immutable.

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/Kalmantic/tokentopper/security/advisories/new).
Please do not open a public issue for an unpatched vulnerability.

Include, where possible:

- the affected TokenTopper version, runtime, and operating system;
- a concise impact statement and reproduction using synthetic data;
- whether credentials or private user data may have been exposed;
- any suggested mitigation or evidence that exploitation occurred.

Never attach real prompts, responses, source code, local agent transcripts,
`~/.tokentopper/key.json`, CLI tokens, or an unredacted `signed.json`. Maintainers
will acknowledge a complete report as soon as practical, target initial triage
within seven days, and coordinate disclosure after a fix or mitigation exists.

## Scope

Examples in scope include:

- reading or exporting fields outside the documented aggregate boundary;
- network activity from commands documented as local-only;
- signature verification, account/key binding, or replay weaknesses;
- unsafe key/config permissions or credential disclosure;
- dependency, build, release, provenance, or GitHub Actions compromise;
- denial of service or injection through supported local record formats.

Reports about the hosted leaderboard or sync API may involve a separate private
service repository, but the same advisory form is the correct starting point.
Purely theoretical findings without a security boundary impact, social
engineering, and availability testing against production are out of scope.

## Researcher safety

Good-faith research that uses your own account and synthetic data, avoids privacy
violations and service disruption, and gives maintainers reasonable remediation
time will not be pursued by the project. Do not access another person's data,
degrade the hosted service, or retain secrets encountered accidentally.

## Release response

Security fixes follow the documented immutable release process: fix forward,
publish with npm provenance, attach checksum/SBOM evidence, verify a clean
installation, and deprecate a vulnerable version when appropriate. A published
version is never overwritten.

