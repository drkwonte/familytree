"use client";

import { getSupabase } from "@/lib/supabase/client";
import { activeGenogramHasUnsavedChanges, closeClient, saveActiveGenogram } from "@/store/genogram-sync";
import { askToSaveChanges } from "./unsaved-changes-prompt";

/** Asks what to do with unsaved edits; a failed save keeps the counselor in the editor. */
async function confirmLeavingGenogram(): Promise<boolean> {
  if (!activeGenogramHasUnsavedChanges()) return true;
  const choice = await askToSaveChanges();
  if (choice === "cancel") return false;
  if (choice === "discard") return true;
  return saveActiveGenogram();
}

export async function returnToClientList(): Promise<void> {
  if (await confirmLeavingGenogram()) closeClient();
}

export async function signOutCounselor(): Promise<void> {
  if (!(await confirmLeavingGenogram())) return;
  closeClient();
  // Local scope ends only this browser's session; other devices stay signed in.
  await getSupabase()?.auth.signOut({ scope: "local" });
}
