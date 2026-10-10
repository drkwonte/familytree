import { FunctionRegion, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { requireSupabase } from "@/lib/supabase/client";
import { CHAT_FUNCTION_NAME } from "./chat";
import { type ChatReply, parseChatReply } from "./chat-changes";
import type { FamilyGraph } from "./types";

/**
 * Seoul is close to counselors and is served by Gemini. Pinning it keeps the call out of
 * Hong Kong, which Gemini refuses and where Cloudflare routed many Korean visitors.
 */
export const CHAT_FUNCTION_REGION = FunctionRegion.ApNortheast2;

export const SESSION_EXPIRED_MESSAGE = "로그인이 만료되었습니다. 새로고침한 뒤 다시 로그인해 주세요.";
const NETWORK_ERROR = "서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 보내 주세요.";
const HTTP_UNAUTHORIZED = 401;

export type ChatRequestBody = { message: string; graph: FamilyGraph };
export type ChatTransport = (body: ChatRequestBody) => Promise<Response>;

function serverFailure(status: number): string {
  return `서버가 응답하지 못했습니다(오류 ${status}). 잠시 후 다시 보내 주세요.`;
}

/** supabase-js parses successful bodies itself; failures keep the raw response so one reader handles both. */
async function invokeChatFunction(body: ChatRequestBody): Promise<Response> {
  const { data, error } = await requireSupabase().functions.invoke(CHAT_FUNCTION_NAME, {
    body,
    region: CHAT_FUNCTION_REGION,
  });
  if (error instanceof FunctionsHttpError || error instanceof FunctionsRelayError) return error.context as Response;
  if (error) throw error;
  return Response.json(data);
}

/** Gateways answer some failures with their own HTML page, so the body is only trusted once it parses. */
export async function readChatResponse(response: Response): Promise<{ reply: string } | { error: string }> {
  if (response.status === HTTP_UNAUTHORIZED) return { error: SESSION_EXPIRED_MESSAGE };
  let payload: unknown;
  try {
    payload = JSON.parse(await response.text());
  } catch {
    return { error: serverFailure(response.status) };
  }
  const { reply, error } = (payload ?? {}) as { reply?: unknown; error?: unknown };
  if (typeof error === "string" && error.trim()) return { error };
  if (!response.ok || typeof reply !== "string") return { error: serverFailure(response.status) };
  return { reply };
}

export async function requestChatChanges(
  message: string,
  graph: FamilyGraph,
  transport: ChatTransport = invokeChatFunction,
): Promise<ChatReply> {
  let response: Response;
  try {
    response = await transport({ message, graph });
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
  const result = await readChatResponse(response);
  if ("error" in result) return { ok: false, error: result.error };
  return parseChatReply(result.reply);
}
