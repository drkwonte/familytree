import assert from "node:assert/strict";
import { test } from "node:test";
import { CANVAS_ZOOM_MAX, CANVAS_ZOOM_MIN } from "./constants";
import { fitCanvasZoom, stepCanvasZoom } from "./canvas-view";

test("canvas zoom steps stay within the allowed range", () => {
  assert.equal(stepCanvasZoom(1, 1), 1.25);
  assert.equal(stepCanvasZoom(1, -1), 0.75);
  assert.equal(stepCanvasZoom(CANVAS_ZOOM_MIN, -1), CANVAS_ZOOM_MIN);
  assert.equal(stepCanvasZoom(CANVAS_ZOOM_MAX, 1), CANVAS_ZOOM_MAX);
});

test("fit zoom shrinks a wide diagram to the viewport", () => {
  assert.equal(fitCanvasZoom(2000, 400, 1000, 800), 0.5);
  assert.equal(fitCanvasZoom(400, 2000, 800, 1000), 0.5);
  assert.equal(fitCanvasZoom(100, 100, 800, 600), CANVAS_ZOOM_MAX);
});
