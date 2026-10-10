import {
  CANVAS_PADDING_X,
  CANVAS_PADDING_Y,
  CHILD_DROP_INSET,
  CHILD_SLOT_WIDTH,
  COLLATERAL_DIRECT_AIR,
  COLLATERAL_STEM,
  COLLATERAL_SCALE,
  COLLATERAL_SCALE_MIN,
  COLLATERAL_SCALE_STEPS,
  COLLATERAL_SIBLING_GAP,
  COLLATERAL_SLOT_WIDTH,
  MARRIED_COLLATERAL_GAP,
  MIN_COLLATERAL_COUPLE_GAP,
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
import { glyphReach } from "./glyph";
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
  sourceId: string;
  targetId: string;
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
  collateralScale: number;
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

/** Family of origin plus the spouses and descendants hanging off that family. */
export function originBranchIds(graph: FamilyGraph, personId: string): Set<string> {
  const ids = familyOfOriginIds(graph, personId);
  const spouseId = findSpouseId(graph, personId);
  const seen = new Set<string>([personId, ...ids]);
  if (spouseId) seen.add(spouseId);
  const queue = [...ids];
  while (queue.length > 0) {
    const current = queue.pop()!;
    const currentSpouseId = findSpouseId(graph, current);
    if (currentSpouseId && !seen.has(currentSpouseId)) {
      seen.add(currentSpouseId);
      ids.add(currentSpouseId);
      queue.push(currentSpouseId);
    }
    for (const child of childrenOfParent(graph, current)) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      ids.add(child.id);
      queue.push(child.id);
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
  childOffset: number;
};

type LayoutMetrics = {
  scale: number;
  direct: Set<string>;
};

function glyphHalf(metrics: LayoutMetrics, person: Pick<FamilyNode, "id" | "data">): number {
  return glyphReach(person.data) * (metrics.direct.has(person.id) ? 1 : metrics.scale);
}

function slotWidth(metrics: LayoutMetrics, personId: string): number {
  return metrics.direct.has(personId) ? CHILD_SLOT_WIDTH : COLLATERAL_SLOT_WIDTH * metrics.scale;
}

function coupleIsCollateral(metrics: LayoutMetrics, leftId: string, rightId: string): boolean {
  return !metrics.direct.has(leftId) && !metrics.direct.has(rightId);
}

function coupleGap(graph: FamilyGraph, leftId: string, rightId: string, metrics: LayoutMetrics): number {
  const collateral = coupleIsCollateral(metrics, leftId, rightId);
  const minimum = collateral ? MIN_COLLATERAL_COUPLE_GAP * metrics.scale : MIN_COUPLE_GAP;
  const units = siblingUnits(graph, childrenOfCouple(graph, leftId, rightId), metrics);
  if (units.length === 0) return minimum;
  // The bar is centered on the sibling block, so each drop needs the inset
  // measured from where that child actually hangs, not from a full-size first seat.
  // A collateral couple uses the same fitted scale as its glyphs, so its line
  // does not keep a full-size gap when that family must sit beside the direct line.
  const inset = collateral ? CHILD_DROP_INSET * metrics.scale : CHILD_DROP_INSET;
  let cursor = 0;
  let nearestDrop = Number.POSITIVE_INFINITY;
  let farthestDrop = Number.NEGATIVE_INFINITY;
  for (const unit of units) {
    const drop = cursor + unit.childOffset;
    nearestDrop = Math.min(nearestDrop, drop);
    farthestDrop = Math.max(farthestDrop, drop);
    cursor += unit.width;
  }
  const halfReach = Math.max(cursor / 2 - nearestDrop, farthestDrop - cursor / 2);
  return Math.max(minimum, halfReach * 2 + inset * 2);
}

function hasBirthParents(graph: FamilyGraph, personId: string): boolean {
  return parentChildEdges(graph).some((edge) => edge.target === personId);
}

function linksSeparateDirectBirthFamilies(
  graph: FamilyGraph,
  personId: string,
  spouseId: string,
  metrics: LayoutMetrics,
): boolean {
  const indexId = graph.nodes.find((node) => node.data.isIndexPerson)?.id ?? graph.nodes[0]?.id;
  if (!indexId || personId === indexId || spouseId === indexId) return false;
  return (
    metrics.direct.has(personId) &&
    metrics.direct.has(spouseId) &&
    hasBirthParents(graph, personId) &&
    hasBirthParents(graph, spouseId)
  );
}

function siblingUnits(graph: FamilyGraph, children: FamilyNode[], metrics: LayoutMetrics): SiblingUnit[] {
  const siblingIds = new Set(children.map((child) => child.id));
  return children.map((child, index) => {
    const spouseId = findSpouseId(graph, child.id);
    const spouse =
      spouseId && !siblingIds.has(spouseId)
        ? graph.nodes.find((node) => node.id === spouseId)
        : undefined;
    const slot = slotWidth(metrics, child.id);
    const centered = {
      child,
      spouse,
      width: slot,
      childOffset: slot / 2,
    };
    if (spouse) {
      const spouseOnRight = coupleOrder(child, spouse)[0].id === child.id;
      const siblingBesideSpouse = spouseOnRight ? index < children.length - 1 : index > 0;
      // A sibling beside an in-law needs that couple's own gap, or the sibling
      // lands on the spouse. The parents' marriage is different: each partner
      // already sits in their own birth family, so reserving it here stretches
      // the grandparents across the other family.
      const joinsTwoBirthFamilies = linksSeparateDirectBirthFamilies(
        graph,
        child.id,
        spouse.id,
        metrics,
      );
      if (siblingBesideSpouse && !joinsTwoBirthFamilies) {
        const spouseGap = coupleGap(graph, child.id, spouse.id, metrics);
        return {
          child,
          spouse,
          width: slot + spouseGap,
          childOffset: spouseOnRight ? slot / 2 : spouseGap + slot / 2,
        };
      }
      return centered;
    }
    const ownChildren = childrenOfParent(graph, child.id);
    if (ownChildren.length > 1) {
      const span = siblingUnits(graph, ownChildren, metrics).reduce((sum, unit) => sum + unit.width, 0);
      const width = Math.max(slot, span);
      return { child, width, childOffset: width / 2 };
    }
    return centered;
  });
}

export function directLineIds(graph: FamilyGraph): Set<string> {
  const index = graph.nodes.find((node) => node.data.isIndexPerson) ?? graph.nodes[0];
  const ids = new Set<string>();
  if (!index) return ids;
  ids.add(index.id);
  const spouseId = findSpouseId(graph, index.id);
  if (spouseId) ids.add(spouseId);

  const ancestors = [index.id];
  const seenUp = new Set<string>();
  while (ancestors.length > 0) {
    const current = ancestors.pop()!;
    if (seenUp.has(current)) continue;
    seenUp.add(current);
    for (const edge of parentChildEdges(graph)) {
      if (edge.target !== current) continue;
      ids.add(edge.source);
      ancestors.push(edge.source);
    }
  }

  const descendants = [index.id];
  const seenDown = new Set<string>();
  while (descendants.length > 0) {
    const current = descendants.pop()!;
    if (seenDown.has(current)) continue;
    seenDown.add(current);
    for (const child of childrenOfParent(graph, current)) {
      ids.add(child.id);
      descendants.push(child.id);
    }
  }

  // The client's own brothers and sisters share the direct line: same size and
  // the same generation drop. Aunts, uncles, and cousins stay off it.
  for (const edge of parentChildEdges(graph)) {
    if (edge.target !== index.id) continue;
    for (const sibling of childrenOfParent(graph, edge.source)) {
      ids.add(sibling.id);
    }
  }
  return ids;
}

function descendantIds(graph: FamilyGraph, personId: string): Set<string> {
  const ids = new Set<string>();
  const pending = [personId];
  const seen = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const child of childrenOfParent(graph, current)) {
      ids.add(child.id);
      pending.push(child.id);
    }
  }
  return ids;
}

function layoutAtScale(graph: FamilyGraph, scale: number): FamilyLayout {
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
      collateralScale: scale,
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

  const indexId = graph.nodes.find((node) => node.data.isIndexPerson)?.id ?? graph.nodes[0]?.id;

  const coupleOwnsPerson = (bar: CoupleBar, personId: string) =>
    childrenOfCouple(graph, bar.leftId, bar.rightId).some((child) => child.id === personId);

  const isPinnedAsChild = (personId: string, exceptEdgeId: string) =>
    coupleBars.some((bar) => bar.id !== exceptEdgeId && coupleOwnsPerson(bar, personId));

  const directLine = directLineIds(graph);
  const metrics: LayoutMetrics = { scale, direct: directLine };
  const indexDescendants = indexId ? descendantIds(graph, indexId) : new Set<string>();

  // Collateral lines are a little shorter than a full generation, both the
  // step down to an aunt and the step from her to her child. The child line
  // still starts below the couple bar, so it cannot disappear into the glyph.
  const childDropGap = (child: FamilyNode, row: FamilyNode[]) => {
    if (!directLine.has(child.id)) return collateralChildGap(graph, child.id, scale, directLine);
    if (!indexDescendants.has(child.id)) return GENERATION_GAP;
    const rowHasMarriedChild = row.some((person) => findSpouseId(graph, person.id));
    if (!rowHasMarriedChild) return GENERATION_GAP;
    if (findSpouseId(graph, child.id)) return MARRIED_COLLATERAL_GAP;
    return COLLATERAL_SIBLING_GAP;
  };

  const childBaseline = (coupleY: number, child: FamilyNode, row: FamilyNode[]) =>
    coupleY + childDropGap(child, row);

  const layoutNestedMarriage = (unit: SiblingUnit, childX: number, childY: number) => {
    if (!unit.spouse) return;
    const nested = coupleEdgeBetween(graph, unit.child.id, unit.spouse.id);
    if (!nested || placedCouples.has(nested.id)) return;
    const ownGap = coupleGap(graph, unit.child.id, unit.spouse.id, metrics);
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
    const firstPlaced = units.findIndex((unit) => positions.has(unit.child.id));
    if (firstPlaced === -1) {
      const span = units.reduce((sum, unit) => sum + unit.width, 0);
      const mid = (barLeftX + barRightX) / 2;
      let cursor = mid - span / 2;
      for (const unit of units) {
        placeUnplacedChild(
          unit,
          cursor + unit.childOffset,
          childBaseline(coupleY, unit.child, children),
        );
        cursor += unit.width;
      }
      return;
    }

    const unitLeft = (unit: SiblingUnit, x: number) => x - unit.childOffset;
    const unitRight = (unit: SiblingUnit, x: number) => x - unit.childOffset + unit.width;
    let rightEdge = unitRight(
      units[firstPlaced],
      positions.get(units[firstPlaced].child.id)!.x,
    );
    for (let index = firstPlaced + 1; index < units.length; index += 1) {
      const unit = units[index];
      if (positions.has(unit.child.id)) {
        rightEdge = Math.max(rightEdge, unitRight(unit, positions.get(unit.child.id)!.x));
        continue;
      }
      placeUnplacedChild(
        unit,
        rightEdge + unit.childOffset,
        childBaseline(coupleY, unit.child, children),
      );
      rightEdge += unit.width;
    }

    let leftEdge = unitLeft(units[firstPlaced], positions.get(units[firstPlaced].child.id)!.x);
    for (let index = firstPlaced - 1; index >= 0; index -= 1) {
      const unit = units[index];
      if (positions.has(unit.child.id)) {
        leftEdge = Math.min(leftEdge, unitLeft(unit, positions.get(unit.child.id)!.x));
        continue;
      }
      leftEdge -= unit.width;
      placeUnplacedChild(
        unit,
        leftEdge + unit.childOffset,
        childBaseline(coupleY, unit.child, children),
      );
    }
  };

  const sitCoupleOnOwnChildren = (
    left: FamilyNode,
    right: FamilyNode,
    edge: FamilyEdge,
    coupleY: number,
    children: FamilyNode[],
  ) => {
    const units = siblingUnits(graph, children, metrics);
    const blockEdges = units.flatMap((unit) => {
      const x = positions.get(unit.child.id)?.x;
      if (x == null) return [];
      return [x - unit.childOffset, x - unit.childOffset + unit.width];
    });
    if (blockEdges.length === 0) return;
    const childrenMid = (Math.min(...blockEdges) + Math.max(...blockEdges)) / 2;
    const fittedGap = coupleGap(graph, left.id, right.id, metrics);
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
    const units = siblingUnits(graph, children, metrics);
    const gap = coupleGap(graph, left.id, right.id, metrics);
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

  const unplacedNodes = () => graph.nodes.filter((node) => !positions.has(node.id));
  const parentKey = (node: FamilyNode) =>
    parentChildEdges(graph)
      .filter((edge) => edge.target === node.id)
      .map((edge) => edge.source)
      .sort()
      .join("|");

  // Children are placed before a lone parent, so the parent can sit on their
  // vertical line instead of beside them with a bent connector.
  for (let placementGuard = 0; unplacedNodes().length > 0; placementGuard += 1) {
    if (placementGuard > graph.nodes.length) break;
    const pending = unplacedNodes();
    const readyParent = pending.find((parent) => {
      const children = childrenOfParent(graph, parent.id);
      return children.length > 0 && children.every((child) => positions.has(child.id));
    });
    if (readyParent) {
      const placedChildren = childrenOfParent(graph, readyParent.id).map((child) => ({
        child,
        point: positions.get(child.id)!,
      }));
      const row = placedChildren.map((item) => item.child);
      const childYs = placedChildren.map((item) => item.point.y - childDropGap(item.child, row));
      positions.set(readyParent.id, {
        x: placedChildren.reduce((sum, item) => sum + item.point.x, 0) / placedChildren.length,
        y: Math.min(...childYs),
      });
      continue;
    }

    const soloParent = graph.nodes.find((parent) => {
      if (!positions.has(parent.id) || findSpouseId(graph, parent.id)) return false;
      return childrenOfParent(graph, parent.id).some((child) => !positions.has(child.id));
    });
    if (soloParent) {
      const parentPoint = positions.get(soloParent.id)!;
      const siblings = childrenOfParent(graph, soloParent.id);
      const units = siblingUnits(graph, siblings, metrics);
      let cursor = parentPoint.x - units.reduce((sum, unit) => sum + unit.width, 0) / 2;
      for (const unit of units) {
        if (!positions.has(unit.child.id)) {
          placeUnplacedChild(
            unit,
            cursor + unit.childOffset,
            childBaseline(parentPoint.y, unit.child, siblings),
          );
        }
        cursor += unit.width;
      }
      continue;
    }

    const leaves = pending.filter((node) =>
      childrenOfParent(graph, node.id).every((child) => positions.has(child.id)),
    );
    const pool = leaves.length > 0 ? leaves : pending;
    const deepest = Math.max(...pool.map((node) => generations.get(node.id) ?? 0));
    const deepestRow = pool.filter((node) => (generations.get(node.id) ?? 0) === deepest);
    const key = parentKey(deepestRow[0]);
    const group = deepestRow.filter((node) => parentKey(node) === key).sort(compareSiblingsByAge);
    for (const node of group) {
      positions.set(node.id, {
        x: originX,
        y: CANVAS_PADDING_Y + (generations.get(node.id) ?? 0) * GENERATION_GAP,
      });
      originX += CHILD_SLOT_WIDTH;
    }
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

  const shiftWithMarriage = (personId: string, delta: number, visited: Set<string>) => {
    if (visited.has(personId) || delta === 0) return;
    visited.add(personId);
    shiftX(personId, delta);
    const spouseId = findSpouseId(graph, personId);
    if (spouseId && !visited.has(spouseId)) {
      shiftWithMarriage(spouseId, delta, visited);
      for (const id of originBranchIds(graph, spouseId)) {
        if (visited.has(id)) continue;
        visited.add(id);
        shiftX(id, delta);
      }
    }
    for (const child of childrenOfParent(graph, personId)) {
      shiftWithMarriage(child.id, delta, visited);
    }
  };

  for (const parent of graph.nodes) {
    if (!positions.has(parent.id) || findSpouseId(graph, parent.id)) continue;
    const siblings = childrenOfParent(graph, parent.id);
    if (siblings.length === 0) continue;
    const units = siblingUnits(graph, siblings, metrics);
    const span = units.reduce((sum, unit) => sum + unit.width, 0);
    let cursor = positions.get(parent.id)!.x - span / 2;
    for (const unit of units) {
      const current = positions.get(unit.child.id);
      if (!current) continue;
      shiftWithMarriage(unit.child.id, cursor + unit.childOffset - current.x, new Set([parent.id]));
      cursor += unit.width;
    }
  }

  const packCoupleChildren = (bar: CoupleBar) => {
    const children = childrenOfCouple(graph, bar.leftId, bar.rightId);
    if (children.length === 0) return;
    const units = siblingUnits(graph, children, metrics);
    const span = units.reduce((sum, unit) => sum + unit.width, 0);
    const mid = (bar.leftX + bar.rightX) / 2;
    let cursor = mid - span / 2;
    const visited = new Set([bar.leftId, bar.rightId]);
    for (const unit of units) {
      const current = positions.get(unit.child.id);
      if (current) {
        shiftWithMarriage(unit.child.id, cursor + unit.childOffset - current.x, visited);
      }
      cursor += unit.width;
    }
  };

  const requiredFooGap = (leftId: string, rightId: string) => {
    const leftPoint = positions.get(leftId);
    const rightPoint = positions.get(rightId);
    if (!leftPoint || !rightPoint) return MIN_COUPLE_GAP;
    const leftFooXs = [...originBranchIds(graph, leftId)]
      .map((id) => positions.get(id)?.x)
      .filter((x): x is number => x != null);
    const rightFooXs = [...originBranchIds(graph, rightId)]
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

  for (const bar of coupleBars) packCoupleChildren(bar);

  for (let pass = 0; pass < FOO_CLEARANCE_PASSES; pass += 1) {
    let widened = false;
    const orderedBars = [...coupleBars].sort(
      (left, right) => (generations.get(left.leftId) ?? 0) - (generations.get(right.leftId) ?? 0),
    );
    for (const bar of orderedBars) {
      if (!directLine.has(bar.leftId) || !directLine.has(bar.rightId)) continue;
      const needed = requiredFooGap(bar.leftId, bar.rightId);
      const currentGap = bar.rightX - bar.leftX;
      if (currentGap + 0.01 >= needed) continue;
      const delta = needed - currentGap;
      const shiftIds = new Set([bar.rightId, ...originBranchIds(graph, bar.rightId)]);
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
          sourceId: edge.source,
          targetId: edge.target,
          source: { x: source.x, y: source.y },
          target: { x: target.x, y: target.y },
        },
      ];
    });

  const householdBoxes = householdBoxesFor(graph, laid, metrics);
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
    collateralScale: scale,
  };
}

function sharesBirthRowWithDirect(
  graph: FamilyGraph,
  personId: string,
  direct: Set<string>,
): boolean {
  for (const edge of parentChildEdges(graph)) {
    if (edge.target !== personId) continue;
    for (const sibling of childrenOfParent(graph, edge.source)) {
      if (sibling.id !== personId && direct.has(sibling.id)) return true;
    }
  }
  return false;
}

function collateralChildGap(
  graph: FamilyGraph,
  childId: string,
  scale: number,
  direct: Set<string>,
): number {
  const parents = parentChildEdges(graph)
    .filter((edge) => edge.target === childId)
    .map((edge) => edge.source);
  const stem = COLLATERAL_STEM * scale;
  const childRadius = NODE_HALF * scale;
  if (parents.length >= 2) {
    const glyph = Math.max(...parents.map((id) => (direct.has(id) ? 1 : scale)));
    const line = parents.every((id) => direct.has(id)) ? 1 : scale;
    return NODE_HALF * glyph + DROP_LENGTH * line + stem + childRadius;
  }
  const glyph = parents.length === 1 && direct.has(parents[0]) ? 1 : scale;
  return NODE_HALF * glyph + stem + childRadius;
}

function staysBesideDirectBirthRow(
  graph: FamilyGraph,
  personId: string,
  direct: Set<string>,
): boolean {
  if (sharesBirthRowWithDirect(graph, personId, direct)) return true;
  const spouseId = findSpouseId(graph, personId);
  return spouseId != null && sharesBirthRowWithDirect(graph, spouseId, direct);
}

function glyphsOverlap(layout: FamilyLayout, graph: FamilyGraph, scale: number): boolean {
  const direct = directLineIds(graph);
  const half = (person: Pick<FamilyNode, "id" | "data">) => glyphHalf({ scale, direct }, person);
  const nodes = layout.nodes;
  for (let left = 0; left < nodes.length; left += 1) {
    for (let right = left + 1; right < nodes.length; right += 1) {
      const a = nodes[left];
      const b = nodes[right];
      const touches =
        Math.abs(a.x - b.x) < half(a) + half(b) &&
        Math.abs(a.y - b.y) < half(a) + half(b);
      if (touches) return true;
      const hangingOntoDirect =
        (!direct.has(a.id) &&
          !staysBesideDirectBirthRow(graph, a.id, direct) &&
          direct.has(b.id) &&
          a.y < b.y) ||
        (!direct.has(b.id) &&
          !staysBesideDirectBirthRow(graph, b.id, direct) &&
          direct.has(a.id) &&
          b.y < a.y);
      if (!hangingOntoDirect) continue;
      // Only a descendant dropping through a direct person's column is covering.
      // Someone beside an ancestor keeps the preferred scale.
      const horizontalGap = Math.abs(a.x - b.x) - half(a) - half(b);
      const verticalGap = Math.abs(a.y - b.y) - half(a) - half(b);
      if (horizontalGap < 0 && verticalGap < COLLATERAL_DIRECT_AIR) return true;
    }
  }
  return false;
}

/** The counselor's chosen collateral size, which the fitted scale never exceeds. */
export function preferredCollateralScale(graph: FamilyGraph): number {
  return graph.collateralScale ?? COLLATERAL_SCALE;
}

function fittedCollateralScale(graph: FamilyGraph): number {
  const preferred = preferredCollateralScale(graph);
  if (preferred <= COLLATERAL_SCALE_MIN) return COLLATERAL_SCALE_MIN;
  if (!glyphsOverlap(layoutAtScale(graph, preferred), graph, preferred)) return preferred;
  let low = COLLATERAL_SCALE_MIN;
  let high = preferred;
  let best = COLLATERAL_SCALE_MIN;
  for (let step = 0; step < COLLATERAL_SCALE_STEPS; step += 1) {
    const mid = (low + high) / 2;
    if (glyphsOverlap(layoutAtScale(graph, mid), graph, mid)) high = mid;
    else {
      best = mid;
      low = mid;
    }
  }
  return best;
}

// Graphs are replaced, never mutated, so one layout per graph object can be
// shared by the canvas, the size picker, and exports without going stale.
const layoutCache = new WeakMap<FamilyGraph, FamilyLayout>();

export function layoutFamily(graph: FamilyGraph): FamilyLayout {
  const cached = layoutCache.get(graph);
  if (cached) return cached;
  const scale = graph.nodes.length === 0 ? preferredCollateralScale(graph) : fittedCollateralScale(graph);
  const layout = layoutAtScale(graph, scale);
  layoutCache.set(graph, layout);
  return layout;
}

function personLabelExtent(node: LaidNode, half: number) {
  const hasYear = node.data.birthYear != null && Number.isFinite(node.data.birthYear);
  const noteCount = 1 + (node.data.occupation ? 1 : 0) + node.data.tags.length;
  return {
    left: node.x - half,
    right: node.x + half,
    top: node.y - half - (hasYear ? YEAR_GAP_ABOVE + YEAR_LABEL_BOX_HEIGHT : 0),
    bottom: node.y + half + NOTE_GAP_BELOW + noteCount * LABEL_LINE_HEIGHT,
  };
}

function householdBoxesFor(graph: FamilyGraph, laid: LaidNode[], metrics: LayoutMetrics): HouseholdBox[] {
  return graph.households.flatMap((household) => {
    const members = household.memberIds
      .map((id) => laid.find((node) => node.id === id))
      .filter((node): node is LaidNode => Boolean(node));
    if (members.length === 0) return [];
    const extents = members.map((member) => personLabelExtent(member, glyphHalf(metrics, member)));
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
