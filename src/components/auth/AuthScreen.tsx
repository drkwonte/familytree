"use client";

import { type FormEvent, type ReactNode, useState } from "react";
import { FormField, FormMessage } from "@/components/forms/FormField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type AppSupabaseClient, getSupabase } from "@/lib/supabase/client";
import {
  type CredentialErrors,
  hasErrors,
  normalizeEmail,
  validateEmail,
  validateNewPassword,
} from "@/lib/supabase/credentials";
import { describeError } from "@/lib/supabase/error-messages";

type SupabaseAuthClient = AppSupabaseClient["auth"];

type AuthMode = "signIn" | "signUp" | "reset";

export type Notice = { tone: "error" | "info"; text: string };

const MODE_COPY: Record<AuthMode, { title: string; description: string; submit: string }> = {
  signIn: { title: "로그인", description: "상담자 계정으로 로그인하세요.", submit: "로그인" },
  signUp: { title: "회원가입", description: "이메일 인증 후 사용할 수 있습니다.", submit: "가입하기" },
  reset: { title: "비밀번호 재설정", description: "가입한 이메일로 재설정 링크를 보내 드립니다.", submit: "링크 보내기" },
};

const CONFIRMATION_SENT_MESSAGE =
  "인증 메일을 보냈습니다. 메일의 링크를 누르면 로그인됩니다. 메일이 없다면 스팸함도 확인해 주세요.";
const RESET_SENT_MESSAGE = "비밀번호 재설정 메일을 보냈습니다. 메일의 링크를 눌러 새 비밀번호를 설정해 주세요.";

export function authRedirectUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

function validate(mode: AuthMode, email: string, password: string, confirmation: string): CredentialErrors {
  const errors: CredentialErrors = { email: validateEmail(email) };
  if (mode === "signUp") return { ...errors, ...validateNewPassword(password, confirmation) };
  if (mode === "signIn" && !password) errors.password = "비밀번호를 입력해 주세요.";
  return errors;
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-[var(--genogram-paper)] p-6">
      <h1 className="text-3xl font-bold tracking-tight">가계도 메이커</h1>
      <Card className="w-full max-w-sm">{children}</Card>
    </div>
  );
}

export function AuthScreen({ initialNotice }: { initialNotice: Notice | null }) {
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState<CredentialErrors>({});
  const [notice, setNotice] = useState<Notice | null>(initialNotice);
  const [isSubmitting, setSubmitting] = useState(false);
  const copy = MODE_COPY[mode];

  function switchMode(next: AuthMode) {
    setMode(next);
    setErrors({});
    setNotice(null);
    setPassword("");
    setConfirmation("");
  }

  async function signUp(auth: SupabaseAuthClient, address: string) {
    const { data, error } = await auth.signUp({
      email: address,
      password,
      options: { emailRedirectTo: authRedirectUrl() },
    });
    if (error) throw error;
    // With email confirmation on, an already-registered address returns a user without identities instead of an error.
    if (data.user?.identities?.length === 0) {
      throw Object.assign(new Error("User already registered"), { code: "user_already_exists" });
    }
    if (data.session) return;
    switchMode("signIn");
    setNotice({ tone: "info", text: CONFIRMATION_SENT_MESSAGE });
  }

  async function submit(auth: SupabaseAuthClient) {
    const address = normalizeEmail(email);
    if (mode === "signUp") return signUp(auth, address);
    if (mode === "reset") {
      const { error } = await auth.resetPasswordForEmail(address, { redirectTo: authRedirectUrl() });
      if (error) throw error;
      setNotice({ tone: "info", text: RESET_SENT_MESSAGE });
      return;
    }
    const { error } = await auth.signInWithPassword({ email: address, password });
    if (error) throw error;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(mode, email, password, confirmation);
    setErrors(nextErrors);
    const supabase = getSupabase();
    if (hasErrors(nextErrors) || !supabase || isSubmitting) return;
    setSubmitting(true);
    setNotice(null);
    try {
      await submit(supabase.auth);
    } catch (cause) {
      setNotice({ tone: "error", text: describeError(cause) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" noValidate onSubmit={(event) => void handleSubmit(event)}>
          {notice ? <FormMessage tone={notice.tone}>{notice.text}</FormMessage> : null}
          <FormField
            id="auth-email"
            label="이메일"
            type="email"
            autoComplete="email"
            value={email}
            error={errors.email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {mode === "reset" ? null : (
            <FormField
              id="auth-password"
              label="비밀번호"
              type="password"
              autoComplete={mode === "signUp" ? "new-password" : "current-password"}
              value={password}
              error={errors.password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
          {mode === "signUp" ? (
            <FormField
              id="auth-password-confirm"
              label="비밀번호 확인"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              error={errors.passwordConfirm}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          ) : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "처리 중..." : copy.submit}
          </Button>
          <AuthModeLinks mode={mode} onChange={switchMode} />
        </form>
      </CardContent>
    </AuthLayout>
  );
}

function AuthModeLinks({ mode, onChange }: { mode: AuthMode; onChange: (mode: AuthMode) => void }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
      {mode === "signIn" ? null : (
        <Button type="button" variant="link" size="sm" onClick={() => onChange("signIn")}>
          로그인으로 돌아가기
        </Button>
      )}
      {mode === "signUp" ? null : (
        <Button type="button" variant="link" size="sm" onClick={() => onChange("signUp")}>
          회원가입
        </Button>
      )}
      {mode === "signIn" ? (
        <Button type="button" variant="link" size="sm" onClick={() => onChange("reset")}>
          비밀번호를 잊으셨나요?
        </Button>
      ) : null}
    </div>
  );
}
