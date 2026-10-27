"use client";

import { create } from "zustand";
import { addRelative, deletePerson, ensureDisplayNumbers, updatePerson } from "@/lib/genogram/relations";
import { removeEmotionalLine } from "@/lib/genogram/interactions";
import { pushGraphHistory, redoGraphChange, snapshotGraph, undoGraphChange } from "@/lib/genogram/history";
import {
  type CollateralScale,
  EMPTY_GRAPH,
  type FamilyGraph,
  type Gender,
  type PersonData,
  type RelativeRelation,
  type ViewMode,
  type VitalStatus,
} from "@/lib/genogram/types";

type AddPersonInput = {
  name: string;
  gender: Gender;
  vitalStatus: VitalStatus;
  age?: number;
  birthYear?: number;
  deathYear?: number;
  occupation?: string;
  tags: string[];
  isIndexPerson: boolean;
  anchorId?: string;
  relation: RelativeRelation;
};

type FamilyStore = {
  graph: FamilyGraph;
  past: FamilyGraph[];
  future: FamilyGraph[];
  viewMode: ViewMode;
  selectedPersonId: string | null;
  selectPerson: (personId: string | null) => void;
  addPerson: (input: AddPersonInput) => void;
  updatePerson: (personId: string, patch: Partial<PersonData>) => void;
  deletePerson: (personId: string) => void;
  deleteRelationLine: (lineId: string) => void;
  replaceGraph: (graph: FamilyGraph) => void;
  /** Opens a saved genogram; undo history belongs to the previous client, so it starts fresh. */
  loadGraph: (graph: FamilyGraph) => void;
  reset: () => void;
  setCollateralScale: (scale: CollateralScale) => void;
  undo: () => void;
  redo: () => void;
  setViewMode: (mode: ViewMode) => void;
};

/** The collateral size is a drawing choice for this genogram, so rebuilding its people must not reset it. */
function keepCollateralScale(next: FamilyGraph, current: FamilyGraph): FamilyGraph {
  const collateralScale = next.collateralScale ?? current.collateralScale;
  return collateralScale === undefined ? next : { ...next, collateralScale };
}

function keepSelection(selectedPersonId: string | null, graph: FamilyGraph): string | null {
  if (!selectedPersonId) return null;
  return graph.nodes.some((node) => node.id === selectedPersonId) ? selectedPersonId : null;
}

export const useFamilyStore = create<FamilyStore>((set) => ({
  graph: snapshotGraph(EMPTY_GRAPH),
  past: [],
  future: [],
  viewMode: "edit",
  selectedPersonId: null,
  loadGraph: (graph) =>
    set({
      graph: ensureDisplayNumbers(snapshotGraph(graph)),
      past: [],
      future: [],
      selectedPersonId: null,
    }),
  selectPerson: (personId) => set({ selectedPersonId: personId }),
  addPerson: (input) =>
    set((state) => ({
      past: pushGraphHistory(state.past, state.graph),
      future: [],
      graph: addRelative(state.graph, input),
    })),
  updatePerson: (personId, patch) =>
    set((state) => ({
      past: pushGraphHistory(state.past, state.graph),
      future: [],
      graph: updatePerson(state.graph, personId, patch),
    })),
  deletePerson: (personId) =>
    set((state) => {
      const graph = deletePerson(state.graph, personId);
      return {
        past: pushGraphHistory(state.past, state.graph),
        future: [],
        graph,
        selectedPersonId: keepSelection(state.selectedPersonId, graph),
      };
    }),
  deleteRelationLine: (lineId) =>
    set((state) => {
      const graph = removeEmotionalLine(state.graph, lineId);
      if (graph === state.graph) return state;
      return { past: pushGraphHistory(state.past, state.graph), future: [], graph };
    }),
  replaceGraph: (graph) =>
    set((state) => ({
      past: pushGraphHistory(state.past, state.graph),
      future: [],
      graph: ensureDisplayNumbers(keepCollateralScale(graph, state.graph)),
      selectedPersonId: keepSelection(state.selectedPersonId, graph),
    })),
  reset: () =>
    set((state) => ({
      past: pushGraphHistory(state.past, state.graph),
      future: [],
      graph: keepCollateralScale(snapshotGraph(EMPTY_GRAPH), state.graph),
      selectedPersonId: null,
    })),
  setCollateralScale: (collateralScale) =>
    set((state) => {
      if (state.graph.collateralScale === collateralScale) return state;
      return {
        past: pushGraphHistory(state.past, state.graph),
        future: [],
        graph: { ...state.graph, collateralScale },
      };
    }),
  undo: () =>
    set((state) => {
      const next = undoGraphChange(state.past, state.future, state.graph);
      if (!next) return state;
      return {
        ...next,
        selectedPersonId: keepSelection(state.selectedPersonId, next.graph),
      };
    }),
  redo: () =>
    set((state) => {
      const next = redoGraphChange(state.past, state.future, state.graph);
      if (!next) return state;
      return {
        ...next,
        selectedPersonId: keepSelection(state.selectedPersonId, next.graph),
      };
    }),
  setViewMode: (mode) => set({ viewMode: mode }),
}));
