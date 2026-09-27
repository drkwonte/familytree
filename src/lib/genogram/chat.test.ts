import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { handleChatPost, parseChatModelPayload, readGeminiApiKey } from "./chat";
import { EMPTY_GRAPH } from "./types";

test("Gemini key helper keeps the first non-empty candidate", () => {
  assert.equal(readGeminiApiKey("  ", undefined, "secret-key"), "secret-key");
  assert.equal(readGeminiApiKey(undefined, ""), undefined);
});

test("committed Function env stub does not contain a secret", async () => {
  const source = await readFile(path.join(process.cwd(), "functions", "runtime-env.ts"), "utf8");
  assert.match(source, /BUILD_TIME_GEMINI_API_KEY = ""/);
});

test("model JSON without a graph is rejected", () => {
  const parsed = parseChatModelPayload(JSON.stringify({ assistantMessage: "ok" }));
  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.equal(parsed.status, 502);
  }
});

test("model JSON keeps households and a Korean assistant message", () => {
  const parsed = parseChatModelPayload(
    JSON.stringify({
      assistantMessage: "어머니를 추가했습니다.",
      graph: {
        nodes: [{ id: "p1" }],
        edges: [],
        households: [{ id: "h1", memberIds: ["p1"] }],
      },
    }),
  );
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.assistantMessage, "어머니를 추가했습니다.");
    assert.deepEqual(parsed.graph.households, [{ id: "h1", memberIds: ["p1"] }]);
  }
});

test("missing Gemini key returns a Korean 500", async () => {
  const response = await handleChatPost(
    new Request("http://local/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "아버지 추가", graph: EMPTY_GRAPH }),
    }),
    undefined,
  );
  assert.equal(response.status, 500);
  const payload = (await response.json()) as { error: string };
  assert.match(payload.error, /GEMINI_API_KEY/);
});

test("empty chat message is rejected", async () => {
  const response = await handleChatPost(
    new Request("http://local/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "   ", graph: EMPTY_GRAPH }),
    }),
    "test-key",
  );
  assert.equal(response.status, 400);
});
