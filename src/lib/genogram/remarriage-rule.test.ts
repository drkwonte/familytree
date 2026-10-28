import assert from "node:assert/strict";
import { test } from "node:test";
import { SPOUSE_ALREADY_EXISTS_MESSAGE, applyInteraction } from "./interactions";
import { layoutFamily } from "./layout";
import { hasCurrentSpouse } from "./partners";
import { addRelative } from "./relations";
import { divorcedSpouseQuestion, remarriageQuestion } from "./spouse-history";
import {
  assertChildrenStayOnTheirCoupleBar,
  assertNoDropCrossesForeignGlyph,
  assertNoGlyphOverlap,
} from "./test-support/layout-assertions";
import { EMPTY_GRAPH, type FamilyGraph } from "./types";
import { validateNewPerson } from "./validate";

const CLIENT = 1;
const HUSBAND = 2;

function idOf(graph: FamilyGraph, displayNumber: number): string {
  return graph.nodes.find((node) => node.data.displayNumber === displayNumber)!.id;
}

function married(): FamilyGraph {
  const graph = addRelative(EMPTY_GRAPH, { name: "", gender: "F", relation: "self", isIndexPerson: true });
  return addRelative(graph, { name: "", gender: "M", relation: "spouse", anchorId: idOf(graph, CLIENT) });
}

function withCoupleKind(graph: FamilyGraph, kind: "divorce" | "separation" | "cohabitation"): FamilyGraph {
  return { ...graph, edges: graph.edges.map((edge) => ({ ...edge, kind })) };
}

function coupleKindBetween(graph: FamilyGraph, first: number, second: number): string | undefined {
  const ids = [idOf(graph, first), idOf(graph, second)];
  return graph.edges.find((edge) => ids.includes(edge.source) && ids.includes(edge.target))?.kind;
}

test("a spouse can be added to a married person, because an earlier ex may be drawn after the current family", () => {
  assert.equal(
    validateNewPerson({ age: "", vitalStatus: "alive", hasExistingPeople: true, relation: "spouse", anchorId: "node_a" }),
    null,
  );
});

test("adding a spouse to a married person first asks whether the new person is a divorced ex", () => {
  const graph = married();
  assert.equal(
    divorcedSpouseQuestion(graph, idOf(graph, CLIENT)),
    "이미 등록된 배우자가 있습니다. 새로 추가한 인물3은(는) 과거에 이혼한 전 배우자인가요?",
  );
  assert.equal(
    remarriageQuestion(graph, idOf(graph, CLIENT)),
    "그렇다면 기존 배우자 인물2와(과) 이혼한 뒤 인물3과(와) 재혼한 것인가요?",
  );
});

test("nothing is asked when the person has no current spouse", () => {
  const graph = married();
  assert.equal(divorcedSpouseQuestion(withCoupleKind(graph, "divorce"), idOf(graph, CLIENT)), null);
  assert.equal(divorcedSpouseQuestion(EMPTY_GRAPH, "nobody"), null);
});

test("a divorced ex added later is joined by a divorce and the current marriage stays as it was", () => {
  const graph = married();
  const next = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "spouse",
    anchorId: idOf(graph, CLIENT),
    spouseHistory: "divorcedEx",
  });
  assert.equal(coupleKindBetween(next, CLIENT, 3), "divorce");
  assert.equal(coupleKindBetween(next, CLIENT, HUSBAND), "marriage");
});

test("a remarriage marks the existing marriage as a divorce", () => {
  const graph = married();
  const next = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "spouse",
    anchorId: idOf(graph, CLIENT),
    spouseHistory: "remarriage",
  });
  assert.equal(coupleKindBetween(next, CLIENT, HUSBAND), "divorce");
  assert.equal(coupleKindBetween(next, CLIENT, 3), "remarriage");
  assert.equal(hasCurrentSpouse(next, idOf(next, HUSBAND)), false);
});

test("an ex added after the current family, with a child of their own, is drawn clear of that family", () => {
  let graph = married();
  graph = addRelative(graph, { name: "", gender: "F", relation: "child", anchorId: idOf(graph, CLIENT) });
  graph = addRelative(graph, { name: "", gender: "M", relation: "child", anchorId: idOf(graph, CLIENT) });
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "spouse",
    anchorId: idOf(graph, CLIENT),
    spouseHistory: "divorcedEx",
  });
  const exId = graph.nodes[graph.nodes.length - 1].id;
  graph = addRelative(graph, { name: "", gender: "F", relation: "child", anchorId: exId });
  const layout = layoutFamily(graph);
  assertNoGlyphOverlap(graph, layout);
  assertChildrenStayOnTheirCoupleBar(graph, layout);
  assertNoDropCrossesForeignGlyph(graph, layout);
});

test("married, separated or cohabiting people still have a spouse; divorced people do not", () => {
  const graph = married();
  assert.equal(hasCurrentSpouse(graph, idOf(graph, CLIENT)), true);
  assert.equal(hasCurrentSpouse(withCoupleKind(graph, "separation"), idOf(graph, CLIENT)), true);
  assert.equal(hasCurrentSpouse(withCoupleKind(graph, "cohabitation"), idOf(graph, CLIENT)), true);
  assert.equal(hasCurrentSpouse(withCoupleKind(graph, "divorce"), idOf(graph, HUSBAND)), false);
  assert.equal(hasCurrentSpouse(EMPTY_GRAPH, "nobody"), false);
});

test("a widowed person has no current spouse, so remarrying asks nothing", () => {
  const graph = married();
  const widowed = {
    ...graph,
    nodes: graph.nodes.map((node) =>
      node.data.displayNumber === HUSBAND ? { ...node, data: { ...node.data, vitalStatus: "deceased" as const } } : node,
    ),
  };
  assert.equal(hasCurrentSpouse(widowed, idOf(widowed, CLIENT)), false);
  assert.equal(divorcedSpouseQuestion(widowed, idOf(widowed, CLIENT)), null);
});

test("an affair is not a marriage, so it does not count as a spouse", () => {
  const graph = married();
  const withAffair = addRelative(withCoupleKind(graph, "divorce"), {
    name: "",
    gender: "M",
    relation: "spouse",
    anchorId: idOf(graph, CLIENT),
  });
  const affair = {
    ...withAffair,
    edges: withAffair.edges.map((edge) => (edge.kind === "remarriage" ? { ...edge, kind: "affair" as const } : edge)),
  };
  assert.equal(hasCurrentSpouse(affair, idOf(affair, CLIENT)), false);
});

test("after remarrying, the divorce cannot be turned back into a marriage from the interaction menus", () => {
  const divorced = withCoupleKind(married(), "divorce");
  const remarried = addRelative(divorced, { name: "", gender: "M", relation: "spouse", anchorId: idOf(divorced, CLIENT) });
  const result = applyInteraction(remarried, {
    firstId: idOf(remarried, CLIENT),
    secondId: idOf(remarried, HUSBAND),
    action: { type: "setRelation", kind: "marriage" },
  });
  assert.equal(result.ok, false);
  assert.equal(result.message, SPOUSE_ALREADY_EXISTS_MESSAGE);
});

test("the divorce of a person who never remarried can still be undone", () => {
  const divorced = withCoupleKind(married(), "divorce");
  const result = applyInteraction(divorced, {
    firstId: idOf(divorced, CLIENT),
    secondId: idOf(divorced, HUSBAND),
    action: { type: "setRelation", kind: "marriage" },
  });
  assert.equal(result.ok, true);
});
