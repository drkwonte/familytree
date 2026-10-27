import assert from "node:assert/strict";
import { test } from "node:test";
import { MIN_COUPLE_GAP } from "./constants";
import { glyphReach } from "./glyph";
import { type FamilyLayout, directLineIds, layoutFamily } from "./layout";
import { addRelative } from "./relations";
import {
  assertChildrenStayOnTheirCoupleBar,
  assertCollateralDoesNotCoverDirect,
  assertNoDropCrossesForeignGlyph,
  assertNoGlyphOverlap,
} from "./test-support/layout-assertions";
import { EMPTY_GRAPH, type FamilyGraph, type Gender } from "./types";

const CLIENT = 1;
const FATHER = 2;
const MOTHER = 3;

function idOf(graph: FamilyGraph, displayNumber: number): string {
  return graph.nodes.find((node) => node.data.displayNumber === displayNumber)!.id;
}

function withBirthYear(graph: FamilyGraph, displayNumber: number, birthYear: number): FamilyGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) =>
      node.data.displayNumber === displayNumber ? { ...node, data: { ...node.data, birthYear } } : node,
    ),
  };
}

function divorced(graph: FamilyGraph, first: number, second: number): FamilyGraph {
  const ids = new Set([idOf(graph, first), idOf(graph, second)]);
  return {
    ...graph,
    edges: graph.edges.map((edge) =>
      edge.kind === "marriage" && ids.has(edge.source) && ids.has(edge.target) ? { ...edge, kind: "divorce" } : edge,
    ),
  };
}

/** The client's parents, each with their own parents, like the counselor's usual three generations. */
function threeGenerations(): FamilyGraph {
  let graph = addRelative(EMPTY_GRAPH, { name: "", gender: "F", relation: "self", isIndexPerson: true });
  graph = addRelative(graph, { name: "", gender: "M", relation: "father", anchorId: idOf(graph, CLIENT) });
  graph = addRelative(graph, { name: "", gender: "F", relation: "mother", anchorId: idOf(graph, CLIENT) });
  for (const parent of [FATHER, MOTHER]) {
    graph = addRelative(graph, { name: "", gender: "M", relation: "father", anchorId: idOf(graph, parent) });
    graph = addRelative(graph, { name: "", gender: "F", relation: "mother", anchorId: idOf(graph, parent) });
  }
  return withBirthYear(graph, MOTHER, 1980);
}

function remarry(graph: FamilyGraph, displayNumber: number, gender: Gender): { graph: FamilyGraph; partnerId: string } {
  const next = addRelative(divorcedFromFirst(graph, displayNumber), {
    name: "",
    gender,
    relation: "spouse",
    anchorId: idOf(graph, displayNumber),
  });
  return { graph: next, partnerId: next.nodes[next.nodes.length - 1].id };
}

function divorcedFromFirst(graph: FamilyGraph, displayNumber: number): FamilyGraph {
  return displayNumber === CLIENT ? graph : divorced(graph, FATHER, MOTHER);
}

function point(layout: FamilyLayout, personId: string) {
  return layout.nodes.find((node) => node.id === personId)!;
}

function drawnHalf(layout: FamilyLayout, graph: FamilyGraph, personId: string): number {
  const person = point(layout, personId);
  return glyphReach(person.data) * (directLineIds(graph).has(personId) ? 1 : layout.collateralScale);
}

function overlappedBy(layout: FamilyLayout, graph: FamilyGraph, personId: string): string[] {
  const person = point(layout, personId);
  const half = drawnHalf(layout, graph, personId);
  return layout.nodes
    .filter((other) => other.id !== personId)
    .filter((other) => {
      const reach = half + drawnHalf(layout, graph, other.id);
      return Math.abs(other.x - person.x) < reach && Math.abs(other.y - person.y) < reach;
    })
    .map((other) => `인물${other.data.displayNumber}`);
}

test("a remarried mother's new husband keeps the husband-left rule, between her and the first husband", () => {
  const { graph, partnerId } = remarry(threeGenerations(), MOTHER, "M");
  const layout = layoutFamily(graph);
  const mother = point(layout, idOf(graph, MOTHER));
  const father = point(layout, idOf(graph, FATHER));
  const partner = point(layout, partnerId);
  assert.ok(father.x < partner.x && partner.x < mother.x, "the new husband sits on her left, inside the first couple");
  assert.ok(mother.x - partner.x < MIN_COUPLE_GAP, "and stays right beside her");
  assert.equal(partner.y, mother.y);
  assert.deepEqual(overlappedBy(layout, graph, partnerId), []);
});

test("a remarried father's new wife sits on his right, between him and the first wife", () => {
  const { graph, partnerId } = remarry(threeGenerations(), FATHER, "F");
  const layout = layoutFamily(graph);
  const father = point(layout, idOf(graph, FATHER));
  const mother = point(layout, idOf(graph, MOTHER));
  const partner = point(layout, partnerId);
  assert.ok(father.x < partner.x && partner.x < mother.x);
  assert.ok(partner.x - father.x < MIN_COUPLE_GAP);
  assert.equal(partner.y, father.y);
  assert.deepEqual(overlappedBy(layout, graph, partnerId), []);
});

test("the later spouse is not on the direct line, so it is drawn at the collateral size", () => {
  const { graph, partnerId } = remarry(threeGenerations(), MOTHER, "M");
  assert.equal(directLineIds(graph).has(partnerId), false);
  assert.ok(drawnHalf(layoutFamily(graph), graph, partnerId) < glyphReach(point(layoutFamily(graph), partnerId).data));
});

test("the first marriage still holds the children and the later one is its own couple line", () => {
  const { graph, partnerId } = remarry(threeGenerations(), MOTHER, "M");
  const layout = layoutFamily(graph);
  const mother = point(layout, idOf(graph, MOTHER));
  const client = point(layout, idOf(graph, CLIENT));
  const firstBar = layout.coupleBars.find((bar) => bar.kind === "divorce")!;
  assert.ok(client.x > firstBar.leftX && client.x < firstBar.rightX, "the client still hangs from the first marriage");
  const laterBar = layout.coupleBars.find((bar) => [bar.leftId, bar.rightId].includes(partnerId))!;
  assert.equal(laterBar.leftId, partnerId);
  assert.equal(laterBar.rightId, idOf(graph, MOTHER));
  assert.equal(laterBar.leftX, point(layout, partnerId).x);
  assert.equal(laterBar.rightX, mother.x);
  assert.equal(laterBar.kind, "remarriage");
  assert.ok(laterBar.barY > firstBar.barY, "the remarriage line runs below the first couple's line, not on it");
});

function parentIdsOf(graph: FamilyGraph, childId: string): string[] {
  return graph.edges.filter((edge) => edge.kind === "parent" && edge.target === childId).map((edge) => edge.source);
}

function withChild(graph: FamilyGraph, anchorId: string): { graph: FamilyGraph; childId: string } {
  const next = addRelative(graph, { name: "", gender: "M", relation: "child", anchorId });
  return { graph: next, childId: next.nodes[next.nodes.length - 1].id };
}

function assertDrawnApart(graph: FamilyGraph, layout: FamilyLayout) {
  assertNoGlyphOverlap(graph, layout);
  assertChildrenStayOnTheirCoupleBar(graph, layout);
  assertNoDropCrossesForeignGlyph(graph, layout);
  assertCollateralDoesNotCoverDirect(graph, layout);
}

/** Mother has the client and a brother from her first marriage, then two children with her new husband. */
function motherRemarriedWithChildren() {
  let base = threeGenerations();
  base = addRelative(base, { name: "", gender: "M", relation: "sibling", anchorId: idOf(base, CLIENT) });
  const firstChildIds = [idOf(base, CLIENT), base.nodes[base.nodes.length - 1].id];
  const remarried = remarry(base, MOTHER, "M");
  const fromPartner = withChild(remarried.graph, remarried.partnerId);
  const fromMother = withChild(fromPartner.graph, idOf(base, MOTHER));
  return {
    graph: fromMother.graph,
    partnerId: remarried.partnerId,
    firstChildIds,
    laterChildIds: [fromPartner.childId, fromMother.childId],
  };
}

test("a child added to a remarried mother belongs to her current husband, not the divorced one", () => {
  const { graph, partnerId, laterChildIds } = motherRemarriedWithChildren();
  for (const childId of laterChildIds) {
    assert.deepEqual(new Set(parentIdsOf(graph, childId)), new Set([idOf(graph, MOTHER), partnerId]));
  }
});

test("the remarried mother's children hang from the remarriage line, clear of the first marriage's children", () => {
  const { graph, partnerId, firstChildIds, laterChildIds } = motherRemarriedWithChildren();
  const layout = layoutFamily(graph);
  const laterBar = layout.coupleBars.find((bar) => bar.leftId === partnerId)!;
  for (const childId of laterChildIds) {
    const child = point(layout, childId);
    assert.equal(child.y, point(layout, idOf(graph, CLIENT)).y, "half-siblings share the client's row");
    assert.ok(child.x > laterBar.leftX && child.x < laterBar.rightX, "and hang between the mother and her new husband");
  }
  const firstEdge = Math.max(...firstChildIds.map((id) => point(layout, id).x));
  const laterEdge = Math.min(...laterChildIds.map((id) => point(layout, id).x));
  assert.ok(firstEdge < laterEdge, "the first marriage's children stay on the father's side");
  assertDrawnApart(graph, layout);
});

test("a remarried father's children with his new wife sit on his side without touching the first children", () => {
  let base = threeGenerations();
  base = addRelative(base, { name: "", gender: "F", relation: "sibling", anchorId: idOf(base, CLIENT) });
  const remarried = remarry(base, FATHER, "F");
  let { graph } = withChild(remarried.graph, remarried.partnerId);
  graph = withChild(graph, remarried.partnerId).graph;
  graph = withChild(graph, remarried.partnerId).graph;
  const layout = layoutFamily(graph);
  const laterChildren = layout.nodes.filter((node) => parentIdsOf(graph, node.id).includes(remarried.partnerId));
  assert.equal(laterChildren.length, 3);
  const firstChildren = layout.nodes.filter(
    (node) => parentIdsOf(graph, node.id).includes(idOf(graph, MOTHER)),
  );
  assert.ok(Math.max(...laterChildren.map((node) => node.x)) < Math.min(...firstChildren.map((node) => node.x)));
  assertDrawnApart(graph, layout);
});

test("a remarried client's children from both marriages are drawn apart under their own couple lines", () => {
  let graph = addRelative(EMPTY_GRAPH, { name: "", gender: "F", relation: "self", isIndexPerson: true });
  graph = addRelative(graph, { name: "", gender: "M", relation: "spouse", anchorId: idOf(graph, CLIENT) });
  graph = withChild(graph, idOf(graph, CLIENT)).graph;
  graph = withChild(graph, idOf(graph, CLIENT)).graph;
  graph = divorced(graph, CLIENT, FATHER);
  graph = addRelative(graph, { name: "", gender: "M", relation: "spouse", anchorId: idOf(graph, CLIENT) });
  const laterHusbandId = graph.nodes[graph.nodes.length - 1].id;
  graph = withChild(graph, idOf(graph, CLIENT)).graph;
  graph = withChild(graph, idOf(graph, CLIENT)).graph;
  const laterChildren = graph.nodes.filter((node) => parentIdsOf(graph, node.id).includes(laterHusbandId));
  assert.equal(laterChildren.length, 2);
  assertDrawnApart(graph, layoutFamily(graph));
});

test("both parents remarried with children keep all three families apart", () => {
  const { graph: base } = motherRemarriedWithChildren();
  let graph = addRelative(base, { name: "", gender: "F", relation: "spouse", anchorId: idOf(base, FATHER) });
  const stepMotherId = graph.nodes[graph.nodes.length - 1].id;
  graph = withChild(graph, stepMotherId).graph;
  graph = withChild(graph, stepMotherId).graph;
  assertDrawnApart(graph, layoutFamily(graph));
});

test("a remarried aunt's children from both marriages stay clear at the collateral size", () => {
  let graph = threeGenerations();
  graph = addRelative(graph, { name: "", gender: "F", relation: "sibling", anchorId: idOf(graph, MOTHER) });
  const auntId = graph.nodes[graph.nodes.length - 1].id;
  graph = addRelative(graph, { name: "", gender: "M", relation: "spouse", anchorId: auntId });
  const firstUncleId = graph.nodes[graph.nodes.length - 1].id;
  graph = withChild(graph, auntId).graph;
  graph = withChild(graph, auntId).graph;
  graph = {
    ...graph,
    edges: graph.edges.map((edge) =>
      edge.kind === "marriage" && [edge.source, edge.target].includes(firstUncleId) ? { ...edge, kind: "divorce" } : edge,
    ),
  };
  graph = addRelative(graph, { name: "", gender: "M", relation: "spouse", anchorId: auntId });
  graph = withChild(graph, auntId).graph;
  graph = withChild(graph, auntId).graph;
  assertDrawnApart(graph, layoutFamily(graph));
});

test("a married half-sibling's own family stays clear of everyone else", () => {
  const { graph: base, laterChildIds } = motherRemarriedWithChildren();
  let graph = addRelative(base, { name: "", gender: "F", relation: "spouse", anchorId: laterChildIds[0] });
  graph = withChild(graph, laterChildIds[0]).graph;
  graph = withChild(graph, laterChildIds[0]).graph;
  const layout = layoutFamily(graph);
  assert.ok(layout.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)));
  assertDrawnApart(graph, layout);
});

test("the mother's older sibling on the new husband's side moves over instead of landing on him", () => {
  let base = threeGenerations();
  base = addRelative(base, { name: "", gender: "M", relation: "sibling", anchorId: idOf(base, MOTHER) });
  base = withBirthYear(base, base.nodes.length, 1975);
  const siblingId = base.nodes[base.nodes.length - 1].id;
  base = addRelative(base, { name: "", gender: "M", relation: "child", anchorId: siblingId });
  const { graph, partnerId } = remarry(base, MOTHER, "M");
  const layout = layoutFamily(graph);
  assert.ok(point(layout, siblingId).x < point(layout, partnerId).x, "the older sibling stays to the left of him");
  assert.deepEqual(overlappedBy(layout, graph, partnerId), []);
});

test("a remarried client's later husband sits inside the first couple without touching the first husband", () => {
  let graph = addRelative(EMPTY_GRAPH, { name: "", gender: "F", relation: "self", isIndexPerson: true });
  graph = addRelative(graph, { name: "", gender: "M", relation: "spouse", anchorId: idOf(graph, CLIENT) });
  graph = addRelative(graph, { name: "", gender: "M", relation: "child", anchorId: idOf(graph, CLIENT) });
  graph = addRelative(graph, { name: "", gender: "M", relation: "spouse", anchorId: idOf(graph, CLIENT) });
  const partnerId = graph.nodes[3].id;
  const layout = layoutFamily(graph);
  const client = point(layout, idOf(graph, CLIENT));
  assert.ok(directLineIds(graph).has(idOf(graph, FATHER)), "the co-parent stays on the direct line");
  assert.equal(directLineIds(graph).has(partnerId), false);
  const firstHusband = point(layout, idOf(graph, FATHER));
  assert.ok(firstHusband.x < point(layout, partnerId).x && point(layout, partnerId).x < client.x);
  assert.deepEqual(overlappedBy(layout, graph, partnerId), []);
});

test("a spouse added to someone already married is recorded as a remarriage", () => {
  const { graph, partnerId } = remarry(threeGenerations(), MOTHER, "M");
  const edge = graph.edges.find((item) => item.source === partnerId || item.target === partnerId)!;
  assert.equal(edge.kind, "remarriage");
});
