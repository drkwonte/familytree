import { GEMINI_SYSTEM_PROMPT } from "./gemini-prompt";

export const GEMINI_MODEL = "gemini-3.8-flash";
const GEMINI_GENERATE_CONTENT_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export const MISSING_API_KEY_MESSAGE =
  "GEMINI_API_KEY가 없습니다. 로컬은 .env.local, Cloudflare는 프로젝트 환경 변수에 넣어 주세요.";

export const GEMINI_API_KEY_NAME = ["GEMINI", "API", "KEY"].join("_");

/** Stops waiting well before the browser or Cloudflare gives up, so the counselor gets a readable error. */
export const GEMINI_TIMEOUT_MS = 45_000;
export const GEMINI_RETRY_DELAY_MS = 1_000;
/** Overload and rate-limit answers usually clear within a second, so one retry hides most of them. */
export const GEMINI_RETRY_STATUSES: readonly number[] = [429, 500, 503];

export const CHAT_ERRORS = {
  invalidRequest: "요청 형식이 올바르지 않습니다. 페이지를 새로고침한 뒤 다시 보내 주세요.",
  emptyMessage: "메시지를 입력해 주세요.",
  modelBusy: "AI 사용량이 몰려 응답하지 못했습니다. 잠시 후 다시 보내 주세요.",
  modelTimeout: "AI 응답이 너무 늦어 중단했습니다. 다시 보내 주세요.",
  modelFailed: "AI 요청에 실패했습니다. 잠시 후 다시 보내 주세요.",
  emptyModelResponse: "AI 응답이 비어 있습니다. 다시 보내 주세요.",
  unexpected: "요청을 처리하다 오류가 났습니다. 다시 보내 주세요.",
} as const;

export function readGeminiApiKey(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return undefined;
}

export function parseEnvFileValue(source: string, name: string): string | undefined {
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;
    if (line.slice(0, separatorIndex).trim() !== name) continue;
    return line.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
  }
  return undefined;
}

type ChatRequest = { message: string; graph: unknown };

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function readChatRequest(request: Request): Promise<ChatRequest | null> {
  try {
    const body = (await request.json()) as Partial<ChatRequest> | null;
    if (!body || typeof body.message !== "string" || typeof body.graph !== "object" || body.graph === null) {
      return null;
    }
    return { message: body.message, graph: body.graph };
  } catch {
    return null;
  }
}

export function buildChatPrompt(graph: unknown, message: string): string {
  return `${GEMINI_SYSTEM_PROMPT}\n\n현재 가계도 JSON:\n${JSON.stringify(graph)}\n\n사용자 요청:\n${message}`;
}

function readModelText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const candidates = (payload as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
    .candidates;
  const text = candidates?.[0]?.content?.parts?.[0]?.text;
  return text?.trim() ? text : null;
}

type GeminiResult = { text: string } | { error: string; status: number };

async function requestGemini(prompt: string, apiKey: string, fetchImpl: typeof fetch): Promise<Response> {
  return fetchImpl(`${GEMINI_GENERATE_CONTENT_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
}

async function askGemini(prompt: string, apiKey: string, fetchImpl: typeof fetch): Promise<GeminiResult> {
  try {
    let response = await requestGemini(prompt, apiKey, fetchImpl);
    if (GEMINI_RETRY_STATUSES.includes(response.status)) {
      await new Promise((resolve) => setTimeout(resolve, GEMINI_RETRY_DELAY_MS));
      response = await requestGemini(prompt, apiKey, fetchImpl);
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

/**
 * Relays the counselor's request to Gemini and returns its raw reply as `{ reply }`.
 * Every failure, including a malformed request, comes back as JSON `{ error }`, never a thrown exception,
 * so the host never substitutes its own HTML error page.
 */
export async function handleChatPost(
  request: Request,
  apiKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  try {
    return await relayChat(request, apiKey, fetchImpl);
  } catch {
    return jsonError(CHAT_ERRORS.unexpected, 500);
  }
}

async function relayChat(request: Request, apiKey: string | undefined, fetchImpl: typeof fetch): Promise<Response> {
  if (!apiKey) return jsonError(MISSING_API_KEY_MESSAGE, 500);
  const body = await readChatRequest(request);
  if (!body) return jsonError(CHAT_ERRORS.invalidRequest, 400);
  if (!body.message.trim()) return jsonError(CHAT_ERRORS.emptyMessage, 400);
  const result = await askGemini(buildChatPrompt(body.graph, body.message), apiKey, fetchImpl);
  if ("error" in result) return jsonError(result.error, result.status);
  return Response.json({ reply: result.text }, { headers: { "Cache-Control": "no-store" } });
}
