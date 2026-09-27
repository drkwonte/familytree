import assert from "node:assert/strict";
import { test } from "node:test";
import { pushGraphHistory, redoGraphChange, undoGraphChange } from "./history";
import { addRelative } from "./relations";
import { EMPTY_GRAPH } from "./types";

test("undo and redo restore previous graphs", () => {
  const first = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "F",
    relation: "self",
    isIndexPerson: true,
  });
  const second = addRelative(first, {
    name: "",
    gender: "M",
    relation: "spouse",
    anchorId: first.nodes[0].id,
  });
  const past = pushGraphHistory([], first);
  const undone = undoGraphChange(past, [], second);
  assert.ok(undone);
  assert.equal(undone.graph.nodes.length, 1);
  assert.equal(undone.past.length, 0);
  const redone = redoGraphChange(undone.past, undone.future, undone.graph);
  assert.ok(redone);
  assert.equal(redone.graph.nodes.length, 2);
});

test("undo does nothing when there is no history", () => {
  assert.equal(undoGraphChange([], [], EMPTY_GRAPH), null);
  assert.equal(redoGraphChange([], [], EMPTY_GRAPH), null);
});
