/** Supabase Edge Function that relays chat requests to Gemini. */
export const CHAT_FUNCTION_NAME = "chat";

export const GEMINI_MODEL = "gemini-3.8-flash";

export const GEMINI_API_KEY_NAME = ["GEMINI", "API", "KEY"].join("_");

export const MISSING_API_KEY_MESSAGE =
  "GEMINI_API_KEY가 없습니다. Supabase 대시보드 > Edge Functions > Secrets에 넣어 주세요.";

/** Stops waiting well before the browser gives up, so the counselor gets a readable error. */
export const GEMINI_TIMEOUT_MS = 45_000;
export const GEMINI_RETRY_DELAY_MS = 1_000;
/** Overload and rate-limit answers usually clear within a second, so one retry hides most of them. */
export const GEMINI_RETRY_STATUSES: readonly number[] = [429, 500, 503];
/** Gemini's error status for requests from regions it does not serve, such as Hong Kong. */
export const GEMINI_REGION_BLOCKED_STATUS = "FAILED_PRECONDITION";

export const CHAT_ERRORS = {
  invalidRequest: "요청 형식이 올바르지 않습니다. 페이지를 새로고침한 뒤 다시 보내 주세요.",
  emptyMessage: "메시지를 입력해 주세요.",
  modelBusy: "AI 사용량이 몰려 응답하지 못했습니다. 잠시 후 다시 보내 주세요.",
  modelTimeout: "AI 응답이 너무 늦어 중단했습니다. 다시 보내 주세요.",
  modelFailed: "AI 요청에 실패했습니다. 잠시 후 다시 보내 주세요.",
  modelRegionBlocked: "AI 서비스가 지원하지 않는 지역의 서버에서 요청이 처리되어 거절되었습니다. 관리자에게 알려 주세요.",
  emptyModelResponse: "AI 응답이 비어 있습니다. 다시 보내 주세요.",
  unexpected: "요청을 처리하다 오류가 났습니다. 다시 보내 주세요.",
} as const;
