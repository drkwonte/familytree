import assert from "node:assert/strict";
import { test } from "node:test";
import { INDEX_RING_GAP, NODE_HALF, NODE_SIZE, NOTE_GAP_BELOW } from "./constants";
import { renderFamilyGraphSvg } from "./draw";
import { glyphReach } from "./glyph";
import { layoutFamily } from "./layout";
import { addRelative } from "./relations";
import { EMPTY_GRAPH, type FamilyGraph, type Gender } from "./types";

function clientWithBrother(clientGender: Gender): FamilyGraph {
  const graph = addRelative(EMPTY_GRAPH, { name: "", gender: clientGender, relation: "self", isIndexPerson: true });
  return addRelative(graph, { name: "", gender: "M", relation: "sibling", anchorId: graph.nodes[0].id });
}

function personGroup(svg: string, personId: string): string {
  const start = svg.indexOf(`<g data-person-id="${personId}"`);
  return svg.slice(start, svg.indexOf("</g>", start));
}

function codeLabelBaseline(group: string): number {
  const match = /<text x="[^"]+" y="([^"]+)"[^>]*>인물\d+<\/text>/.exec(group);
  assert.ok(match, "the person code label is drawn");
  return Number(match[1]);
}

test("a female client's second circle is drawn outside her circle, so she reads larger", () => {
  const graph = clientWithBrother("F");
  const svg = renderFamilyGraphSvg(graph, "edit");
  const group = personGroup(svg, graph.nodes[0].id);
  const radii = [...group.matchAll(/<circle [^>]*r="([^"]+)"/g)].map((match) => Number(match[1]));
  assert.deepEqual(radii.sort((a, b) => a - b), [NODE_HALF, NODE_HALF + INDEX_RING_GAP]);
});

test("a male client's second square is drawn outside his square", () => {
  const graph = clientWithBrother("M");
  const group = personGroup(renderFamilyGraphSvg(graph, "edit"), graph.nodes[0].id);
  const widths = [...group.matchAll(/<rect [^>]*width="([^"]+)" height="\1" fill="(?:none|#ffffff)" stroke/g)].map(
    (match) => Number(match[1]),
  );
  assert.deepEqual(widths.sort((a, b) => a - b), [NODE_SIZE, NODE_SIZE + INDEX_RING_GAP * 2]);
});

test("the client's labels start below the outer ring, not over it", () => {
  const graph = clientWithBrother("F");
  const client = layoutFamily(graph).nodes.find((node) => node.data.isIndexPerson)!;
  const baseline = codeLabelBaseline(personGroup(renderFamilyGraphSvg(graph, "edit"), client.id));
  assert.equal(baseline, client.y + NODE_HALF + INDEX_RING_GAP + NOTE_GAP_BELOW);
});

test("only a client drawn as a circle or square reaches past the usual glyph", () => {
  const graph = clientWithBrother("F");
  const [client, brother] = graph.nodes;
  assert.equal(glyphReach(client.data), NODE_HALF + INDEX_RING_GAP);
  assert.equal(glyphReach(brother.data), NODE_HALF);
  assert.equal(glyphReach({ ...client.data, vitalStatus: "pregnancy" }), NODE_HALF);
  assert.equal(glyphReach({ ...client.data, gender: "U" }), NODE_HALF);
});
