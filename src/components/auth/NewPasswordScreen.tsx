"use client";

import { type FormEvent, useState } from "react";
import { FormField, FormMessage } from "@/components/forms/FormField";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type CredentialErrors, hasErrors, validateNewPassword } from "@/lib/supabase/credentials";
import { describeError } from "@/lib/supabase/error-messages";
import { getSupabase } from "@/lib/supabase/client";
import { AuthLayout } from "./AuthScreen";

export function NewPasswordScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState<CredentialErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateNewPassword(password, confirmation);
    setErrors(nextErrors);
    const supabase = getSupabase();
    if (hasErrors(nextErrors) || !supabase || isSubmitting) return;
    setSubmitting(true);
    setFailure(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      onDone();
    } catch (cause) {
      setFailure(describeError(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <CardHeader>
        <CardTitle>새 비밀번호 설정</CardTitle>
        <CardDescription>앞으로 로그인할 때 사용할 비밀번호를 입력하세요.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" noValidate onSubmit={(event) => void handleSubmit(event)}>
          {failure ? <FormMessage tone="error">{failure}</FormMessage> : null}
          <FormField
            id="new-password"
            label="새 비밀번호"
            type="password"
            autoComplete="new-password"
            value={password}
            error={errors.password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <FormField
            id="new-password-confirm"
            label="새 비밀번호 확인"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            error={errors.passwordConfirm}
            onChange={(event) => setConfirmation(event.target.value)}
          />
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "저장 중..." : "비밀번호 변경"}
          </Button>
        </form>
      </CardContent>
    </AuthLayout>
  );
}
