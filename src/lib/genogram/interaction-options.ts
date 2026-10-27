import { type EmotionalKind, type StructuralKind, isDirectionalEmotion } from "./types";

export type RelationKind = StructuralKind | EmotionalKind;

export type InteractionAction =
  | { type: "setRelation"; kind: RelationKind }
  | { type: "removeRelation" }
  | { type: "joinHousehold" }
  | { type: "leaveHousehold" };

export type InteractionOption = { id: string; label: string; action: InteractionAction };
export type InteractionOptionGroup = { label: string; options: InteractionOption[] };

export const RELATION_KIND_LABELS: Record<RelationKind, string> = {
  close: "친밀",
  distant: "소원",
  fused: "융합",
  conflict: "갈등",
  cutoff: "단절",
  fusedConflict: "융합갈등",
  focused: "과잉개입",
  physicalAbuse: "신체학대",
  sexualAbuse: "성학대",
  marriage: "결혼",
  remarriage: "재혼",
  separation: "별거",
  divorce: "이혼",
  cohabitation: "동거",
  affair: "외도",
  sameSexUnion: "동성 결합",
  parent: "친자",
  adopted: "입양",
  foster: "위탁",
  twin: "쌍둥이",
  identicalTwin: "일란성 쌍둥이",
};

/** The first menu is person A, so these hints tell which end of a one-way line each person sits on. */
const DIRECTED_HINT = "A → B";
const PARENT_HINT = "A가 부모";

const EMOTIONAL_ORDER: EmotionalKind[] = [
  "close",
  "distant",
  "fused",
  "conflict",
  "cutoff",
  "fusedConflict",
  "focused",
  "physicalAbuse",
  "sexualAbuse",
];
const COUPLE_ORDER: StructuralKind[] = [
  "marriage",
  "remarriage",
  "separation",
  "divorce",
  "cohabitation",
  "affair",
  "sameSexUnion",
];
const PARENT_ORDER: StructuralKind[] = ["parent", "adopted", "foster"];
const TWIN_ORDER: StructuralKind[] = ["twin", "identicalTwin"];

function relationOption(kind: RelationKind, hint?: string): InteractionOption {
  const label = RELATION_KIND_LABELS[kind];
  return { id: kind, label: hint ? `${label} (${hint})` : label, action: { type: "setRelation", kind } };
}

export const INTERACTION_OPTION_GROUPS: InteractionOptionGroup[] = [
  {
    label: "관계 역동",
    options: EMOTIONAL_ORDER.map((kind) => relationOption(kind, isDirectionalEmotion(kind) ? DIRECTED_HINT : undefined)),
  },
  { label: "부부 관계", options: COUPLE_ORDER.map((kind) => relationOption(kind)) },
  { label: "부모-자녀", options: PARENT_ORDER.map((kind) => relationOption(kind, PARENT_HINT)) },
  { label: "쌍둥이", options: TWIN_ORDER.map((kind) => relationOption(kind)) },
  {
    label: "지우기 · 동거 가구",
    options: [
      { id: "remove-relation", label: "관계 역동 지우기", action: { type: "removeRelation" } },
      { id: "join-household", label: "같은 동거 가구로 묶기", action: { type: "joinHousehold" } },
      { id: "leave-household", label: "동거 가구 풀기", action: { type: "leaveHousehold" } },
    ],
  },
];

const OPTIONS_BY_ID = new Map(
  INTERACTION_OPTION_GROUPS.flatMap((group) => group.options).map((option) => [option.id, option]),
);

export function findInteractionOption(id: string): InteractionOption | undefined {
  return OPTIONS_BY_ID.get(id);
}
