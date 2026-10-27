import assert from "node:assert/strict";
import { test } from "node:test";
import { applyInteraction } from "./interactions";
import { hasCurrentSpouse } from "./partners";
import { addRelative } from "./relations";
import { EMPTY_GRAPH, type FamilyGraph } from "./types";
import { SPOUSE_ALREADY_EXISTS_MESSAGE, validateNewPerson } from "./validate";

function idOf(graph: FamilyGraph, displayNumber: number): string {
  return graph.nodes.find((node) => node.data.displayNumber === displayNumber)!.id;
}

function married(): FamilyGraph {
  const graph = addRelative(EMPTY_GRAPH, { name: "", gender: "F", relation: "self", isIndexPerson: true });
  return addRelative(graph, { name: "", gender: "M", relation: "spouse", anchorId: idOf(graph, 1) });
}

function withCoupleKind(graph: FamilyGraph, kind: "divorce" | "separation" | "cohabitation"): FamilyGraph {
  return { ...graph, edges: graph.edges.map((edge) => ({ ...edge, kind })) };
}

function newSpouseFor(anchorHasCurrentSpouse: boolean) {
  return validateNewPerson({
    age: "",
    vitalStatus: "alive",
    hasExistingPeople: true,
    relation: "spouse",
    anchorId: "node_a",
    anchorHasCurrentSpouse,
  });
}

test("a spouse cannot be added while the current marriage has not ended in divorce", () => {
  assert.equal(newSpouseFor(true), SPOUSE_ALREADY_EXISTS_MESSAGE);
  assert.equal(SPOUSE_ALREADY_EXISTS_MESSAGE, "이미 배우자가 있습니다.");
  assert.equal(newSpouseFor(false), null);
});

test("only a spouse addition is blocked; other relatives of a married person are fine", () => {
  assert.equal(
    validateNewPerson({
      age: "",
      vitalStatus: "alive",
      hasExistingPeople: true,
      relation: "child",
      anchorId: "node_a",
      anchorHasCurrentSpouse: true,
    }),
    null,
  );
});

test("married, separated or cohabiting people still have a spouse; divorced people do not", () => {
  const graph = married();
  assert.equal(hasCurrentSpouse(graph, idOf(graph, 1)), true);
  assert.equal(hasCurrentSpouse(withCoupleKind(graph, "separation"), idOf(graph, 1)), true);
  assert.equal(hasCurrentSpouse(withCoupleKind(graph, "cohabitation"), idOf(graph, 1)), true);
  assert.equal(hasCurrentSpouse(withCoupleKind(graph, "divorce"), idOf(graph, 2)), false);
  assert.equal(hasCurrentSpouse(EMPTY_GRAPH, "nobody"), false);
});

test("an affair is not a marriage, so it does not count as a spouse", () => {
  const graph = married();
  const withAffair = addRelative(withCoupleKind(graph, "divorce"), {
    name: "",
    gender: "M",
    relation: "spouse",
    anchorId: idOf(graph, 1),
  });
  const affair = {
    ...withAffair,
    edges: withAffair.edges.map((edge) => (edge.kind === "remarriage" ? { ...edge, kind: "affair" as const } : edge)),
  };
  assert.equal(hasCurrentSpouse(affair, idOf(affair, 1)), false);
});

test("after remarrying, the divorce cannot be turned back into a marriage", () => {
  const divorced = withCoupleKind(married(), "divorce");
  const remarried = addRelative(divorced, { name: "", gender: "M", relation: "spouse", anchorId: idOf(divorced, 1) });
  const result = applyInteraction(remarried, {
    firstId: idOf(remarried, 1),
    secondId: idOf(remarried, 2),
    action: { type: "setRelation", kind: "marriage" },
  });
  assert.equal(result.ok, false);
  assert.equal(result.message, SPOUSE_ALREADY_EXISTS_MESSAGE);
});

test("the divorce of a person who never remarried can still be undone", () => {
  const divorced = withCoupleKind(married(), "divorce");
  const result = applyInteraction(divorced, {
    firstId: idOf(divorced, 1),
    secondId: idOf(divorced, 2),
    action: { type: "setRelation", kind: "marriage" },
  });
  assert.equal(result.ok, true);
});
