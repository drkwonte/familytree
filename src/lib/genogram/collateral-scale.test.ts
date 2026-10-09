import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AGE_FONT_SIZE,
  CHILD_SLOT_WIDTH,
  COLLATERAL_CLEARANCE_RATIO,
  COLLATERAL_SCALE,
  COLLATERAL_SLOT_WIDTH,
  NODE_HALF,
  NODE_SIZE,
} from "./constants";
import { renderFamilyGraphSvg } from "./draw";
import { layoutFamily } from "./layout";
import { addRelative, deletePerson } from "./relations";
import { COLLATERAL_SCALE_OPTIONS, EMPTY_GRAPH, type FamilyGraph } from "./types";

const COORDINATE_TOLERANCE = 0.01;
const AGE_FONT = `font-size="${AGE_FONT_SIZE}"`;

function familyWithAuntsChildren(): { graph: FamilyGraph; auntId: string } {
  let graph = addRelative(EMPTY_GRAPH, { name: "", gender: "F", relation: "self", isIndexPerson: true, age: 15 });
  const client = graph.nodes[0].id;
  graph = addRelative(graph, { name: "", gender: "M", relation: "father", anchorId: client, age: 47 });
  graph = addRelative(graph, { name: "", gender: "F", relation: "mother", anchorId: client, age: 45 });
  const mother = graph.nodes.find((node) => node.data.age === 45)!.id;
  graph = addRelative(graph, { name: "", gender: "M", relation: "father", anchorId: mother, age: 75 });
  graph = addRelative(graph, { name: "", gender: "F", relation: "mother", anchorId: mother, age: 73 });
  graph = addRelative(graph, { name: "", gender: "F", relation: "sibling", anchorId: mother, age: 48 });
  const auntId = graph.nodes.find((node) => node.data.age === 48)!.id;
  graph = addRelative(graph, { name: "", gender: "M", relation: "spouse", anchorId: auntId, age: 49 });
  graph = addRelative(graph, { name: "", gender: "F", relation: "child", anchorId: auntId, age: 20 });
  graph = addRelative(graph, { name: "", gender: "M", relation: "child", anchorId: auntId, age: 18 });
  return { graph, auntId };
}

function cousinSpacing(graph: FamilyGraph): number {
  const layout = layoutFamily(graph);
  const cousins = [20, 18].map((age) => layout.nodes.find((node) => node.data.age === age)!);
  return Math.abs(cousins[0].x - cousins[1].x);
}

test("collateral people default to the preferred scale", () => {
  const { graph } = familyWithAuntsChildren();
  assert.equal(layoutFamily(graph).collateralScale, COLLATERAL_SCALE);
});

test("each offered collateral size is used when nothing overlaps", () => {
  const { graph } = familyWithAuntsChildren();
  for (const scale of COLLATERAL_SCALE_OPTIONS) {
    assert.equal(layoutFamily({ ...graph, collateralScale: scale }).collateralScale, scale);
  }
});

function airBetween(left: { x: number }, right: { x: number }, glyph: number): number {
  return Math.abs(right.x - left.x) - glyph;
}

test("collateral siblings and spouses keep their clearance share of a glyph, tighter than the direct line", () => {
  const { graph, auntId } = familyWithAuntsChildren();
  const childlessUncle = addRelative(graph, { name: "", gender: "M", relation: "sibling", anchorId: auntId, age: 52 });
  const withUncleSpouse = addRelative(childlessUncle, {
    name: "",
    gender: "F",
    relation: "spouse",
    anchorId: childlessUncle.nodes.find((node) => node.data.age === 52)!.id,
    age: 53,
  });
  const clientId = withUncleSpouse.nodes.find((node) => node.data.isIndexPerson)!.id;
  const married = addRelative(withUncleSpouse, { name: "", gender: "M", relation: "sibling", anchorId: clientId, age: 12 });
  for (const scale of COLLATERAL_SCALE_OPTIONS) {
    const layout = layoutFamily({ ...married, collateralScale: scale });
    const at = (age: number) => layout.nodes.find((node) => node.data.age === age)!;
    const glyph = NODE_SIZE * layout.collateralScale;
    const expectedAir = glyph * COLLATERAL_CLEARANCE_RATIO;
    assert.ok(Math.abs(airBetween(at(20), at(18), glyph) - expectedAir) < COORDINATE_TOLERANCE, `siblings at ${scale}`);
    assert.ok(Math.abs(airBetween(at(52), at(53), glyph) - expectedAir) < COORDINATE_TOLERANCE, `spouses at ${scale}`);
    const directSiblingAir = airBetween(at(15), at(12), NODE_SIZE);
    assert.ok(Math.abs(directSiblingAir - (CHILD_SLOT_WIDTH - NODE_SIZE)) < COORDINATE_TOLERANCE);
  }
});

test("smaller collateral people sit closer together, with shorter lines down to their children", () => {
  const { graph, auntId } = familyWithAuntsChildren();
  const large = { ...graph, collateralScale: 0.8 } as const;
  const small = { ...graph, collateralScale: 0.5 } as const;
  assert.ok(Math.abs(cousinSpacing(small) - COLLATERAL_SLOT_WIDTH * 0.5) < COORDINATE_TOLERANCE);
  assert.ok(cousinSpacing(small) < cousinSpacing(large));
  const drop = (family: FamilyGraph) => {
    const layout = layoutFamily(family);
    const aunt = layout.nodes.find((node) => node.id === auntId)!;
    const cousin = layout.nodes.find((node) => node.data.age === 20)!;
    return cousin.y - aunt.y;
  };
  assert.ok(drop(small) < drop(large));
});

test("ages keep their full font size on shrunken collateral glyphs", () => {
  const { graph } = familyWithAuntsChildren();
  const svg = renderFamilyGraphSvg({ ...graph, collateralScale: 0.5 }, "edit");
  const scaledGroups = [...svg.matchAll(/<g transform="[^"]*scale\(0\.5\)[^"]*">(.*?)<\/g>/g)].map((match) => match[1]);
  assert.ok(scaledGroups.length > 0);
  for (const glyph of scaledGroups) assert.equal(glyph.includes("<text"), false, "age text must not be scaled");
  const ages = [...svg.matchAll(/<text[^>]*font-size="(\d+)"[^>]*>(\d+)<\/text>/g)];
  assert.ok(ages.some((match) => match[2] === "48"));
  for (const match of ages) assert.equal(`font-size="${match[1]}"`, AGE_FONT);
});

test("labels under a shrunken glyph stay as close to it as under a full-size one", () => {
  const { graph, auntId } = familyWithAuntsChildren();
  const scaled = { ...graph, collateralScale: 0.5 } as const;
  const layout = layoutFamily(scaled);
  const aunt = layout.nodes.find((node) => node.id === auntId)!;
  const client = layout.nodes.find((node) => node.data.isIndexPerson)!;
  const svg = renderFamilyGraphSvg(scaled, "edit");
  const labelTop = (personId: string, center: number) => {
    const group = svg.slice(svg.indexOf(`data-person-id="${personId}"`));
    const backdrop = group.match(/<rect x="[^"]+" y="([^"]+)"[^>]*fill-opacity/)!;
    return Number(backdrop[1]) - center;
  };
  const auntGap = labelTop(auntId, aunt.y) - NODE_HALF * layout.collateralScale;
  const clientGap = labelTop(client.id, client.y) - NODE_HALF;
  assert.ok(Math.abs(auntGap - clientGap) < COORDINATE_TOLERANCE, `aunt label gap ${auntGap}, client ${clientGap}`);
});

test("editing people keeps the chosen collateral size", () => {
  const { graph, auntId } = familyWithAuntsChildren();
  const chosen = { ...graph, collateralScale: 0.6 } as const;
  assert.equal(deletePerson(chosen, auntId).collateralScale, 0.6);
  assert.equal(addRelative(chosen, { name: "", gender: "M", relation: "sibling", anchorId: auntId }).collateralScale, 0.6);
});
