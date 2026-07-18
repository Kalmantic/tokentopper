# Contributing to TokenTopper

Thanks for helping make coding-agent usage easier to understand without weakening user privacy.

## Local setup

TokenTopper supports Node.js 22 and 24.

```sh
npm ci
npm run check
```

`npm run check` typechecks the source, runs fixture-based tests, builds the CLI, packs the exact npm artifact, installs it in an isolated directory, and exercises summary, export, and mocked sync flows.

## Privacy invariants

Changes must not collect or export:

- prompt or response content;
- source code;
- file paths or project names;
- branch names;
- reusable credentials or private signing keys.

Fixtures must be synthetic and live under `test/`. Tests must not read real usage data from the contributor's home directory or contact production.

## Adding a coding-agent source

1. Document the source format and local discovery paths.
2. Reduce raw events to the numeric `Rec` shape in `src/usage.ts`.
3. Deduplicate replayed, resumed, and repeated events.
4. Add synthetic fixtures for normal, malformed, duplicated, and resumed sessions.
5. Confirm `npm run check` passes on every supported platform.
6. Update the README support table only after the source is tested.

Do not promise support based only on a roadmap keyword or an unverified example file.

## Pull requests

- Keep changes focused and explain the user-visible behavior.
- Use Conventional Commit subjects such as `fix:`, `feat:`, and `docs:`.
- Update tests and documentation with behavior changes.
- Never commit generated `signed.json`, `.tokentopper` keys, access tokens, or real agent logs.

Bug reports and tool-support requests should include sanitized structure, never private transcript content.
