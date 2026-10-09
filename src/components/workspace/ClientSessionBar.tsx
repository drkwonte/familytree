"use client";

import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { AccountActions } from "@/components/auth/AccountActions";
import { Button } from "@/components/ui/button";
import { describeClientFields } from "@/lib/storage/client-fields";
import { useWorkspaceStore } from "@/store/workspace-store";
import { returnToClientList } from "./leave-workspace";
import { SaveControls } from "./SaveControls";

export function ClientSessionBar() {
  const client = useWorkspaceStore((state) => state.activeClient);
  const [isLeaving, setLeaving] = useState(false);

  async function handleBack() {
    setLeaving(true);
    try {
      await returnToClientList();
    } finally {
      setLeaving(false);
    }
  }

  if (!client) return null;
  const summary = describeClientFields(client);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-1.5">
      <div className="flex min-w-0 items-center gap-3">
        <Button variant="ghost" size="sm" disabled={isLeaving} onClick={() => void handleBack()}>
          <ArrowLeft />
          내담자 목록
        </Button>
        <p className="min-w-0 truncate text-sm">
          <span className="font-semibold">{client.name}</span>
          {summary ? <span className="ml-2 text-muted-foreground">{summary}</span> : null}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <SaveControls />
        <AccountActions />
      </div>
    </div>
  );
}
