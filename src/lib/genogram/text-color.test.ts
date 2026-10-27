import assert from "node:assert/strict";
import { test } from "node:test";
import { PERSON_CODE_COLOR, STRUCTURE_COLOR } from "./constants";
import { renderFamilyGraphSvg } from "./draw";
import { addRelative } from "./relations";
import { EMPTY_GRAPH } from "./types";

test("years, notes and couple captions are as dark as the lines they describe", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "F",
    relation: "self",
    isIndexPerson: true,
    age: 15,
    birthYear: 2011,
    occupation: "학생",
    tags: ["우울증"],
  });
  graph = addRelative(graph, { name: "", gender: "M", relation: "father", anchorId: graph.nodes[0].id });
  graph = addRelative(graph, { name: "", gender: "F", relation: "mother", anchorId: graph.nodes[0].id });
  graph = { ...graph, edges: graph.edges.map((edge) => (edge.kind === "marriage" ? { ...edge, year: 2005 } : edge)) };
  for (const viewMode of ["edit", "final"] as const) {
    const fills = [...renderFamilyGraphSvg(graph, viewMode).matchAll(/<text [^>]*fill="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((fill) => fill !== PERSON_CODE_COLOR);
    assert.ok(fills.length >= 4, "the age, year, occupation, tag and couple year are drawn");
    assert.deepEqual([...new Set(fills)], [STRUCTURE_COLOR], viewMode);
  }
});
