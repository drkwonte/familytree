import assert from "node:assert/strict";
import { CHILD_DROP_INSET, COLLATERAL_DIRECT_AIR, NODE_HALF } from "../constants";
import { type FamilyLayout, directLineIds } from "../layout";
import { findSpouseId } from "../partners";
import type { FamilyGraph } from "../types";

const PARENT_KINDS = ["parent", "adopted", "foster"];

function drawnHalf(graph: FamilyGraph, layout: FamilyLayout) {
  const direct = directLineIds(graph);
  return (personId: string) => (direct.has(personId) ? NODE_HALF : NODE_HALF * layout.collateralScale);
}

function parentIdsOf(graph: FamilyGraph, childId: string): string[] {
  return graph.edges
    .filter((edge) => edge.category === "structural" && PARENT_KINDS.includes(edge.kind) && edge.target === childId)
    .map((edge) => edge.source);
}

/**
 * Children drawn from this bar: every parent is one of the pair, and a child with one
 * recorded parent belongs to that parent's main couple.
 */
function barChildren(graph: FamilyGraph, layout: FamilyLayout, bar: FamilyLayout["coupleBars"][number]) {
  const pair = [bar.leftId, bar.rightId];
  return layout.nodes.filter((node) => {
    const parents = [...new Set(parentIdsOf(graph, node.id))];
    if (parents.length === 0 || !parents.every((id) => pair.includes(id))) return false;
    if (parents.length > 1) return true;
    const mainSpouseId = findSpouseId(graph, parents[0]);
    return mainSpouseId == null || pair.includes(mainSpouseId);
  });
}

export function assertChildrenStayOnTheirCoupleBar(graph: FamilyGraph, layout: FamilyLayout) {
  const direct = directLineIds(graph);
  for (const bar of layout.coupleBars) {
    const children = barChildren(graph, layout, bar);
    if (children.length === 0) continue;
    const left = layout.nodes.find((node) => node.id === bar.leftId)!;
    const right = layout.nodes.find((node) => node.id === bar.rightId)!;
    assert.equal(left.x, bar.leftX);
    assert.equal(right.x, bar.rightX);
    const collateral = !direct.has(bar.leftId) && !direct.has(bar.rightId);
    const inset = collateral ? CHILD_DROP_INSET * layout.collateralScale : CHILD_DROP_INSET;
    for (const child of children) {
      assert.ok(child.x >= bar.leftX + inset - 0.01, `${child.data.displayNumber} misses the left inset`);
      assert.ok(child.x <= bar.rightX - inset + 0.01, `${child.data.displayNumber} misses the right inset`);
      assert.ok(Math.abs(child.x - bar.leftX) > 1);
      assert.ok(Math.abs(child.x - bar.rightX) > 1);
      const drop = layout.childDrops.find(
        (item) => item.fromY === bar.barY && Math.abs(item.x - child.x) < 0.01 && item.toY === child.y,
      );
      assert.ok(drop, `${child.data.displayNumber} has a line from its parents' bar`);
      assert.equal(drop.fromX, undefined);
    }
  }
}

export function assertNoGlyphOverlap(graph: FamilyGraph, layout: FamilyLayout) {
  const half = drawnHalf(graph, layout);
  for (let left = 0; left < layout.nodes.length; left += 1) {
    for (let right = left + 1; right < layout.nodes.length; right += 1) {
      const a = layout.nodes[left];
      const b = layout.nodes[right];
      const overlaps =
        Math.abs(a.x - b.x) < half(a.id) + half(b.id) && Math.abs(a.y - b.y) < half(a.id) + half(b.id);
      assert.equal(overlaps, false, `${a.data.displayNumber} overlaps ${b.data.displayNumber}`);
    }
  }
}

function sharesBirthRowWithDirect(graph: FamilyGraph, personId: string, direct: Set<string>): boolean {
  return parentIdsOf(graph, personId).some((parentId) =>
    graph.edges.some(
      (other) =>
        other.category === "structural" &&
        PARENT_KINDS.includes(other.kind) &&
        other.source === parentId &&
        other.target !== personId &&
        direct.has(other.target),
    ),
  );
}

export function assertCollateralDoesNotCoverDirect(graph: FamilyGraph, layout: FamilyLayout) {
  const direct = directLineIds(graph);
  const half = drawnHalf(graph, layout);
  for (const node of layout.nodes) {
    if (direct.has(node.id) || sharesBirthRowWithDirect(graph, node.id, direct)) continue;
    const spouseId = findSpouseId(graph, node.id);
    if (spouseId && sharesBirthRowWithDirect(graph, spouseId, direct)) continue;
    for (const other of layout.nodes) {
      if (!direct.has(other.id) || node.y >= other.y) continue;
      const horizontalGap = Math.abs(node.x - other.x) - half(node.id) - half(other.id);
      const verticalGap = Math.abs(node.y - other.y) - half(node.id) - half(other.id);
      const covers = horizontalGap < 0 && verticalGap < COLLATERAL_DIRECT_AIR;
      assert.equal(covers, false, `${node.data.displayNumber} covers ${other.data.displayNumber}`);
    }
  }
}

export function assertNoDropCrossesForeignGlyph(graph: FamilyGraph, layout: FamilyLayout) {
  const half = drawnHalf(graph, layout);
  for (const drop of layout.childDrops) {
    const top = Math.min(drop.fromY, drop.toY);
    const bottom = Math.max(drop.fromY, drop.toY);
    for (const node of layout.nodes) {
      if (Math.abs(node.x - drop.x) >= half(node.id)) continue;
      if (Math.abs(node.y - drop.toY) < 1 && Math.abs(node.x - drop.x) < 1) continue;
      const nodeTop = node.y - half(node.id);
      const nodeBottom = node.y + half(node.id);
      const crosses = nodeBottom > top && nodeTop < bottom;
      assert.equal(crosses, false, `a child line crosses ${node.data.displayNumber}`);
    }
  }
}
