"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AccountActions } from "@/components/auth/AccountActions";
import { FormMessage } from "@/components/forms/FormField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ClientFields } from "@/lib/storage/client-fields";
import {
  type ClientRecord,
  createClient,
  deleteClient,
  listClients,
  updateClient,
} from "@/lib/storage/client-repository";
import { describeError } from "@/lib/supabase/error-messages";
import { requireSupabase } from "@/lib/supabase/client";
import { openClient } from "@/store/genogram-sync";
import { ClientForm } from "./ClientForm";
import { ClientRow } from "./ClientRow";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready" };

function matchesSearch(client: ClientRecord, search: string): boolean {
  return client.name.toLocaleLowerCase("ko").includes(search.trim().toLocaleLowerCase("ko"));
}

function useClientList() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    Promise.resolve()
      .then(() => listClients(requireSupabase()))
      .then(
        (loaded) => {
          if (!isCurrent) return;
          setClients(loaded);
          setLoadState({ status: "ready" });
        },
        (cause: unknown) => {
          if (isCurrent) setLoadState({ status: "error", message: describeError(cause) });
        },
      );
    return () => {
      isCurrent = false;
    };
  }, [loadAttempt]);

  const reload = useCallback(() => {
    setLoadState({ status: "loading" });
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  const add = useCallback(async (fields: ClientFields) => {
    const created = await createClient(requireSupabase(), fields);
    setClients((previous) => [created, ...previous]);
    return created;
  }, []);

  const edit = useCallback(async (id: string, fields: ClientFields) => {
    const updated = await updateClient(requireSupabase(), id, fields);
    setClients((previous) => previous.map((client) => (client.id === id ? updated : client)));
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteClient(requireSupabase(), id);
    setClients((previous) => previous.filter((client) => client.id !== id));
  }, []);

  return { clients, loadState, reload, add, edit, remove };
}

export function ClientDirectory() {
  const { clients, loadState, reload, add, edit, remove } = useClientList();
  const [search, setSearch] = useState("");
  const visibleClients = useMemo(
    () => clients.filter((client) => matchesSearch(client, search)),
    [clients, search],
  );

  async function handleCreate(fields: ClientFields) {
    const created = await add(fields);
    await openClient(created);
  }

  return (
    <div className="flex min-h-svh flex-col bg-[var(--genogram-paper)]">
      <header className="border-b bg-background">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-4 px-6 py-2">
          <h1 className="text-3xl font-bold tracking-tight">가계도 메이커</h1>
          <AccountActions />
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-3xl gap-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>새 내담자</CardTitle>
          </CardHeader>
          <CardContent>
            <ClientForm idPrefix="new-client" initial={null} submitLabel="추가하고 가계도 열기" onSubmit={handleCreate} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="grid-cols-[1fr_auto] items-center">
            <CardTitle>내담자 목록</CardTitle>
            <Input
              aria-label="이름으로 찾기"
              placeholder="이름으로 찾기"
              className="w-48"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </CardHeader>
          <CardContent>
            <ClientListBody
              loadState={loadState}
              clients={visibleClients}
              hasAnyClient={clients.length > 0}
              onRetry={reload}
              onEdit={edit}
              onDelete={remove}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

type ClientListBodyProps = {
  loadState: LoadState;
  clients: ClientRecord[];
  hasAnyClient: boolean;
  onRetry: () => void;
  onEdit: (id: string, fields: ClientFields) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

function ClientListBody({ loadState, clients, hasAnyClient, onRetry, onEdit, onDelete }: ClientListBodyProps) {
  if (loadState.status === "loading") return <p className="text-sm text-muted-foreground">불러오는 중...</p>;
  if (loadState.status === "error") {
    return (
      <div className="grid gap-3">
        <FormMessage tone="error">{loadState.message}</FormMessage>
        <Button variant="outline" size="sm" className="justify-self-start" onClick={onRetry}>
          다시 시도
        </Button>
      </div>
    );
  }
  if (!hasAnyClient) {
    return <p className="text-sm text-muted-foreground">아직 내담자가 없습니다. 위에서 내담자를 추가하세요.</p>;
  }
  if (clients.length === 0) return <p className="text-sm text-muted-foreground">검색 결과가 없습니다.</p>;
  return (
    <ul className="divide-y">
      {clients.map((client) => (
        <ClientRow key={client.id} client={client} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </ul>
  );
}
