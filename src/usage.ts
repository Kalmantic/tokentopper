import { readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// One deduplicated assistant response, reduced to the numbers we care about.
// We never keep prompt/response content, file paths, or branch names — only
// counts, the model, the day, and an opaque session id.
export interface Rec {
  ts: string;
  day: string; // YYYY-MM-DD (UTC)
  model: string;
  sessionId: string;
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  webSearch: number;
  webFetch: number;
}

// Where Claude Code writes its transcripts. CLAUDE_CONFIG_DIR may be a
// comma-separated list; we also probe the two default locations.
export function usageRoots(): string[] {
  const roots: string[] = [];
  const env = process.env.CLAUDE_CONFIG_DIR;
  if (env) for (const d of env.split(",")) roots.push(join(d.trim(), "projects"));
  roots.push(join(homedir(), ".claude", "projects"));
  roots.push(join(homedir(), ".config", "claude", "projects"));
  return [...new Set(roots)];
}

function walk(dir: string, out: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // missing dir is fine
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && e.name.endsWith(".jsonl")) out.push(p);
  }
}

export function findFiles(): string[] {
  const files: string[] = [];
  for (const root of usageRoots()) walk(root, files);
  return files;
}

interface RawRecord {
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

// Parse every transcript, keep only assistant turns that carry usage, and
// deduplicate on the API message id (a streamed turn is written more than once;
// the last write is the final tally).
export function loadRecords(files: string[]): Rec[] {
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
      let o: RawRecord;
      try {
        o = JSON.parse(line) as RawRecord;
      } catch {
        continue;
      }
      if (o.type !== "assistant") continue;
      const msg = o.message;
      const u = msg?.usage;
      if (!msg || !u) continue;

      const ts = o.timestamp ?? "";
      const key = String(msg.id ?? o.uuid ?? `${file}:${ts}`);
      const server = u.server_tool_use ?? {};
      seen.set(key, {
        ts,
        day: ts.slice(0, 10),
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
