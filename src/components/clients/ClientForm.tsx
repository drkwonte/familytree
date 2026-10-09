"use client";

import { type FormEvent, useState } from "react";
import { FormField, FormMessage } from "@/components/forms/FormField";
import { Button } from "@/components/ui/button";
import {
  CLIENT_AGE_MAX,
  CLIENT_AGE_MIN,
  CLIENT_BIRTH_YEAR_MIN,
  CLIENT_NAME_MAX_LENGTH,
  type ClientFieldErrors,
  type ClientFields,
  toClientFieldsDraft,
  validateClientFields,
} from "@/lib/storage/client-fields";
import { describeError } from "@/lib/supabase/error-messages";

type ClientFormProps = {
  idPrefix: string;
  initial: ClientFields | null;
  submitLabel: string;
  onSubmit: (fields: ClientFields) => Promise<void>;
  onCancel?: () => void;
};

export function ClientForm({ idPrefix, initial, submitLabel, onSubmit, onCancel }: ClientFormProps) {
  const [draft, setDraft] = useState(() => toClientFieldsDraft(initial));
  const [errors, setErrors] = useState<ClientFieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const currentYear = new Date().getFullYear();

  function patch(field: keyof typeof draft, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateClientFields(draft, currentYear);
    setErrors(result.ok ? {} : result.errors);
    if (!result.ok || isSubmitting) return;
    setSubmitting(true);
    setFailure(null);
    try {
      await onSubmit(result.value);
      if (!initial) setDraft(toClientFieldsDraft(null));
    } catch (cause) {
      setFailure(describeError(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-3" noValidate onSubmit={(event) => void handleSubmit(event)}>
      {failure ? <FormMessage tone="error">{failure}</FormMessage> : null}
      <FormField
        id={`${idPrefix}-name`}
        label="이름 *"
        maxLength={CLIENT_NAME_MAX_LENGTH}
        value={draft.name}
        error={errors.name}
        onChange={(event) => patch("name", event.target.value)}
      />
      <div className="grid grid-cols-2 gap-3">
        <FormField
          id={`${idPrefix}-age`}
          label="나이"
          inputMode="numeric"
          type="number"
          min={CLIENT_AGE_MIN}
          max={CLIENT_AGE_MAX}
          value={draft.age}
          error={errors.age}
          onChange={(event) => patch("age", event.target.value)}
        />
        <FormField
          id={`${idPrefix}-birth-year`}
          label="출생연도"
          inputMode="numeric"
          type="number"
          min={CLIENT_BIRTH_YEAR_MIN}
          max={currentYear}
          value={draft.birthYear}
          error={errors.birthYear}
          onChange={(event) => patch("birthYear", event.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
            취소
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "저장 중..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
