import {
  CANVAS_PADDING_X,
  CANVAS_PADDING_Y,
  CHILD_DROP_INSET,
  CHILD_SLOT_WIDTH,
  COLLATERAL_SIBLING_GAP,
  FOO_CLEARANCE_PASSES,
  FOO_SIDE_CLEARANCE,
  HOUSEHOLD_PAD_X,
  HOUSEHOLD_PAD_Y,
  DROP_LENGTH,
  GENERATION_GAP,
  LABEL_LINE_HEIGHT,
  MIN_COUPLE_GAP,
  NODE_HALF,
  NODE_SIZE,
  NOTE_GAP_BELOW,
  YEAR_GAP_ABOVE,
  YEAR_LABEL_BOX_HEIGHT,
} from "./constants";
import { isCoupleKind } from "./relations";
import type { FamilyEdge, FamilyGraph, FamilyNode, Gender } from "./types";

export type Point = { x: number; y: number };

export type LaidNode = FamilyNode & Point;

export type CoupleBar = {
  id: string;
  kind: FamilyEdge["kind"];
  year?: number;
  leftId: string;
  rightId: string;
  leftX: number;
  rightX: number;
  barY: number;
  leftCenterY: number;
  rightCenterY: number;
};

export type ChildDrop = {
  id: string;
  x: number;
  fromY: number;
  toY: number;
  dashed: boolean;
  fromX?: number;
  elbowY?: number;
};

export type EmotionalLink = {
  id: string;
  kind: FamilyEdge["kind"];
  label?: string;
  source: Point;
  target: Point;
};

export type HouseholdBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FamilyLayout = {
  nodes: LaidNode[];
  coupleBars: CoupleBar[];
  childDrops: ChildDrop[];
  emotional: EmotionalLink[];
  householdBoxes: HouseholdBox[];
  width: number;
  height: number;
  viewMinX: number;
  viewMinY: number;
};

function nodesById(graph: FamilyGraph): Map<string, FamilyNode> {
  return new Map(graph.nodes.map((node) => [node.id, node]));
}

function coupleOrder(a: FamilyNode, b: FamilyNode): [FamilyNode, FamilyNode] {
  const rank = (gender: Gender) => (gender === "M" ? 0 : gender === "F" ? 1 : 2);
  return rank(a.data.gender) <= rank(b.data.gender) ? [a, b] : [b, a];
}

export function findSpouseId(graph: FamilyGraph, personId: string): string | undefined {
  const edge = graph.edges.find(
    (item) =>
      item.category === "structural" &&
      isCoupleKind(item.kind) &&
      (item.source === personId || item.target === personId),
  );
  if (!edge) return undefined;
  return edge.source === personId ? edge.target : edge.source;
}

function coupleEdgeBetween(graph: FamilyGraph, a: string, b: string): FamilyEdge | undefined {
  return graph.edges.find(
    (edge) =>
      edge.category === "structural" &&
      isCoupleKind(edge.kind) &&
      ((edge.source === a && edge.target === b) || (edge.source === b && edge.target === a)),
  );
}

function parentChildEdges(graph: FamilyGraph): FamilyEdge[] {
  return graph.edges.filter(
    (edge) =>
      edge.category === "structural" &&
      ["parent", "adopted", "foster"].includes(edge.kind),
  );
}

function couplesOf(graph: FamilyGraph) {
  const nodes = nodesById(graph);
  return graph.edges
    .filter((edge) => edge.category === "structural" && isCoupleKind(edge.kind))
    .flatMap((edge) => {
      const source = nodes.get(edge.source);
      const target = nodes.get(edge.target);
      if (!source || !target) return [];
      const [left, right] = coupleOrder(source, target);
      return [{ edge, left, right }];
    });
}

function parentalCouples(graph: FamilyGraph) {
  const nodes = nodesById(graph);
  const parentsByChild = new Map<string, string[]>();
  for (const edge of parentChildEdges(graph)) {
    const parents = parentsByChild.get(edge.target) ?? [];
    if (!parents.includes(edge.source)) parents.push(edge.source);
    parentsByChild.set(edge.target, parents);
  }
  return [...parentsByChild.values()].flatMap((parentIds) => {
    if (parentIds.length < 2) return [];
    const first = nodes.get(parentIds[0]);
    const second = nodes.get(parentIds[1]);
    if (!first || !second) return [];
    const [left, right] = coupleOrder(first, second);
    const edge = coupleEdgeBetween(graph, left.id, right.id) ?? {
      id: `parent-unit-${left.id}-${right.id}`,
      source: left.id,
      target: right.id,
      category: "structural" as const,
      kind: "marriage" as const,
    };
    return [{ edge, left, right }];
  });
}

function couplesForLayout(graph: FamilyGraph) {
  const seen = new Set<string>();
  const couples: ReturnType<typeof couplesOf> = [];
  for (const couple of [...couplesOf(graph), ...parentalCouples(graph)]) {
    const key = [couple.left.id, couple.right.id].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    couples.push(couple);
  }
  return couples;
}

function couplePairKey(leftId: string, rightId: string): string {
  return [leftId, rightId].sort().join("|");
}

function coupleNestsOther(
  graph: FamilyGraph,
  parent: { left: FamilyNode; right: FamilyNode },
  childCouple: { left: FamilyNode; right: FamilyNode },
): boolean {
  return childrenOfCouple(graph, parent.left.id, parent.right.id).some(
    (child) => child.id === childCouple.left.id || child.id === childCouple.right.id,
  );
}

function rootCouplesForLayout(graph: FamilyGraph) {
  const couples = couplesForLayout(graph);
  return couples.filter(
    (couple) =>
      !couples.some(
        (other) =>
          couplePairKey(other.left.id, other.right.id) !== couplePairKey(couple.left.id, couple.right.id) &&
          coupleNestsOther(graph, other, couple),
      ),
  );
}

function compareSiblingsByAge(left: FamilyNode, right: FamilyNode): number {
  const leftYear = left.data.birthYear;
  const rightYear = right.data.birthYear;
  if (leftYear != null && rightYear != null) return leftYear - rightYear;
  const leftAge = left.data.age;
  const rightAge = right.data.age;
  if (leftAge != null && rightAge != null) return rightAge - leftAge;
  const leftKnown = leftYear != null || leftAge != null;
  const rightKnown = rightYear != null || rightAge != null;
  if (leftKnown !== rightKnown) return leftKnown ? -1 : 1;
  return left.data.displayNumber - right.data.displayNumber;
}

function childrenOfCouple(graph: FamilyGraph, leftId: string, rightId: string): FamilyNode[] {
  const children = graph.nodes.filter((node) =>
    graph.edges.some(
      (edge) =>
        edge.category === "structural" &&
        ["parent", "adopted", "foster"].includes(edge.kind) &&
        edge.target === node.id &&
        (edge.source === leftId || edge.source === rightId),
    ),
  );
  return [...new Map(children.map((child) => [child.id, child])).values()].sort(compareSiblingsByAge);
}

export function familyOfOriginIds(graph: FamilyGraph, personId: string): Set<string> {
  const ids = new Set<string>();
  const spouseId = findSpouseId(graph, personId);
  const blocked = new Set<string>([personId]);
  if (spouseId) blocked.add(spouseId);

  const ancestors: string[] = [];
  const queue = [personId];
  const seen = new Set(blocked);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of parentChildEdges(graph)) {
      if (edge.target !== current || seen.has(edge.source)) continue;
      seen.add(edge.source);
      ids.add(edge.source);
      ancestors.push(edge.source);
      queue.push(edge.source);
    }
  }

  for (const ancestorId of ancestors) {
    for (const child of childrenOfParent(graph, ancestorId)) {
      if (blocked.has(child.id) || ids.has(child.id)) continue;
      ids.add(child.id);
      const siblingSpouseId = findSpouseId(graph, child.id);
      if (siblingSpouseId && !blocked.has(siblingSpouseId)) ids.add(siblingSpouseId);
    }
  }
  return ids;
}

function childrenOfParent(graph: FamilyGraph, parentId: string): FamilyNode[] {
  const children = graph.nodes.filter((node) =>
    graph.edges.some(
      (edge) =>
        edge.category === "structural" &&
        ["parent", "adopted", "foster"].includes(edge.kind) &&
        edge.source === parentId &&
        edge.target === node.id,
    ),
  );
  return [...new Map(children.map((child) => [child.id, child])).values()].sort(compareSiblingsByAge);
}

function parentChildKind(graph: FamilyGraph, parentId: string, childId: string): FamilyEdge["kind"] | undefined {
  return graph.edges.find(
    (item) =>
      item.category === "structural" &&
      ["parent", "adopted", "foster"].includes(item.kind) &&
      item.source === parentId &&
      item.target === childId,
  )?.kind;
}

function coupleCoversChild(graph: FamilyGraph, leftId: string, rightId: string, childId: string): boolean {
  return childrenOfCouple(graph, leftId, rightId).some((child) => child.id === childId);
}

function assignGenerations(graph: FamilyGraph): Map<string, number> {
  const generations = new Map<string, number>();
  const index = graph.nodes.find((node) => node.data.isIndexPerson) ?? graph.nodes[0];
  if (!index) return generations;
  generations.set(index.id, 0);

  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();
  for (const edge of parentChildEdges(graph)) {
    childrenOf.set(edge.source, [...(childrenOf.get(edge.source) ?? []), edge.target]);
    parentsOf.set(edge.target, [...(parentsOf.get(edge.target) ?? []), edge.source]);
  }

  const queue = [index.id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const generation = generations.get(current)!;
    const spouseId = findSpouseId(graph, current);
    if (spouseId && !generations.has(spouseId)) {
      generations.set(spouseId, generation);
      queue.push(spouseId);
    }
    for (const parent of parentsOf.get(current) ?? []) {
      if (!generations.has(parent)) {
        generations.set(parent, generation - 1);
        queue.push(parent);
      }
    }
    for (const child of childrenOf.get(current) ?? []) {
      if (!generations.has(child)) {
        generations.set(child, generation + 1);
        queue.push(child);
      }
    }
  }

  for (const couple of couplesForLayout(graph)) {
    const left = generations.get(couple.left.id);
    const right = generations.get(couple.right.id);
    if (left !== undefined && right === undefined) generations.set(couple.right.id, left);
    if (right !== undefined && left === undefined) generations.set(couple.left.id, right);
  }

  for (const node of graph.nodes) {
    if (!generations.has(node.id)) generations.set(node.id, 0);
  }

  const minimum = Math.min(...generations.values());
  for (const [id, value] of generations) generations.set(id, value - minimum);
  return generations;
}

type SiblingUnit = {
  child: FamilyNode;
  spouse?: FamilyNode;
  width: number;
};

function coupleInnerSpan(graph: FamilyGraph, leftId: string, rightId: string): number {
  return siblingUnits(graph, childrenOfCouple(graph, leftId, rightId)).reduce(
    (sum, unit) => sum + unit.width,
    0,
  );
}

function coupleGap(graph: FamilyGraph, leftId: string, rightId: string): number {
  const childSpan = coupleInnerSpan(graph, leftId, rightId);
  if (childSpan === 0) return MIN_COUPLE_GAP;
  return Math.max(MIN_COUPLE_GAP, childSpan + CHILD_DROP_INSET * 2);
}

function siblingUnits(graph: FamilyGraph, children: FamilyNode[]): SiblingUnit[] {
  const siblingIds = new Set(children.map((child) => child.id));
  return children.map((child) => {
    const spouseId = findSpouseId(graph, child.id);
    const spouse =
      spouseId && !siblingIds.has(spouseId)
        ? graph.nodes.find((node) => node.id === spouseId)
        : undefined;
    return {
      child,
      spouse,
      width: CHILD_SLOT_WIDTH,
    };
  });
}

export function layoutFamily(graph: FamilyGraph): FamilyLayout {
  if (graph.nodes.length === 0) {
    return {
      nodes: [],
      coupleBars: [],
      childDrops: [],
      emotional: [],
      householdBoxes: [],
      width: 640,
      height: 400,
      viewMinX: 0,
      viewMinY: 0,
    };
  }

  const generations = assignGenerations(graph);
  const positions = new Map<string, Point>();
  const coupleBars: CoupleBar[] = [];
  const placedCouples = new Set<string>();

  const recordBar = (
    edge: FamilyEdge,
    left: FamilyNode,
    right: FamilyNode,
    leftX: number,
    rightX: number,
    y: number,
  ) => {
    const nextBar: CoupleBar = {
      id: edge.id,
      kind: edge.kind,
      year: edge.year,
      leftId: left.id,
      rightId: right.id,
      leftX,
      rightX,
      barY: y + NODE_HALF + DROP_LENGTH,
      leftCenterY: y,
      rightCenterY: y,
    };
    const existing = coupleBars.find((bar) => bar.id === edge.id);
    if (existing) {
      Object.assign(existing, nextBar);
    } else {
      coupleBars.push(nextBar);
    }
    placedCouples.add(edge.id);
  };

  const indexId = (graph.nodes.find((node) => node.data.isIndexPerson) ?? graph.nodes[0])?.id;

  const isInLawFamilyOfOrigin = (children: FamilyNode[]) => {
    if (!indexId) return false;
    const spouseId = findSpouseId(graph, indexId);
    if (!spouseId) return false;
    const includesSpouse = children.some((child) => child.id === spouseId);
    const includesIndex = children.some((child) => child.id === indexId);
    return includesSpouse && !includesIndex;
  };

  const coupleOwnsPerson = (bar: CoupleBar, personId: string) =>
    childrenOfCouple(graph, bar.leftId, bar.rightId).some((child) => child.id === personId);

  const isPinnedAsChild = (personId: string, exceptEdgeId: string) =>
    coupleBars.some((bar) => bar.id !== exceptEdgeId && coupleOwnsPerson(bar, personId));

  const childBaseline = (
    coupleY: number,
    child: FamilyNode,
    compressCollaterals: boolean,
    alignedY?: number,
  ) => {
    if (alignedY != null) return alignedY;
    const spouseOfIndex = indexId ? findSpouseId(graph, indexId) : undefined;
    const isLinkingSpouse = spouseOfIndex === child.id;
    return coupleY + (compressCollaterals && !isLinkingSpouse ? COLLATERAL_SIBLING_GAP : GENERATION_GAP);
  };

  const layoutNestedMarriage = (unit: SiblingUnit, childX: number, childY: number) => {
    if (!unit.spouse) return;
    const nested = coupleEdgeBetween(graph, unit.child.id, unit.spouse.id);
    if (!nested || placedCouples.has(nested.id)) return;
    const ownGap = coupleGap(graph, unit.child.id, unit.spouse.id);
    const [unitLeft, unitRight] = coupleOrder(unit.child, unit.spouse);
    if (!positions.has(unit.spouse.id)) {
      if (unitLeft.id === unit.child.id) {
        positions.set(unit.spouse.id, { x: childX + ownGap, y: childY });
      } else {
        positions.set(unit.spouse.id, { x: childX - ownGap, y: childY });
      }
    }
    layoutCoupleAt(unitLeft, unitRight, nested, positions.get(unitLeft.id)!.x, childY);
  };

  const placeUnplacedChild = (
    unit: SiblingUnit,
    childX: number,
    childY: number,
  ) => {
    if (positions.has(unit.child.id)) return;
    positions.set(unit.child.id, { x: childX, y: childY });
    layoutNestedMarriage(unit, childX, childY);
  };

  const placeChildren = (
    units: SiblingUnit[],
    coupleY: number,
    barLeftX: number,
    barRightX: number,
  ) => {
    const children = units.map((unit) => unit.child);
    const compressCollaterals = isInLawFamilyOfOrigin(children);
    const firstPlaced = units.findIndex((unit) => positions.has(unit.child.id));
    if (firstPlaced === -1) {
      const span = units.reduce((sum, unit) => sum + unit.width, 0);
      const mid = (barLeftX + barRightX) / 2;
      let cursor = mid - span / 2;
      for (const unit of units) {
        placeUnplacedChild(
          unit,
          cursor + unit.width / 2,
          childBaseline(coupleY, unit.child, compressCollaterals),
        );
        cursor += unit.width;
      }
      return;
    }

    const alignedY = positions.get(units[firstPlaced].child.id)!.y;
    let rightCursor =
      positions.get(units[firstPlaced].child.id)!.x + units[firstPlaced].width / 2;
    for (let index = firstPlaced + 1; index < units.length; index += 1) {
      const unit = units[index];
      if (positions.has(unit.child.id)) {
        rightCursor = Math.max(rightCursor, positions.get(unit.child.id)!.x + unit.width / 2);
        continue;
      }
      placeUnplacedChild(
        unit,
        rightCursor + unit.width / 2,
        childBaseline(coupleY, unit.child, compressCollaterals, alignedY),
      );
      rightCursor += unit.width;
    }

    let leftCursor =
      positions.get(units[firstPlaced].child.id)!.x - units[firstPlaced].width / 2;
    for (let index = firstPlaced - 1; index >= 0; index -= 1) {
      const unit = units[index];
      if (positions.has(unit.child.id)) {
        leftCursor = Math.min(leftCursor, positions.get(unit.child.id)!.x - unit.width / 2);
        continue;
      }
      placeUnplacedChild(
        unit,
        leftCursor - unit.width / 2,
        childBaseline(coupleY, unit.child, compressCollaterals, alignedY),
      );
      leftCursor -= unit.width;
    }
  };

  const sitCoupleOnOwnChildren = (
    left: FamilyNode,
    right: FamilyNode,
    edge: FamilyEdge,
    coupleY: number,
    children: FamilyNode[],
  ) => {
    const childXs = children
      .map((child) => positions.get(child.id)?.x)
      .filter((x): x is number => x != null);
    if (childXs.length === 0) return;
    const childrenMid = childXs.reduce((sum, x) => sum + x, 0) / childXs.length;
    const fittedGap = Math.max(
      MIN_COUPLE_GAP,
      Math.max(...childXs) - Math.min(...childXs) + CHILD_DROP_INSET * 2,
    );
    const barLeftX = childrenMid - fittedGap / 2;
    const barRightX = childrenMid + fittedGap / 2;
    positions.set(left.id, { x: barLeftX, y: coupleY });
    positions.set(right.id, { x: barRightX, y: coupleY });
    const recorded = coupleBars.find((bar) => bar.id === edge.id);
    if (recorded) {
      recorded.leftX = barLeftX;
      recorded.rightX = barRightX;
    }
  };

  const layoutCoupleAt = (
    left: FamilyNode,
    right: FamilyNode,
    edge: FamilyEdge,
    leftX: number,
    y: number,
  ) => {
    if (placedCouples.has(edge.id)) return;

    const children = childrenOfCouple(graph, left.id, right.id);
    const units = siblingUnits(graph, children);
    const gap = coupleGap(graph, left.id, right.id);
    const pinPartners = isPinnedAsChild(left.id, edge.id) || isPinnedAsChild(right.id, edge.id);
    const coupleY = pinPartners
      ? (positions.get(left.id)?.y ?? positions.get(right.id)?.y ?? y)
      : y;
    const resolvedLeftX =
      pinPartners && positions.has(left.id) ? positions.get(left.id)!.x : leftX;
    const resolvedRightX =
      pinPartners && positions.has(right.id) ? positions.get(right.id)!.x : resolvedLeftX + gap;

    positions.set(left.id, { x: resolvedLeftX, y: coupleY });
    positions.set(right.id, { x: resolvedRightX, y: coupleY });
    recordBar(edge, left, right, resolvedLeftX, resolvedRightX, coupleY);
    placeChildren(units, coupleY, resolvedLeftX, resolvedRightX);
    if (!pinPartners) sitCoupleOnOwnChildren(left, right, edge, coupleY, children);
  };

  let originX = CANVAS_PADDING_X;
  const layoutCouples = [...rootCouplesForLayout(graph)].sort(
    (left, right) => (generations.get(left.left.id) ?? 0) - (generations.get(right.left.id) ?? 0),
  );

  for (const couple of layoutCouples) {
    if (placedCouples.has(couple.edge.id)) continue;
    layoutCoupleAt(
      couple.left,
      couple.right,
      couple.edge,
      originX,
      CANVAS_PADDING_Y + (generations.get(couple.left.id) ?? 0) * GENERATION_GAP,
    );
    const left = positions.get(couple.left.id)!;
    const right = positions.get(couple.right.id)!;
    originX = Math.max(left.x, right.x) + CHILD_SLOT_WIDTH + NODE_SIZE;
  }

  const leftoverCouples = [...couplesForLayout(graph)].sort(
    (left, right) => (generations.get(left.left.id) ?? 0) - (generations.get(right.left.id) ?? 0),
  );
  for (const couple of leftoverCouples) {
    if (placedCouples.has(couple.edge.id)) continue;
    layoutCoupleAt(
      couple.left,
      couple.right,
      couple.edge,
      originX,
      CANVAS_PADDING_Y + (generations.get(couple.left.id) ?? 0) * GENERATION_GAP,
    );
    originX += MIN_COUPLE_GAP + NODE_SIZE * 2;
  }

  const spouseOfIndex = indexId ? findSpouseId(graph, indexId) : undefined;
  for (const parent of graph.nodes) {
    if (positions.has(parent.id)) continue;
    const placedChildren = childrenOfParent(graph, parent.id)
      .map((child) => ({ child, point: positions.get(child.id) }))
      .filter((item): item is { child: FamilyNode; point: Point } => Boolean(item.point));
    if (placedChildren.length === 0) continue;
    const compressCollaterals = isInLawFamilyOfOrigin(placedChildren.map((item) => item.child));
    const childYs = placedChildren.map((item) => {
      const isLinkingSpouse = spouseOfIndex === item.child.id;
      const gap = compressCollaterals && !isLinkingSpouse ? COLLATERAL_SIBLING_GAP : GENERATION_GAP;
      return item.point.y - gap;
    });
    positions.set(parent.id, {
      x: placedChildren.reduce((sum, item) => sum + item.point.x, 0) / placedChildren.length,
      y: Math.min(...childYs),
    });
  }

  for (const node of graph.nodes) {
    if (positions.has(node.id)) continue;
    positions.set(node.id, {
      x: originX,
      y: CANVAS_PADDING_Y + (generations.get(node.id) ?? 0) * GENERATION_GAP,
    });
    originX += CHILD_SLOT_WIDTH;
  }

  const shiftX = (personId: string, delta: number) => {
    if (delta === 0) return;
    const point = positions.get(personId);
    if (!point) return;
    positions.set(personId, { x: point.x + delta, y: point.y });
    for (const bar of coupleBars) {
      if (bar.leftId === personId) bar.leftX += delta;
      if (bar.rightId === personId) bar.rightX += delta;
    }
  };

  const isLockedToOtherCouple = (personId: string, exceptBarId: string) =>
    coupleBars.some(
      (other) =>
        other.id !== exceptBarId &&
        (other.leftId === personId || other.rightId === personId),
    );

  const shiftOwnBranch = (personId: string, delta: number, visited: Set<string>) => {
    if (visited.has(personId)) return;
    visited.add(personId);
    shiftX(personId, delta);
    for (const child of childrenOfParent(graph, personId)) {
      shiftOwnBranch(child.id, delta, visited);
    }
  };

  const packCoupleChildren = (bar: CoupleBar) => {
    const children = childrenOfCouple(graph, bar.leftId, bar.rightId);
    if (children.length === 0) return;
    const units = siblingUnits(graph, children);
    if (units.some((unit) => isLockedToOtherCouple(unit.child.id, bar.id))) return;
    const span = units.reduce((sum, unit) => sum + unit.width, 0);
    const mid = (bar.leftX + bar.rightX) / 2;
    let cursor = mid - span / 2;
    const visited = new Set([bar.leftId, bar.rightId]);
    for (const unit of units) {
      const current = positions.get(unit.child.id);
      if (current) {
        shiftOwnBranch(unit.child.id, cursor + unit.width / 2 - current.x, visited);
      }
      cursor += unit.width;
    }
  };

  const requiredFooGap = (leftId: string, rightId: string) => {
    const leftPoint = positions.get(leftId);
    const rightPoint = positions.get(rightId);
    if (!leftPoint || !rightPoint) return MIN_COUPLE_GAP;
    const leftFooXs = [...familyOfOriginIds(graph, leftId)]
      .map((id) => positions.get(id)?.x)
      .filter((x): x is number => x != null);
    const rightFooXs = [...familyOfOriginIds(graph, rightId)]
      .map((id) => positions.get(id)?.x)
      .filter((x): x is number => x != null);
    const leftReach = leftFooXs.length === 0 ? 0 : Math.max(0, Math.max(...leftFooXs) - leftPoint.x) + NODE_HALF;
    const rightReach = rightFooXs.length === 0 ? 0 : Math.max(0, rightPoint.x - Math.min(...rightFooXs)) + NODE_HALF;
    if (leftReach === 0 && rightReach === 0) return 0;
    if (leftReach > 0 && rightReach > 0) {
      return Math.max(
        2 * Math.max(leftReach, rightReach) + FOO_SIDE_CLEARANCE,
        leftReach + rightReach + FOO_SIDE_CLEARANCE,
      );
    }
    return Math.max(leftReach, rightReach);
  };

  for (let pass = 0; pass < FOO_CLEARANCE_PASSES; pass += 1) {
    let widened = false;
    const orderedBars = [...coupleBars].sort(
      (left, right) => (generations.get(left.leftId) ?? 0) - (generations.get(right.leftId) ?? 0),
    );
    for (const bar of orderedBars) {
      const needed = requiredFooGap(bar.leftId, bar.rightId);
      const currentGap = bar.rightX - bar.leftX;
      if (currentGap + 0.01 >= needed) continue;
      const delta = needed - currentGap;
      const shiftIds = new Set([bar.rightId, ...familyOfOriginIds(graph, bar.rightId)]);
      for (const child of childrenOfParent(graph, bar.rightId)) {
        if (coupleCoversChild(graph, bar.leftId, bar.rightId, child.id)) continue;
        shiftIds.add(child.id);
      }
      for (const id of shiftIds) shiftX(id, delta);
      const leftPoint = positions.get(bar.leftId);
      const rightPoint = positions.get(bar.rightId);
      if (leftPoint) bar.leftX = leftPoint.x;
      if (rightPoint) bar.rightX = rightPoint.x;
      packCoupleChildren(bar);
      widened = true;
    }
    if (!widened) break;
  }

  const childDrops: ChildDrop[] = [];
  const linkedChildren = new Set<string>();

  const parentKindOf = (childId: string) =>
    graph.edges.find(
      (item) =>
        item.category === "structural" &&
        ["parent", "adopted", "foster"].includes(item.kind) &&
        item.target === childId,
    )?.kind;

  for (const bar of coupleBars) {
    const children = childrenOfCouple(graph, bar.leftId, bar.rightId);
    for (const child of children) {
      const point = positions.get(child.id);
      if (!point) continue;
      const kind = parentKindOf(child.id);
      childDrops.push({
        id: `${bar.id}-${child.id}`,
        x: point.x,
        fromY: bar.barY,
        toY: point.y,
        dashed: kind === "adopted" || kind === "foster",
      });
      linkedChildren.add(child.id);
    }
  }

  for (const edge of parentChildEdges(graph)) {
    if (linkedChildren.has(edge.target)) continue;
    if (
      coupleBars.some((bar) =>
        (bar.leftId === edge.source || bar.rightId === edge.source) &&
        coupleCoversChild(graph, bar.leftId, bar.rightId, edge.target),
      )
    ) {
      continue;
    }
    const parentPoint = positions.get(edge.source);
    const childPoint = positions.get(edge.target);
    if (!parentPoint || !childPoint) continue;
    const kind = parentChildKind(graph, edge.source, edge.target);
    const fromY = parentPoint.y + NODE_HALF;
    const elbowY = parentPoint.y + NODE_HALF + DROP_LENGTH;
    childDrops.push({
      id: `solo-${edge.source}-${edge.target}`,
      x: childPoint.x,
      fromX: parentPoint.x,
      fromY,
      elbowY,
      toY: childPoint.y,
      dashed: kind === "adopted" || kind === "foster",
    });
    linkedChildren.add(edge.target);
  }

  const laid: LaidNode[] = graph.nodes.map((node) => ({
    ...node,
    ...positions.get(node.id)!,
  }));

  const emotional: EmotionalLink[] = graph.edges
    .filter((edge) => edge.category === "emotional")
    .flatMap((edge) => {
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      if (!source || !target) return [];
      return [
        {
          id: edge.id,
          kind: edge.kind,
          label: edge.label,
          source: { x: source.x, y: source.y },
          target: { x: target.x, y: target.y },
        },
      ];
    });

  const householdBoxes = householdBoxesFor(graph, laid);
  const xs = laid.map((node) => node.x);
  const ys = laid.map((node) => node.y);
  const viewMinX = Math.min(
    Math.min(...xs) - NODE_SIZE - CANVAS_PADDING_X / 2,
    ...householdBoxes.map((box) => box.x),
  );
  const viewMinY = Math.min(
    Math.min(...ys) - NODE_HALF - YEAR_GAP_ABOVE - YEAR_LABEL_BOX_HEIGHT,
    ...householdBoxes.map((box) => box.y),
  );
  const viewMaxX = Math.max(
    Math.max(...xs) + NODE_SIZE + CANVAS_PADDING_X / 2,
    ...householdBoxes.map((box) => box.x + box.width),
  );
  const viewMaxY = Math.max(
    Math.max(...ys) + NODE_HALF + NOTE_GAP_BELOW + LABEL_LINE_HEIGHT * 6 + CANVAS_PADDING_Y / 2,
    ...householdBoxes.map((box) => box.y + box.height),
  );
  return {
    nodes: laid,
    coupleBars,
    childDrops,
    emotional,
    householdBoxes,
    viewMinX,
    viewMinY,
    width: viewMaxX - viewMinX,
    height: viewMaxY - viewMinY,
  };
}

function personLabelExtent(node: LaidNode) {
  const hasYear = node.data.birthYear != null && Number.isFinite(node.data.birthYear);
  const noteCount = 1 + (node.data.occupation ? 1 : 0) + node.data.tags.length;
  return {
    left: node.x - NODE_HALF,
    right: node.x + NODE_HALF,
    top: node.y - NODE_HALF - (hasYear ? YEAR_GAP_ABOVE + YEAR_LABEL_BOX_HEIGHT : 0),
    bottom: node.y + NODE_HALF + NOTE_GAP_BELOW + noteCount * LABEL_LINE_HEIGHT,
  };
}

function householdBoxesFor(graph: FamilyGraph, laid: LaidNode[]): HouseholdBox[] {
  return graph.households.flatMap((household) => {
    const members = household.memberIds
      .map((id) => laid.find((node) => node.id === id))
      .filter((node): node is LaidNode => Boolean(node));
    if (members.length === 0) return [];
    const extents = members.map(personLabelExtent);
    const left = Math.min(...extents.map((extent) => extent.left)) - HOUSEHOLD_PAD_X;
    const right = Math.max(...extents.map((extent) => extent.right)) + HOUSEHOLD_PAD_X;
    const top = Math.min(...extents.map((extent) => extent.top)) - HOUSEHOLD_PAD_Y;
    const bottom = Math.max(...extents.map((extent) => extent.bottom)) + HOUSEHOLD_PAD_Y;
    return [
      {
        id: household.id,
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
      },
    ];
  });
}
