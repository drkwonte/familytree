import assert from "node:assert/strict";
import { test } from "node:test";
import { readAuthRedirect } from "./auth-redirect";
import { describeError, describeRedirectError } from "./error-messages";

test("detects a password recovery link", () => {
  const redirect = readAuthRedirect("#access_token=a&refresh_token=r&expires_in=3600&type=recovery");
  assert.deepEqual(redirect, { isPasswordRecovery: true, error: null });
});

test("does not treat a sign-up confirmation or an unrelated fragment as recovery", () => {
  assert.equal(readAuthRedirect("#access_token=a&refresh_token=r&type=signup").isPasswordRecovery, false);
  assert.deepEqual(readAuthRedirect(""), { isPasswordRecovery: false, error: null });
  assert.deepEqual(readAuthRedirect("#section-2"), { isPasswordRecovery: false, error: null });
});

test("reports why an expired email link failed", () => {
  const redirect = readAuthRedirect(
    "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid",
  );
  assert.deepEqual(redirect.error, { code: "otp_expired", description: "Email link is invalid" });
  assert.equal(describeRedirectError("otp_expired", "x"), "링크가 만료되었거나 이미 사용되었습니다. 다시 요청해 주세요.");
  assert.equal(describeRedirectError(null, "Unknown problem"), "Unknown problem");
});

test("maps Supabase errors to messages a counselor can act on", () => {
  assert.equal(
    describeError({ name: "AuthApiError", code: "invalid_credentials", status: 400 }),
    "이메일 또는 비밀번호가 올바르지 않습니다.",
  );
  assert.match(describeError({ name: "AuthRetryableFetchError", status: 0 }), /서버에 연결하지 못했습니다/);
  assert.match(describeError({ code: "", message: "TypeError: Failed to fetch" }), /서버에 연결하지 못했습니다/);
  assert.match(describeError({ code: "PGRST303", message: "JWT expired" }), /로그인이 만료/);
  assert.match(describeError({ code: "23514", message: "violates check" }), /입력값을 확인/);
  assert.equal(describeError(new Error("boom")), "요청을 처리하지 못했습니다. (boom)");
  assert.equal(describeError(null), "요청을 처리하지 못했습니다.");
});
