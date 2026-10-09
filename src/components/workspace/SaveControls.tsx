"use client";

import { Button } from "@/components/ui/button";
import { openClient, overwriteAfterConflict, saveActiveGenogram } from "@/store/genogram-sync";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useHasUnsavedChanges } from "./use-unsaved-changes";

const SAVE_FAILED_LABEL = "저장 실패";
const CONFLICT_LABEL = "다른 곳에서 먼저 저장됨";
const CONFLICT_RELOAD_CONFIRM = "다른 창에서 저장한 최신 가계도를 불러옵니다. 이 창에서 고친 내용은 사라집니다. 계속할까요?";
const CONFLICT_OVERWRITE_CONFIRM = "이 창의 가계도로 최신 저장본을 덮어씁니다. 계속할까요?";

const timestampFormat = new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" });

function savedAtHint(lastSavedAt: string | null): string {
  return lastSavedAt ? `마지막 저장: ${timestampFormat.format(new Date(lastSavedAt))} (Ctrl+S)` : "저장 (Ctrl+S)";
}

function ConflictActions() {
  const activeClient = useWorkspaceStore((state) => state.activeClient);

  function reloadLatest() {
    if (activeClient && window.confirm(CONFLICT_RELOAD_CONFIRM)) void openClient(activeClient);
  }

  function overwrite() {
    if (window.confirm(CONFLICT_OVERWRITE_CONFIRM)) void overwriteAfterConflict();
  }

  return (
    <>
      <span role="alert" className="text-sm text-destructive">
        {CONFLICT_LABEL}
      </span>
      <Button variant="outline" size="sm" onClick={reloadLatest}>
        최신본 불러오기
      </Button>
      <Button variant="outline" size="sm" onClick={overwrite}>
        덮어쓰기
      </Button>
    </>
  );
}

function SaveFailure({ message }: { message: string | null }) {
  return (
    <span role="alert" className="max-w-64 truncate text-sm text-destructive" title={message ?? undefined}>
      {message ? `${SAVE_FAILED_LABEL}: ${message}` : SAVE_FAILED_LABEL}
    </span>
  );
}

/** Only problems get a message; an enabled save button is the cue that there is work to save. */
export function SaveControls() {
  const saveStatus = useWorkspaceStore((state) => state.saveStatus);
  const saveError = useWorkspaceStore((state) => state.saveError);
  const lastSavedAt = useWorkspaceStore((state) => state.lastSavedAt);
  const hasUnsavedChanges = useHasUnsavedChanges();
  const isSaving = saveStatus === "saving";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {saveStatus === "error" ? <SaveFailure message={saveError} /> : null}
      {saveStatus === "conflict" ? <ConflictActions /> : null}
      <Button
        size="sm"
        disabled={!hasUnsavedChanges || isSaving || saveStatus === "conflict"}
        title={savedAtHint(lastSavedAt)}
        onClick={() => void saveActiveGenogram()}
      >
        {isSaving ? "저장 중..." : "저장"}
      </Button>
    </div>
  );
}
