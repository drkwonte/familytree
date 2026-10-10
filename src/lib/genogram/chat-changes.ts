import { addHousehold, createEdgeId, isCoupleKind, personCode } from "./relations";
import {
  EMOTIONAL_KINDS,
  type EmotionalKind,
  type FamilyEdge,
  type FamilyGraph,
  STRUCTURAL_KINDS,
  type StructuralKind,
} from "./types";

/**
 * The chat model answers with these small edits instead of a whole graph, so a reply
 * stays short (and fast) however large the genogram grows, and it cannot drop people.
 * People are named by their display number, the same "인물N" the counselor types.
 */
export type ChatChange =
  | { type: "setRelation"; from: number; to: number; kind: StructuralKind | EmotionalKind; year?: number }
  | { type: "removeRelation"; from: number; to: number }
  | { type: "setHousehold"; members: number[] }
  | { type: "removeHousehold"; members: number[] };

export type ChatReply =
  | { ok: true; assistantMessage: string; changes: ChatChange[]; problems: string[] }
  | { ok: false; error: string };

const DEFAULT_ASSISTANT_MESSAGE = "가계도에 반영했습니다.";
const UNREADABLE_REPLY_ERROR = "AI 응답을 이해하지 못했습니다. 같은 요청을 다시 보내 주세요.";
const PARENT_KINDS: ReadonlySet<string> = new Set<StructuralKind>(["parent", "adopted", "foster"]);
const TWIN_KINDS: ReadonlySet<string> = new Set<StructuralKind>(["twin", "identicalTwin"]);
const RELATION_KINDS: ReadonlySet<string> = new Set<string>([...STRUCTURAL_KINDS, ...EMOTIONAL_KINDS]);
const EMOTIONAL_KIND_SET: ReadonlySet<string> = new Set<string>(EMOTIONAL_KINDS);

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPersonNumber(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function isPersonList(value: unknown): value is number[] {
  return Array.isArray(value) && value.length > 0 && value.every(isPersonNumber);
}

function readChange(value: unknown): ChatChange | null {
  if (!isRecord(value)) return null;
  const { type, from, to, kind, year, members } = value;
  if (type === "setRelation" && isPersonNumber(from) && isPersonNumber(to) && RELATION_KINDS.has(String(kind))) {
    const change: ChatChange = { type, from, to, kind: kind as StructuralKind | EmotionalKind };
    return Number.isInteger(year) ? { ...change, year: year as number } : change;
  }
  if (type === "removeRelation" && isPersonNumber(from) && isPersonNumber(to)) return { type, from, to };
  if ((type === "setHousehold" || type === "removeHousehold") && isPersonList(members)) return { type, members };
  return null;
}

export function parseChatReply(text: string): ChatReply {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: UNREADABLE_REPLY_ERROR };
  }
  if (!isRecord(parsed)) return { ok: false, error: UNREADABLE_REPLY_ERROR };
  const rawChanges = Array.isArray(parsed.changes) ? parsed.changes : [];
  const changes = rawChanges.map(readChange).filter((change): change is ChatChange => change !== null);
  const skipped = rawChanges.length - changes.length;
  const assistantMessage =
    typeof parsed.assistantMessage === "string" && parsed.assistantMessage.trim()
      ? parsed.assistantMessage.trim()
      : DEFAULT_ASSISTANT_MESSAGE;
  return {
    ok: true,
    assistantMessage,
    changes,
    problems: skipped > 0 ? [`이해하지 못한 변경 ${skipped}건은 건너뛰었습니다.`] : [],
  };
}

type Applied = { graph: FamilyGraph; problem?: string };

function personIdsByNumber(graph: FamilyGraph): Map<number, string> {
  return new Map(graph.nodes.map((node) => [node.data.displayNumber, node.id]));
}

function missingPeople(numbers: number[], ids: Map<number, string>): string | undefined {
  const missing = numbers.filter((number) => !ids.has(number));
  if (missing.length === 0) return undefined;
  return `${missing.map(personCode).join(", ")}을(를) 가계도에서 찾지 못해 건너뛰었습니다.`;
}

function joinsPair(edge: FamilyEdge, a: string, b: string): boolean {
  return (edge.source === a && edge.target === b) || (edge.source === b && edge.target === a);
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

function setRelation(graph: FamilyGraph, change: Extract<ChatChange, { type: "setRelation" }>): Applied {
  const ids = personIdsByNumber(graph);
  const problem = missingPeople([change.from, change.to], ids);
  if (problem) return { graph, problem };
  if (change.from === change.to) return { graph, problem: `${personCode(change.from)} 자신과의 관계는 표시할 수 없습니다.` };
  const source = ids.get(change.from)!;
  const target = ids.get(change.to)!;
  const category = EMOTIONAL_KIND_SET.has(change.kind) ? "emotional" : "structural";
  const existing = graph.edges.find((edge) => joinsPair(edge, source, target) && sameRelationFamily(edge, change.kind));
  // Structural lines keep their id and direction so the layout (who is the parent) does not change.
  if (existing && category === "structural") {
    const updated = { ...existing, kind: change.kind, ...(change.year !== undefined ? { year: change.year } : {}) };
    return { graph: { ...graph, edges: graph.edges.map((edge) => (edge === existing ? updated : edge)) } };
  }
  const kept = graph.edges.filter((edge) => edge !== existing);
  const added: FamilyEdge = { id: createEdgeId(), source, target, category, kind: change.kind };
  if (change.year !== undefined) added.year = change.year;
  return { graph: { ...graph, edges: [...kept, added] } };
}

function removeRelation(graph: FamilyGraph, change: Extract<ChatChange, { type: "removeRelation" }>): Applied {
  const ids = personIdsByNumber(graph);
  const problem = missingPeople([change.from, change.to], ids);
  if (problem) return { graph, problem };
  const source = ids.get(change.from)!;
  const target = ids.get(change.to)!;
  const edges = graph.edges.filter((edge) => !(edge.category === "emotional" && joinsPair(edge, source, target)));
  if (edges.length === graph.edges.length) {
    return { graph, problem: `${personCode(change.from)}과 ${personCode(change.to)} 사이에 지울 관계선이 없습니다.` };
  }
  return { graph: { ...graph, edges } };
}

function householdMembers(graph: FamilyGraph, members: number[]): { memberIds: string[]; problem?: string } {
  const ids = personIdsByNumber(graph);
  return { memberIds: members.flatMap((number) => ids.get(number) ?? []), problem: missingPeople(members, ids) };
}

function setHousehold(graph: FamilyGraph, members: number[]): Applied {
  const { memberIds, problem } = householdMembers(graph, members);
  if (problem) return { graph, problem };
  const wanted = new Set(memberIds);
  const alreadyDrawn = graph.households.some(
    (household) => household.memberIds.length === wanted.size && household.memberIds.every((id) => wanted.has(id)),
  );
  return { graph: alreadyDrawn ? graph : addHousehold(graph, memberIds) };
}

function removeHousehold(graph: FamilyGraph, members: number[]): Applied {
  const { memberIds, problem } = householdMembers(graph, members);
  if (problem) return { graph, problem };
  const households = graph.households.filter((household) => !memberIds.every((id) => household.memberIds.includes(id)));
  if (households.length === graph.households.length) return { graph, problem: "지울 동거 가구를 찾지 못했습니다." };
  return { graph: { ...graph, households } };
}

function applyChange(graph: FamilyGraph, change: ChatChange): Applied {
  switch (change.type) {
    case "setRelation":
      return setRelation(graph, change);
    case "removeRelation":
      return removeRelation(graph, change);
    case "setHousehold":
      return setHousehold(graph, change.members);
    case "removeHousehold":
      return removeHousehold(graph, change.members);
  }
}

/** Applies every change it can; each one it cannot is explained in `problems` rather than guessed at. */
export function applyChatChanges(graph: FamilyGraph, changes: ChatChange[]): { graph: FamilyGraph; problems: string[] } {
  const problems: string[] = [];
  let next = graph;
  for (const change of changes) {
    const applied = applyChange(next, change);
    next = applied.graph;
    if (applied.problem) problems.push(applied.problem);
  }
  return { graph: next, problems };
}
