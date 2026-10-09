import type { AppSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { ClientFields } from "./client-fields";

export type ClientRecord = ClientFields & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

type ClientRow = Omit<Database["public"]["Tables"]["clients"]["Row"], "counselor_id">;

const CLIENT_COLUMNS = "id,name,age,birth_year,created_at,updated_at";

export function toClientRecord(row: ClientRow): ClientRecord {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    birthYear: row.birth_year,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toClientRow(fields: ClientFields) {
  return { name: fields.name, age: fields.age, birth_year: fields.birthYear };
}

export async function listClients(supabase: AppSupabaseClient): Promise<ClientRecord[]> {
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(toClientRecord);
}

/** The counselor_id defaults to the signed-in user in the database, so it is never sent. */
export async function createClient(supabase: AppSupabaseClient, fields: ClientFields): Promise<ClientRecord> {
  const { data, error } = await supabase.from("clients").insert(toClientRow(fields)).select(CLIENT_COLUMNS).single();
  if (error) throw error;
  return toClientRecord(data);
}

export async function updateClient(
  supabase: AppSupabaseClient,
  id: string,
  fields: ClientFields,
): Promise<ClientRecord> {
  const { data, error } = await supabase
    .from("clients")
    .update(toClientRow(fields))
    .eq("id", id)
    .select(CLIENT_COLUMNS)
    .single();
  if (error) throw error;
  return toClientRecord(data);
}

/** Deleting a client cascades to its genogram in the database. */
export async function deleteClient(supabase: AppSupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}
