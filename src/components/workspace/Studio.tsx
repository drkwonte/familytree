"use client";

import { Redo2, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { EmotionLegend } from "@/components/genogram/EmotionLegend";
import { GenogramCanvas } from "@/components/genogram/GenogramCanvas";
import { ChatPanel } from "@/components/panel/ChatPanel";
import { PersonForm } from "@/components/panel/PersonForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ExportActions } from "@/components/workspace/ExportActions";
import type { ViewMode } from "@/lib/genogram/types";
import { useFamilyStore } from "@/store/family-store";

const VIEW_MODE_EDIT: ViewMode = "edit";
const VIEW_MODE_OUTPUT: ViewMode = "final";
const SIDEBAR_FORM = "form";
const SIDEBAR_CHAT = "chat";
const INTERACTION_CHAT_LABEL = "인물 간 상호작용 추가";

const MODE_TOGGLE_ITEM_CLASS =
  "rounded-md px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90";

export function Studio() {
  const graph = useFamilyStore((state) => state.graph);
  const viewMode = useFamilyStore((state) => state.viewMode);
  const selectedPersonId = useFamilyStore((state) => state.selectedPersonId);
  const selectPerson = useFamilyStore((state) => state.selectPerson);
  const reset = useFamilyStore((state) => state.reset);
  const undo = useFamilyStore((state) => state.undo);
  const redo = useFamilyStore((state) => state.redo);
  const canUndo = useFamilyStore((state) => state.past.length > 0);
  const canRedo = useFamilyStore((state) => state.future.length > 0);
  const setViewMode = useFamilyStore((state) => state.setViewMode);
  const [sidebarPanel, setSidebarPanel] = useState(SIDEBAR_FORM);
  const [legendOpen, setLegendOpen] = useState(true);

  useEffect(() => {
    if (selectedPersonId) setSidebarPanel(SIDEBAR_FORM);
  }, [selectedPersonId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      const withModifier = event.ctrlKey || event.metaKey;
      if (!withModifier) return;
      if (event.key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }
      if (event.key === "z" && event.shiftKey) {
        event.preventDefault();
        redo();
        return;
      }
      if (event.key === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, undo]);

  return (
    <div className="flex h-svh max-h-svh flex-col overflow-hidden">
      <header className="z-20 shrink-0 border-b bg-background">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-4 px-6 py-2">
          <h1 className="text-3xl font-bold tracking-tight">가계도 메이커</h1>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ExportActions graph={graph} viewMode={viewMode} />
            <Button variant="ghost" size="sm" disabled={!canUndo} onClick={undo}>
              <Undo2 />
              되돌리기
            </Button>
            <Button variant="ghost" size="sm" disabled={!canRedo} onClick={redo}>
              <Redo2 />
              다시 실행
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>
              캔버스 지우기
            </Button>
            <span className="text-sm font-medium text-muted-foreground">모드변경</span>
            <ToggleGroup
              value={[viewMode]}
              variant="outline"
              spacing={0}
              className="rounded-lg border p-0.5"
              onValueChange={(values) => {
                const next = values[0];
                if (next === VIEW_MODE_EDIT || next === VIEW_MODE_OUTPUT) {
                  setViewMode(next);
                }
              }}
            >
              <ToggleGroupItem value={VIEW_MODE_EDIT} className={MODE_TOGGLE_ITEM_CLASS}>
                편집화면
              </ToggleGroupItem>
              <ToggleGroupItem value={VIEW_MODE_OUTPUT} className={MODE_TOGGLE_ITEM_CLASS}>
                출력화면
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-rows-2 overflow-hidden lg:grid-cols-[420px_minmax(0,1fr)] lg:grid-rows-1">
        <aside className="flex min-h-0 flex-col overflow-hidden border-r bg-sidebar">
          {sidebarPanel === SIDEBAR_CHAT ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-5">
              <div className="flex shrink-0 items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">{INTERACTION_CHAT_LABEL}</h3>
                <Button variant="outline" size="sm" onClick={() => setSidebarPanel(SIDEBAR_FORM)}>
                  인물 폼
                </Button>
              </div>
              <ChatPanel />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-5">
              <Button className="shrink-0" onClick={() => setSidebarPanel(SIDEBAR_CHAT)}>
                {INTERACTION_CHAT_LABEL}
              </Button>
              <PersonForm />
            </div>
          )}
        </aside>
        <main className="flex min-h-0 flex-col overflow-hidden bg-[var(--genogram-paper)]">
          <div className="min-h-0 flex-1 overflow-hidden">
            <GenogramCanvas graph={graph} viewMode={viewMode} onSelectPerson={selectPerson} />
          </div>
          <div className="shrink-0 border-t bg-[var(--genogram-paper)]">
            <div className="flex items-center justify-between gap-3 px-4 py-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                {legendOpen ? "범례" : "범례가 숨겨져 있습니다"}
              </p>
              <Button variant="ghost" size="sm" onClick={() => setLegendOpen((open) => !open)}>
                {legendOpen ? "숨기기" : "보기"}
              </Button>
            </div>
            {legendOpen ? (
              <>
                <EmotionLegend />
                <Card className="mx-4 mb-4 border-dashed">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">읽는 법</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    사각형은 남성, 원은 여성, 이중 테두리는 내담자입니다. 관계 역동은 선 기호와 아래 범례를
                    따릅니다.
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
