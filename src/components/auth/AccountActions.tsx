"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { signOutCounselor } from "@/components/workspace/leave-workspace";
import { useWorkspaceStore } from "@/store/workspace-store";

export function AccountActions() {
  const email = useWorkspaceStore((state) => state.user?.email);
  const [isSigningOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOutCounselor();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="max-w-48 truncate text-sm text-muted-foreground" title={email}>
        {email}
      </span>
      <Button variant="ghost" size="sm" disabled={isSigningOut} onClick={() => void handleSignOut()}>
        <LogOut />
        로그아웃
      </Button>
    </div>
  );
}
