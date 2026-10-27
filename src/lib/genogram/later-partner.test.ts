import assert from "node:assert/strict";
import { test } from "node:test";
import { MIN_COUPLE_GAP } from "./constants";
import { glyphReach } from "./glyph";
import { type FamilyLayout, directLineIds, layoutFamily } from "./layout";
import { addRelative } from "./relations";
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

test("a remarried mother's new husband sits on her far side from the first husband, on her row", () => {
  const { graph, partnerId } = remarry(threeGenerations(), MOTHER, "M");
  const layout = layoutFamily(graph);
  const mother = point(layout, idOf(graph, MOTHER));
  const father = point(layout, idOf(graph, FATHER));
  const partner = point(layout, partnerId);
  assert.ok(father.x < mother.x, "the first husband keeps the left seat");
  assert.ok(partner.x > mother.x, "the new husband goes to the right even though he is a man");
  assert.ok(partner.x - mother.x < MIN_COUPLE_GAP, "and stays right beside her");
  assert.equal(partner.y, mother.y);
  assert.deepEqual(overlappedBy(layout, graph, partnerId), []);
});

test("a remarried father's new wife sits on his far side, to his left", () => {
  const { graph, partnerId } = remarry(threeGenerations(), FATHER, "F");
  const layout = layoutFamily(graph);
  const father = point(layout, idOf(graph, FATHER));
  const partner = point(layout, partnerId);
  assert.ok(partner.x < father.x);
  assert.ok(father.x - partner.x < MIN_COUPLE_GAP);
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
  assert.equal(laterBar.leftId, idOf(graph, MOTHER));
  assert.equal(laterBar.leftX, mother.x);
  assert.equal(laterBar.rightX, point(layout, partnerId).x);
  assert.equal(laterBar.kind, "remarriage");
});

test("the mother's younger sibling moves over instead of landing on the new husband", () => {
  let base = threeGenerations();
  base = addRelative(base, { name: "", gender: "M", relation: "sibling", anchorId: idOf(base, MOTHER) });
  base = withBirthYear(base, base.nodes.length, 1985);
  const { graph, partnerId } = remarry(base, MOTHER, "M");
  const layout = layoutFamily(graph);
  const sibling = point(layout, graph.nodes[base.nodes.length - 1].id);
  assert.ok(sibling.x > point(layout, partnerId).x, "the younger sibling stays to the right of the new husband");
  assert.deepEqual(overlappedBy(layout, graph, partnerId), []);
});

test("a remarried client keeps the first spouse beside them and the later one outside", () => {
  let graph = addRelative(EMPTY_GRAPH, { name: "", gender: "F", relation: "self", isIndexPerson: true });
  graph = addRelative(graph, { name: "", gender: "M", relation: "spouse", anchorId: idOf(graph, CLIENT) });
  graph = addRelative(graph, { name: "", gender: "M", relation: "child", anchorId: idOf(graph, CLIENT) });
  graph = addRelative(graph, { name: "", gender: "M", relation: "spouse", anchorId: idOf(graph, CLIENT) });
  const partnerId = graph.nodes[3].id;
  const layout = layoutFamily(graph);
  const client = point(layout, idOf(graph, CLIENT));
  assert.ok(directLineIds(graph).has(idOf(graph, FATHER)), "the co-parent stays on the direct line");
  assert.equal(directLineIds(graph).has(partnerId), false);
  assert.ok(point(layout, partnerId).x > client.x);
  assert.deepEqual(overlappedBy(layout, graph, partnerId), []);
});

test("a spouse added to someone already married is recorded as a remarriage", () => {
  const { graph, partnerId } = remarry(threeGenerations(), MOTHER, "M");
  const edge = graph.edges.find((item) => item.source === partnerId || item.target === partnerId)!;
  assert.equal(edge.kind, "remarriage");
});
