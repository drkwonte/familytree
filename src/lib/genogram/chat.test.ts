import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { pathToFileURL } from "node:url";
import { CHAT_ERRORS, GEMINI_API_KEY_NAME, MISSING_API_KEY_MESSAGE } from "./chat";
import { buildChatFunctionSource, CHAT_FUNCTION_PATH } from "./chat-function-source";
import { EMPTY_GRAPH } from "./types";

const TEST_KEY = "test-key";
const MODEL_REPLY = JSON.stringify({ assistantMessage: "ok", changes: [] });
const FUNCTION_URL = "https://project.supabase.co/functions/v1/chat";

type Handler = (request: Request) => Promise<Response>;

const functionDirectory = mkdtempSync(path.join(tmpdir(), "familytree-chat-function-"));
const environment: Record<string, string | undefined> = {};
const realFetch = globalThis.fetch;
let handler: Handler;

/** Loads the generated Edge Function with a stand-in for the Deno globals it uses. */
before(async () => {
  const file = path.join(functionDirectory, "chat.mjs");
  writeFileSync(file, buildChatFunctionSource(), "utf8");
  Object.assign(globalThis, {
    Deno: {
      env: { get: (name: string) => environment[name] },
      serve: (served: Handler) => {
        handler = served;
      },
    },
  });
  await import(pathToFileURL(file).href);
});

after(() => {
  globalThis.fetch = realFetch;
  delete (globalThis as { Deno?: unknown }).Deno;
  rmSync(functionDirectory, { recursive: true, force: true });
});

function post(body: BodyInit, apiKey = TEST_KEY): Promise<Response> {
  environment[GEMINI_API_KEY_NAME] = apiKey;
  return handler(new Request(FUNCTION_URL, { method: "POST", body }));
}

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

async function errorOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: string }).error;
}

test("the browser's CORS preflight is answered, including the region header supabase-js adds", async () => {
  const response = await handler(new Request(FUNCTION_URL, { method: "OPTIONS" }));
  assert.equal(response.ok, true);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  assert.match(response.headers.get("Access-Control-Allow-Headers") ?? "", /x-region/);
  assert.match(response.headers.get("Access-Control-Allow-Headers") ?? "", /authorization/);
});

test("relays the model reply", async () => {
  stubGemini(geminiAnswer(MODEL_REPLY));
  const response = await post(validBody);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { reply: MODEL_REPLY });
});

test("error answers carry CORS headers so the browser can read the message", async () => {
  const response = await post("{message:hello}");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
});

test("a body that is not JSON is a 400 JSON error, not a crash", async () => {
  const response = await post("{message:hello}");
  assert.equal(response.status, 400);
  assert.equal(await errorOf(response), CHAT_ERRORS.invalidRequest);
});

test("an empty message is rejected", async () => {
  const response = await post(JSON.stringify({ message: "   ", graph: EMPTY_GRAPH }));
  assert.equal(response.status, 400);
});

test("a missing key is explained", async () => {
  const response = await post(validBody, "");
  assert.equal(response.status, 500);
  assert.equal(await errorOf(response), MISSING_API_KEY_MESSAGE);
});

test("a busy model is retried once", async () => {
  const gemini = stubGemini(new Response("busy", { status: 503 }), geminiAnswer(MODEL_REPLY));
  const response = await post(validBody);
  assert.equal(response.status, 200);
  assert.equal(gemini.calls(), 2);
});

test("a model that stays busy is reported as busy", async () => {
  stubGemini(new Response("busy", { status: 503 }));
  const response = await post(validBody);
  assert.equal(response.status, 503);
  assert.equal(await errorOf(response), CHAT_ERRORS.modelBusy);
});

test("a slow model is cut off with a timeout message", async () => {
  stubGemini(new DOMException("timed out", "TimeoutError"));
  const response = await post(validBody);
  assert.equal(response.status, 504);
  assert.equal(await errorOf(response), CHAT_ERRORS.modelTimeout);
});

test("an empty model answer is an error", async () => {
  stubGemini(Response.json({ candidates: [] }));
  const response = await post(validBody);
  assert.equal(response.status, 502);
  assert.equal(await errorOf(response), CHAT_ERRORS.emptyModelResponse);
});

test("a model that refuses the server's region says so instead of a generic failure", async () => {
  const gemini = stubGemini(
    Response.json(
      { error: { code: 400, message: "User location is not supported for the API use.", status: "FAILED_PRECONDITION" } },
      { status: 400 },
    ),
  );
  const response = await post(validBody);
  assert.equal(response.status, 502);
  assert.equal(await errorOf(response), CHAT_ERRORS.modelRegionBlocked);
  assert.equal(gemini.calls(), 1);
});

test("other model rejections stay a generic failure", async () => {
  stubGemini(Response.json({ error: { code: 400, status: "INVALID_ARGUMENT" } }, { status: 400 }));
  const response = await post(validBody);
  assert.equal(response.status, 502);
  assert.equal(await errorOf(response), CHAT_ERRORS.modelFailed);
});

test("the committed Edge Function matches its generator, so a deploy never ships stale code", () => {
  const committed = readFileSync(path.join(process.cwd(), CHAT_FUNCTION_PATH), "utf8").replace(/\r\n/g, "\n");
  assert.equal(committed, buildChatFunctionSource());
});
