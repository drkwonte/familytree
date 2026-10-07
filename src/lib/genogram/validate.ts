import type { RelativeRelation, VitalStatus } from "./types";

const SIBLING_RELATIONS = new Set<RelativeRelation>(["brother", "sister", "sibling"]);

export const SIBLING_NEEDS_PARENT_MESSAGE =
  "부모를 먼저 입력한 후 형제를 입력해 주세요.";

function isSiblingRelation(relation: RelativeRelation | ""): boolean {
  return relation !== "" && SIBLING_RELATIONS.has(relation);
}

export function validateNewPerson(input: {
  age: string;
  vitalStatus: VitalStatus;
  hasExistingPeople: boolean;
  relation: RelativeRelation | "";
  anchorId: string;
  anchorHasParent?: boolean;
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
    if (isSiblingRelation(input.relation) && !input.anchorHasParent) {
      return SIBLING_NEEDS_PARENT_MESSAGE;
    }
  }
  return null;
}
