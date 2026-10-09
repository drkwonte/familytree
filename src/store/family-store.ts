"use client";

import { create } from "zustand";
import { addRelative, deletePerson, ensureDisplayNumbers, updatePerson } from "@/lib/genogram/relations";
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

export type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

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
  chat: ChatTurn[];
  isThinking: boolean;
  selectPerson: (personId: string | null) => void;
  addPerson: (input: AddPersonInput) => void;
  updatePerson: (personId: string, patch: Partial<PersonData>) => void;
  deletePerson: (personId: string) => void;
  replaceGraph: (graph: FamilyGraph, note: string) => void;
  /** Opens a saved genogram; undo history and chat belong to the previous client, so both start fresh. */
  loadGraph: (graph: FamilyGraph) => void;
  reset: () => void;
  setCollateralScale: (scale: CollateralScale) => void;
  undo: () => void;
  redo: () => void;
  setViewMode: (mode: ViewMode) => void;
  setThinking: (value: boolean) => void;
  appendChat: (turn: ChatTurn) => void;
};

function createInitialChat(): ChatTurn[] {
  return [
    {
      id: "welcome",
      role: "assistant",
      content:
        "누구와 누구 사이인지 인물 번호로 분명히 적어 주세요. 예: 인물1과 인물2 사이에 갈등 표시해줘. 인물5와 인물7 사이에 단절 표시해줘.",
    },
  ];
}

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
  chat: createInitialChat(),
  isThinking: false,
  loadGraph: (graph) =>
    set({
      graph: ensureDisplayNumbers(snapshotGraph(graph)),
      past: [],
      future: [],
      selectedPersonId: null,
      chat: createInitialChat(),
      isThinking: false,
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
  replaceGraph: (graph, note) =>
    set((state) => ({
      past: pushGraphHistory(state.past, state.graph),
      future: [],
      graph: ensureDisplayNumbers(keepCollateralScale(graph, state.graph)),
      selectedPersonId: keepSelection(state.selectedPersonId, graph),
      chat: [
        ...state.chat,
        { id: crypto.randomUUID(), role: "assistant", content: note },
      ],
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
  setThinking: (value) => set({ isThinking: value }),
  appendChat: (turn) =>
    set((state) => ({
      chat: [...state.chat, turn],
    })),
}));
