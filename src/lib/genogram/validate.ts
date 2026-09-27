import type { RelativeRelation, VitalStatus } from "./types";

export function validateNewPerson(input: {
  age: string;
  vitalStatus: VitalStatus;
  hasExistingPeople: boolean;
  relation: RelativeRelation | "";
  anchorId: string;
}): string | null {
  const trimmedAge = input.age.trim();
  if (trimmedAge) {
    const age = Number(trimmedAge);
    if (!Number.isFinite(age) || age < 0) {
      return "나이를 올바르게 입력해 주세요.";
    }
  }
  if (input.hasExistingPeople) {
    if (!input.anchorId) {
      return "기준 인물을 선택해 주세요.";
    }
    if (!input.relation || input.relation === "self") {
      return "기존 인물과의 관계를 선택해 주세요.";
    }
  }
  return null;
}
