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

function loadClaude(): Rec[] {
  const files: string[] = [];
  for (const root of claudeRoots()) walk(root, (n) => n.endsWith(".jsonl"), files);
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

function loadCodex(): Rec[] {
  const files: string[] = [];
  for (const root of codexRoots()) walk(root, (n) => n.startsWith("rollout-") && n.endsWith(".jsonl"), files);
  const recs: Rec[] = [];
  for (const file of files) {
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    let best: Record<string, number> | null = null;
    let model = "gpt-5-codex";
    let modelFound = false;
    for (const line of text.split("\n")) {
      if (!line) continue;
      if (line.includes("total_token_usage")) {
        try {
          const o = JSON.parse(line);
          const info = o?.payload?.info?.total_token_usage;
          if (info && typeof info.total_tokens === "number") best = info; // cumulative → keep last
        } catch {
          /* ignore */
        }
      }
      if (!modelFound && line.includes('"model"')) {
        const m = line.match(/"model"\s*:\s*"([^"]+)"/);
        if (m) {
          model = m[1]!;
          modelFound = true;
        }
      }
    }
    if (best) {
      const cacheRead = best.cached_input_tokens || 0;
      const input = Math.max(0, (best.input_tokens || 0) - cacheRead);
      const output = (best.output_tokens || 0) + (best.reasoning_output_tokens || 0);
      const ts = tsFromRollout(basename(file));
      recs.push({
        ts,
        day: ts.slice(0, 10),
        tool: "codex",
        provider: "openai",
        model,
        sessionId: basename(file),
        input,
        output,
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
