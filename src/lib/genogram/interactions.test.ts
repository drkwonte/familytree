import assert from "node:assert/strict";
import { test } from "node:test";
import { renderFamilyGraphSvg } from "./draw";
import {
  type Interaction,
  type InteractionResult,
  applyInteraction,
  emotionalLineDeletePrompt,
  removeEmotionalLine,
} from "./interactions";
import { addRelative } from "./relations";
import { EMPTY_GRAPH, type FamilyGraph } from "./types";

function family(): FamilyGraph {
  let graph = addRelative(EMPTY_GRAPH, { name: "", gender: "F", relation: "self", isIndexPerson: true });
  const client = graph.nodes[0].id;
  graph = addRelative(graph, { name: "", gender: "M", relation: "father", anchorId: client });
  graph = addRelative(graph, { name: "", gender: "F", relation: "mother", anchorId: client });
  graph = addRelative(graph, { name: "", gender: "M", relation: "sibling", anchorId: client });
  return { ...graph, collateralScale: 0.6 };
}

const idOf = (graph: FamilyGraph, displayNumber: number) =>
  graph.nodes.find((node) => node.data.displayNumber === displayNumber)!.id;

const emotionalEdges = (graph: FamilyGraph) => graph.edges.filter((edge) => edge.category === "emotional");

function between(graph: FamilyGraph, first: number, second: number, action: Interaction["action"]): Interaction {
  return { firstId: idOf(graph, first), secondId: idOf(graph, second), action };
}

function drawn(result: InteractionResult): FamilyGraph {
  assert.ok(result.ok, result.message);
  return result.graph;
}

function withConflict(): { graph: FamilyGraph; lineId: string } {
  const base = family();
  const graph = drawn(applyInteraction(base, between(base, 2, 3, { type: "setRelation", kind: "conflict" })));
  return { graph, lineId: emotionalEdges(graph)[0].id };
}

test("a clicked relationship line is named for the deletion prompt", () => {
  const { graph, lineId } = withConflict();
  assert.equal(emotionalLineDeletePrompt(graph, lineId), "인물2·인물3 사이의 갈등 관계를 지울까요?");
});

test("only relationship lines can be deleted by clicking, not family lines or missing ones", () => {
  const { graph } = withConflict();
  const coupleLine = graph.edges.find((edge) => edge.category === "structural")!;
  assert.equal(emotionalLineDeletePrompt(graph, coupleLine.id), null);
  assert.equal(emotionalLineDeletePrompt(graph, "missing"), null);
  assert.equal(removeEmotionalLine(graph, coupleLine.id), graph);
});

test("deleting a relationship line removes only that line", () => {
  const { graph: conflicted, lineId } = withConflict();
  const graph = drawn(applyInteraction(conflicted, between(conflicted, 1, 4, { type: "setRelation", kind: "close" })));
  const remaining = removeEmotionalLine(graph, lineId);
  assert.deepEqual(emotionalEdges(remaining).map((edge) => edge.kind), ["close"]);
  assert.equal(remaining.edges.length, graph.edges.length - 1);
});

test("relationship lines are clickable while editing, and the final drawing has no click targets", () => {
  const { graph, lineId } = withConflict();
  assert.match(renderFamilyGraphSvg(graph, "edit"), new RegExp(`data-relation-id="${lineId}"`));
  assert.doesNotMatch(renderFamilyGraphSvg(graph, "final"), /data-relation-id/);
});

test("an emotional relation is drawn from the first person to the second", () => {
  const graph = family();
  const result = applyInteraction(graph, between(graph, 3, 1, { type: "setRelation", kind: "focused" }));
  assert.deepEqual(
    emotionalEdges(drawn(result)).map((edge) => [edge.source, edge.target, edge.kind]),
    [[idOf(graph, 3), idOf(graph, 1), "focused"]],
  );
  assert.match(result.message, /인물3.*인물1.*과잉개입/);
});

test("a new emotional relation replaces the old one between the same pair, in either direction", () => {
  const graph = family();
  const first = drawn(applyInteraction(graph, between(graph, 2, 3, { type: "setRelation", kind: "close" })));
  const second = drawn(applyInteraction(first, between(first, 3, 2, { type: "setRelation", kind: "cutoff" })));
  assert.deepEqual(emotionalEdges(second).map((edge) => edge.kind), ["cutoff"]);
});

test("drawing the relation that is already there is reported instead of redrawn", () => {
  const graph = family();
  const once = drawn(applyInteraction(graph, between(graph, 2, 3, { type: "setRelation", kind: "close" })));
  const twice = applyInteraction(once, between(once, 3, 2, { type: "setRelation", kind: "close" }));
  assert.equal(twice.ok, false);
  assert.match(twice.message, /이미/);
});

test("an emotional relation can be removed, and removing nothing is reported", () => {
  const graph = family();
  const withLine = drawn(applyInteraction(graph, between(graph, 2, 3, { type: "setRelation", kind: "close" })));
  const removed = drawn(applyInteraction(withLine, between(withLine, 3, 2, { type: "removeRelation" })));
  assert.deepEqual(emotionalEdges(removed), []);
  assert.equal(applyInteraction(removed, between(removed, 3, 2, { type: "removeRelation" })).ok, false);
});

test("a couple's status changes on the existing couple line, keeping its id and year", () => {
  const graph = family();
  const couple = graph.edges.find((edge) => edge.kind === "marriage")!;
  const withYear = { ...graph, edges: graph.edges.map((edge) => (edge === couple ? { ...edge, year: 1990 } : edge)) };
  const next = drawn(applyInteraction(withYear, between(withYear, 2, 3, { type: "setRelation", kind: "divorce" })));
  const updated = next.edges.find((edge) => edge.id === couple.id)!;
  assert.equal(updated.kind, "divorce");
  assert.equal(updated.year, 1990);
  assert.equal(next.edges.length, graph.edges.length);
});

test("a parent line can become adoption without changing who is the parent", () => {
  const graph = family();
  const next = drawn(applyInteraction(graph, between(graph, 1, 2, { type: "setRelation", kind: "adopted" })));
  const line = next.edges.find(
    (edge) => edge.kind === "adopted" && edge.target === idOf(graph, 1) && edge.source === idOf(graph, 2),
  );
  assert.ok(line, "the father stays the source of the adoption line");
});

test("a person cannot have an interaction with themselves", () => {
  const graph = family();
  const result = applyInteraction(graph, between(graph, 2, 2, { type: "setRelation", kind: "conflict" }));
  assert.equal(result.ok, false);
});

test("a person who is no longer in the genogram is reported, not invented", () => {
  const graph = family();
  const result = applyInteraction(graph, {
    firstId: idOf(graph, 2),
    secondId: "missing",
    action: { type: "setRelation", kind: "conflict" },
  });
  assert.equal(result.ok, false);
});

test("pairs joined one by one grow a single household", () => {
  const graph = family();
  const pair = drawn(applyInteraction(graph, between(graph, 1, 2, { type: "joinHousehold" })));
  const trio = drawn(applyInteraction(pair, between(pair, 3, 2, { type: "joinHousehold" })));
  assert.equal(trio.households.length, 1);
  assert.deepEqual(new Set(trio.households[0].memberIds), new Set([1, 2, 3].map((n) => idOf(trio, n))));
  assert.equal(applyInteraction(trio, between(trio, 1, 3, { type: "joinHousehold" })).ok, false);
});

test("joining two people from different households merges them into one", () => {
  const graph = family();
  const first = drawn(applyInteraction(graph, between(graph, 1, 2, { type: "joinHousehold" })));
  const second = drawn(applyInteraction(first, between(first, 3, 4, { type: "joinHousehold" })));
  const merged = drawn(applyInteraction(second, between(second, 2, 3, { type: "joinHousehold" })));
  assert.equal(merged.households.length, 1);
  assert.equal(merged.households[0].memberIds.length, 4);
});

test("a household both people share can be taken apart", () => {
  const graph = family();
  const joined = drawn(applyInteraction(graph, between(graph, 1, 2, { type: "joinHousehold" })));
  const apart = drawn(applyInteraction(joined, between(joined, 2, 1, { type: "leaveHousehold" })));
  assert.deepEqual(apart.households, []);
  assert.equal(applyInteraction(apart, between(apart, 1, 2, { type: "leaveHousehold" })).ok, false);
});

test("an interaction keeps everything else about the genogram", () => {
  const graph = family();
  const next = drawn(applyInteraction(graph, between(graph, 2, 3, { type: "setRelation", kind: "close" })));
  assert.equal(next.collateralScale, 0.6);
  assert.deepEqual(next.nodes, graph.nodes);
});
