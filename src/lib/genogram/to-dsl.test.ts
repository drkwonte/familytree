import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CIRCLE_DEATH_MARK_ARM,
  CONFLICT_AMPLITUDE,
  CONFLICT_TOOTH_WIDTH,
  CUTOFF_GAP,
  CUTOFF_TICK_SIZE,
  DEATH_MARK_INSET,
  EMOTION_CHILD_CLEARANCE,
  NODE_HALF,
} from "./constants";
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

test("the couple shares a baseline and collateral siblings sit higher", () => {
  const graph = seedDemoGraph();
  const layout = layoutFamily(graph);
  const index = layout.nodes.find((node) => node.data.isIndexPerson)!;
  const spouse = layout.nodes.find((node) => node.data.name === "배우자")!;
  const brother = layout.nodes.find((node) => node.data.name === "오빠")!;
  assert.equal(spouse.y, index.y);
  assert.ok(brother.y < index.y);
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
  assert.equal((withEmotion("close").match(/ A /g) ?? []).length, 2);
  assert.equal((withEmotion("fused").match(/ A /g) ?? []).length, 3);
  const close = withEmotion("close");
  const arc = close.match(/M ([0-9.]+) ([0-9.]+) A ([0-9.]+) \3 0 0 1 ([0-9.]+) ([0-9.]+)/);
  assert.ok(arc);
  const x1 = Number(arc[1]);
  const y1 = Number(arc[2]);
  const radius = Number(arc[3]);
  const x2 = Number(arc[4]);
  const y2 = Number(arc[5]);
  const chord = Math.hypot(x2 - x1, y2 - y1);
  const sagitta = radius - Math.sqrt(radius * radius - (chord / 2) ** 2);
  assert.ok(sagitta > 1);
  assert.ok(sagitta <= 18);
});

test("a conflict line keeps sharp teeth on a long span", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "M",
    relation: "self",
    isIndexPerson: true,
    age: 40,
  });
  const husband = graph.nodes[0].id;
  graph = addRelative(graph, {
    name: "",
    gender: "F",
    relation: "spouse",
    anchorId: husband,
    age: 40,
  });
  const wife = graph.nodes.find((node) => node.id !== husband)!.id;
  for (let age = 10; age >= 5; age -= 1) {
    graph = addRelative(graph, {
      name: "",
      gender: "M",
      relation: "child",
      anchorId: husband,
      age,
    });
  }
  graph = {
    ...graph,
    edges: [
      ...graph.edges,
      {
        id: "emotion-conflict",
        source: husband,
        target: wife,
        category: "emotional",
        kind: "conflict",
      },
    ],
  };
  const layout = layoutFamily(graph);
  const link = layout.emotional[0];
  const svg = renderFamilyGraphSvg(graph, "edit");
  const path = svg.match(/stroke="#f87171"[^>]*d="([^"]+)"|d="([^"]+)"[^>]*stroke="#f87171"/);
  const data = path?.[1] ?? path?.[2];
  assert.ok(data);
  const points = [...data.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
  }));
  const dx = link.target.x - link.source.x;
  const dy = link.target.y - link.source.y;
  const length = Math.hypot(dx, dy);
  const normalX = -dy / length;
  const normalY = dx / length;
  const along = (point: { x: number; y: number }) =>
    ((point.x - link.source.x) * dx + (point.y - link.source.y) * dy) / length;
  const across = (point: { x: number; y: number }) =>
    (point.x - link.source.x) * normalX + (point.y - link.source.y) * normalY;
  assert.ok(points.length > 16);
  assert.ok(Math.abs(across(points[0])) < 0.01);
  assert.ok(Math.abs(across(points[points.length - 1])) < 0.01);
  for (let index = 1; index < points.length - 1; index += 1) {
    const sign = index % 2 === 1 ? 1 : -1;
    assert.ok(Math.abs(across(points[index]) - sign * CONFLICT_AMPLITUDE) < 0.01);
    const step = along(points[index]) - along(points[index - 1]);
    assert.ok(step > CONFLICT_TOOTH_WIDTH * 0.5);
    assert.ok(step < CONFLICT_TOOTH_WIDTH * 1.5);
  }
});

test("a cutoff is a solid line with a short break in the middle", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "F",
    relation: "self",
    isIndexPerson: true,
    age: 58,
  });
  const parent = graph.nodes[0].id;
  graph = addRelative(graph, {
    name: "",
    gender: "M",
    relation: "child",
    anchorId: parent,
    age: 30,
  });
  const child = graph.nodes.find((node) => node.id !== parent)!;
  graph = {
    ...graph,
    edges: [
      ...graph.edges,
      {
        id: "emotion-cutoff",
        source: parent,
        target: child.id,
        category: "emotional",
        kind: "cutoff",
      },
    ],
  };
  const link = layoutFamily(graph).emotional[0];
  const svg = renderFamilyGraphSvg(graph, "edit");
  const lines = [...svg.matchAll(/<line x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"[^>]*stroke="#e879f9"/g)].map(
    (match) => ({
      x1: Number(match[1]),
      y1: Number(match[2]),
      x2: Number(match[3]),
      y2: Number(match[4]),
    }),
  );
  const dx = link.target.x - link.source.x;
  const dy = link.target.y - link.source.y;
  const length = Math.hypot(dx, dy);
  const along = (x: number, y: number) => ((x - link.source.x) * dx + (y - link.source.y) * dy) / length;
  const across = (x: number, y: number) => ((x - link.source.x) * -dy + (y - link.source.y) * dx) / length;
  const span = (line: { x1: number; y1: number; x2: number; y2: number }) =>
    Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
  const connectors = lines.filter((line) => span(line) > CUTOFF_TICK_SIZE * 2);
  const ticks = lines.filter((line) => span(line) <= CUTOFF_TICK_SIZE * 2 + 0.1);
  assert.equal(connectors.length, 2);
  assert.equal(ticks.length, 2);
  for (const line of connectors) {
    for (const point of [
      { x: line.x1, y: line.y1 },
      { x: line.x2, y: line.y2 },
    ]) {
      assert.ok(Math.abs(across(point.x, point.y)) < 0.01);
    }
  }
  for (const line of ticks) {
    assert.ok(Math.abs(across((line.x1 + line.x2) / 2, (line.y1 + line.y2) / 2)) < 0.01);
    assert.ok(Math.abs(span(line) - CUTOFF_TICK_SIZE * 2) < 0.01);
  }
  const innerEnds = connectors
    .flatMap((line) => [along(line.x1, line.y1), along(line.x2, line.y2)])
    .filter((position) => position > 1 && position < length - 1)
    .sort((left, right) => left - right);
  assert.equal(innerEnds.length, 2);
  assert.ok(Math.abs(innerEnds[1] - innerEnds[0] - CUTOFF_GAP) < 0.01);
  assert.ok(innerEnds[1] - innerEnds[0] < length / 4);
  const tickCenters = ticks.map((line) => along((line.x1 + line.x2) / 2, (line.y1 + line.y2) / 2));
  assert.ok(Math.abs(Math.min(...tickCenters) - innerEnds[0]) < 0.01);
  assert.ok(Math.abs(Math.max(...tickCenters) - innerEnds[1]) < 0.01);
});

test("a child line opens where a relationship line crosses it", () => {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "",
    gender: "M",
    relation: "self",
    isIndexPerson: true,
    age: 40,
  });
  const index = graph.nodes[0].id;
  graph = addRelative(graph, { name: "", gender: "F", relation: "spouse", anchorId: index, age: 38 });
  graph = addRelative(graph, { name: "", gender: "M", relation: "father", anchorId: index, age: 70 });
  graph = addRelative(graph, { name: "", gender: "F", relation: "mother", anchorId: index, age: 68 });
  graph = addRelative(graph, { name: "", gender: "F", relation: "sibling", anchorId: index, age: 36 });
  graph = addRelative(graph, { name: "", gender: "M", relation: "child", anchorId: index, age: 10 });
  const father = graph.nodes.find((node) => node.data.age === 70)!;
  const child = graph.nodes.find((node) => node.data.age === 10)!;
  graph = {
    ...graph,
    edges: [
      ...graph.edges,
      {
        id: "emotion-cross",
        source: father.id,
        target: child.id,
        category: "emotional",
        kind: "cutoff",
      },
    ],
  };
  const layout = layoutFamily(graph);
  const link = layout.emotional[0];
  const parameterOnDrop = (item: { x: number; fromY: number; toY: number }) =>
    ((item.x - link.source.x) * (link.source.y - link.target.y) -
      (item.fromY - link.source.y) * (link.source.x - link.target.x)) /
    ((item.x - item.x) * (link.source.y - link.target.y) -
      (item.fromY - item.toY) * (link.source.x - link.target.x));
  const drop = layout.childDrops.find((item) => {
    const along = parameterOnDrop(item);
    return along > 0.05 && along < 0.95;
  })!;
  const crossY = drop.fromY + (drop.toY - drop.fromY) * parameterOnDrop(drop);
  const svg = renderFamilyGraphSvg(graph, "edit");
  const onDrop = [...svg.matchAll(/<line x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/g)]
    .map((match) => ({
      x1: Number(match[1]),
      y1: Number(match[2]),
      x2: Number(match[3]),
      y2: Number(match[4]),
    }))
    .filter((line) => Math.abs(line.x1 - drop.x) < 0.01 && Math.abs(line.x2 - drop.x) < 0.01);
  assert.equal(onDrop.length, 2);
  const coversCrossing = onDrop.some((line) => {
    const top = Math.min(line.y1, line.y2);
    const bottom = Math.max(line.y1, line.y2);
    return top < crossY && bottom > crossY;
  });
  assert.equal(coversCrossing, false);
  const above = onDrop.flatMap((line) => [line.y1, line.y2]).filter((y) => y < crossY);
  const below = onDrop.flatMap((line) => [line.y1, line.y2]).filter((y) => y > crossY);
  const gapTop = Math.max(...above);
  const gapBottom = Math.min(...below);
  assert.ok(gapBottom - gapTop >= EMOTION_CHILD_CLEARANCE * 2 - 0.1);
});
