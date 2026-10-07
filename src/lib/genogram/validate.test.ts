import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHILD_DROP_INSET,
  CHILD_SLOT_WIDTH,
  COLLATERAL_SIBLING_GAP,
  GENERATION_GAP,
  MARRIED_COLLATERAL_GAP,
  MIN_COUPLE_GAP,
  NODE_HALF,
  NODE_SIZE,
} from "./constants";
import { familyOfOriginIds, layoutFamily } from "./layout";
import { addRelative, deletePerson, isCoupleKind } from "./relations";
import { EMPTY_GRAPH, type FamilyGraph } from "./types";
import { SIBLING_NEEDS_PARENT_MESSAGE, validateNewPerson } from "./validate";

test("empty age is allowed; relation is required when people exist", () => {
  assert.equal(
    validateNewPerson({
      age: "",
      vitalStatus: "alive",
      hasExistingPeople: false,
      relation: "",
      anchorId: "",
    }),
    null,
  );
  assert.equal(
    validateNewPerson({
      age: "",
      vitalStatus: "deceased",
      hasExistingPeople: false,
      relation: "",
      anchorId: "",
    }),
    null,
  );
  assert.equal(
    validateNewPerson({
      age: "32",
      vitalStatus: "alive",
      hasExistingPeople: true,
      relation: "",
      anchorId: "node_a",
    }),
    "기존 인물과의 관계를 선택해 주세요.",
  );
  assert.equal(
    validateNewPerson({
      age: "32",
      vitalStatus: "alive",
      hasExistingPeople: true,
      relation: "self",
      anchorId: "node_a",
    }),
    "기존 인물과의 관계를 선택해 주세요.",
  );
  assert.equal(
    validateNewPerson({
      age: "32",
      vitalStatus: "alive",
      hasExistingPeople: true,
      relation: "spouse",
      anchorId: "node_a",
    }),
    null,
  );
});

test("a sibling cannot be added until the anchor person has a parent", () => {
  assert.equal(
    validateNewPerson({
      age: "65",
      vitalStatus: "alive",
      hasExistingPeople: true,
      relation: "sibling",
      anchorId: "client",
      anchorHasParent: false,
    }),
    SIBLING_NEEDS_PARENT_MESSAGE,
  );
  assert.equal(
    validateNewPerson({
      age: "65",
      vitalStatus: "alive",
      hasExistingPeople: true,
      relation: "brother",
      anchorId: "client",
      anchorHasParent: true,
    }),
    null,
  );
});

test("an older brother sits to the left of the client, not beyond the spouse", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "M",
    relation: "self",
    isIndexPerson: true,
    age: 60,
  });
  const clientId = graph.nodes[0].id;
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "spouse",
    anchorId: clientId,
    age: 60,
  });
  const spouseId = graph.nodes.find((node) => node.id !== clientId)!.id;
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "father",
    anchorId: clientId,
    age: 90,
  });
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "mother",
    anchorId: clientId,
    age: 88,
  });
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "sibling",
    anchorId: clientId,
    age: 65,
  });
  const brotherId = graph.nodes.find((node) => node.data.age === 65)!.id;
  assert.ok(
    graph.edges.some(
      (edge) => edge.kind === "parent" && edge.target === brotherId,
    ),
  );
  const layout = layoutFamily(graph);
  const client = layout.nodes.find((node) => node.id === clientId)!;
  const spouse = layout.nodes.find((node) => node.id === spouseId)!;
  const brother = layout.nodes.find((node) => node.id === brotherId)!;
  assert.ok(brother.x < client.x, `brother ${brother.x} should be left of client ${client.x}`);
  assert.ok(client.x < spouse.x, `client ${client.x} should be left of spouse ${spouse.x}`);
  assert.ok(brother.x < spouse.x);
});

test("client siblings use a shorter drop than the client so they sit above the couple", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "M",
    relation: "self",
    isIndexPerson: true,
    age: 60,
  });
  const clientId = graph.nodes[0].id;
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "spouse",
    anchorId: clientId,
    age: 60,
  });
  const spouseId = graph.nodes.find((node) => node.id !== clientId)!.id;
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "father",
    anchorId: clientId,
    vitalStatus: "deceased",
    age: 90,
  });
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "mother",
    anchorId: clientId,
    vitalStatus: "deceased",
    age: 88,
  });
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "sibling",
    anchorId: clientId,
    age: 65,
  });
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "sibling",
    anchorId: clientId,
    age: 58,
  });
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "child",
    anchorId: clientId,
    age: 30,
  });
  const layout = layoutFamily(graph);
  const client = layout.nodes.find((node) => node.id === clientId)!;
  const spouse = layout.nodes.find((node) => node.id === spouseId)!;
  const brother = layout.nodes.find((node) => node.data.age === 65)!;
  const sister = layout.nodes.find((node) => node.data.age === 58)!;
  const father = layout.nodes.find((node) => node.data.age === 90)!;
  const child = layout.nodes.find((node) => node.data.age === 30)!;
  assert.equal(spouse.y, client.y);
  assert.ok(child.y > client.y);
  assert.equal(brother.y, sister.y);
  assert.equal(brother.y - father.y, COLLATERAL_SIBLING_GAP);
  assert.equal(client.y - father.y, GENERATION_GAP);
  assert.ok(brother.x < client.x);
  assert.ok(client.x < spouse.x);
  assert.ok(client.x < sister.x);
  assert.ok(Math.abs(sister.x - spouse.x) >= NODE_SIZE || sister.y + NODE_SIZE < spouse.y);
  const parentBar = layout.coupleBars.find(
    (bar) => bar.leftId === father.id || bar.rightId === father.id,
  )!;
  for (const sibling of [brother, sister]) {
    const drop = layout.childDrops.find(
      (item) => item.fromY === parentBar.barY && Math.abs(item.x - sibling.x) < 0.01,
    );
    assert.ok(drop);
    assert.ok(drop.toY < client.y);
    assert.equal(drop.fromX, undefined);
  }
});

test("a child's spouse stays beside them below unmarried siblings", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "M",
    relation: "self",
    isIndexPerson: true,
    age: 60,
  });
  const clientId = graph.nodes[0].id;
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "spouse",
    anchorId: clientId,
    age: 60,
  });
  const clientSpouseId = graph.nodes.find((node) => node.id !== clientId)!.id;
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "father",
    anchorId: clientId,
    vitalStatus: "deceased",
  });
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "mother",
    anchorId: clientId,
    vitalStatus: "deceased",
  });
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "sibling",
    anchorId: clientId,
    age: 65,
  });
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "sibling",
    anchorId: clientId,
    age: 58,
  });
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "child",
    anchorId: clientId,
    age: 35,
  });
  const sonId = graph.nodes.find((node) => node.data.age === 35)!.id;
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "child",
    anchorId: clientId,
    age: 30,
  });
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "child",
    anchorId: clientId,
    age: 28,
  });
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "spouse",
    anchorId: sonId,
    age: 35,
  });
  const layout = layoutFamily(graph);
  const client = layout.nodes.find((node) => node.id === clientId)!;
  const clientSpouse = layout.nodes.find((node) => node.id === clientSpouseId)!;
  const son = layout.nodes.find((node) => node.id === sonId)!;
  const sonSpouse = layout.nodes.find(
    (node) => node.data.age === 35 && node.id !== sonId,
  )!;
  const middle = layout.nodes.find((node) => node.data.age === 30)!;
  const youngest = layout.nodes.find((node) => node.data.age === 28)!;
  assert.equal(middle.y - client.y, COLLATERAL_SIBLING_GAP);
  assert.equal(youngest.y, middle.y);
  assert.equal(son.y - client.y, MARRIED_COLLATERAL_GAP);
  assert.ok(son.y > middle.y);
  assert.ok(son.y - client.y < GENERATION_GAP);
  assert.equal(sonSpouse.y, son.y);
  assert.equal(sonSpouse.x - son.x, MIN_COUPLE_GAP);
  assert.ok(son.x < sonSpouse.x);
  assert.ok(sonSpouse.x + NODE_HALF <= middle.x - NODE_HALF);
  assert.ok(middle.x < youngest.x);
  assert.ok(sonSpouse.x < clientSpouse.x);
  assert.ok(clientSpouse.x - client.x > sonSpouse.x - son.x);
  const coupleBar = layout.coupleBars.find(
    (bar) =>
      (bar.leftId === clientId && bar.rightId === clientSpouseId) ||
      (bar.leftId === clientSpouseId && bar.rightId === clientId),
  )!;
  const sonDrop = layout.childDrops.find(
    (drop) => drop.fromY === coupleBar.barY && Math.abs(drop.x - son.x) < 0.01,
  );
  assert.ok(sonDrop);
  assert.equal(sonDrop.fromX, undefined);
  assert.equal(sonDrop.toY, son.y);
});

test("a couple starts at the minimum gap and grows only with its own children", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "M",
    relation: "self",
    isIndexPerson: true,
    age: 30,
  });
  const leftId = graph.nodes[0].id;
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "spouse",
    anchorId: leftId,
    age: 30,
  });
  const rightId = graph.nodes.find((node) => node.id !== leftId)!.id;
  const gapOf = (layout: ReturnType<typeof layoutFamily>) => {
    const bar = layout.coupleBars.find(
      (item) =>
        (item.leftId === leftId && item.rightId === rightId) ||
        (item.leftId === rightId && item.rightId === leftId),
    )!;
    return bar.rightX - bar.leftX;
  };
  let layout = layoutFamily(graph);
  assert.equal(gapOf(layout), MIN_COUPLE_GAP);

  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "child",
    anchorId: leftId,
    age: 1,
  });
  const onlyChildId = graph.nodes.find((node) => node.data.age === 1)!.id;
  layout = layoutFamily(graph);
  const onlyChild = layout.nodes.find((node) => node.id === onlyChildId)!;
  const bar = layout.coupleBars.find((item) => item.leftId === leftId || item.rightId === leftId)!;
  assert.equal(gapOf(layout), MIN_COUPLE_GAP);
  assert.equal(onlyChild.x, (bar.leftX + bar.rightX) / 2);

  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "child",
    anchorId: leftId,
    age: 2,
  });
  layout = layoutFamily(graph);
  assert.equal(gapOf(layout), CHILD_SLOT_WIDTH + CHILD_DROP_INSET * 2);
  const kids = layout.nodes.filter((node) => node.data.age === 1 || node.data.age === 2);
  const grown = layout.coupleBars.find((item) => item.leftId === leftId || item.rightId === leftId)!;
  const kidMid = kids.reduce((sum, node) => sum + node.x, 0) / kids.length;
  assert.ok(Math.abs(kidMid - (grown.leftX + grown.rightX) / 2) < 0.01);

  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "child",
    anchorId: onlyChildId,
    age: 0,
  });
  layout = layoutFamily(graph);
  assert.equal(gapOf(layout), CHILD_SLOT_WIDTH + CHILD_DROP_INSET * 2);

  let side = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "M",
    relation: "self",
    isIndexPerson: true,
    age: 60,
  });
  const parentId = side.nodes[0].id;
  side = addRelative(side, {
    name: "",
    gender: "F",
    relation: "spouse",
    anchorId: parentId,
    age: 60,
  });
  side = addRelative(side, {
    name: "",
    gender: "M",
    relation: "child",
    anchorId: parentId,
    age: 30,
  });
  const marriedChildId = side.nodes.find((node) => node.data.age === 30)!.id;
  side = addRelative(side, {
    name: "",
    gender: "F",
    relation: "spouse",
    anchorId: marriedChildId,
    age: 30,
  });
  const sideLayout = layoutFamily(side);
  const parentBar = sideLayout.coupleBars.find(
    (item) => item.leftId === parentId || item.rightId === parentId,
  )!;
  const marriedChild = sideLayout.nodes.find((node) => node.id === marriedChildId)!;
  assert.equal(parentBar.rightX - parentBar.leftX, MIN_COUPLE_GAP);
  assert.equal(marriedChild.x, (parentBar.leftX + parentBar.rightX) / 2);
});

test("unmarried siblings sit one short seat apart until a spouse needs room", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "M",
    relation: "self",
    isIndexPerson: true,
    age: 50,
  });
  const fatherId = graph.nodes[0].id;
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "spouse",
    anchorId: fatherId,
    age: 48,
  });
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "child",
    anchorId: fatherId,
    age: 20,
  });
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "child",
    anchorId: fatherId,
    age: 18,
  });
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "child",
    anchorId: fatherId,
    age: 16,
  });
  const at = (layout: ReturnType<typeof layoutFamily>, age: number) =>
    layout.nodes.find((node) => node.data.age === age)!;
  let layout = layoutFamily(graph);
  const oldest = at(layout, 20);
  const middle = at(layout, 18);
  const youngest = at(layout, 16);
  assert.equal(middle.x - oldest.x, CHILD_SLOT_WIDTH);
  assert.equal(youngest.x - middle.x, CHILD_SLOT_WIDTH);

  const middleId = graph.nodes.find((node) => node.data.age === 18)!.id;
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "spouse",
    anchorId: middleId,
    age: 18,
  });
  layout = layoutFamily(graph);
  const marriedSon = layout.nodes.find((node) => node.data.age === 18 && node.data.gender === "M")!;
  const spouse = layout.nodes.find((node) => node.data.age === 18 && node.data.gender === "F")!;
  assert.equal(marriedSon.x - at(layout, 20).x, CHILD_SLOT_WIDTH);
  assert.ok(at(layout, 16).x - marriedSon.x > CHILD_SLOT_WIDTH);
  assert.ok(spouse.x + NODE_HALF <= at(layout, 16).x - NODE_HALF);
});

test("delete person removes edges and household membership", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "F",
    relation: "self",
    isIndexPerson: true,
  });
  const me = graph.nodes[0].id;
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "spouse",
    anchorId: me,
  });
  const spouse = graph.nodes.find((node) => node.id !== me)!.id;
  graph = deletePerson(graph, spouse);
  assert.equal(graph.nodes.length, 1);
  assert.equal(graph.edges.length, 0);
  assert.ok(graph.nodes[0].data.isIndexPerson);
});

test("spouse is linked even if the form still holds a deleted person id", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "F",
    relation: "self",
    isIndexPerson: true,
    age: 57,
  });
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "spouse",
    anchorId: "node_from_previous_canvas",
    age: 61,
  });
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 1);
  assert.ok(isCoupleKind(graph.edges[0].kind));
  assert.equal(layoutFamily(graph).coupleBars.length, 1);
});

test("a single known parent still draws a parent-child line", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "F",
    relation: "self",
    isIndexPerson: true,
    age: 57,
  });
  const me = graph.nodes[0].id;
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "spouse",
    anchorId: me,
    age: 61,
  });
  const spouse = graph.nodes.find((node) => node.id !== me)!.id;
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "father",
    anchorId: spouse,
    vitalStatus: "deceased",
  });
  const layout = layoutFamily(graph);
  const spouseNode = layout.nodes.find((node) => node.id === spouse)!;
  const father = layout.nodes.find((node) => node.id !== me && node.id !== spouse)!;
  assert.ok(father.y < spouseNode.y);
  assert.ok(Math.abs(father.x - spouseNode.x) < 0.01);
  assert.ok(
    layout.childDrops.some(
      (drop) => Math.abs(drop.x - spouseNode.x) < 0.01 && drop.fromY < spouseNode.y,
    ),
  );
});

test("parents of a spouse sit in the generation above with a couple bar", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "F",
    relation: "self",
    isIndexPerson: true,
    age: 57,
  });
  const me = graph.nodes[0].id;
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "spouse",
    anchorId: me,
    age: 61,
  });
  const spouse = graph.nodes.find((node) => node.id !== me)!.id;
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "father",
    anchorId: spouse,
    vitalStatus: "deceased",
  });
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "mother",
    anchorId: spouse,
    vitalStatus: "deceased",
  });
  const layout = layoutFamily(graph);
  const spouseNode = layout.nodes.find((node) => node.id === spouse)!;
  const inLawParents = layout.nodes.filter(
    (node) => node.id !== me && node.id !== spouse,
  );
  assert.equal(inLawParents.length, 2);
  assert.ok(inLawParents.every((node) => node.y < spouseNode.y));
  assert.ok(layout.coupleBars.length >= 2);
  const parentBar = layout.coupleBars.find(
    (bar) => ![bar.leftId, bar.rightId].includes(me) && ![bar.leftId, bar.rightId].includes(spouse),
  )!;
  const parentMid = (parentBar.leftX + parentBar.rightX) / 2;
  assert.ok(Math.abs(parentMid - spouseNode.x) < 0.01);
  assert.ok(
    layout.childDrops.some(
      (drop) =>
        drop.fromY === parentBar.barY &&
        drop.fromX === undefined &&
        Math.abs(drop.x - spouseNode.x) < 0.01 &&
        drop.toY === spouseNode.y,
    ),
  );
});

test("siblings are ordered oldest to the left even if a younger sibling has no age", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "F",
    relation: "self",
    isIndexPerson: true,
    age: 57,
  });
  const me = graph.nodes[0].id;
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "spouse",
    anchorId: me,
    age: 61,
  });
  const spouse = graph.nodes.find((node) => node.id !== me)!.id;
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "father",
    anchorId: spouse,
  });
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "mother",
    anchorId: spouse,
  });
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "sister",
    anchorId: spouse,
  });
  const layout = layoutFamily(graph);
  const spouseNode = layout.nodes.find((node) => node.id === spouse)!;
  const sister = layout.nodes.find(
    (node) => node.data.gender === "F" && node.id !== me && node.data.age === undefined,
  )!;
  assert.ok(spouseNode.x < sister.x);
});

test("in-law siblings sit closer to their parents than the linking spouse", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "F",
    relation: "self",
    isIndexPerson: true,
    age: 57,
  });
  const me = graph.nodes[0].id;
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "spouse",
    anchorId: me,
    age: 61,
  });
  const spouse = graph.nodes.find((node) => node.id !== me)!.id;
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "father",
    anchorId: spouse,
  });
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "mother",
    anchorId: spouse,
  });
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "brother",
    anchorId: spouse,
    age: 61,
  });
  const layout = layoutFamily(graph);
  const spouseNode = layout.nodes.find((node) => node.id === spouse)!;
  const father = layout.nodes.find((node) => node.data.gender === "M" && node.id !== spouse && node.data.age === undefined)!;
  const brother = layout.nodes.find(
    (node) => node.data.gender === "M" && node.id !== spouse && node.id !== father.id,
  )!;
  const spouseDrop = spouseNode.y - father.y;
  const brotherDrop = brother.y - father.y;
  assert.ok(brotherDrop < spouseDrop);
});

test("child and sibling relations follow the chosen gender", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "F",
    relation: "self",
    isIndexPerson: true,
    age: 40,
  });
  const me = graph.nodes[0].id;
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "child",
    anchorId: me,
    age: 10,
  });
  const child = graph.nodes.find((node) => node.id !== me)!;
  assert.equal(child.data.gender, "M");
  assert.ok(
    graph.edges.some(
      (edge) =>
        edge.kind === "parent" && edge.source === me && edge.target === child.id,
    ),
  );
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "sibling",
    anchorId: me,
  });
  const sibling = graph.nodes.find((node) => node.id !== me && node.id !== child.id)!;
  assert.equal(sibling.data.gender, "F");
});

function assertChildrenStayOnTheirCoupleBar(
  graph: { edges: { category: string; kind: string; source: string; target: string }[] },
  layout: ReturnType<typeof layoutFamily>,
) {
  for (const bar of layout.coupleBars) {
    const children = layout.nodes.filter((node) =>
      graph.edges.some(
        (edge) =>
          edge.category === "structural" &&
          ["parent", "adopted", "foster"].includes(edge.kind) &&
          edge.target === node.id &&
          (edge.source === bar.leftId || edge.source === bar.rightId),
      ),
    );
    const unique = [...new Map(children.map((child) => [child.id, child])).values()];
    if (unique.length === 0) continue;
    const left = layout.nodes.find((node) => node.id === bar.leftId)!;
    const right = layout.nodes.find((node) => node.id === bar.rightId)!;
    assert.equal(left.x, bar.leftX);
    assert.equal(right.x, bar.rightX);
    for (const child of unique) {
      assert.ok(child.x >= bar.leftX + CHILD_DROP_INSET - 0.01);
      assert.ok(child.x <= bar.rightX - CHILD_DROP_INSET + 0.01);
      assert.ok(Math.abs(child.x - bar.leftX) > 1);
      assert.ok(Math.abs(child.x - bar.rightX) > 1);
    }
    for (const child of unique) {
      const drop = layout.childDrops.find(
        (item) => item.fromY === bar.barY && Math.abs(item.x - child.x) < 0.01 && item.toY === child.y,
      );
      assert.ok(drop);
      assert.equal(drop.fromX, undefined);
    }
  }
}

test("child drops stay inset on the couple bar instead of under the parents", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "F",
    relation: "self",
    isIndexPerson: true,
    age: 57,
  });
  const me = graph.nodes[0].id;
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "spouse",
    anchorId: me,
    age: 61,
  });
  for (const age of [31, 30, 28]) {
    graph = addRelative(graph, {
      name: "",
      gender: age === 28 ? "F" : "M",
      relation: "child",
      anchorId: me,
      age,
    });
    const layout = layoutFamily(graph);
    assertChildrenStayOnTheirCoupleBar(graph, layout);
    const bar = layout.coupleBars.find((item) => [item.leftId, item.rightId].includes(me))!;
    const kids = layout.nodes.filter((node) => node.id !== me && node.id !== bar.leftId && node.id !== bar.rightId);
    const childDrops = layout.childDrops.filter((drop) => drop.fromY === bar.barY);
    assert.equal(childDrops.length, kids.length);
    for (const drop of childDrops) {
      assert.ok(Math.abs(drop.x - bar.leftX) > 1);
      assert.ok(Math.abs(drop.x - bar.rightX) > 1);
    }
  }
});

test("each couple sits over its own children so drops stay vertical", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "F",
    relation: "self",
    isIndexPerson: true,
    age: 57,
  });
  const me = graph.nodes[0].id;
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "spouse",
    anchorId: me,
    age: 61,
  });
  const spouse = graph.nodes.find((node) => node.id !== me)!.id;
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "father",
    anchorId: spouse,
    vitalStatus: "deceased",
  });
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "mother",
    anchorId: spouse,
    vitalStatus: "deceased",
  });
  const father = graph.nodes.find(
    (node) => node.data.gender === "M" && node.id !== spouse && node.data.vitalStatus === "deceased",
  )!.id;
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "father",
    anchorId: father,
    vitalStatus: "deceased",
  });
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "mother",
    anchorId: father,
    vitalStatus: "deceased",
  });
  const layout = layoutFamily(graph);
  assert.equal(layout.coupleBars.length, 3);
  assertChildrenStayOnTheirCoupleBar(graph, layout);
});

function buildThreeGenerationIndexFamily() {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "F",
    relation: "self",
    isIndexPerson: true,
    age: 57,
    birthYear: 1969,
    occupation: "동화작가",
  });
  const indexId = graph.nodes[0].id;
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "spouse",
    anchorId: indexId,
    age: 61,
    birthYear: 1965,
    occupation: "관리직",
  });
  const spouseId = graph.nodes.find((node) => node.id !== indexId)!.id;
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "child",
    anchorId: indexId,
    age: 31,
    birthYear: 1995,
  });
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "child",
    anchorId: indexId,
    age: 29,
    birthYear: 1997,
  });
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "father",
    anchorId: spouseId,
    vitalStatus: "deceased",
  });
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "mother",
    anchorId: spouseId,
    vitalStatus: "deceased",
  });
  const fatherId = graph.nodes.find(
    (node) => node.data.gender === "M" && node.data.vitalStatus === "deceased",
  )!.id;
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "sibling",
    anchorId: spouseId,
    age: 63,
    birthYear: 1963,
  });
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "sibling",
    anchorId: spouseId,
    age: 58,
    birthYear: 1968,
  });
  const motherId = graph.nodes.find(
    (node) => node.data.gender === "F" && node.data.vitalStatus === "deceased",
  )!.id;
  const childIds = graph.nodes
    .filter((node) =>
      graph.edges.some(
        (edge) =>
          edge.kind === "parent" &&
          edge.target === node.id &&
          (edge.source === indexId || edge.source === spouseId),
      ),
    )
    .map((node) => node.id);
  return { graph, indexId, spouseId, fatherId, motherId, childIds };
}

function parentIds(
  graph: { edges: { kind: string; source: string; target: string }[] },
  childId: string,
): [string, string] {
  const ids = graph.edges
    .filter((edge) => edge.kind === "parent" && edge.target === childId)
    .map((edge) => edge.source);
  assert.equal(ids.length, 2);
  return [ids[0], ids[1]];
}

function assertCoupleKeepsItsChildren(
  graph: { edges: { category: string; kind: string; source: string; target: string }[] },
  layout: ReturnType<typeof layoutFamily>,
  leftId: string,
  rightId: string,
) {
  const bars = layout.coupleBars.filter(
    (bar) =>
      (bar.leftId === leftId && bar.rightId === rightId) ||
      (bar.leftId === rightId && bar.rightId === leftId),
  );
  assert.equal(bars.length, 1);
  const bar = bars[0];
  const left = layout.nodes.find((node) => node.id === bar.leftId)!;
  const right = layout.nodes.find((node) => node.id === bar.rightId)!;
  assert.equal(left.x, bar.leftX);
  assert.equal(right.x, bar.rightX);
  const children = layout.nodes.filter((node) =>
    graph.edges.some(
      (edge) =>
        edge.kind === "parent" &&
        edge.target === node.id &&
        (edge.source === leftId || edge.source === rightId),
    ),
  );
  assert.ok(children.length > 0);
  for (const child of children) {
    assert.ok(child.x > bar.leftX);
    assert.ok(child.x < bar.rightX);
    assert.ok(
      layout.childDrops.some(
        (drop) => drop.fromY === bar.barY && Math.abs(drop.x - child.x) < 0.01 && drop.toY === child.y,
      ),
    );
  }
}

test("a solo ancestor does not detach a descendant couple from its children", () => {
  let { graph, indexId, spouseId, fatherId, childIds } = buildThreeGenerationIndexFamily();
  let layout = layoutFamily(graph);
  assertCoupleKeepsItsChildren(graph, layout, indexId, spouseId);
  assertChildrenStayOnTheirCoupleBar(graph, layout);

  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "father",
    anchorId: fatherId,
    vitalStatus: "deceased",
  });
  layout = layoutFamily(graph);
  assert.equal(childIds.length, 2);
  assertCoupleKeepsItsChildren(graph, layout, indexId, spouseId);
  assertChildrenStayOnTheirCoupleBar(graph, layout);
  const soloFather = layout.nodes.find((node) => node.id !== fatherId && node.data.vitalStatus === "deceased" && node.data.gender === "M")!;
  const fatherNode = layout.nodes.find((node) => node.id === fatherId)!;
  assert.ok(soloFather.y < fatherNode.y);
  assert.ok(Math.abs(soloFather.x - fatherNode.x) < 0.01);

  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "mother",
    anchorId: fatherId,
    vitalStatus: "deceased",
  });
  layout = layoutFamily(graph);
  assertCoupleKeepsItsChildren(graph, layout, indexId, spouseId);
  assertChildrenStayOnTheirCoupleBar(graph, layout);
});

test("each family of origin sits above its own child without moving the other couple", () => {
  let { graph, indexId, spouseId, fatherId, motherId } = buildThreeGenerationIndexFamily();
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "father",
    anchorId: fatherId,
    vitalStatus: "deceased",
  });
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "mother",
    anchorId: fatherId,
    vitalStatus: "deceased",
  });
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "father",
    anchorId: motherId,
    vitalStatus: "deceased",
  });
  let layout = layoutFamily(graph);
  const [paternalLeft, paternalRight] = parentIds(graph, fatherId);
  assertCoupleKeepsItsChildren(graph, layout, paternalLeft, paternalRight);
  assertCoupleKeepsItsChildren(graph, layout, indexId, spouseId);
  assertChildrenStayOnTheirCoupleBar(graph, layout);

  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "mother",
    anchorId: motherId,
    vitalStatus: "deceased",
  });
  layout = layoutFamily(graph);
  const [maternalLeft, maternalRight] = parentIds(graph, motherId);
  assertCoupleKeepsItsChildren(graph, layout, paternalLeft, paternalRight);
  assertCoupleKeepsItsChildren(graph, layout, maternalLeft, maternalRight);
  assertCoupleKeepsItsChildren(graph, layout, indexId, spouseId);
  assertChildrenStayOnTheirCoupleBar(graph, layout);
});

test("four stacked only-child couples keep vertical parent drops", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "F",
    relation: "self",
    isIndexPerson: true,
  });
  const me = graph.nodes[0].id;
  graph = addRelative(graph, { name: "", gender: "M", relation: "spouse", anchorId: me });
  const spouse = graph.nodes.find((node) => node.id !== me)!.id;
  graph = addRelative(graph, { name: "", gender: "M", relation: "father", anchorId: spouse });
  graph = addRelative(graph, { name: "", gender: "F", relation: "mother", anchorId: spouse });
  const father = graph.nodes.find((node) => node.data.gender === "M" && node.id !== spouse)!.id;
  graph = addRelative(graph, { name: "", gender: "M", relation: "father", anchorId: father });
  graph = addRelative(graph, { name: "", gender: "F", relation: "mother", anchorId: father });
  const grandfather = graph.nodes.find(
    (node) => node.data.gender === "M" && node.id !== spouse && node.id !== father,
  )!.id;
  graph = addRelative(graph, { name: "", gender: "M", relation: "father", anchorId: grandfather });
  graph = addRelative(graph, { name: "", gender: "F", relation: "mother", anchorId: grandfather });
  const layout = layoutFamily(graph);
  assert.equal(layout.coupleBars.length, 4);
  assertChildrenStayOnTheirCoupleBar(graph, layout);
});

test("many children each drop from the same couple bar and stay under it", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "F",
    relation: "self",
    isIndexPerson: true,
  });
  const me = graph.nodes[0].id;
  graph = addRelative(graph, { name: "", gender: "M", relation: "spouse", anchorId: me });
  for (const age of [12, 10, 8, 6, 4]) {
    graph = addRelative(graph, {
      name: "",
      gender: "F",
      relation: "child",
      anchorId: me,
      age,
    });
  }
  const layout = layoutFamily(graph);
  const couple = layout.coupleBars[0];
  const drops = layout.childDrops.filter((drop) => drop.fromY === couple.barY);
  assert.equal(drops.length, 5);
  assert.equal(new Set(drops.map((drop) => drop.x)).size, 5);
  assertChildrenStayOnTheirCoupleBar(graph, layout);
});

test("in-law parents sit above their child, not above the child's marriage", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "F",
    relation: "self",
    isIndexPerson: true,
    age: 57,
    birthYear: 1969,
  });
  const me = graph.nodes[0].id;
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "spouse",
    anchorId: me,
    age: 61,
    birthYear: 1965,
  });
  const spouse = graph.nodes.find((node) => node.id !== me)!.id;
  graph = addRelative(graph, { name: "", gender: "M", relation: "father", anchorId: spouse, vitalStatus: "deceased" });
  graph = addRelative(graph, { name: "", gender: "F", relation: "mother", anchorId: spouse, vitalStatus: "deceased" });
  const father = graph.nodes.find((node) => node.data.gender === "M" && node.id !== spouse)!.id;
  graph = addRelative(graph, { name: "", gender: "M", relation: "father", anchorId: father, vitalStatus: "deceased" });
  graph = addRelative(graph, { name: "", gender: "F", relation: "mother", anchorId: father, vitalStatus: "deceased" });
  graph = addRelative(graph, { name: "", gender: "M", relation: "child", anchorId: me, age: 31, birthYear: 1996 });
  graph = addRelative(graph, { name: "", gender: "F", relation: "child", anchorId: me, age: 29, birthYear: 1998 });
  const layout = layoutFamily(graph);
  assert.equal(layout.coupleBars.length, 3);
  assertChildrenStayOnTheirCoupleBar(graph, layout);
  const parentBar = layout.coupleBars.find((bar) =>
    graph.edges.some(
      (edge) =>
        edge.kind === "parent" &&
        edge.target === spouse &&
        (edge.source === bar.leftId || edge.source === bar.rightId),
    ),
  )!;
  const parentMid = (parentBar.leftX + parentBar.rightX) / 2;
  const spouseNode = layout.nodes.find((node) => node.id === spouse)!;
  assert.ok(Math.abs(parentMid - spouseNode.x) < 0.01);
  assert.ok(
    layout.childDrops.some(
      (drop) =>
        drop.fromY === parentBar.barY &&
        drop.fromX === undefined &&
        Math.abs(drop.x - spouseNode.x) < 0.01 &&
        drop.toY === spouseNode.y,
    ),
  );
  const indexBar = layout.coupleBars.find((bar) => [bar.leftId, bar.rightId].includes(me))!;
  const kidDrops = layout.childDrops.filter((drop) => drop.fromY === indexBar.barY);
  assert.equal(kidDrops.length, 2);
  assert.notEqual(kidDrops[0].x, kidDrops[1].x);
});

test("a nested couple widens for its own children instead of overflowing", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "F",
    relation: "self",
    isIndexPerson: true,
  });
  const me = graph.nodes[0].id;
  graph = addRelative(graph, { name: "", gender: "M", relation: "spouse", anchorId: me });
  const spouse = graph.nodes.find((node) => node.id !== me)!.id;
  graph = addRelative(graph, { name: "", gender: "M", relation: "father", anchorId: spouse });
  graph = addRelative(graph, { name: "", gender: "F", relation: "mother", anchorId: spouse });
  for (const age of [20, 18, 16]) {
    graph = addRelative(graph, {
      name: "",
      gender: "M",
      relation: "child",
      anchorId: me,
      age,
    });
  }
  const layout = layoutFamily(graph);
  assertChildrenStayOnTheirCoupleBar(graph, layout);
  const indexBar = layout.coupleBars.find(
    (bar) => bar.leftId === spouse || bar.rightId === spouse,
  )!;
  const childDrops = layout.childDrops.filter((drop) => drop.fromY === indexBar.barY);
  assert.equal(childDrops.length, 3);
  const parentBar = layout.coupleBars.find(
    (bar) => bar.id !== indexBar.id && (bar.leftId !== me && bar.rightId !== me),
  )!;
  const parentWidth = parentBar.rightX - parentBar.leftX;
  const indexWidth = indexBar.rightX - indexBar.leftX;
  assert.ok(indexWidth > parentWidth);
});

test("a couple with three children stays only as wide as those children", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "F",
    relation: "self",
    isIndexPerson: true,
  });
  const me = graph.nodes[0].id;
  graph = addRelative(graph, { name: "", gender: "M", relation: "spouse", anchorId: me });
  const spouse = graph.nodes.find((node) => node.id !== me)!.id;
  graph = addRelative(graph, { name: "", gender: "M", relation: "father", anchorId: spouse });
  graph = addRelative(graph, { name: "", gender: "F", relation: "mother", anchorId: spouse });
  graph = addRelative(graph, { name: "", gender: "M", relation: "brother", anchorId: spouse, age: 63 });
  graph = addRelative(graph, { name: "", gender: "F", relation: "sister", anchorId: spouse, age: 58 });
  graph = addRelative(graph, { name: "", gender: "M", relation: "child", anchorId: me, age: 31 });
  graph = addRelative(graph, { name: "", gender: "F", relation: "child", anchorId: me, age: 29 });
  const layout = layoutFamily(graph);
  const parentBar = layout.coupleBars.find((bar) =>
    graph.edges.some(
      (edge) =>
        edge.kind === "parent" &&
        edge.target === spouse &&
        (edge.source === bar.leftId || edge.source === bar.rightId),
    ),
  )!;
  const indexBar = layout.coupleBars.find((bar) => [bar.leftId, bar.rightId].includes(me))!;
  const parentWidth = parentBar.rightX - parentBar.leftX;
  assert.ok(parentWidth <= 2 * CHILD_SLOT_WIDTH + CHILD_DROP_INSET * 2 + 0.01);
  assertChildrenStayOnTheirCoupleBar(graph, layout);
  const spouseNode = layout.nodes.find((node) => node.id === spouse)!;
  const meNode = layout.nodes.find((node) => node.id === me)!;
  assert.ok(meNode.x > spouseNode.x);
  assert.ok(
    layout.childDrops.some(
      (drop) => drop.fromY === parentBar.barY && Math.abs(drop.x - spouseNode.x) < 0.01,
    ),
  );
});

function maleParentOf(
  graph: { nodes: { id: string; data: { gender: string } }[]; edges: { kind: string; source: string; target: string }[] },
  childId: string,
): string {
  const ids = graph.edges
    .filter((edge) => edge.kind === "parent" && edge.target === childId)
    .map((edge) => edge.source);
  return graph.nodes.find((node) => ids.includes(node.id) && node.data.gender === "M")!.id;
}

function addParentCouple(
  graph: ReturnType<typeof addRelative>,
  childId: string,
): ReturnType<typeof addRelative> {
  let next = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "father",
    anchorId: childId,
    vitalStatus: "deceased",
  });
  return addRelative(next, {
    name: "",
    gender: "F",
    relation: "mother",
    anchorId: childId,
    vitalStatus: "deceased",
  });
}

function stackAncestorCouples(
  graph: ReturnType<typeof addRelative>,
  startId: string,
  extraCouples: number,
): ReturnType<typeof addRelative> {
  let next = graph;
  let current = startId;
  for (let count = 0; count < extraCouples; count += 1) {
    next = addParentCouple(next, current);
    current = maleParentOf(next, current);
  }
  return next;
}

test("six stacked only-child couples keep every child on its own couple bar", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "F",
    relation: "self",
    isIndexPerson: true,
  });
  const me = graph.nodes[0].id;
  graph = addRelative(graph, { name: "", gender: "M", relation: "spouse", anchorId: me });
  const spouse = graph.nodes.find((node) => node.id !== me)!.id;
  graph = stackAncestorCouples(graph, spouse, 5);
  const layout = layoutFamily(graph);
  assert.equal(layout.coupleBars.length, 6);
  assertChildrenStayOnTheirCoupleBar(graph, layout);
});

test("ten children stay inset on one couple bar with a drop each", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "F",
    relation: "self",
    isIndexPerson: true,
  });
  const me = graph.nodes[0].id;
  graph = addRelative(graph, { name: "", gender: "M", relation: "spouse", anchorId: me });
  for (let age = 20; age >= 11; age -= 1) {
    graph = addRelative(graph, {
      name: "",
      gender: age % 2 === 0 ? "M" : "F",
      relation: "child",
      anchorId: me,
      age,
    });
  }
  const layout = layoutFamily(graph);
  const bar = layout.coupleBars.find((item) => [item.leftId, item.rightId].includes(me))!;
  const drops = layout.childDrops.filter((drop) => drop.fromY === bar.barY);
  assert.equal(drops.length, 10);
  assert.equal(new Set(drops.map((drop) => drop.x)).size, 10);
  assert.ok(bar.rightX - bar.leftX <= 10 * CHILD_SLOT_WIDTH + CHILD_DROP_INSET * 2 + 0.01);
  assertChildrenStayOnTheirCoupleBar(graph, layout);
});

test("deep generations and many children stay intact after each ancestor is added", () => {
  let { graph, indexId, spouseId, fatherId, motherId } = buildThreeGenerationIndexFamily();
  for (let age = 27; age >= 20; age -= 1) {
    graph = addRelative(graph, {
      name: "",
      gender: "M",
      relation: "child",
      anchorId: indexId,
      age,
    });
  }
  graph = addParentCouple(graph, fatherId);
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "father",
    anchorId: motherId,
    vitalStatus: "deceased",
  });
  let layout = layoutFamily(graph);
  assertChildrenStayOnTheirCoupleBar(graph, layout);
  assertCoupleKeepsItsChildren(graph, layout, indexId, spouseId);

  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "mother",
    anchorId: motherId,
    vitalStatus: "deceased",
  });
  layout = layoutFamily(graph);
  assertChildrenStayOnTheirCoupleBar(graph, layout);
  assertCoupleKeepsItsChildren(graph, layout, indexId, spouseId);
  const [paternalLeft, paternalRight] = parentIds(graph, fatherId);
  const [maternalLeft, maternalRight] = parentIds(graph, motherId);
  assertCoupleKeepsItsChildren(graph, layout, paternalLeft, paternalRight);
  assertCoupleKeepsItsChildren(graph, layout, maternalLeft, maternalRight);

  const fifthMale = maleParentOf(graph, fatherId);
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "father",
    anchorId: fifthMale,
    vitalStatus: "deceased",
  });
  layout = layoutFamily(graph);
  assertChildrenStayOnTheirCoupleBar(graph, layout);
  assertCoupleKeepsItsChildren(graph, layout, indexId, spouseId);
  assertCoupleKeepsItsChildren(graph, layout, paternalLeft, paternalRight);

  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "mother",
    anchorId: fifthMale,
    vitalStatus: "deceased",
  });
  layout = layoutFamily(graph);
  assertChildrenStayOnTheirCoupleBar(graph, layout);
  assertCoupleKeepsItsChildren(graph, layout, indexId, spouseId);

  const sixthMale = maleParentOf(graph, fifthMale);
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "father",
    anchorId: sixthMale,
    vitalStatus: "deceased",
  });
  layout = layoutFamily(graph);
  assertChildrenStayOnTheirCoupleBar(graph, layout);
  assertCoupleKeepsItsChildren(graph, layout, indexId, spouseId);

  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "mother",
    anchorId: sixthMale,
    vitalStatus: "deceased",
  });
  layout = layoutFamily(graph);
  assertChildrenStayOnTheirCoupleBar(graph, layout);
  assertCoupleKeepsItsChildren(graph, layout, indexId, spouseId);
  assertCoupleKeepsItsChildren(graph, layout, paternalLeft, paternalRight);
  assertCoupleKeepsItsChildren(graph, layout, maternalLeft, maternalRight);
  const indexBar = layout.coupleBars.find((bar) => [bar.leftId, bar.rightId].includes(indexId))!;
  const indexDrops = layout.childDrops.filter((drop) => drop.fromY === indexBar.barY);
  assert.equal(indexDrops.length, 10);
  assert.equal(new Set(indexDrops.map((drop) => drop.x)).size, 10);
});

function assertFamiliesStayOnOwnSides(
  graph: FamilyGraph,
  layout: ReturnType<typeof layoutFamily>,
  leftId: string,
  rightId: string,
) {
  const left = layout.nodes.find((node) => node.id === leftId)!;
  const right = layout.nodes.find((node) => node.id === rightId)!;
  const mid = (left.x + right.x) / 2;
  const leftFoo = [...familyOfOriginIds(graph, leftId)]
    .map((id) => layout.nodes.find((node) => node.id === id))
    .filter((node): node is NonNullable<typeof node> => Boolean(node));
  const rightFoo = [...familyOfOriginIds(graph, rightId)]
    .map((id) => layout.nodes.find((node) => node.id === id))
    .filter((node): node is NonNullable<typeof node> => Boolean(node));
  for (const node of leftFoo) {
    assert.ok(node.x + NODE_HALF <= mid + 0.01);
  }
  for (const node of rightFoo) {
    assert.ok(node.x - NODE_HALF >= mid - 0.01);
  }
  if (leftFoo.length > 0 && rightFoo.length > 0) {
    const leftEdge = Math.max(...leftFoo.map((node) => node.x));
    const rightEdge = Math.min(...rightFoo.map((node) => node.x));
    assert.ok(leftEdge + NODE_SIZE <= rightEdge + 0.01);
    for (const leftNode of leftFoo) {
      for (const rightNode of rightFoo) {
        const sameGeneration = Math.abs(leftNode.y - rightNode.y) < NODE_SIZE;
        if (!sameGeneration) continue;
        assert.ok(
          leftNode.x + NODE_SIZE <= rightNode.x + 0.01,
          `${leftNode.id} overlaps ${rightNode.id}`,
        );
      }
    }
  }
}

function buildBothFamiliesOfOrigin() {
  let { graph, indexId, spouseId, fatherId, motherId } = buildThreeGenerationIndexFamily();
  graph = addParentCouple(graph, fatherId);
  graph = addParentCouple(graph, motherId);
  return { graph, indexId, spouseId, fatherId, motherId };
}

test("both spouses' families of origin stay on their own side of the couple", () => {
  let { graph, indexId, spouseId } = buildBothFamiliesOfOrigin();
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "father",
    anchorId: indexId,
    vitalStatus: "deceased",
  });
  let layout = layoutFamily(graph);
  assertCoupleKeepsItsChildren(graph, layout, indexId, spouseId);
  assertChildrenStayOnTheirCoupleBar(graph, layout);

  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "mother",
    anchorId: indexId,
    age: 80,
    birthYear: 1945,
  });
  layout = layoutFamily(graph);
  assertCoupleKeepsItsChildren(graph, layout, indexId, spouseId);
  assertChildrenStayOnTheirCoupleBar(graph, layout);
  assertFamiliesStayOnOwnSides(graph, layout, spouseId, indexId);
  const [indexFather, indexMother] = parentIds(graph, indexId);
  assertCoupleKeepsItsChildren(graph, layout, indexFather, indexMother);
});

test("a husband with many siblings does not push his family across the couple mid", () => {
  let { graph, indexId, spouseId } = buildBothFamiliesOfOrigin();
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "father",
    anchorId: indexId,
    vitalStatus: "deceased",
  });
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "mother",
    anchorId: indexId,
    age: 80,
    birthYear: 1945,
  });
  for (const age of [70, 68, 66, 64, 62]) {
    graph = addRelative(graph, {
      name: "",
      gender: "M",
      relation: "sibling",
      anchorId: spouseId,
      age,
    });
  }
  const layout = layoutFamily(graph);
  assertCoupleKeepsItsChildren(graph, layout, indexId, spouseId);
  assertChildrenStayOnTheirCoupleBar(graph, layout);
  assertFamiliesStayOnOwnSides(graph, layout, spouseId, indexId);
});

test("a wife with many siblings does not push her family across the couple mid", () => {
  let { graph, indexId, spouseId } = buildBothFamiliesOfOrigin();
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "father",
    anchorId: indexId,
    vitalStatus: "deceased",
  });
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "mother",
    anchorId: indexId,
    age: 80,
    birthYear: 1945,
  });
  for (const age of [55, 53, 51, 49, 47, 45]) {
    graph = addRelative(graph, {
      name: "",
      gender: age % 2 === 0 ? "M" : "F",
      relation: "sibling",
      anchorId: indexId,
      age,
    });
  }
  const layout = layoutFamily(graph);
  assertCoupleKeepsItsChildren(graph, layout, indexId, spouseId);
  assertChildrenStayOnTheirCoupleBar(graph, layout);
  assertFamiliesStayOnOwnSides(graph, layout, spouseId, indexId);
});

test("deep ancestry on the husband side still leaves room for the wife's parents", () => {
  let { graph, indexId, spouseId, fatherId } = buildBothFamiliesOfOrigin();
  graph = stackAncestorCouples(graph, maleParentOf(graph, fatherId), 3);
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "father",
    anchorId: indexId,
    vitalStatus: "deceased",
  });
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "mother",
    anchorId: indexId,
    age: 80,
    birthYear: 1945,
  });
  const layout = layoutFamily(graph);
  assertCoupleKeepsItsChildren(graph, layout, indexId, spouseId);
  assertChildrenStayOnTheirCoupleBar(graph, layout);
  assertFamiliesStayOnOwnSides(graph, layout, spouseId, indexId);
});

test("adding the wife's mother incrementally does not collide with the husband's family", () => {
  let { graph, indexId, spouseId } = buildBothFamiliesOfOrigin();
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "father",
    anchorId: indexId,
    vitalStatus: "deceased",
  });
  let layout = layoutFamily(graph);
  assertCoupleKeepsItsChildren(graph, layout, indexId, spouseId);
  assertChildrenStayOnTheirCoupleBar(graph, layout);
  assertFamiliesStayOnOwnSides(graph, layout, spouseId, indexId);

  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "mother",
    anchorId: indexId,
    age: 80,
    birthYear: 1945,
  });
  layout = layoutFamily(graph);
  assertCoupleKeepsItsChildren(graph, layout, indexId, spouseId);
  assertChildrenStayOnTheirCoupleBar(graph, layout);
  assertFamiliesStayOnOwnSides(graph, layout, spouseId, indexId);
  const [wifeFather, wifeMother] = parentIds(graph, indexId);
  assertCoupleKeepsItsChildren(graph, layout, wifeFather, wifeMother);
});

test("both sides growing at once still keep families of origin apart", () => {
  let { graph, indexId, spouseId } = buildBothFamiliesOfOrigin();
  graph = stackAncestorCouples(graph, maleParentOf(graph, spouseId), 3);
  for (const age of [70, 68, 66, 64]) {
    graph = addRelative(graph, {
      name: "",
      gender: "M",
      relation: "sibling",
      anchorId: spouseId,
      age,
    });
  }
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "father",
    anchorId: indexId,
    vitalStatus: "deceased",
  });
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "mother",
    anchorId: indexId,
    age: 80,
    birthYear: 1945,
  });
  for (const age of [55, 53, 51, 49, 47]) {
    graph = addRelative(graph, {
      name: "",
      gender: age % 2 === 0 ? "M" : "F",
      relation: "sibling",
      anchorId: indexId,
      age,
    });
  }
  const grown = layoutFamily(graph);
  assertCoupleKeepsItsChildren(graph, grown, indexId, spouseId);
  assertChildrenStayOnTheirCoupleBar(graph, grown);
  assertFamiliesStayOnOwnSides(graph, grown, spouseId, indexId);
});
