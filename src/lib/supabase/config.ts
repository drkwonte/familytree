export type SupabaseConfig = {
  url: string;
  publishableKey: string;
};

// NEXT_PUBLIC_* values are inlined at build time, so they must be read with literal property access.
export function readSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) return null;
  return { url: url.replace(/\/+$/, ""), publishableKey };
}
