import assert from "node:assert/strict";
import { test } from "node:test";
import { applyChatChanges, parseChatReply } from "./chat-changes";
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

test("a reply is read into a message and its changes", () => {
  const reply = parseChatReply(
    JSON.stringify({
      assistantMessage: "갈등을 표시했습니다.",
      changes: [{ type: "setRelation", from: 2, to: 3, kind: "conflict" }],
    }),
  );
  assert.equal(reply.ok, true);
  if (!reply.ok) return;
  assert.equal(reply.assistantMessage, "갈등을 표시했습니다.");
  assert.deepEqual(reply.changes, [{ type: "setRelation", from: 2, to: 3, kind: "conflict" }]);
  assert.deepEqual(reply.problems, []);
});

test("malformed changes are skipped and reported instead of failing the whole reply", () => {
  const reply = parseChatReply(
    JSON.stringify({
      assistantMessage: "ok",
      changes: [
        { type: "setRelation", from: 2, to: 3, kind: "conflict" },
        { type: "setRelation", from: "2", to: 3, kind: "conflict" },
        { type: "setRelation", from: 2, to: 3, kind: "hates" },
        { type: "teleport" },
      ],
    }),
  );
  assert.equal(reply.ok, true);
  if (!reply.ok) return;
  assert.equal(reply.changes.length, 1);
  assert.equal(reply.problems.length, 1);
});

test("text that is not a JSON object is rejected with a readable error", () => {
  for (const text of ["", "<!DOCTYPE html>", "[]", "null"]) {
    const reply = parseChatReply(text);
    assert.equal(reply.ok, false, text);
  }
});

test("an emotional relation is drawn between the numbered people", () => {
  const graph = family();
  const { graph: next, problems } = applyChatChanges(graph, [
    { type: "setRelation", from: 2, to: 3, kind: "conflict" },
    { type: "setRelation", from: 3, to: 1, kind: "focused" },
  ]);
  assert.deepEqual(problems, []);
  assert.deepEqual(
    emotionalEdges(next).map((edge) => [edge.source, edge.target, edge.kind]),
    [
      [idOf(graph, 2), idOf(graph, 3), "conflict"],
      [idOf(graph, 3), idOf(graph, 1), "focused"],
    ],
  );
});

test("a new emotional relation replaces the old one between the same pair, in either direction", () => {
  const first = applyChatChanges(family(), [{ type: "setRelation", from: 2, to: 3, kind: "close" }]).graph;
  const second = applyChatChanges(first, [{ type: "setRelation", from: 3, to: 2, kind: "cutoff" }]).graph;
  assert.deepEqual(emotionalEdges(second).map((edge) => edge.kind), ["cutoff"]);
});

test("an emotional relation can be removed", () => {
  const drawn = applyChatChanges(family(), [{ type: "setRelation", from: 2, to: 3, kind: "close" }]).graph;
  const { graph, problems } = applyChatChanges(drawn, [{ type: "removeRelation", from: 3, to: 2 }]);
  assert.deepEqual(problems, []);
  assert.deepEqual(emotionalEdges(graph), []);
});

test("a couple's status changes on the existing couple line, keeping its id", () => {
  const graph = family();
  const couple = graph.edges.find((edge) => edge.kind === "marriage")!;
  const { graph: next } = applyChatChanges(graph, [
    { type: "setRelation", from: 2, to: 3, kind: "divorce", year: 2015 },
  ]);
  const updated = next.edges.find((edge) => edge.id === couple.id)!;
  assert.equal(updated.kind, "divorce");
  assert.equal(updated.year, 2015);
  assert.equal(next.edges.filter((edge) => edge.category === "structural").length, graph.edges.length);
});

test("a parent line can become adoption without changing who is the parent", () => {
  const graph = family();
  const { graph: next } = applyChatChanges(graph, [{ type: "setRelation", from: 1, to: 2, kind: "adopted" }]);
  const line = next.edges.find(
    (edge) => edge.kind === "adopted" && edge.target === idOf(graph, 1) && edge.source === idOf(graph, 2),
  );
  assert.ok(line, "the father stays the source of the adoption line");
});

test("people who are not in the genogram are reported, not invented", () => {
  const graph = family();
  const { graph: next, problems } = applyChatChanges(graph, [
    { type: "setRelation", from: 2, to: 99, kind: "conflict" },
    { type: "setRelation", from: 2, to: 2, kind: "conflict" },
  ]);
  assert.equal(next.edges.length, graph.edges.length);
  assert.equal(problems.length, 2);
  assert.match(problems[0], /인물99/);
});

test("households are added and removed by their members", () => {
  const added = applyChatChanges(family(), [{ type: "setHousehold", members: [1, 2, 3] }]).graph;
  assert.equal(added.households.length, 1);
  assert.deepEqual(new Set(added.households[0].memberIds), new Set([1, 2, 3].map((n) => idOf(added, n))));
  const again = applyChatChanges(added, [{ type: "setHousehold", members: [3, 2, 1] }]).graph;
  assert.equal(again.households.length, 1, "the same household is not drawn twice");
  const removed = applyChatChanges(added, [{ type: "removeHousehold", members: [1, 2] }]).graph;
  assert.deepEqual(removed.households, []);
});

test("applying changes keeps everything else about the genogram", () => {
  const graph = family();
  const { graph: next } = applyChatChanges(graph, [{ type: "setRelation", from: 2, to: 3, kind: "close" }]);
  assert.equal(next.collateralScale, 0.6);
  assert.deepEqual(next.nodes, graph.nodes);
});
