import assert from "node:assert/strict";
import { test } from "node:test";
import { readChatResponse, requestChatChanges, SESSION_EXPIRED_MESSAGE } from "./chat-client";
import { EMPTY_GRAPH } from "./types";

const HTML_ERROR_PAGE = "<!DOCTYPE html><html><body>502 Bad gateway</body></html>";
const HTTP_UNAUTHORIZED = 401;

test("an HTML error page from the host becomes a readable message, not a JSON parse error", async () => {
  const result = await readChatResponse(new Response(HTML_ERROR_PAGE, { status: 502 }));
  assert.ok("error" in result);
  assert.match(result.error, /502/);
  assert.doesNotMatch(result.error, /Unexpected token|DOCTYPE/);
});

test("a JSON error from the chat function is shown as written", async () => {
  const result = await readChatResponse(Response.json({ error: "AI 응답이 비어 있습니다." }, { status: 502 }));
  assert.deepEqual(result, { error: "AI 응답이 비어 있습니다." });
});

test("a rejected login token asks the counselor to sign in again", async () => {
  const gatewayAnswer = Response.json({ code: HTTP_UNAUTHORIZED, message: "Invalid JWT" }, { status: HTTP_UNAUTHORIZED });
  const result = await readChatResponse(gatewayAnswer);
  assert.deepEqual(result, { error: SESSION_EXPIRED_MESSAGE });
});

test("a successful response hands back the model reply", async () => {
  const result = await readChatResponse(Response.json({ reply: "{}" }));
  assert.deepEqual(result, { reply: "{}" });
});

test("a network failure is reported instead of thrown", async () => {
  const reply = await requestChatChanges("갈등", EMPTY_GRAPH, async () => {
    throw new TypeError("Failed to fetch");
  });
  assert.equal(reply.ok, false);
});

test("the request sends the message with the current graph", async () => {
  let sent: unknown;
  await requestChatChanges("갈등", EMPTY_GRAPH, async (body) => {
    sent = body;
    return Response.json({ reply: JSON.stringify({ assistantMessage: "", changes: [] }) });
  });
  assert.deepEqual(sent, { message: "갈등", graph: EMPTY_GRAPH });
});

test("the model reply is read into changes", async () => {
  const modelReply = JSON.stringify({
    assistantMessage: "표시했습니다.",
    changes: [{ type: "setRelation", from: 1, to: 2, kind: "close" }],
  });
  const reply = await requestChatChanges("친밀", EMPTY_GRAPH, async () => Response.json({ reply: modelReply }));
  assert.equal(reply.ok, true);
  if (reply.ok) assert.equal(reply.changes.length, 1);
});
