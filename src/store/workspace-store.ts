"use client";

import { create } from "zustand";
import type { ClientRecord } from "@/lib/storage/client-repository";

export type CounselorUser = {
  id: string;
  email: string;
};

export type AuthStatus = "loading" | "unconfigured" | "signedOut" | "signedIn";

export type GenogramStatus = "idle" | "loading" | "ready" | "error";

/** conflict: another tab or device saved newer work, so this editor must not write blindly. */
export type SaveStatus = "idle" | "saving" | "error" | "conflict";

type GenogramState = {
  activeClient: ClientRecord | null;
  genogramStatus: GenogramStatus;
  genogramError: string | null;
  revision: number;
  savedFingerprint: string | null;
  saveStatus: SaveStatus;
  saveError: string | null;
  lastSavedAt: string | null;
};

type WorkspaceStore = GenogramState & {
  authStatus: AuthStatus;
  user: CounselorUser | null;
};

export const CLOSED_GENOGRAM_STATE: GenogramState = {
  activeClient: null,
  genogramStatus: "idle",
  genogramError: null,
  revision: 0,
  savedFingerprint: null,
  saveStatus: "idle",
  saveError: null,
  lastSavedAt: null,
};

export const useWorkspaceStore = create<WorkspaceStore>(() => ({
  ...CLOSED_GENOGRAM_STATE,
  authStatus: "loading",
  user: null,
}));