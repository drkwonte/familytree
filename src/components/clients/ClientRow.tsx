"use client";

import { useState } from "react";
import { FormMessage } from "@/components/forms/FormField";
import { Button } from "@/components/ui/button";
import { type ClientFields, describeClientFields } from "@/lib/storage/client-fields";
import type { ClientRecord } from "@/lib/storage/client-repository";
import { describeError } from "@/lib/supabase/error-messages";
import { openClient } from "@/store/genogram-sync";
import { ClientForm } from "./ClientForm";

type ClientRowProps = {
  client: ClientRecord;
  onEdit: (id: string, fields: ClientFields) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

function deleteConfirmation(name: string): string {
  return `${name} 내담자를 삭제할까요? 이 내담자의 가계도도 함께 삭제되며 되돌릴 수 없습니다.`;
}

export function ClientRow({ client, onEdit, onDelete }: ClientRowProps) {
  const [isEditing, setEditing] = useState(false);
  const [isDeleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const summary = describeClientFields(client);

  async function handleEdit(fields: ClientFields) {
    await onEdit(client.id, fields);
    setEditing(false);
  }

  async function handleDelete() {
    if (!window.confirm(deleteConfirmation(client.name))) return;
    setDeleting(true);
    setFailure(null);
    try {
      await onDelete(client.id);
    } catch (cause) {
      setFailure(describeError(cause));
      setDeleting(false);
    }
  }

  if (isEditing) {
    return (
      <li className="py-3">
        <ClientForm
          idPrefix={`edit-${client.id}`}
          initial={client}
          submitLabel="수정 저장"
          onSubmit={handleEdit}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="grid gap-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{client.name}</p>
          {summary ? <p className="text-xs text-muted-foreground">{summary}</p> : null}
        </div>
        <div className="flex gap-1">
          <Button size="sm" disabled={isDeleting} onClick={() => void openClient(client)}>
            가계도 열기
          </Button>
          <Button variant="ghost" size="sm" disabled={isDeleting} onClick={() => setEditing(true)}>
            수정
          </Button>
          <Button variant="ghost" size="sm" disabled={isDeleting} onClick={() => void handleDelete()}>
            {isDeleting ? "삭제 중..." : "삭제"}
          </Button>
        </div>
      </div>
      {failure ? <FormMessage tone="error">{failure}</FormMessage> : null}
    </li>
  );
}
