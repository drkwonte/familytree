"use client";

import { EMPTY_GRAPH } from "@/lib/genogram/types";
import type { ClientRecord } from "@/lib/storage/client-repository";
import { loadGenogram, readGenogramRevision, saveGenogram, type SaveOutcome } from "@/lib/storage/genogram-repository";
import { graphFingerprint, hasUnsavedGraph } from "@/lib/storage/stored-graph";
import { describeError } from "@/lib/supabase/error-messages";
import { requireSupabase } from "@/lib/supabase/client";
import { useFamilyStore } from "./family-store";
import { CLOSED_GENOGRAM_STATE, useWorkspaceStore } from "./workspace-store";

let saveInFlight: Promise<void> | null = null;

function isActiveClient(clientId: string): boolean {
  return useWorkspaceStore.getState().activeClient?.id === clientId;
}

/** True when the open genogram holds edits that storage does not have yet. */
export function activeGenogramHasUnsavedChanges(): boolean {
  const { activeClient, genogramStatus, savedFingerprint } = useWorkspaceStore.getState();
  if (!activeClient || genogramStatus !== "ready") return false;
  return hasUnsavedGraph(useFamilyStore.getState().graph, savedFingerprint);
}

export async function openClient(client: ClientRecord): Promise<void> {
  useWorkspaceStore.setState({ ...CLOSED_GENOGRAM_STATE, activeClient: client, genogramStatus: "loading" });
  try {
    const record = await loadGenogram(requireSupabase(), client.id);
    if (!isActiveClient(client.id)) return;
    useFamilyStore.getState().loadGraph(record.graph);
    useWorkspaceStore.setState({
      genogramStatus: "ready",
      revision: record.revision,
      // Fingerprint the editor's normalized copy, so opening alone never reads as an unsaved edit.
      savedFingerprint: graphFingerprint(useFamilyStore.getState().graph),
      lastSavedAt: record.updatedAt,
    });
  } catch (cause) {
    if (!isActiveClient(client.id)) return;
    useWorkspaceStore.setState({ genogramStatus: "error", genogramError: describeError(cause) });
  }
}

function applyOutcome(outcome: SaveOutcome, fingerprint: string): void {
  if (outcome.status === "conflict") {
    useWorkspaceStore.setState({ saveStatus: "conflict", saveError: null });
    return;
  }
  useWorkspaceStore.setState({
    revision: outcome.revision,
    savedFingerprint: fingerprint,
    lastSavedAt: outcome.updatedAt,
    saveStatus: "idle",
    saveError: null,
  });
}

function markSaveFailed(cause: unknown): void {
  useWorkspaceStore.setState({ saveStatus: "error", saveError: describeError(cause) });
}

async function writeActiveGraph(): Promise<void> {
  const { activeClient, revision, saveStatus } = useWorkspaceStore.getState();
  if (!activeClient || saveStatus === "conflict" || !activeGenogramHasUnsavedChanges()) return;
  const graph = useFamilyStore.getState().graph;
  const fingerprint = graphFingerprint(graph);
  useWorkspaceStore.setState({ saveStatus: "saving", saveError: null });
  try {
    const outcome = await saveGenogram(requireSupabase(), activeClient.id, graph, revision);
    if (isActiveClient(activeClient.id)) applyOutcome(outcome, fingerprint);
  } catch (cause) {
    if (isActiveClient(activeClient.id)) markSaveFailed(cause);
  }
}

/** Serializes writes so each request carries the revision returned by the previous one. */
function runExclusive(task: () => Promise<void>): Promise<void> {
  const run = (saveInFlight ?? Promise.resolve()).then(task);
  // A failed write must not block the queue for the writes after it.
  const settled = run.catch(() => undefined);
  saveInFlight = settled;
  void settled.then(() => {
    if (saveInFlight === settled) saveInFlight = null;
  });
  return run;
}

/** Saves the open genogram; resolves true when storage matches the editor afterwards. */
export async function saveActiveGenogram(): Promise<boolean> {
  await runExclusive(writeActiveGraph);
  const { saveStatus } = useWorkspaceStore.getState();
  return saveStatus !== "conflict" && saveStatus !== "error" && !activeGenogramHasUnsavedChanges();
}

/** Keeps this editor's version by adopting the newer stored revision, then saving over it. */
export async function overwriteAfterConflict(): Promise<void> {
  const { activeClient } = useWorkspaceStore.getState();
  if (!activeClient) return;
  try {
    const revision = await readGenogramRevision(requireSupabase(), activeClient.id);
    useWorkspaceStore.setState({ revision, saveStatus: "idle", savedFingerprint: null });
    await saveActiveGenogram();
  } catch (cause) {
    markSaveFailed(cause);
  }
}

export function closeClient(): void {
  useWorkspaceStore.setState(CLOSED_GENOGRAM_STATE);
  useFamilyStore.getState().loadGraph(EMPTY_GRAPH);
}

export function updateActiveClient(client: ClientRecord): void {
  if (isActiveClient(client.id)) useWorkspaceStore.setState({ activeClient: client });
}
