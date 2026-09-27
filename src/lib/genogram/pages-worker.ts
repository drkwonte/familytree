import { GEMINI_MODEL, MISSING_API_KEY_MESSAGE } from "./chat";
import { GEMINI_SYSTEM_PROMPT } from "./gemini-prompt";

const EMPTY_MESSAGE_ERROR = "메시지를 입력해 주세요.";
const EMPTY_MODEL_RESPONSE_ERROR = "모델 응답이 비었습니다.";
const INVALID_GRAPH_ERROR = "그래프 형식이 올바르지 않습니다.";
const JSON_PARSE_ERROR = "JSON 파싱에 실패했습니다.";

export function buildPagesWorkerSource(bakedApiKey: string): string {
  return `const BAKED_API_KEY = ${JSON.stringify(bakedApiKey)};
const SYSTEM_PROMPT = ${JSON.stringify(GEMINI_SYSTEM_PROMPT)};
const GEMINI_MODEL = ${JSON.stringify(GEMINI_MODEL)};
const MISSING_API_KEY_MESSAGE = ${JSON.stringify(MISSING_API_KEY_MESSAGE)};
const EMPTY_MESSAGE_ERROR = ${JSON.stringify(EMPTY_MESSAGE_ERROR)};
const EMPTY_MODEL_RESPONSE_ERROR = ${JSON.stringify(EMPTY_MODEL_RESPONSE_ERROR)};
const INVALID_GRAPH_ERROR = ${JSON.stringify(INVALID_GRAPH_ERROR)};
const JSON_PARSE_ERROR = ${JSON.stringify(JSON_PARSE_ERROR)};

function readApiKey(env) {
  const runtime = typeof env?.GEMINI_API_KEY === "string" ? env.GEMINI_API_KEY.trim() : "";
  if (runtime) return runtime;
  return typeof BAKED_API_KEY === "string" ? BAKED_API_KEY.trim() : "";
}

function jsonError(message, status) {
  return Response.json({ error: message }, { status });
}

function parseChatModelPayload(text) {
  try {
    const parsed = JSON.parse(text);
    if (!parsed.graph?.nodes || !parsed.graph.edges) {
      return { ok: false, error: INVALID_GRAPH_ERROR, status: 502 };
    }
    return {
      ok: true,
      assistantMessage: parsed.assistantMessage ?? "가계도를 업데이트했습니다.",
      graph: {
        nodes: parsed.graph.nodes,
        edges: parsed.graph.edges,
        households: parsed.graph.households ?? [],
      },
    };
  } catch {
    return { ok: false, error: JSON_PARSE_ERROR, status: 502 };
  }
}

function readModelText(payload) {
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text?.trim() ? text : null;
}

async function handleChat(request, apiKey) {
  if (!apiKey) return jsonError(MISSING_API_KEY_MESSAGE, 500);
  const body = await request.json();
  if (!body.message?.trim()) return jsonError(EMPTY_MESSAGE_ERROR, 400);

  const prompt = SYSTEM_PROMPT + "\\n\\n현재 가계도 JSON:\\n" + JSON.stringify(body.graph) + "\\n\\n사용자 요청:\\n" + body.message;
  const geminiResponse = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent?key=" + encodeURIComponent(apiKey),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
  if (!geminiResponse.ok) return jsonError(EMPTY_MODEL_RESPONSE_ERROR, 502);
  const text = readModelText(await geminiResponse.json());
  if (!text) return jsonError(EMPTY_MODEL_RESPONSE_ERROR, 502);
  const parsed = parseChatModelPayload(text);
  if (!parsed.ok) return jsonError(parsed.error, parsed.status);
  return Response.json({
    assistantMessage: parsed.assistantMessage,
    graph: parsed.graph,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/_worker.js") {
      return new Response(null, { status: 404 });
    }
    if (url.pathname === "/api/key-status") {
      const runtime = typeof env?.GEMINI_API_KEY === "string" && Boolean(env.GEMINI_API_KEY.trim());
      const baked = Boolean(BAKED_API_KEY);
      return Response.json({ hasRuntimeKey: runtime, hasBakedKey: baked });
    }
    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChat(request, readApiKey(env));
    }
    return env.ASSETS.fetch(request);
  },
};
`;
}
