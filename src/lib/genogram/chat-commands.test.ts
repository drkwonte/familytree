import assert from "node:assert/strict";
import { test } from "node:test";
import { describeChatChanges, parseRelationCommand } from "./chat-commands";

const changesOf = parseRelationCommand;

test("a pair and a relation word become one relation, without the AI", () => {
  assert.deepEqual(changesOf("인물1과 인물2 사이에 단절 표시해줘"), [
    { type: "setRelation", from: 1, to: 2, kind: "cutoff" },
  ]);
});

test("spaces inside a person code and every relation word are understood", () => {
  const words: [string, string][] = [
    ["친밀", "close"],
    ["소원", "distant"],
    ["융합", "fused"],
    ["밀착", "fused"],
    ["갈등", "conflict"],
    ["융합갈등", "fusedConflict"],
    ["과잉개입", "focused"],
    ["신체학대", "physicalAbuse"],
    ["성학대", "sexualAbuse"],
    ["결혼", "marriage"],
    ["재혼", "remarriage"],
    ["별거", "separation"],
    ["이혼", "divorce"],
    ["동거", "cohabitation"],
    ["외도", "affair"],
    ["입양", "adopted"],
    ["위탁", "foster"],
    ["쌍둥이", "twin"],
    ["일란성 쌍둥이", "identicalTwin"],
  ];
  for (const [word, kind] of words) {
    assert.deepEqual(changesOf(`인물 3과 인물 12 ${word} 표시`), [{ type: "setRelation", from: 3, to: 12, kind }], word);
  }
});

test("several pairs before one relation word all get that relation", () => {
  assert.deepEqual(changesOf("인물2와 인물 8, 인물6과 인물3 사이에 갈등 표시해줘"), [
    { type: "setRelation", from: 2, to: 8, kind: "conflict" },
    { type: "setRelation", from: 6, to: 3, kind: "conflict" },
  ]);
});

test("each relation word applies to the pairs just before it", () => {
  assert.deepEqual(changesOf("인물1과 인물2 사이에 갈등 표시해줘. 인물5와 인물7 사이에 단절 표시해줘."), [
    { type: "setRelation", from: 1, to: 2, kind: "conflict" },
    { type: "setRelation", from: 5, to: 7, kind: "cutoff" },
  ]);
});

test("a directed relation keeps who does it first", () => {
  assert.deepEqual(changesOf("인물3이 인물1에게 과잉개입"), [{ type: "setRelation", from: 3, to: 1, kind: "focused" }]);
});

test("a couple event keeps its year", () => {
  assert.deepEqual(changesOf("인물2와 인물3 2015년 이혼"), [
    { type: "setRelation", from: 2, to: 3, kind: "divorce", year: 2015 },
  ]);
});

test("removing a relation needs no relation word", () => {
  assert.deepEqual(changesOf("인물1과 인물2 사이 관계 지워줘"), [{ type: "removeRelation", from: 1, to: 2 }]);
  assert.deepEqual(changesOf("인물1과 인물2 갈등 삭제"), [{ type: "removeRelation", from: 1, to: 2 }]);
});

test("people living together become one household, and can be taken out again", () => {
  assert.deepEqual(changesOf("인물1, 인물2, 인물3 함께 사는 가구로 묶어줘"), [
    { type: "setHousehold", members: [1, 2, 3] },
  ]);
  assert.deepEqual(changesOf("인물1, 인물2 동거 가구 지워줘"), [{ type: "removeHousehold", members: [1, 2] }]);
});

test("the reply says what was drawn, one line per change", () => {
  const lines = describeChatChanges([
    { type: "setRelation", from: 1, to: 2, kind: "cutoff" },
    { type: "setRelation", from: 2, to: 3, kind: "divorce", year: 2015 },
    { type: "removeRelation", from: 1, to: 2 },
    { type: "setHousehold", members: [1, 2, 3] },
    { type: "removeHousehold", members: [1, 2] },
  ]).split("\n");
  assert.equal(lines.length, 5);
  assert.match(lines[0], /인물1.*인물2.*단절/);
  assert.match(lines[1], /2015.*이혼/);
  assert.match(lines[2], /인물1.*인물2.*지웠/);
  assert.match(lines[3], /인물1, 인물2, 인물3.*동거 가구/);
  assert.match(lines[4], /동거 가구.*지웠/);
});

test("nothing applied is said plainly", () => {
  assert.equal(describeChatChanges([]), "반영한 내용이 없습니다.");
});

test("sentences the rules cannot read for sure are left to the AI", () => {
  for (const text of [
    "엄마랑 아들 사이가 안 좋아",
    "인물1과 인물2 사이에 표시해줘",
    "인물1, 인물2, 인물3 사이에 갈등",
    "인물1과 인물2 사이에 갈등 말고 친밀",
    "인물1과 인물2는 갈등이 아니라 친밀",
    "갈등 표시해줘",
    "",
  ]) {
    assert.equal(parseRelationCommand(text), null, text);
  }
});
