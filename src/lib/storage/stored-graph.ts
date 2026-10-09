import { type FamilyGraph, isCollateralScale } from "@/lib/genogram/types";

export class StoredGraphError extends Error {
  constructor() {
    super("저장된 가계도 형식이 올바르지 않아 불러올 수 없습니다.");
    this.name = "StoredGraphError";
  }
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasStringFields(value: unknown, keys: readonly string[]): boolean {
  return isRecord(value) && keys.every((key) => typeof value[key] === "string");
}

const isStoredNode = (value: unknown) => hasStringFields(value, ["id"]) && isRecord((value as JsonRecord).data);
const isStoredEdge = (value: unknown) => hasStringFields(value, ["id", "source", "target", "category", "kind"]);
const isStoredHousehold = (value: unknown) =>
  hasStringFields(value, ["id"]) && Array.isArray((value as JsonRecord).memberIds);

function isArrayOf(value: unknown, predicate: (item: unknown) => boolean): value is unknown[] {
  return Array.isArray(value) && value.every(predicate);
}

/** Validates graph JSON read from the database before it reaches the editor. */
export function parseStoredGraph(value: unknown): FamilyGraph {
  if (!isRecord(value)) throw new StoredGraphError();
  const households = value.households ?? [];
  if (
    !isArrayOf(value.nodes, isStoredNode) ||
    !isArrayOf(value.edges, isStoredEdge) ||
    !isArrayOf(households, isStoredHousehold)
  ) {
    throw new StoredGraphError();
  }
  const graph = { nodes: value.nodes, edges: value.edges, households } as FamilyGraph;
  // An unknown size is display-only, so it falls back to the default instead of blocking the load.
  return isCollateralScale(value.collateralScale) ? { ...graph, collateralScale: value.collateralScale } : graph;
}

/** Stable text used to tell whether the editor differs from what was last saved. */
export function graphFingerprint(graph: FamilyGraph): string {
  return JSON.stringify(graph);
}

/** True when the editor holds work that storage does not have yet. */
export function hasUnsavedGraph(graph: FamilyGraph, savedFingerprint: string | null): boolean {
  return graphFingerprint(graph) !== savedFingerprint;
}
