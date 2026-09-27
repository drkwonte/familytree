import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUSEHOLD_DASH } from "./constants";
import { renderFamilyGraphSvg } from "./draw";
import { layoutFamily } from "./layout";
import { addHousehold, addRelative, seedDemoGraph } from "./relations";
import { EMPTY_GRAPH } from "./types";

test("a household is drawn as a dashed rectangle around its members", () => {
  const graph = seedDemoGraph();
  const layout = layoutFamily(graph);
  assert.equal(layout.householdBoxes.length, 1);
  const box = layout.householdBoxes[0];
  const members = layout.nodes.filter((node) => graph.households[0].memberIds.includes(node.id));
  assert.ok(members.length >= 3);
  for (const member of members) {
    assert.ok(member.x >= box.x);
    assert.ok(member.x <= box.x + box.width);
    assert.ok(member.y >= box.y);
    assert.ok(member.y <= box.y + box.height);
  }
  const svg = renderFamilyGraphSvg(graph, "edit");
  assert.match(svg, new RegExp(`stroke-dasharray="${HOUSEHOLD_DASH}"`));
  assert.match(svg, /<rect /);
});

test("no household box is drawn when nobody lives together", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "F",
    relation: "self",
    isIndexPerson: true,
  });
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "spouse",
    anchorId: graph.nodes[0].id,
  });
  const layout = layoutFamily(graph);
  assert.equal(layout.householdBoxes.length, 0);
  assert.doesNotMatch(renderFamilyGraphSvg(graph, "edit"), new RegExp(`stroke-dasharray="${HOUSEHOLD_DASH}"`));
});

test("adding a household wraps the chosen people", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "F",
    relation: "self",
    isIndexPerson: true,
  });
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "spouse",
    anchorId: graph.nodes[0].id,
  });
  graph = addHousehold(
    graph,
    graph.nodes.map((node) => node.id),
  );
  const layout = layoutFamily(graph);
  assert.equal(layout.householdBoxes.length, 1);
  assert.ok(layout.householdBoxes[0].width > 0);
  assert.ok(layout.householdBoxes[0].height > 0);
});
