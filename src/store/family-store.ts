"use client";

import { create } from "zustand";
import { addRelative, deletePerson, ensureDisplayNumbers, updatePerson } from "@/lib/genogram/relations";
import { pushGraphHistory, redoGraphChange, snapshotGraph, undoGraphChange } from "@/lib/genogram/history";
import {
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
  reset: () => void;
  undo: () => void;
  redo: () => void;
  setViewMode: (mode: ViewMode) => void;
  setThinking: (value: boolean) => void;
  appendChat: (turn: ChatTurn) => void;
};

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
  chat: [
    {
      id: "welcome",
      role: "assistant",
      content:
        "가족을 문장으로 말씀해 주세요. 예: 아버지와는 대화가 단절되었고, 어머니는 주요 의논대상이야.",
    },
  ],
  isThinking: false,
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
      graph: ensureDisplayNumbers(graph),
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
      graph: snapshotGraph(EMPTY_GRAPH),
      selectedPersonId: null,
    })),
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
