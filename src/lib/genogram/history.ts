import { HISTORY_LIMIT } from "./constants";
import type { FamilyGraph } from "./types";

export function snapshotGraph(graph: FamilyGraph): FamilyGraph {
  return structuredClone(graph);
}

export function pushGraphHistory(past: FamilyGraph[], current: FamilyGraph): FamilyGraph[] {
  return [...past, snapshotGraph(current)].slice(-HISTORY_LIMIT);
}

export function undoGraphChange(
  past: FamilyGraph[],
  future: FamilyGraph[],
  current: FamilyGraph,
): { graph: FamilyGraph; past: FamilyGraph[]; future: FamilyGraph[] } | null {
  if (past.length === 0) return null;
  return {
    graph: past[past.length - 1],
    past: past.slice(0, -1),
    future: [snapshotGraph(current), ...future],
  };
}

export function redoGraphChange(
  past: FamilyGraph[],
  future: FamilyGraph[],
  current: FamilyGraph,
): { graph: FamilyGraph; past: FamilyGraph[]; future: FamilyGraph[] } | null {
  if (future.length === 0) return null;
  return {
    graph: future[0],
    past: pushGraphHistory(past, current),
    future: future.slice(1),
  };
}
