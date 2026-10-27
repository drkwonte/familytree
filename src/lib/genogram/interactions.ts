import { type InteractionAction, RELATION_KIND_LABELS, type RelationKind } from "./interaction-options";
import { addHousehold, createEdgeId, isCoupleKind, personCode } from "./relations";
import { EMOTIONAL_KINDS, type FamilyEdge, type FamilyGraph, type FamilyNode, type Household, type StructuralKind } from "./types";

/** One counselor pick from the interaction menus: person A, person B and what to draw between them. */
export type Interaction = { firstId: string; secondId: string; action: InteractionAction };

export type InteractionResult = { ok: true; graph: FamilyGraph; message: string } | { ok: false; message: string };

const MISSING_PERSON_MESSAGE = "선택한 인물을 가계도에서 찾지 못했습니다. 인물을 다시 선택해 주세요.";
const SAME_PERSON_MESSAGE = "서로 다른 두 인물을 선택해 주세요.";
const PARENT_KINDS: ReadonlySet<string> = new Set<StructuralKind>(["parent", "adopted", "foster"]);
const TWIN_KINDS: ReadonlySet<string> = new Set<StructuralKind>(["twin", "identicalTwin"]);
const EMOTIONAL_KIND_SET: ReadonlySet<string> = new Set<string>(EMOTIONAL_KINDS);

type Pair = { first: FamilyNode; second: FamilyNode; name: string };

function failure(message: string): InteractionResult {
  return { ok: false, message };
}

function joinsPair(edge: FamilyEdge, pair: Pair): boolean {
  const { first, second } = pair;
  return (
    (edge.source === first.id && edge.target === second.id) || (edge.source === second.id && edge.target === first.id)
  );
}

/** Relations of one family replace each other: a couple has one status, a parent line one kind. */
function sameRelationFamily(edge: FamilyEdge, kind: string): boolean {
  if (EMOTIONAL_KIND_SET.has(kind)) return edge.category === "emotional";
  if (edge.category !== "structural") return false;
  if (isCoupleKind(kind)) return isCoupleKind(edge.kind);
  if (PARENT_KINDS.has(kind)) return PARENT_KINDS.has(edge.kind);
  if (TWIN_KINDS.has(kind)) return TWIN_KINDS.has(edge.kind);
  return false;
}

function setRelation(graph: FamilyGraph, pair: Pair, kind: RelationKind): InteractionResult {
  const label = RELATION_KIND_LABELS[kind];
  const existing = graph.edges.find((edge) => joinsPair(edge, pair) && sameRelationFamily(edge, kind));
  if (existing?.kind === kind) return failure(`${pair.name} 사이에는 이미 ${label} 관계가 표시되어 있습니다.`);
  const message = `${pair.name} 사이에 ${label} 관계를 표시했습니다.`;
  const category = EMOTIONAL_KIND_SET.has(kind) ? "emotional" : "structural";
  // Structural lines keep their id, direction and year so the layout (who is the parent) does not change.
  if (existing && category === "structural") {
    const edges = graph.edges.map((edge) => (edge === existing ? { ...existing, kind } : edge));
    return { ok: true, graph: { ...graph, edges }, message };
  }
  const added: FamilyEdge = { id: createEdgeId(), source: pair.first.id, target: pair.second.id, category, kind };
  const kept = graph.edges.filter((edge) => edge !== existing);
  return { ok: true, graph: { ...graph, edges: [...kept, added] }, message };
}

function removeRelation(graph: FamilyGraph, pair: Pair): InteractionResult {
  const edges = graph.edges.filter((edge) => !(edge.category === "emotional" && joinsPair(edge, pair)));
  if (edges.length === graph.edges.length) return failure(`${pair.name} 사이에 지울 관계 역동이 없습니다.`);
  return { ok: true, graph: { ...graph, edges }, message: `${pair.name} 사이의 관계 역동을 지웠습니다.` };
}

function housesBoth(household: Household, pair: Pair): boolean {
  return household.memberIds.includes(pair.first.id) && household.memberIds.includes(pair.second.id);
}

/** The menus name two people at a time, so a larger household grows by joining pairs into it. */
function joinHousehold(graph: FamilyGraph, pair: Pair): InteractionResult {
  if (graph.households.some((household) => housesBoth(household, pair))) {
    return failure(`${pair.name}은(는) 이미 같은 동거 가구입니다.`);
  }
  const message = `${pair.name}을(를) 같은 동거 가구로 묶었습니다.`;
  const pairIds = [pair.first.id, pair.second.id];
  const touching = graph.households.filter((household) => pairIds.some((id) => household.memberIds.includes(id)));
  if (touching.length === 0) return { ok: true, graph: addHousehold(graph, pairIds), message };
  const [kept, ...absorbed] = touching;
  const memberIds = [...new Set([...touching.flatMap((household) => household.memberIds), ...pairIds])];
  const households = graph.households
    .filter((household) => !absorbed.includes(household))
    .map((household) => (household === kept ? { ...kept, memberIds } : household));
  return { ok: true, graph: { ...graph, households }, message };
}

function leaveHousehold(graph: FamilyGraph, pair: Pair): InteractionResult {
  const households = graph.households.filter((household) => !housesBoth(household, pair));
  if (households.length === graph.households.length) return failure(`${pair.name}이(가) 함께 속한 동거 가구가 없습니다.`);
  return { ok: true, graph: { ...graph, households }, message: `${pair.name}이(가) 함께 속한 동거 가구를 풀었습니다.` };
}

function findPair(graph: FamilyGraph, interaction: Interaction): Pair | string {
  const first = graph.nodes.find((node) => node.id === interaction.firstId);
  const second = graph.nodes.find((node) => node.id === interaction.secondId);
  if (!first || !second) return MISSING_PERSON_MESSAGE;
  if (first.id === second.id) return SAME_PERSON_MESSAGE;
  const name = `${personCode(first.data.displayNumber)}·${personCode(second.data.displayNumber)}`;
  return { first, second, name };
}

/** Applies one interaction, or explains why it cannot be drawn without touching the genogram. */
export function applyInteraction(graph: FamilyGraph, interaction: Interaction): InteractionResult {
  const pair = findPair(graph, interaction);
  if (typeof pair === "string") return failure(pair);
  const { action } = interaction;
  switch (action.type) {
    case "setRelation":
      return setRelation(graph, pair, action.kind);
    case "removeRelation":
      return removeRelation(graph, pair);
    case "joinHousehold":
      return joinHousehold(graph, pair);
    case "leaveHousehold":
      return leaveHousehold(graph, pair);
  }
}
