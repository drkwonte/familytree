import {
  CHAT_ERRORS,
  GEMINI_MODEL,
  GEMINI_RETRY_DELAY_MS,
  GEMINI_RETRY_STATUSES,
  GEMINI_TIMEOUT_MS,
  MISSING_API_KEY_MESSAGE,
} from "./chat";
import { GEMINI_SYSTEM_PROMPT } from "./gemini-prompt";

/**
 * Plain-JS twin of `handleChatPost` for the Cloudflare Pages Function, which cannot import
 * the app's TypeScript. `chat.test.ts` runs both against the same cases to keep them in step.
 * The x-familytree-api header shows a response really came from this Function, not a host error page.
 */
export function buildPagesFunctionSource(bakedApiKey: string): string {
  return `const BAKED_API_KEY = ${JSON.stringify(bakedApiKey)};
const SYSTEM_PROMPT = ${JSON.stringify(GEMINI_SYSTEM_PROMPT)};
const GEMINI_MODEL = ${JSON.stringify(GEMINI_MODEL)};
const MISSING_API_KEY_MESSAGE = ${JSON.stringify(MISSING_API_KEY_MESSAGE)};
const CHAT_ERRORS = ${JSON.stringify(CHAT_ERRORS)};
const GEMINI_TIMEOUT_MS = ${GEMINI_TIMEOUT_MS};
const GEMINI_RETRY_DELAY_MS = ${GEMINI_RETRY_DELAY_MS};
const GEMINI_RETRY_STATUSES = ${JSON.stringify(GEMINI_RETRY_STATUSES)};
const NO_STORE = { "Cache-Control": "no-store", "x-familytree-api": "1" };

function readApiKey(env) {
  const runtime = typeof env?.GEMINI_API_KEY === "string" ? env.GEMINI_API_KEY.trim() : "";
  if (runtime) return runtime;
  return typeof BAKED_API_KEY === "string" ? BAKED_API_KEY.trim() : "";
}

function jsonError(message, status) {
  return Response.json({ error: message }, { status, headers: NO_STORE });
}

async function readChatRequest(request) {
  try {
    const body = await request.json();
    if (!body || typeof body.message !== "string" || typeof body.graph !== "object" || body.graph === null) return null;
    return { message: body.message, graph: body.graph };
  } catch {
    return null;
  }
}

function readModelText(payload) {
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text?.trim() ? text : null;
}

function requestGemini(prompt, apiKey) {
  return fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent?key=" + encodeURIComponent(apiKey),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
}

async function askGemini(prompt, apiKey) {
  try {
    let response = await requestGemini(prompt, apiKey);
    if (GEMINI_RETRY_STATUSES.includes(response.status)) {
      await new Promise((resolve) => setTimeout(resolve, GEMINI_RETRY_DELAY_MS));
      response = await requestGemini(prompt, apiKey);
    }
    if (GEMINI_RETRY_STATUSES.includes(response.status)) return { error: CHAT_ERRORS.modelBusy, status: 503 };
    if (!response.ok) return { error: CHAT_ERRORS.modelFailed, status: 502 };
    const text = readModelText(await response.json());
    return text ? { text } : { error: CHAT_ERRORS.emptyModelResponse, status: 502 };
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";
    return timedOut ? { error: CHAT_ERRORS.modelTimeout, status: 504 } : { error: CHAT_ERRORS.modelFailed, status: 502 };
  }
}

async function handleChat(request, apiKey) {
  if (!apiKey) return jsonError(MISSING_API_KEY_MESSAGE, 500);
  const body = await readChatRequest(request);
  if (!body) return jsonError(CHAT_ERRORS.invalidRequest, 400);
  if (!body.message.trim()) return jsonError(CHAT_ERRORS.emptyMessage, 400);
  const prompt = SYSTEM_PROMPT + "\\n\\n현재 가계도 JSON:\\n" + JSON.stringify(body.graph) + "\\n\\n사용자 요청:\\n" + body.message;
  const result = await askGemini(prompt, apiKey);
  if ("error" in result) return jsonError(result.error, result.status);
  return Response.json({ reply: result.text }, { headers: NO_STORE });
}

export async function onRequestPost(context) {
  try {
    return await handleChat(context.request, readApiKey(context.env));
  } catch {
    return jsonError(CHAT_ERRORS.unexpected, 500);
  }
}
`;
}
