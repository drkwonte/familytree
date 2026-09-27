import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPagesFunctionSource } from "./pages-worker";

test("Pages Function uses the runtime key, then the baked build key", () => {
  const source = buildPagesFunctionSource("baked-test-key");
  assert.match(source, /export async function onRequestPost/);
  assert.match(source, /env\?\.GEMINI_API_KEY/);
  assert.match(source, /BAKED_API_KEY = "baked-test-key"/);
  assert.match(source, /x-familytree-api/);
});

test("Pages Function can be generated without baking a key", () => {
  const source = buildPagesFunctionSource("");
  assert.match(source, /BAKED_API_KEY = ""/);
});
