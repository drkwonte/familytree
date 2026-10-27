import assert from "node:assert/strict";
import { test } from "node:test";
import { INTERACTION_OPTION_GROUPS, findInteractionOption } from "./interaction-options";
import { EMOTIONAL_KINDS, STRUCTURAL_KINDS } from "./types";

const allOptions = INTERACTION_OPTION_GROUPS.flatMap((group) => group.options);

test("every relation kind can be picked exactly once", () => {
  const kinds = allOptions.flatMap((option) => (option.action.type === "setRelation" ? [option.action.kind] : []));
  assert.deepEqual([...kinds].sort(), [...STRUCTURAL_KINDS, ...EMOTIONAL_KINDS].sort());
});

test("option ids are unique so the menu value finds one option", () => {
  const ids = allOptions.map((option) => option.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const option of allOptions) assert.equal(findInteractionOption(option.id), option);
  assert.equal(findInteractionOption(""), undefined);
});

test("relations with a direction say which person is which", () => {
  assert.match(findInteractionOption("focused")!.label, /A.*B/);
  assert.match(findInteractionOption("adopted")!.label, /A.*부모/);
  assert.doesNotMatch(findInteractionOption("conflict")!.label, /A/);
});
