"use client";

import { ClientDirectory } from "@/components/clients/ClientDirectory";
import { FormMessage } from "@/components/forms/FormField";
import { Button } from "@/components/ui/button";
import { closeClient, openClient } from "@/store/genogram-sync";
import { useWorkspaceStore } from "@/store/workspace-store";
import { Studio } from "./Studio";

function GenogramLoadFailure({ message }: { message: string }) {
  const client = useWorkspaceStore((state) => state.activeClient);
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
      <FormMessage tone="error">{message}</FormMessage>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={closeClient}>
          내담자 목록
        </Button>
        <Button size="sm" disabled={!client} onClick={() => client && void openClient(client)}>
          다시 시도
        </Button>
      </div>
    </div>
  );
}

export function Workspace() {
  const hasActiveClient = useWorkspaceStore((state) => state.activeClient !== null);
  const genogramStatus = useWorkspaceStore((state) => state.genogramStatus);
  const genogramError = useWorkspaceStore((state) => state.genogramError);

  if (!hasActiveClient) return <ClientDirectory />;
  if (genogramStatus === "error") return <GenogramLoadFailure message={genogramError ?? "가계도를 불러오지 못했습니다."} />;
  if (genogramStatus !== "ready") {
    return <p className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">가계도를 불러오는 중...</p>;
  }
  return <Studio />;
}
