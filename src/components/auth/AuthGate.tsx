"use client";

import type { Session } from "@supabase/supabase-js";
import { type ReactNode, useEffect, useState } from "react";
import { readAuthRedirect } from "@/lib/supabase/auth-redirect";
import { getSupabase } from "@/lib/supabase/client";
import { describeError, describeRedirectError } from "@/lib/supabase/error-messages";
import { closeClient } from "@/store/genogram-sync";
import { useWorkspaceStore } from "@/store/workspace-store";
import { AuthLayout, AuthScreen, type Notice } from "./AuthScreen";
import { NewPasswordScreen } from "./NewPasswordScreen";

const UNCONFIGURED_MESSAGE =
  "저장소 연결 정보(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)가 설정되지 않았습니다.";
const CHECKING_MESSAGE = "로그인 상태를 확인하는 중...";

// supabase-js strips the auth fragment once it has consumed it, so it is captured before the client starts.
const initialRedirect = readAuthRedirect(typeof window === "undefined" ? "" : window.location.hash);

function applySession(session: Session | null): void {
  if (!session?.user.email) {
    useWorkspaceStore.setState({ authStatus: "signedOut", user: null });
    return;
  }
  // A different counselor must never see the previous one's open genogram.
  const previousUser = useWorkspaceStore.getState().user;
  if (previousUser && previousUser.id !== session.user.id) closeClient();
  if (previousUser?.id === session.user.id && previousUser.email === session.user.email) {
    useWorkspaceStore.setState({ authStatus: "signedIn" });
    return;
  }
  useWorkspaceStore.setState({ authStatus: "signedIn", user: { id: session.user.id, email: session.user.email } });
}

function clearRedirectFromUrl(): void {
  if (!window.location.hash) return;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

function redirectErrorNotice(): Notice | null {
  const { error } = initialRedirect;
  return error ? { tone: "error", text: describeRedirectError(error.code, error.description) } : null;
}

function StatusScreen({ message }: { message: string }) {
  return (
    <AuthLayout>
      <p className="px-6 py-4 text-center text-sm text-muted-foreground">{message}</p>
    </AuthLayout>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const authStatus = useWorkspaceStore((state) => state.authStatus);
  const [isInitialized, setInitialized] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(redirectErrorNotice);
  const [isRecoveringPassword, setRecoveringPassword] = useState(initialRedirect.isPasswordRecovery);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      useWorkspaceStore.setState({ authStatus: "unconfigured" });
      return;
    }
    // Callbacks must stay synchronous: awaiting Supabase calls inside them can deadlock the auth lock.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecoveringPassword(true);
      if (event === "SIGNED_OUT") setRecoveringPassword(false);
      if (session) setNotice(null);
      applySession(session);
    });
    let isMounted = true;
    void supabase.auth.initialize().then(({ error }) => {
      if (!isMounted) return;
      if (error && !initialRedirect.error) setNotice({ tone: "error", text: describeError(error) });
      clearRedirectFromUrl();
      setInitialized(true);
    });
    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (authStatus === "unconfigured") return <StatusScreen message={UNCONFIGURED_MESSAGE} />;
  if (!isInitialized || authStatus === "loading") return <StatusScreen message={CHECKING_MESSAGE} />;
  if (authStatus === "signedOut") return <AuthScreen initialNotice={notice} />;
  if (isRecoveringPassword) return <NewPasswordScreen onDone={() => setRecoveringPassword(false)} />;
  return children;
}
