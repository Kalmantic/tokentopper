import { createInterface } from "node:readline";
import { collectAll, type Rec } from "./usage";
import { aggregate, toPublicAggregate } from "./report";
import {
  benchmarkInsight,
  blocksReport,
  dailyReport,
  monthlyReport,
  sessionReport,
  totalsOf,
  weeklyReport,
  type ReportOptions,
} from "./breakdown";

// Minimal MCP (Model Context Protocol) stdio server: JSON-RPC 2.0, one JSON
// message per line. Read-only and local-only by design — it never writes
// files, never touches the network, and exposes only the same privacy-safe
// aggregates the CLI prints. No prompt or response content ever crosses it.

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: {
    protocolVersion?: string;
    name?: string;
    arguments?: Record<string, unknown>;
  };
}

const PROTOCOL_VERSION = "2025-06-18";

const TOOLS = [
  {
    name: "usage_summary",
    description:
      "Aggregate local AI coding-agent usage (Claude Code, Codex, OpenCode, Gemini CLI): totals, run-rate, tier, index, per-model and per-agent breakdowns. Privacy-safe: no hostname, machine id, prompts, or file paths.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "usage_report",
    description:
      "Bucketed usage report over local coding-agent records. Returns rows, totals, and a benchmark insight as JSON.",
    inputSchema: {
      type: "object",
      properties: {
        report: {
          type: "string",
          enum: ["daily", "weekly", "monthly", "session", "blocks"],
          description: "How to bucket usage",
        },
        since: { type: "string", description: "Inclusive start day, YYYY-MM-DD" },
        until: { type: "string", description: "Inclusive end day, YYYY-MM-DD" },
        tool: {
          type: "string",
          enum: ["claude", "codex", "opencode", "gemini"],
          description: "Restrict to one agent",
        },
      },
      required: ["report"],
      additionalProperties: false,
    },
  },
];

function result(id: number | string | null | undefined, value: unknown): string {
  return JSON.stringify({ jsonrpc: "2.0", id: id ?? null, result: value });
}

function rpcError(id: number | string | null | undefined, code: number, message: string): string {
  return JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

function toolText(payload: unknown, isError = false): unknown {
  return { content: [{ type: "text", text: JSON.stringify(payload) }], isError };
}

async function callTool(
  name: string | undefined,
  args: Record<string, unknown>,
  version: string,
  loadRecs: () => Promise<Rec[]>,
): Promise<unknown> {
  const recs = await loadRecs();
  if (name === "usage_summary") {
    return toolText(toPublicAggregate(aggregate(recs, version, Date.now())));
  }
  if (name === "usage_report") {
    const report = String(args.report ?? "");
    const opts: ReportOptions = {
      since: typeof args.since === "string" ? args.since : undefined,
      until: typeof args.until === "string" ? args.until : undefined,
      tool: typeof args.tool === "string" ? args.tool : undefined,
    };
    const rows =
      report === "daily"
        ? dailyReport(recs, opts)
        : report === "weekly"
          ? weeklyReport(recs, opts)
          : report === "monthly"
            ? monthlyReport(recs, opts)
            : report === "session"
              ? sessionReport(recs, opts)
              : report === "blocks"
                ? blocksReport(recs, opts)
                : null;
    if (!rows) return toolText({ error: `Unknown report "${report}".` }, true);
    return toolText({
      schema: "tokentopper-report/1",
      report,
      rows,
      totals: totalsOf(rows),
      insight: benchmarkInsight(recs),
    });
  }
  return toolText({ error: `Unknown tool "${name}".` }, true);
}

// Handles one decoded JSON-RPC message; returns the serialized response, or
// null for notifications (which must not be answered).
export async function handleMessage(
  msg: JsonRpcMessage,
  version: string,
  loadRecs: () => Promise<Rec[]> = collectAll,
): Promise<string | null> {
  const { id, method, params } = msg;
  const isNotification = id === undefined;
  try {
    if (method === "initialize") {
      return result(id, {
        protocolVersion: params?.protocolVersion || PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "tokentopper", version },
      });
    }
    if (method === "notifications/initialized" || method === "notifications/cancelled") return null;
    if (method === "ping") return result(id, {});
    if (method === "tools/list") return result(id, { tools: TOOLS });
    if (method === "tools/call") {
      const value = await callTool(params?.name, params?.arguments ?? {}, version, loadRecs);
      return result(id, value);
    }
    return isNotification ? null : rpcError(id, -32601, `Method not found: ${method}`);
  } catch (e) {
    return isNotification ? null : rpcError(id, -32603, (e as Error).message);
  }
}

export function runMcpServer(version: string): void {
  const rl = createInterface({ input: process.stdin, terminal: false });
  rl.on("line", (line) => {
    const text = line.trim();
    if (!text) return;
    let msg: JsonRpcMessage;
    try {
      msg = JSON.parse(text) as JsonRpcMessage;
    } catch {
      process.stdout.write(rpcError(null, -32700, "Parse error") + "\n");
      return;
    }
    void handleMessage(msg, version).then((response) => {
      if (response) process.stdout.write(response + "\n");
    });
  });
}
