"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadFamilyGraph, printFamilyGraph } from "@/lib/genogram/export-image";
import type { FamilyGraph, ViewMode } from "@/lib/genogram/types";

type ExportActionsProps = {
  graph: FamilyGraph;
  viewMode: ViewMode;
};

type ExportAction = "print" | "save";

export function ExportActions({ graph, viewMode }: ExportActionsProps) {
  const [isBusy, setBusy] = useState(false);
  const canExport = graph.nodes.length > 0 && !isBusy;

  async function handleExport(action: ExportAction) {
    if (!canExport) return;
    setBusy(true);
    try {
      if (action === "print") {
        printFamilyGraph(graph, viewMode);
        return;
      }
      await downloadFamilyGraph(graph, viewMode, "png");
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "내보내기에 실패했습니다.";
      window.alert(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={!canExport}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        내보내기
        <ChevronDown />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-28">
        <DropdownMenuItem onClick={() => void handleExport("print")}>출력</DropdownMenuItem>
        <DropdownMenuItem onClick={() => void handleExport("save")}>저장</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
