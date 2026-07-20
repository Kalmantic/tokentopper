import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { DatabaseSync } from "node:sqlite";
import { loadClaude, loadCodex, loadGemini, loadOpenCode } from "../src/usage";

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
    // The same message id appears three times: an early streaming partial, the
    // full line with client-side WebSearch/WebFetch tool_use blocks, then a
    // stale copy walked last. The reader must keep the max per counter and
    // count client-side web tools, not just server_tool_use.
    const complete = {
      ...record,
      message: {
        ...record.message,
        content: [
          { type: "text", text: "" },
          { type: "tool_use", name: "WebSearch" },
          { type: "tool_use", name: "WebFetch" },
        ],
        usage: { ...record.message.usage, output_tokens: 40 },
      },
    };
    const stale = {
      ...record,
      message: { ...record.message, usage: { ...record.message.usage, output_tokens: 10 } },
    };
    writeFileSync(
      join(project, "session.jsonl"),
      `${JSON.stringify(record)}\nnot-json\n${JSON.stringify(complete)}\n${JSON.stringify(stale)}\n`,
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
        output: 40,
        cacheWrite: 30,
        cacheRead: 40,
        webSearch: 3,
        webFetch: 2,
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

test("OpenCode reader combines JSON and SQLite with database records winning", async () => {
  const root = fixtureDir("opencode");
  try {
    const messageDir = join(root, "storage", "message", "session-1");
    mkdirSync(messageDir, { recursive: true });
    writeFileSync(join(messageDir, "message-1.json"), JSON.stringify({
      id: "message-1",
      sessionID: "session-json",
      role: "assistant",
      providerID: "anthropic",
      modelID: "claude-sonnet-4",
      time: { created: 1782986400000 },
      tokens: { input: 10, output: 4, cache: { read: 2, write: 1 }, total: 17 },
      cost: 0.01,
    }));
    writeFileSync(join(messageDir, "message-2.json"), JSON.stringify({
      id: "message-2",
      sessionID: "session-json",
      role: "assistant",
      providerID: "openai",
      modelID: "gpt-5",
      time: { created: 1782986460000 },
      tokens: { input: 7, output: 3, total: 12 },
    }));

    const db = new DatabaseSync(join(root, "opencode.db"));
    db.exec("CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT, data TEXT NOT NULL)");
    db.prepare("INSERT INTO message (id,session_id,data) VALUES (?,?,?)").run(
      "message-1",
      "session-db",
      JSON.stringify({
        id: "message-1",
        role: "assistant",
        providerID: "openai",
        modelID: "gpt-5-codex",
        time: { created: 1782986520000 },
        tokens: { input: 20, output: 5, cache: { read: 3, write: 2 }, total: 30 },
        cost: 0.25,
      }),
    );
    db.close();

    const records = (await loadOpenCode([root])).sort((a, b) => a.model.localeCompare(b.model));
    assert.equal(records.length, 2);
    assert.deepEqual(records.map(({ model, sessionId, input, output, cacheRead, cacheWrite, costUSD }) => ({
      model, sessionId, input, output, cacheRead, cacheWrite, costUSD,
    })), [
      { model: "gpt-5", sessionId: "session-json", input: 7, output: 5, cacheRead: 0, cacheWrite: 0, costUSD: undefined },
      { model: "gpt-5-codex", sessionId: "session-db", input: 20, output: 5, cacheRead: 3, cacheWrite: 2, costUSD: 0.25 },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Gemini reader follows message updates, token semantics, and rewinds", () => {
  const root = fixtureDir("gemini");
  try {
    const chats = join(root, "project-hash", "chats");
    mkdirSync(chats, { recursive: true });
    const message = {
      id: "gemini-message-1",
      timestamp: "2026-07-03T12:00:00.000Z",
      type: "gemini",
      model: "gemini-2.5-pro",
      content: "private response content",
      tokens: {
        input: 100,
        output: 20,
        cached: 40,
        thoughts: 10,
        tool: 5,
        total: 135,
      },
    };
    writeFileSync(join(chats, "session-2026-07-03T12-00-gemini.jsonl"), [
      JSON.stringify({
        sessionId: "gemini-session",
        projectHash: "project-hash",
        startTime: "2026-07-03T12:00:00.000Z",
        lastUpdated: "2026-07-03T12:01:00.000Z",
      }),
      JSON.stringify({ ...message, tokens: null }),
      JSON.stringify(message),
      JSON.stringify({
        id: "gemini-message-rewound",
        timestamp: "2026-07-03T12:01:00.000Z",
        type: "gemini",
        model: "gemini-2.5-flash",
        tokens: { input: 5, output: 2, cached: 0, total: 7 },
      }),
      JSON.stringify({ $rewindTo: "gemini-message-rewound" }),
      "not-json",
    ].join("\n") + "\n");

    assert.deepEqual(loadGemini([root]), [
      {
        ts: "2026-07-03T12:00:00.000Z",
        day: "2026-07-03",
        tool: "gemini",
        provider: "google",
        model: "gemini-2.5-pro",
        sessionId: "gemini-session",
        input: 65,
        output: 30,
        cacheWrite: 0,
        cacheRead: 40,
        webSearch: 0,
        webFetch: 0,
      },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Gemini reader restores checkpoint message sets", () => {
  const root = fixtureDir("gemini-checkpoint");
  try {
    const chats = join(root, "project-hash", "chats");
    mkdirSync(chats, { recursive: true });
    writeFileSync(join(chats, "session-checkpoint.jsonl"), [
      JSON.stringify({ sessionId: "original-session" }),
      JSON.stringify({
        id: "discarded-message",
        timestamp: "2026-07-04T11:59:00.000Z",
        type: "gemini",
        model: "gemini-2.5-flash",
        tokens: { input: 2, output: 1, total: 3 },
      }),
      JSON.stringify({
        $set: {
          sessionId: "restored-session",
          messages: [{
            id: "restored-message",
            timestamp: "2026-07-04T12:00:00.000Z",
            type: "gemini",
            model: "gemini-2.5-flash",
            tokens: { input: 30, output: 8, cached: 10, total: 38 },
          }],
        },
      }),
    ].join("\n") + "\n");

    assert.deepEqual(loadGemini([root]), [{
      ts: "2026-07-04T12:00:00.000Z",
      day: "2026-07-04",
      tool: "gemini",
      provider: "google",
      model: "gemini-2.5-flash",
      sessionId: "restored-session",
      input: 20,
      output: 8,
      cacheWrite: 0,
      cacheRead: 10,
      webSearch: 0,
      webFetch: 0,
    }]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
