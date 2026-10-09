export type AuthRedirect = {
  isPasswordRecovery: boolean;
  error: { code: string | null; description: string } | null;
};

const RECOVERY_TYPE = "recovery";

/**
 * Reads the fragment Supabase Auth appends to email links. supabase-js consumes the tokens itself,
 * so this only extracts what the UI needs: whether to ask for a new password, or why the link failed.
 */
export function readAuthRedirect(hash: string): AuthRedirect {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const errorCode = params.get("error_code");
  const error = params.get("error") ?? errorCode;
  return {
    isPasswordRecovery: params.get("type") === RECOVERY_TYPE && params.has("access_token"),
    error: error ? { code: errorCode, description: params.get("error_description") ?? error } : null,
  };
}
