"use client";

import { useEffect, useMemo } from "react";
import { hasUnsavedGraph } from "@/lib/storage/stored-graph";
import { useFamilyStore } from "@/store/family-store";
import { activeGenogramHasUnsavedChanges, saveActiveGenogram } from "@/store/genogram-sync";
import { useWorkspaceStore } from "@/store/workspace-store";

export function useHasUnsavedChanges(): boolean {
  const graph = useFamilyStore((state) => state.graph);
  const savedFingerprint = useWorkspaceStore((state) => state.savedFingerprint);
  return useMemo(() => hasUnsavedGraph(graph, savedFingerprint), [graph, savedFingerprint]);
}

function isSaveShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "s";
}

/**
 * Ctrl+S (⌘S) saves, and closing or reloading the tab with unsaved edits asks first.
 * Browsers show their own fixed wording for that last prompt; pages cannot change it.
 */
export function useUnsavedChangesGuard(): void {
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (activeGenogramHasUnsavedChanges()) event.preventDefault();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isSaveShortcut(event)) return;
      event.preventDefault();
      void saveActiveGenogram();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
