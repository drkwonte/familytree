import assert from "node:assert/strict";
import { test } from "node:test";
import { MISSING_API_KEY_MESSAGE } from "./chat";
import { buildPagesWorkerSource } from "./pages-worker";

test("Pages worker reads the runtime Gemini key before any baked value", () => {
  const source = buildPagesWorkerSource("baked-test-key");
  assert.match(source, /env\?\.GEMINI_API_KEY/);
  assert.match(source, /env\.ASSETS\.fetch\(request\)/);
  assert.match(source, /pathname === "\/api\/chat"/);
  assert.match(source, /BAKED_API_KEY = "baked-test-key"/);
  assert.match(source, /pathname === "\/_worker\.js"/);
  assert.ok(source.includes(MISSING_API_KEY_MESSAGE));
});

test("Pages worker can be generated without baking a key", () => {
  const source = buildPagesWorkerSource("");
  assert.match(source, /BAKED_API_KEY = ""/);
  assert.match(source, /env\?\.GEMINI_API_KEY/);
});
