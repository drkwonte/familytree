import { currentSpouseIds } from "./partners";
import { nextDisplayNumber, personCode } from "./relations";
import type { FamilyGraph } from "./types";

export const SPOUSE_NOT_ADDED_MESSAGE =
  "현재 배우자는 한 명만 표시할 수 있어 추가하지 않았습니다. 기존 배우자와의 관계를 먼저 확인해 주세요.";

/**
 * Asked when a spouse is added to someone already married. A counselor often draws the
 * current family first, so the new person is most likely an ex from before.
 */
export function divorcedSpouseQuestion(graph: FamilyGraph, anchorId: string): string | null {
  if (currentSpouseIds(graph, anchorId).length === 0) return null;
  return `이미 등록된 배우자가 있습니다. 새로 추가한 ${personCode(nextDisplayNumber(graph))}은(는) 과거에 이혼한 전 배우자인가요?`;
}

/** Asked when the new person is not an ex: then the existing marriage ended and this is the remarriage. */
export function remarriageQuestion(graph: FamilyGraph, anchorId: string): string | null {
  const spouseNumbers = currentSpouseIds(graph, anchorId).flatMap(
    (id) => graph.nodes.find((node) => node.id === id)?.data.displayNumber ?? [],
  );
  if (spouseNumbers.length === 0) return null;
  const spouses = spouseNumbers.map(personCode).join("·");
  return `그렇다면 기존 배우자 ${spouses}와(과) 이혼한 뒤 ${personCode(nextDisplayNumber(graph))}과(와) 재혼한 것인가요?`;
}
