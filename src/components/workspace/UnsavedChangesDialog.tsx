"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { answerUnsavedChangesPrompt, useUnsavedChangesPrompt } from "./unsaved-changes-prompt";

export function UnsavedChangesDialog() {
  const isOpen = useUnsavedChangesPrompt((state) => state.resolve !== null);

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) answerUnsavedChangesPrompt("cancel");
      }}
    >
      <AlertDialogContent>
        <AlertDialogTitle>바뀐 내용을 저장하시겠습니까?</AlertDialogTitle>
        <AlertDialogDescription>저장하지 않으면 마지막으로 저장한 뒤 바꾼 내용이 사라집니다.</AlertDialogDescription>
        <AlertDialogFooter>
          <Button variant="ghost" onClick={() => answerUnsavedChangesPrompt("cancel")}>
            취소
          </Button>
          <Button variant="outline" onClick={() => answerUnsavedChangesPrompt("discard")}>
            저장 안 함
          </Button>
          <Button autoFocus onClick={() => answerUnsavedChangesPrompt("save")}>
            저장
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
