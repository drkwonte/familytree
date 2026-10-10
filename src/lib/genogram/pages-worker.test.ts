import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { buildPagesFunctionSource } from "./pages-worker";

const WRANGLER_CONFIG_PATH = path.join(process.cwd(), "wrangler.jsonc");

/** Cloudflare's code for western North America, where Gemini serves requests. */
const GEMINI_SUPPORTED_PLACEMENT_HINT = "wnam";

function readWranglerConfig(): { placement?: { mode?: string; hint?: string } } {
  const withoutComments = readFileSync(WRANGLER_CONFIG_PATH, "utf8").replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(withoutComments.replace(/,(\s*[}\]])/g, "$1"));
}

test("Pages Function is placed in a Gemini-supported region, in a form the Pages builder's Wrangler accepts", () => {
  assert.deepEqual(readWranglerConfig().placement, { mode: "smart", hint: GEMINI_SUPPORTED_PLACEMENT_HINT });
});

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
