---
name: tokentopper
description: Extract, summarize, sign, and optionally sync local Claude Code, Codex, and OpenCode token usage with TokenTopper. Use when a user asks about their Professional AI Usage Index, token run-rate, AI coding-agent cost, local usage breakdown, verified TokenTopper rank, or multi-machine usage aggregation.
---

# TokenTopper

Use the TokenTopper CLI to calculate a privacy-preserving Professional AI Usage Index from local coding-agent logs. Treat local transcripts, signing keys, CLI tokens, and generated envelopes as sensitive.

## Inspect locally

1. Confirm the CLI is available with `npx tokentopper@latest --version`.
2. Run `npx tokentopper@latest json --pretty` for a machine-readable local summary, or `npx tokentopper@latest` for the human-readable report.
3. Summarize the run-rate, tier, index, tools, and top models. Do not expose raw transcript content, file paths, hostnames, signing keys, or credentials.

The CLI reads token metadata from Claude Code, Codex, and OpenCode. It does not need to read or reproduce prompts or source code to calculate the aggregate.

## Export a signed aggregate

Ask for explicit confirmation before creating a file intended for sharing. After confirmation, run:

```bash
npx tokentopper@latest export --pretty --out signed.json
```

Explain that `signed.json` contains aggregate usage plus an Ed25519 signature. It does not contain raw prompts or code. Do not upload it unless the user separately authorizes the upload.

## Link and sync

Ask for explicit confirmation before sending any aggregate to TokenTopper.

1. Direct the user to sign in at `https://openfactoryai.com/tools/tokentopper/` and create a CLI login command.
2. Have the user run the generated `tokentopper login --token ...` command themselves. Never ask them to paste the token into chat, and never echo or log it.
3. After upload confirmation, run `npx tokentopper@latest sync`.
4. Report the CLI's sync result. Do not claim success unless the command confirms it.

For multiple machines, repeat login and sync on each installation using the same TokenTopper account. Each installation has its own signing key and becomes a separately labeled machine in the user's aggregate. Machines can be renamed or removed on the website; a later signed sync intentionally re-adds a removed installation.

## Safety rules

- Default to local inspection only.
- Require confirmation for export and separate confirmation for upload.
- Never manually parse or transmit raw prompt/response text when the aggregate CLI output is sufficient.
- Never request, display, store in project files, or commit an npm token, TokenTopper CLI token, Firebase token, or signing private key.
- Do not broaden the scan beyond TokenTopper's documented Claude Code, Codex, and OpenCode locations.
- If no usage is found, explain which supported tools were checked and stop; do not search unrelated home-directory files.
