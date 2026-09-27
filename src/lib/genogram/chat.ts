import { GEMINI_SYSTEM_PROMPT } from "./gemini-prompt";
import type { FamilyGraph } from "./types";

export const GEMINI_MODEL = "gemini-3.8-flash";
const GEMINI_GENERATE_CONTENT_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export const MISSING_API_KEY_MESSAGE =
  "GEMINI_API_KEY가 없습니다. 로컬은 .env.local, Cloudflare는 프로젝트 환경 변수에 넣어 주세요.";

export function readGeminiApiKey(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return undefined;
}
const EMPTY_MESSAGE_ERROR = "메시지를 입력해 주세요.";
const EMPTY_MODEL_RESPONSE_ERROR = "모델 응답이 비었습니다.";
const INVALID_GRAPH_ERROR = "그래프 형식이 올바르지 않습니다.";
const JSON_PARSE_ERROR = "JSON 파싱에 실패했습니다.";

type ChatRequest = {
  message: string;
  graph: FamilyGraph;
};

type ChatModelPayload = {
  assistantMessage?: string;
  graph?: FamilyGraph;
};

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export function parseChatModelPayload(text: string):
  | { ok: true; assistantMessage: string; graph: FamilyGraph }
  | { ok: false; error: string; status: number } {
  try {
    const parsed = JSON.parse(text) as ChatModelPayload;
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

export function buildChatPrompt(graph: FamilyGraph, message: string): string {
  return `${GEMINI_SYSTEM_PROMPT}\n\n현재 가계도 JSON:\n${JSON.stringify(graph)}\n\n사용자 요청:\n${message}`;
}

function readModelText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const candidates = (payload as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
    .candidates;
  const text = candidates?.[0]?.content?.parts?.[0]?.text;
  return text?.trim() ? text : null;
}

export async function handleChatPost(
  request: Request,
  apiKey: string | undefined,
): Promise<Response> {
  if (!apiKey) {
    return jsonError(MISSING_API_KEY_MESSAGE, 500);
  }

  const body = (await request.json()) as ChatRequest;
  if (!body.message?.trim()) {
    return jsonError(EMPTY_MESSAGE_ERROR, 400);
  }

  const geminiResponse = await fetch(`${GEMINI_GENERATE_CONTENT_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: buildChatPrompt(body.graph, body.message) }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    }),
  });

  if (!geminiResponse.ok) {
    return jsonError(EMPTY_MODEL_RESPONSE_ERROR, 502);
  }

  const text = readModelText(await geminiResponse.json());
  if (!text) {
    return jsonError(EMPTY_MODEL_RESPONSE_ERROR, 502);
  }

  const parsed = parseChatModelPayload(text);
  if (!parsed.ok) {
    return jsonError(parsed.error, parsed.status);
  }

  return Response.json({
    assistantMessage: parsed.assistantMessage,
    graph: parsed.graph,
  });
}
