"use client";

import { useMemo } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { directLineIds, layoutFamily, preferredCollateralScale } from "@/lib/genogram/layout";
import { COLLATERAL_SCALE_OPTIONS, type FamilyGraph, isCollateralScale } from "@/lib/genogram/types";
import { useFamilyStore } from "@/store/family-store";

const PERCENT = 100;
const PICKER_LABEL = "방계 인물 크기";
const PICKER_HINT = "직계 인물 대비 방계 인물의 크기입니다. 간격과 자녀선도 함께 줄어듭니다.";
const SCALE_ITEM_CLASS =
  "px-2.5 tabular-nums aria-pressed:bg-primary! aria-pressed:text-primary-foreground! aria-pressed:hover:bg-primary/90!";

function asPercent(scale: number): number {
  return Math.round(scale * PERCENT);
}

function hasCollateralPeople(graph: FamilyGraph): boolean {
  const direct = directLineIds(graph);
  return graph.nodes.some((node) => !direct.has(node.id));
}

export function CollateralScalePicker({ graph }: { graph: FamilyGraph }) {
  const setCollateralScale = useFamilyStore((state) => state.setCollateralScale);
  const drawnScale = useMemo(() => layoutFamily(graph).collateralScale, [graph]);
  if (!hasCollateralPeople(graph)) return null;

  const preferred = preferredCollateralScale(graph);
  const fittedSmaller = asPercent(drawnScale) < asPercent(preferred);

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card/95 p-1 pl-3 shadow-sm" title={PICKER_HINT}>
      <span className="text-xs font-medium text-muted-foreground">{PICKER_LABEL}</span>
      <ToggleGroup
        value={[String(preferred)]}
        variant="outline"
        size="sm"
        spacing={0}
        className="rounded-md"
        onValueChange={(values) => {
          const next = Number(values[0]);
          if (isCollateralScale(next)) setCollateralScale(next);
        }}
      >
        {COLLATERAL_SCALE_OPTIONS.map((option) => (
          <ToggleGroupItem key={option} value={String(option)} className={SCALE_ITEM_CLASS}>
            {asPercent(option)}%
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {fittedSmaller ? (
        <span className="pr-2 text-xs text-amber-700">겹치지 않도록 {asPercent(drawnScale)}%로 그렸습니다</span>
      ) : null}
    </div>
  );
}
