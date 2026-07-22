# Optional TokenTopper setup for an AI development workstation

TokenTopper can be added to a development-machine bootstrap as an optional,
local-only observability command. It does not need an API key or account to read
supported coding-agent usage.

## Without a global install

Add shell aliases that always resolve the current provenance-backed npm release:

```sh
alias ai-usage='npx --yes tokentopper@latest'
alias ai-usage-daily='npx --yes tokentopper@latest daily --by-tool'
```

For a reproducible team image, pin an audited version instead:

```sh
alias ai-usage='npx --yes tokentopper@0.8.0'
```

## Global install

```sh
npm install --global tokentopper@latest
tokentopper --version
tokentopper
```

Node.js 22 or 24 is required. The default command discovers Claude Code, Codex,
OpenCode, and Gemini CLI stores in their standard per-user locations and does
not contact the network.

## Optional agent integration

Install the same privacy-first Agent Skill for Claude, Codex, and Gemini CLI:

```sh
npx tokentopper@latest skill install
```

The skill is read-only by default. Export and sync still require explicit user
intent. Use `--claude`, `--codex`, or `--gemini` to install for only one client.

## Optional publication

Keep publication out of unattended workstation bootstrap. A user who chooses to
publish should sign in, link that machine, inspect the local result, and then run:

```sh
tokentopper sync
```

Do not bake CLI tokens or `~/.tokentopper/key.json` into a machine image. Each
installation must generate its own Ed25519 key, and managed environments should
store any CLI token in the user's protected configuration rather than a shared
dotfiles repository. See [enterprise data handling](../COMPATIBILITY.md) and the
[threat model](../THREAT_MODEL.md).

