import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadClaude, loadCodex } from "../src/usage";

function fixtureDir(name: string): string {
  return mkdtempSync(join(tmpdir(), `tokentopper-${name}-`));
}

test("Claude reader extracts usage and deduplicates message IDs", () => {
  const root = fixtureDir("claude");
  try {
    const project = join(root, "project");
    mkdirSync(project, { recursive: true });
    const record = {
      type: "assistant",
      timestamp: "2026-07-01T10:00:00.000Z",
      sessionId: "claude-session",
      message: {
        id: "message-1",
        model: "claude-sonnet-4",
        usage: {
          input_tokens: 100,
          output_tokens: 25,
          cache_creation_input_tokens: 30,
          cache_read_input_tokens: 40,
          server_tool_use: { web_search_requests: 2, web_fetch_requests: 1 },
        },
      },
    };
    writeFileSync(
      join(project, "session.jsonl"),
      `${JSON.stringify(record)}\nnot-json\n${JSON.stringify(record)}\n`,
    );

    assert.deepEqual(loadClaude([root]), [
      {
        ts: "2026-07-01T10:00:00.000Z",
        day: "2026-07-01",
        tool: "claude",
        provider: "anthropic",
        model: "claude-sonnet-4",
        sessionId: "claude-session",
        input: 100,
        output: 25,
        cacheWrite: 30,
        cacheRead: 40,
        webSearch: 2,
        webFetch: 1,
      },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Codex reader handles last usage, cumulative deltas, caching, and deduplication", () => {
  const root = fixtureDir("codex");
  try {
    const file = join(root, "rollout-2026-07-02T11-22-33-session.jsonl");
    const first = {
      type: "event_msg",
      timestamp: "2026-07-02T11:22:34.000Z",
      payload: {
        type: "token_count",
        info: {
          last_token_usage: {
            input_tokens: 100,
            cached_input_tokens: 40,
            output_tokens: 10,
            reasoning_output_tokens: 2,
            total_tokens: 112,
          },
          total_token_usage: {
            input_tokens: 100,
            cached_input_tokens: 40,
            output_tokens: 10,
            reasoning_output_tokens: 2,
            total_tokens: 112,
          },
        },
      },
    };
    const second = {
      type: "event_msg",
      timestamp: "2026-07-02T11:23:00.000Z",
      payload: {
        type: "token_count",
        info: {
          total_token_usage: {
            input_tokens: 150,
            cached_input_tokens: 60,
            output_tokens: 15,
            reasoning_output_tokens: 3,
            total_tokens: 168,
          },
        },
      },
    };
    writeFileSync(
      file,
      [
        JSON.stringify({ type: "session_meta", payload: { model: "gpt-5.3-codex" } }),
        JSON.stringify(first),
        JSON.stringify(first),
        JSON.stringify(second),
      ].join("\n"),
    );

    const records = loadCodex([root]);
    assert.equal(records.length, 2);
    assert.deepEqual(
      records.map(({ input, output, cacheRead, model }) => ({ input, output, cacheRead, model })),
      [
        { input: 60, output: 12, cacheRead: 40, model: "gpt-5.3-codex" },
        { input: 30, output: 6, cacheRead: 20, model: "gpt-5.3-codex" },
      ],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
