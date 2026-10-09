"use client";

import { create } from "zustand";

export type UnsavedChangesChoice = "save" | "discard" | "cancel";

type PromptStore = {
  resolve: ((choice: UnsavedChangesChoice) => void) | null;
};

export const useUnsavedChangesPrompt = create<PromptStore>(() => ({ resolve: null }));

/** Opens the "save changes?" dialog and resolves with the counselor's answer. */
export function askToSaveChanges(): Promise<UnsavedChangesChoice> {
  // A prompt already on screen is answered as cancel, so two leave actions never race.
  useUnsavedChangesPrompt.getState().resolve?.("cancel");
  return new Promise((resolve) => {
    useUnsavedChangesPrompt.setState({ resolve });
  });
}

export function answerUnsavedChangesPrompt(choice: UnsavedChangesChoice): void {
  const { resolve } = useUnsavedChangesPrompt.getState();
  useUnsavedChangesPrompt.setState({ resolve: null });
  resolve?.(choice);
}
