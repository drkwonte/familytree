// Mirrors the check constraints on public.clients so mistakes are caught before a round trip.
export const CLIENT_NAME_MAX_LENGTH = 50;
export const CLIENT_AGE_MIN = 0;
export const CLIENT_AGE_MAX = 150;
export const CLIENT_BIRTH_YEAR_MIN = 1850;
// Age and birth year can legitimately differ by one depending on whether the birthday has passed.
const AGE_BIRTH_YEAR_TOLERANCE = 1;

export type ClientFieldsDraft = {
  name: string;
  age: string;
  birthYear: string;
};

export type ClientFields = {
  name: string;
  age: number | null;
  birthYear: number | null;
};

export type ClientFieldErrors = Partial<Record<keyof ClientFieldsDraft, string>>;

export type ClientFieldsValidation =
  | { ok: true; value: ClientFields }
  | { ok: false; errors: ClientFieldErrors };

type IntegerParse = { ok: true; value: number | null } | { ok: false };

function parseOptionalInteger(text: string): IntegerParse {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!/^\d+$/.test(trimmed)) return { ok: false };
  return { ok: true, value: Number(trimmed) };
}

function validateName(name: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return "이름을 입력해 주세요.";
  if (trimmed.length > CLIENT_NAME_MAX_LENGTH) return `이름은 ${CLIENT_NAME_MAX_LENGTH}자 이내로 입력해 주세요.`;
  return undefined;
}

function isWithin(value: number | null, min: number, max: number): boolean {
  return value === null || (value >= min && value <= max);
}

function ageMatchesBirthYear(age: number | null, birthYear: number | null, currentYear: number): boolean {
  if (age === null || birthYear === null) return true;
  return Math.abs(currentYear - birthYear - age) <= AGE_BIRTH_YEAR_TOLERANCE;
}

export function validateClientFields(draft: ClientFieldsDraft, currentYear: number): ClientFieldsValidation {
  const errors: ClientFieldErrors = {};
  const nameError = validateName(draft.name);
  if (nameError) errors.name = nameError;

  const age = parseOptionalInteger(draft.age);
  if (!age.ok || !isWithin(age.value, CLIENT_AGE_MIN, CLIENT_AGE_MAX)) {
    errors.age = `나이는 ${CLIENT_AGE_MIN}~${CLIENT_AGE_MAX} 사이 숫자로 입력해 주세요.`;
  }
  const birthYear = parseOptionalInteger(draft.birthYear);
  if (!birthYear.ok || !isWithin(birthYear.value, CLIENT_BIRTH_YEAR_MIN, currentYear)) {
    errors.birthYear = `출생연도는 ${CLIENT_BIRTH_YEAR_MIN}~${currentYear} 사이로 입력해 주세요.`;
  }
  if (Object.keys(errors).length > 0 || !age.ok || !birthYear.ok) return { ok: false, errors };

  if (!ageMatchesBirthYear(age.value, birthYear.value, currentYear)) {
    return { ok: false, errors: { birthYear: "나이와 출생연도가 서로 맞지 않습니다." } };
  }
  return { ok: true, value: { name: draft.name.trim(), age: age.value, birthYear: birthYear.value } };
}

function optionalNumberText(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

export function toClientFieldsDraft(fields: ClientFields | null): ClientFieldsDraft {
  return {
    name: fields?.name ?? "",
    age: optionalNumberText(fields?.age),
    birthYear: optionalNumberText(fields?.birthYear),
  };
}

export function describeClientFields(fields: ClientFields): string {
  const parts = [
    fields.age === null ? null : `${fields.age}세`,
    fields.birthYear === null ? null : `${fields.birthYear}년생`,
  ].filter((part): part is string => part !== null);
  return parts.join(" · ");
}
