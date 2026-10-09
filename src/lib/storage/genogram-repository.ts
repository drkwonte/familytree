import type { FamilyGraph } from "@/lib/genogram/types";
import type { AppSupabaseClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import { parseStoredGraph } from "./stored-graph";

export type GenogramRecord = {
  clientId: string;
  graph: FamilyGraph;
  revision: number;
  updatedAt: string;
};

export type SaveOutcome = { status: "saved"; revision: number; updatedAt: string } | { status: "conflict" };

type SavedRow = { revision: number; updated_at: string };

const GENOGRAM_COLUMNS = "client_id,graph,revision,updated_at";
const SAVED_COLUMNS = "revision,updated_at";
const MISSING_GENOGRAM_MESSAGE = "이 내담자의 가계도를 찾을 수 없습니다.";

function toJson(graph: FamilyGraph): Json {
  return graph as unknown as Json;
}

/** Zero updated rows means the revision moved on: another tab or device saved first. */
export function toSaveOutcome(rows: SavedRow[]): SaveOutcome {
  const row = rows[0];
  if (!row) return { status: "conflict" };
  return { status: "saved", revision: row.revision, updatedAt: row.updated_at };
}

export async function loadGenogram(supabase: AppSupabaseClient, clientId: string): Promise<GenogramRecord> {
  const { data, error } = await supabase
    .from("genograms")
    .select(GENOGRAM_COLUMNS)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(MISSING_GENOGRAM_MESSAGE);
  return {
    clientId: data.client_id,
    graph: parseStoredGraph(data.graph),
    revision: data.revision,
    updatedAt: data.updated_at,
  };
}

/** Writes only when the stored revision still matches, so newer work is never silently overwritten. */
export async function saveGenogram(
  supabase: AppSupabaseClient,
  clientId: string,
  graph: FamilyGraph,
  revision: number,
): Promise<SaveOutcome> {
  const { data, error } = await supabase
    .from("genograms")
    .update({ graph: toJson(graph) })
    .eq("client_id", clientId)
    .eq("revision", revision)
    .select(SAVED_COLUMNS);
  if (error) throw error;
  return toSaveOutcome(data);
}

/** Reads only the current revision, used to take over after a save conflict. */
export async function readGenogramRevision(supabase: AppSupabaseClient, clientId: string): Promise<number> {
  const { data, error } = await supabase.from("genograms").select("revision").eq("client_id", clientId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(MISSING_GENOGRAM_MESSAGE);
  return data.revision;
}
