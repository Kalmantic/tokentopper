import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";

// One deduplicated turn from any supported CLI, reduced to the numbers we care
// about. We never keep prompt/response content, file paths, or branch names.
export interface Rec {
  ts: string;
  day: string; // YYYY-MM-DD
  tool: "claude" | "codex" | "opencode"; // the CLI it came from
  provider: string;
  model: string;
  sessionId: string;
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  webSearch: number;
  webFetch: number;
  costUSD?: number;
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

/* ------------------------------ OpenCode ------------------------------ */
// OpenCode stores messages in ~/.local/share/opencode/opencode.db. Older
// installs may use storage/message/**/*.json; SQLite wins when both contain
// the same message ID, matching ccusage's reader.
function openCodeRoots(): string[] {
  const env = process.env.OPENCODE_DATA_DIR;
  const roots = env ? env.split(",").map((d) => d.trim()).filter(Boolean) : [];
  roots.push(join(homedir(), ".local", "share", "opencode"));
  return [...new Set(roots)];
}

interface OpenCodeRaw {
  id?: string;
  sessionID?: string;
  session_id?: string;
  providerID?: string;
  modelID?: string;
  role?: string;
  time?: { created?: number | string };
  tokens?: {
    input?: number;
    output?: number;
    total?: number;
    cache?: { read?: number; write?: number };
  };
  cost?: number;
}

interface OpenCodeRow {
  id: string;
  session_id?: string;
  data: string;
}

interface SQLiteReader {
  rows: () => OpenCodeRow[];
  close: () => void;
}

async function openSQLiteReadOnly(path: string): Promise<SQLiteReader> {
  try {
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(path, { readOnly: true });
    return {
      rows: () => db.prepare("SELECT id, session_id, data FROM message").all() as unknown as OpenCodeRow[],
      close: () => db.close(),
    };
  } catch (nodeError) {
    // Bun deliberately does not implement node:sqlite, but its native driver is
    // available in bunx and compiled executables. Keep this import indirect so
    // Node, Deno, TypeScript, and esbuild do not need to resolve a Bun builtin.
    if (!process.versions.bun) throw nodeError;
    const bunSQLite = "bun:sqlite";
    const { Database } = await import(bunSQLite) as {
      Database: new (filename: string, options: { readonly: boolean; create: boolean }) => {
        query: (sql: string) => { all: () => OpenCodeRow[] };
        close: () => void;
      };
    };
    const db = new Database(path, { readonly: true, create: false });
    return {
      rows: () => db.query("SELECT id, session_id, data FROM message").all(),
      close: () => db.close(),
    };
  }
}

function openCodeRec(raw: OpenCodeRaw, fallbackId: string): Rec | null {
  const u = raw.tokens;
  if (!u || (raw.role && raw.role !== "assistant")) return null;
  const created = raw.time?.created;
  const ts = typeof created === "number"
    ? new Date(created).toISOString()
    : typeof created === "string"
      ? new Date(created).toISOString()
      : "";
  const input = Math.max(0, Number(u.input) || 0);
  const cacheRead = Math.max(0, Number(u.cache?.read) || 0);
  const cacheWrite = Math.max(0, Number(u.cache?.write) || 0);
  let output = Math.max(0, Number(u.output) || 0);
  const known = input + output + cacheRead + cacheWrite;
  const total = Math.max(0, Number(u.total) || 0);
  if (total > known) output += total - known;
  if (input + output + cacheRead + cacheWrite === 0) return null;
  return {
    ts,
    day: ts.slice(0, 10),
    tool: "opencode",
    provider: raw.providerID || "unknown",
    model: raw.modelID || "unknown",
    sessionId: raw.sessionID || raw.session_id || fallbackId,
    input,
    output,
    cacheWrite,
    cacheRead,
    webSearch: 0,
    webFetch: 0,
    ...(typeof raw.cost === "number" ? { costUSD: raw.cost } : {}),
  };
}

export async function loadOpenCode(roots = openCodeRoots()): Promise<Rec[]> {
  const records = new Map<string, Rec>();
  for (const root of roots) {
    const jsonFiles: string[] = [];
    walk(join(root, "storage", "message"), (name) => name.endsWith(".json"), jsonFiles);
    for (const file of jsonFiles) {
      try {
        const raw = JSON.parse(readFileSync(file, "utf8")) as OpenCodeRaw;
        const rec = openCodeRec(raw, basename(file));
        if (rec) records.set(raw.id || `json:${file}`, rec);
      } catch {
        /* malformed historical records are ignored */
      }
    }

    const dbFiles = existsSync(root)
      ? readdirSync(root).filter((name) => name === "opencode.db" || /^opencode-.*\.db$/.test(name)).sort()
      : [];
    if (!dbFiles.length) continue;
    try {
      for (const name of dbFiles) {
        const db = await openSQLiteReadOnly(join(root, name));
        try {
          for (const row of db.rows()) {
            try {
              const raw = JSON.parse(row.data) as OpenCodeRaw;
              raw.id ||= row.id;
              raw.sessionID ||= row.session_id;
              const rec = openCodeRec(raw, row.id);
              if (rec) records.set(row.id, rec);
            } catch {
              /* ignore malformed database rows */
            }
          }
        } finally {
          db.close();
        }
      }
    } catch {
      // Deno or older Node builds may not expose a supported SQLite driver.
      // JSON fallback still works, and other usage sources remain available.
    }
  }
  return [...records.values()];
}

/* ------------------------------ registry ------------------------------ */
export interface Source {
  tool: Rec["tool"];
  label: string;
  load: () => Rec[] | Promise<Rec[]>;
}
export const SOURCES: Source[] = [
  { tool: "claude", label: "Claude Code", load: loadClaude },
  { tool: "codex", label: "Codex", load: loadCodex },
  { tool: "opencode", label: "OpenCode", load: loadOpenCode },
];

// Read every supported CLI. Sources with no data simply contribute nothing.
export async function collectAll(): Promise<Rec[]> {
  const all: Rec[] = [];
  for (const s of SOURCES) {
    try {
      all.push(...await s.load());
    } catch {
      /* a broken source never breaks the others */
    }
  }
  return all;
}
