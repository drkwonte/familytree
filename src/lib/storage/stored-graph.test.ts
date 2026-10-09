import assert from "node:assert/strict";
import { test } from "node:test";
import { addRelative } from "@/lib/genogram/relations";
import { EMPTY_GRAPH } from "@/lib/genogram/types";
import { graphFingerprint, hasUnsavedGraph, parseStoredGraph, StoredGraphError } from "./stored-graph";

test("loads a graph saved by the editor unchanged", () => {
  const graph = addRelative(EMPTY_GRAPH, { name: "", gender: "F", relation: "self", isIndexPerson: true });
  // jsonb drops undefined fields, which is exactly what a database round trip returns.
  const stored = JSON.parse(JSON.stringify(graph));
  assert.deepEqual(parseStoredGraph(stored), stored);
  assert.equal(graphFingerprint(parseStoredGraph(stored)), graphFingerprint(graph));
});

test("an edit counts as unsaved until its fingerprint is recorded as saved", () => {
  const saved = graphFingerprint(EMPTY_GRAPH);
  assert.equal(hasUnsavedGraph(EMPTY_GRAPH, saved), false);
  const edited = addRelative(EMPTY_GRAPH, { name: "", gender: "M", relation: "self", isIndexPerson: true });
  assert.equal(hasUnsavedGraph(edited, saved), true);
  assert.equal(hasUnsavedGraph(edited, graphFingerprint(edited)), false);
});

test("a graph that was never saved is unsaved, even when empty", () => {
  assert.equal(hasUnsavedGraph(EMPTY_GRAPH, null), true);
});

test("keeps an offered collateral size and drops anything else", () => {
  assert.equal(parseStoredGraph({ ...EMPTY_GRAPH, collateralScale: 0.6 }).collateralScale, 0.6);
  for (const invalid of [0.65, 1, "0.6", null]) {
    assert.equal("collateralScale" in parseStoredGraph({ ...EMPTY_GRAPH, collateralScale: invalid }), false);
  }
});

test("fills in households missing from older saves", () => {
  assert.deepEqual(parseStoredGraph({ nodes: [], edges: [] }), EMPTY_GRAPH);
});

test("rejects malformed graphs instead of handing them to the editor", () => {
  const malformed = [
    null,
    [],
    { nodes: "x", edges: [] },
    { nodes: [{ id: 1, data: {} }], edges: [] },
    { nodes: [{ id: "a" }], edges: [] },
    { nodes: [], edges: [{ id: "e", source: "a" }] },
    { nodes: [], edges: [], households: [{ id: "h" }] },
  ];
  for (const value of malformed) {
    assert.throws(() => parseStoredGraph(value), StoredGraphError, JSON.stringify(value));
  }
});
