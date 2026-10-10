import { type ChatReply, parseChatReply } from "./chat-changes";
import type { FamilyGraph } from "./types";

export const CHAT_ENDPOINT = "/api/chat";
const NETWORK_ERROR = "서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 보내 주세요.";

function serverFailure(status: number): string {
  return `서버가 응답하지 못했습니다(오류 ${status}). 잠시 후 다시 보내 주세요.`;
}

/** Hosts answer some failures with their own HTML page, so the body is only trusted once it parses. */
export async function readChatResponse(response: Response): Promise<{ reply: string } | { error: string }> {
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
  fetchImpl: typeof fetch = fetch,
): Promise<ChatReply> {
  let response: Response;
  try {
    response = await fetchImpl(CHAT_ENDPOINT, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, graph }),
    });
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
  const result = await readChatResponse(response);
  if ("error" in result) return { ok: false, error: result.error };
  return parseChatReply(result.reply);
}
