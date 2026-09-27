import assert from "node:assert/strict";
import { test } from "node:test";
import { CIRCLE_DEATH_MARK_ARM, DEATH_MARK_INSET, NODE_HALF } from "./constants";
import { renderFamilyGraphSvg } from "./draw";
import { layoutFamily } from "./layout";
import { addRelative, personCode, seedDemoGraph, updatePerson } from "./relations";
import { EMPTY_GRAPH } from "./types";

test("couple bar drops from shape bottoms then goes horizontal", () => {
  const layout = layoutFamily(seedDemoGraph());
  const bar = layout.coupleBars[0];
  const left = layout.nodes.find((node) => node.id === bar.leftId)!;
  assert.ok(bar.barY > left.y + 20);
  assert.equal(bar.leftCenterY, left.y);
});

test("each child drops independently from the couple bar", () => {
  const layout = layoutFamily(seedDemoGraph());
  const parents = layout.coupleBars[0];
  const drops = layout.childDrops.filter((drop) => drop.fromY === parents.barY);
  assert.ok(drops.length >= 2);
  for (const drop of drops) {
    assert.equal(drop.fromY, parents.barY);
    const child = layout.nodes.find((node) => Math.abs(node.x - drop.x) < 0.01 && node.y === drop.toY);
    assert.ok(child);
  }
  const uniqueX = new Set(drops.map((drop) => drop.x));
  assert.equal(uniqueX.size, drops.length);
});

test("stacked labels hide kinship names and person codes in final view", () => {
  const graph = seedDemoGraph();
  const edit = renderFamilyGraphSvg(graph, "edit");
  const finalView = renderFamilyGraphSvg(graph, "final");
  assert.match(edit, /인물1/);
  assert.doesNotMatch(finalView, /인물1/);
  assert.match(edit, /자영업/);
  assert.match(edit, /알코올 문제/);
  assert.doesNotMatch(edit, />아버지</);
  assert.doesNotMatch(edit, /대화 단절/);
  assert.doesNotMatch(edit, />갈등</);
  assert.match(edit, /1990 결혼/);
  assert.match(edit, /fill-opacity="0.68"/);
  assert.match(edit, /stroke-opacity="0.68"/);
});

test("saving a person keeps the birth year on the canvas", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "F",
    relation: "self",
    isIndexPerson: true,
    age: 57,
    birthYear: 1969,
  });
  graph = updatePerson(graph, graph.nodes[0].id, {
    age: 57,
    birthYear: 1969,
    occupation: "동화작가",
    isIndexPerson: true,
  });
  assert.equal(graph.nodes[0].data.birthYear, 1969);
  assert.match(renderFamilyGraphSvg(graph, "edit"), /1969/);
});

test("same generation shares one baseline and lines start at shape centers", () => {
  const graph = seedDemoGraph();
  const layout = layoutFamily(graph);
  const index = layout.nodes.find((node) => node.data.isIndexPerson)!;
  const peers = layout.nodes.filter((node) => node.y === index.y);
  assert.ok(peers.length >= 3);
  const firstEmotion = graph.edges.find((edge) => edge.category === "emotional")!;
  const source = layout.nodes.find((node) => node.id === firstEmotion.source)!;
  const laid = layout.emotional.find((link) => link.id === firstEmotion.id)!;
  assert.equal(laid.source.x, source.x);
  assert.equal(laid.source.y, source.y);
});

test("structure and emotion are painted before person shapes", () => {
  const svg = renderFamilyGraphSvg(seedDemoGraph(), "final");
  const firstLine = svg.indexOf("<path");
  const firstPerson = svg.indexOf("data-person-id");
  assert.ok(firstLine >= 0 && firstPerson >= 0 && firstLine < firstPerson);
});

test("adds parent without requiring a visible kinship label", () => {
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
    relation: "father",
    anchorId: me,
  });
  assert.equal(personCode(graph.nodes[0].data.displayNumber), "인물1");
  assert.equal(graph.nodes[1].data.displayNumber, 2);
});

test("deceased male X reaches the square corners", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "M",
    relation: "self",
    vitalStatus: "deceased",
  });
  const svg = renderFamilyGraphSvg(graph, "edit");
  const layout = layoutFamily(graph);
  const node = layout.nodes[0];
  const left = node.x - NODE_HALF + DEATH_MARK_INSET;
  const top = node.y - NODE_HALF + DEATH_MARK_INSET;
  assert.match(svg, new RegExp(`M ${left} ${top}`));
});

test("deceased female X stays inside the circle", () => {
  const graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "F",
    relation: "self",
    vitalStatus: "deceased",
  });
  const svg = renderFamilyGraphSvg(graph, "edit");
  const node = layoutFamily(graph).nodes[0];
  const arm = CIRCLE_DEATH_MARK_ARM;
  const squareCorner = node.x - NODE_HALF + DEATH_MARK_INSET;
  assert.match(svg, new RegExp(`M ${node.x - arm} ${node.y - arm}`));
  assert.doesNotMatch(svg, new RegExp(`M ${squareCorner} ${node.y - NODE_HALF + DEATH_MARK_INSET}`));
});

test("person glyphs are clickable groups", () => {
  const svg = renderFamilyGraphSvg(seedDemoGraph(), "edit");
  assert.match(svg, /data-person-id="/);
});

test("close is a double line and fused is a triple line", () => {
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
  const withEmotion = (kind: "close" | "fused") =>
    renderFamilyGraphSvg(
      {
        ...graph,
        edges: [
          ...graph.edges,
          {
            id: `emotion-${kind}`,
            source: me,
            target: spouse,
            category: "emotional",
            kind,
          },
        ],
      },
      "final",
    );
  assert.equal((withEmotion("close").match(/<line /g) ?? []).length, 2);
  assert.equal((withEmotion("fused").match(/<line /g) ?? []).length, 3);
});
