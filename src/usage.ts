import { readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";

// One deduplicated turn from any supported CLI, reduced to the numbers we care
// about. We never keep prompt/response content, file paths, or branch names.
export interface Rec {
  ts: string;
  day: string; // YYYY-MM-DD
  tool: "claude" | "codex"; // the CLI it came from
  provider: "anthropic" | "openai";
  model: string;
  sessionId: string;
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  webSearch: number;
  webFetch: number;
}

function walk(dir: string, match: (name: string) => boolean, out: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, match, out);
    else if (e.isFile() && match(e.name)) out.push(p);
  }
}

/* ----------------------------- Claude Code ----------------------------- */
// ~/.claude/projects/**/*.jsonl (also ~/.config/claude, $CLAUDE_CONFIG_DIR)
function claudeRoots(): string[] {
  const roots: string[] = [];
  const env = process.env.CLAUDE_CONFIG_DIR;
  if (env) for (const d of env.split(",")) roots.push(join(d.trim(), "projects"));
  roots.push(join(homedir(), ".claude", "projects"));
  roots.push(join(homedir(), ".config", "claude", "projects"));
  return [...new Set(roots)];
}

interface ClaudeRaw {
  type?: string;
  timestamp?: string;
  sessionId?: string;
  uuid?: string;
  message?: {
    id?: string;
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
      server_tool_use?: { web_search_requests?: number; web_fetch_requests?: number };
    };
  };
}

export function loadClaude(roots = claudeRoots()): Rec[] {
  const files: string[] = [];
  for (const root of roots) walk(root, (n) => n.endsWith(".jsonl"), files);
  const seen = new Map<string, Rec>();
  for (const file of files) {
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const line of text.split("\n")) {
      if (!line || !line.includes('"usage"')) continue;
      let o: ClaudeRaw;
      try {
        o = JSON.parse(line) as ClaudeRaw;
      } catch {
        continue;
      }
      if (o.type !== "assistant") continue;
      const msg = o.message;
      const u = msg?.usage;
      if (!msg || !u) continue;
      const ts = o.timestamp ?? "";
      const key = "claude:" + String(msg.id ?? o.uuid ?? `${file}:${ts}`);
      const server = u.server_tool_use ?? {};
      seen.set(key, {
        ts,
        day: ts.slice(0, 10),
        tool: "claude",
        provider: "anthropic",
        model: msg.model ?? "unknown",
        sessionId: o.sessionId ?? "unknown",
        input: u.input_tokens ?? 0,
        output: u.output_tokens ?? 0,
        cacheWrite: u.cache_creation_input_tokens ?? 0,
        cacheRead: u.cache_read_input_tokens ?? 0,
        webSearch: server.web_search_requests ?? 0,
        webFetch: server.web_fetch_requests ?? 0,
      });
    }
  }
  return [...seen.values()];
}

/* -------------------------------- Codex -------------------------------- */
// ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl. token_count events carry a
// cumulative total_token_usage; the last one per session is the session total.
function codexRoots(): string[] {
  const roots = [join(homedir(), ".codex", "sessions")];
  const env = process.env.CODEX_HOME;
  if (env) roots.push(join(env, "sessions"));
  return [...new Set(roots)];
}

function tsFromRollout(name: string): string {
  const m = name.match(/rollout-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}

interface CodexUsage {
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  reasoning_output_tokens?: number;
  total_tokens?: number;
}
function sub(a: CodexUsage, b: CodexUsage | null): CodexUsage {
  const p = b ?? {};
  return {
    input_tokens: (a.input_tokens ?? 0) - (p.input_tokens ?? 0),
    cached_input_tokens: (a.cached_input_tokens ?? 0) - (p.cached_input_tokens ?? 0),
    output_tokens: (a.output_tokens ?? 0) - (p.output_tokens ?? 0),
    reasoning_output_tokens: (a.reasoning_output_tokens ?? 0) - (p.reasoning_output_tokens ?? 0),
    total_tokens: (a.total_tokens ?? 0) - (p.total_tokens ?? 0),
  };
}

// Mirrors ccusage's Codex reader: per token_count event use last_token_usage
// (or total-minus-previous), globally dedup identical events, and — for forked/
// resumed sessions (a "forked_from_id" or "thread.spawn" marker) — skip the
// replayed parent history, whose events all carry the fork-creation second.
export function loadCodex(roots = codexRoots()): Rec[] {
  const files: string[] = [];
  for (const root of roots) walk(root, (n) => n.startsWith("rollout-") && n.endsWith(".jsonl"), files);
  files.sort();
  const recs: Rec[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const head = text.slice(0, 16384);
    const isReplay = head.includes("forked_from_id") || head.includes("thread.spawn");
    const lines = text.split("\n");

    let replaySec: string | null = null;
    if (isReplay) {
      for (const line of lines) {
        if (!line.includes('"token_count"')) continue;
        try {
          const o = JSON.parse(line);
          if (o?.type === "event_msg" && o?.payload?.type === "token_count" && typeof o.timestamp === "string") {
            replaySec = o.timestamp.slice(0, 19);
            break;
          }
        } catch {
          /* ignore */
        }
      }
    }

    let skip = isReplay && replaySec != null;
    let prev: CodexUsage | null = null;
    let model = "gpt-5-codex";
    for (const line of lines) {
      if (!line.includes('"token_count"')) {
        if (line.includes('"model"')) {
          const m = line.match(/"model"\s*:\s*"([^"]+)"/);
          if (m) model = m[1]!;
        }
        continue;
      }
      let o: { type?: string; timestamp?: string; payload?: { type?: string; info?: { last_token_usage?: CodexUsage; total_token_usage?: CodexUsage } } };
      try {
        o = JSON.parse(line);
      } catch {
        continue;
      }
      if (o.type !== "event_msg" || o.payload?.type !== "token_count") continue;
      const ts = o.timestamp ?? "";
      const info = o.payload.info ?? {};
      const total = info.total_token_usage ?? null;
      if (skip && ts && ts.slice(0, 19) === replaySec) {
        if (total) prev = total;
        continue;
      }
      skip = false;
      const raw: CodexUsage | null = info.last_token_usage ?? (total ? sub(total, prev) : null);
      if (total) prev = total;
      if (!raw) continue;
      const it = raw.input_tokens ?? 0;
      const rawCached = raw.cached_input_tokens ?? 0;
      const ot = raw.output_tokens ?? 0;
      const rt = raw.reasoning_output_tokens ?? 0;
      const tt = raw.total_tokens ?? 0;
      if (it === 0 && rawCached === 0 && ot === 0 && rt === 0) continue;
      const key = `${ts}|${it}|${rawCached}|${ot}|${rt}|${tt}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const cacheRead = Math.min(rawCached, it);
      recs.push({
        ts,
        day: ts.slice(0, 10),
        tool: "codex",
        provider: "openai",
        model,
        sessionId: basename(file),
        input: Math.max(0, it - cacheRead),
        output: ot + rt,
        cacheWrite: 0,
        cacheRead,
        webSearch: 0,
        webFetch: 0,
      });
    }
  }
  return recs;
}

/* ------------------------------ registry ------------------------------ */
export interface Source {
  tool: Rec["tool"];
  label: string;
  load: () => Rec[];
}
export const SOURCES: Source[] = [
  { tool: "claude", label: "Claude Code", load: loadClaude },
  { tool: "codex", label: "Codex", load: loadCodex },
];

// Read every supported CLI. Sources with no data simply contribute nothing.
export function collectAll(): Rec[] {
  const all: Rec[] = [];
  for (const s of SOURCES) {
    try {
      all.push(...s.load());
    } catch {
      /* a broken source never breaks the others */
    }
  }
  return all;
}
