const NETWORK_MESSAGE = "서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.";
const SESSION_EXPIRED_MESSAGE = "로그인이 만료되었습니다. 다시 로그인해 주세요.";
const ALREADY_REGISTERED_MESSAGE = "이미 가입된 이메일입니다. 로그인하거나 비밀번호 재설정을 이용해 주세요.";
const FALLBACK_MESSAGE = "요청을 처리하지 못했습니다.";
const HTTP_UNAUTHORIZED = 401;

// Auth error codes come from Supabase Auth; numeric codes are Postgres SQLSTATEs relayed by the Data API.
const MESSAGES_BY_CODE: Record<string, string> = {
  invalid_credentials: "이메일 또는 비밀번호가 올바르지 않습니다.",
  email_not_confirmed: "이메일 인증이 아직 완료되지 않았습니다. 받은편지함의 인증 메일을 확인해 주세요.",
  user_already_exists: ALREADY_REGISTERED_MESSAGE,
  email_exists: ALREADY_REGISTERED_MESSAGE,
  weak_password: "비밀번호가 너무 약합니다. 영문, 숫자를 섞어 더 길게 입력해 주세요.",
  same_password: "이전과 다른 비밀번호를 입력해 주세요.",
  email_address_invalid: "사용할 수 없는 이메일 주소입니다.",
  signup_disabled: "현재 신규 가입이 중단되어 있습니다.",
  over_email_send_rate_limit: "메일 발송 한도를 넘었습니다. 잠시 후 다시 시도해 주세요.",
  over_request_rate_limit: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  otp_expired: "링크가 만료되었거나 이미 사용되었습니다. 다시 요청해 주세요.",
  refresh_token_not_found: SESSION_EXPIRED_MESSAGE,
  refresh_token_already_used: SESSION_EXPIRED_MESSAGE,
  session_not_found: SESSION_EXPIRED_MESSAGE,
  session_expired: SESSION_EXPIRED_MESSAGE,
  PGRST301: SESSION_EXPIRED_MESSAGE,
  PGRST303: SESSION_EXPIRED_MESSAGE,
  "23514": "저장할 수 없는 값이 포함되어 있습니다. 입력값을 확인해 주세요.",
  "42501": "이 데이터에 접근할 권한이 없습니다.",
};

type ErrorLike = { name?: unknown; code?: unknown; status?: unknown; message?: unknown };

function asErrorLike(cause: unknown): ErrorLike {
  return cause && typeof cause === "object" ? (cause as ErrorLike) : {};
}

function isNetworkFailure(error: ErrorLike): boolean {
  if (error.name === "AuthRetryableFetchError") return true;
  return typeof error.message === "string" && /failed to fetch|networkerror|load failed/i.test(error.message);
}

/** Turns Supabase Auth, Data API and network errors into a message a counselor can act on. */
export function describeError(cause: unknown): string {
  const error = asErrorLike(cause);
  const known = typeof error.code === "string" ? MESSAGES_BY_CODE[error.code] : undefined;
  if (known) return known;
  if (isNetworkFailure(error)) return NETWORK_MESSAGE;
  if (error.name === "AuthSessionMissingError" || error.status === HTTP_UNAUTHORIZED) return SESSION_EXPIRED_MESSAGE;
  if (typeof error.message === "string" && error.message) return `${FALLBACK_MESSAGE} (${error.message})`;
  return FALLBACK_MESSAGE;
}

export function describeRedirectError(code: string | null, description: string): string {
  return (code ? MESSAGES_BY_CODE[code] : undefined) ?? description;
}
