export const PASSWORD_MIN_LENGTH = 8;
// Bcrypt, which Supabase Auth uses, ignores bytes past 72, so longer passwords give a false sense of strength.
export const PASSWORD_MAX_LENGTH = 72;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CredentialErrors = Partial<Record<"email" | "password" | "passwordConfirm", string>>;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): string | undefined {
  const normalized = normalizeEmail(email);
  if (!normalized) return "이메일을 입력해 주세요.";
  if (!EMAIL_PATTERN.test(normalized)) return "이메일 형식이 올바르지 않습니다.";
  return undefined;
}

export function validateNewPassword(password: string, confirmation: string): CredentialErrors {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { password: `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.` };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { password: `비밀번호는 ${PASSWORD_MAX_LENGTH}자 이하여야 합니다.` };
  }
  if (password !== confirmation) return { passwordConfirm: "비밀번호가 서로 일치하지 않습니다." };
  return {};
}

export function hasErrors(errors: object): boolean {
  return Object.values(errors).some(Boolean);
}
