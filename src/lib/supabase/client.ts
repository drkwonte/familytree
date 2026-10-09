import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readSupabaseConfig } from "./config";
import type { Database } from "./database.types";

export type AppSupabaseClient = SupabaseClient<Database>;

const UNCONFIGURED_MESSAGE = "저장소가 설정되지 않았습니다.";

let client: AppSupabaseClient | null | undefined;

/** Browser-only singleton; returns null when the Supabase environment variables are missing. */
export function getSupabase(): AppSupabaseClient | null {
  if (client !== undefined) return client;
  const config = readSupabaseConfig();
  client = config ? createClient<Database>(config.url, config.publishableKey) : null;
  return client;
}

export function requireSupabase(): AppSupabaseClient {
  const configured = getSupabase();
  if (!configured) throw new Error(UNCONFIGURED_MESSAGE);
  return configured;
}
