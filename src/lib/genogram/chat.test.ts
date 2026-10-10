import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { pathToFileURL } from "node:url";
import { CHAT_ERRORS, handleChatPost, MISSING_API_KEY_MESSAGE, parseEnvFileValue, readGeminiApiKey } from "./chat";
import { buildPagesFunctionSource } from "./pages-worker";
import { EMPTY_GRAPH } from "./types";

const TEST_KEY = "test-key";
const MODEL_REPLY = JSON.stringify({ assistantMessage: "ok", changes: [] });

type ChatHandler = (body: BodyInit, apiKey: string | undefined) => Promise<Response>;

const workerDirectory = mkdtempSync(path.join(tmpdir(), "familytree-worker-"));
after(() => rmSync(workerDirectory, { recursive: true, force: true }));

async function loadPagesWorker(): Promise<ChatHandler> {
  const file = path.join(workerDirectory, "chat.mjs");
  writeFileSync(file, buildPagesFunctionSource(""), "utf8");
  const worker = (await import(pathToFileURL(file).href)) as {
    onRequestPost: (context: { request: Request; env: Record<string, string | undefined> }) => Promise<Response>;
  };
  return (body, apiKey) =>
    worker.onRequestPost({ request: new Request("http://local/api/chat", { method: "POST", body }), env: { GEMINI_API_KEY: apiKey } });
}

const localHandler: ChatHandler = (body, apiKey) =>
  handleChatPost(new Request("http://local/api/chat", { method: "POST", body }), apiKey);

function geminiAnswer(text: string): Response {
  return Response.json({ candidates: [{ content: { parts: [{ text }] } }] });
}

/** Replaces the global fetch with answers served in order, and counts the calls. */
function stubGemini(...answers: (Response | Error)[]): { calls: () => number } {
  let calls = 0;
  globalThis.fetch = (async () => {
    const answer = answers[Math.min(calls, answers.length - 1)];
    calls += 1;
    if (answer instanceof Error) throw answer;
    return answer.clone();
  }) as typeof fetch;
  return { calls: () => calls };
}

const validBody = JSON.stringify({ message: "인물1과 인물2 사이에 갈등", graph: EMPTY_GRAPH });
const realFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = realFetch;
});

async function errorOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: string }).error;
}

for (const [name, handlerFor] of [
  ["local handler", async () => localHandler],
  ["Cloudflare function", loadPagesWorker],
] as const) {
  test(`${name}: relays the model reply`, async () => {
    const handler = await handlerFor();
    stubGemini(geminiAnswer(MODEL_REPLY));
    const response = await handler(validBody, TEST_KEY);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { reply: MODEL_REPLY });
  });

  test(`${name}: a body that is not JSON is a 400 JSON error, not a crash`, async () => {
    const handler = await handlerFor();
    const response = await handler("{message:hello}", TEST_KEY);
    assert.equal(response.status, 400);
    assert.equal(await errorOf(response), CHAT_ERRORS.invalidRequest);
  });

  test(`${name}: an empty message is rejected`, async () => {
    const handler = await handlerFor();
    const response = await handler(JSON.stringify({ message: "   ", graph: EMPTY_GRAPH }), TEST_KEY);
    assert.equal(response.status, 400);
  });

  test(`${name}: a missing key is explained`, async () => {
    const handler = await handlerFor();
    const response = await handler(validBody, undefined);
    assert.equal(response.status, 500);
    assert.equal(await errorOf(response), MISSING_API_KEY_MESSAGE);
  });

  test(`${name}: a busy model is retried once`, async () => {
    const handler = await handlerFor();
    const gemini = stubGemini(new Response("busy", { status: 503 }), geminiAnswer(MODEL_REPLY));
    const response = await handler(validBody, TEST_KEY);
    assert.equal(response.status, 200);
    assert.equal(gemini.calls(), 2);
  });

  test(`${name}: a model that stays busy is reported as busy`, async () => {
    const handler = await handlerFor();
    stubGemini(new Response("busy", { status: 503 }));
    const response = await handler(validBody, TEST_KEY);
    assert.equal(response.status, 503);
    assert.equal(await errorOf(response), CHAT_ERRORS.modelBusy);
  });

  test(`${name}: a slow model is cut off with a timeout message`, async () => {
    const handler = await handlerFor();
    stubGemini(new DOMException("timed out", "TimeoutError"));
    const response = await handler(validBody, TEST_KEY);
    assert.equal(response.status, 504);
    assert.equal(await errorOf(response), CHAT_ERRORS.modelTimeout);
  });

  test(`${name}: an empty model answer is an error`, async () => {
    const handler = await handlerFor();
    stubGemini(Response.json({ candidates: [] }));
    const response = await handler(validBody, TEST_KEY);
    assert.equal(response.status, 502);
    assert.equal(await errorOf(response), CHAT_ERRORS.emptyModelResponse);
  });

  test(`${name}: a model that refuses the server's region says so instead of a generic failure`, async () => {
    const handler = await handlerFor();
    const gemini = stubGemini(
      Response.json(
        { error: { code: 400, message: "User location is not supported for the API use.", status: "FAILED_PRECONDITION" } },
        { status: 400 },
      ),
    );
    const response = await handler(validBody, TEST_KEY);
    assert.equal(response.status, 502);
    assert.equal(await errorOf(response), CHAT_ERRORS.modelRegionBlocked);
    assert.equal(gemini.calls(), 1);
  });

  test(`${name}: other model rejections stay a generic failure`, async () => {
    const handler = await handlerFor();
    stubGemini(Response.json({ error: { code: 400, status: "INVALID_ARGUMENT" } }, { status: 400 }));
    const response = await handler(validBody, TEST_KEY);
    assert.equal(response.status, 502);
    assert.equal(await errorOf(response), CHAT_ERRORS.modelFailed);
  });
}

test("Gemini key helper keeps the first non-empty candidate", () => {
  assert.equal(readGeminiApiKey("  ", undefined, "secret-key"), "secret-key");
  assert.equal(readGeminiApiKey(undefined, ""), undefined);
});

test("env file parser reads GEMINI_API_KEY without quotes", () => {
  const value = parseEnvFileValue("GEMINI_API_KEY=test-local-key\nOTHER=1\n", "GEMINI_API_KEY");
  assert.equal(value, "test-local-key");
});
