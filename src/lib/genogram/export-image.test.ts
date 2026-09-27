import assert from "node:assert/strict";
import { test } from "node:test";
import { renderFamilyGraphSvg } from "./draw";
import {
  EXPORT_FILE_PREFIX,
  buildExportFileName,
  familyGraphSvg,
  readSvgPixelSize,
} from "./export-image";
import { seedDemoGraph } from "./relations";
import { EMPTY_GRAPH } from "./types";

test("export file names use the local date and requested format", () => {
  const now = new Date(2026, 8, 27);
  assert.equal(buildExportFileName("png", now), `${EXPORT_FILE_PREFIX}-2026-09-27.png`);
  assert.equal(buildExportFileName("jpg", now), `${EXPORT_FILE_PREFIX}-2026-09-27.jpg`);
});

test("svg pixel size is read from the rendered genogram", () => {
  const svg = renderFamilyGraphSvg(seedDemoGraph(), "final");
  const size = readSvgPixelSize(svg);
  assert.ok(size.width > 0);
  assert.ok(size.height > 0);
  assert.match(svg, /xmlns="http:\/\/www.w3.org\/2000\/svg"/);
});

test("exporting an empty graph is rejected", () => {
  assert.throws(() => familyGraphSvg(EMPTY_GRAPH, "final"), /내보낼 가계도가 없습니다/);
});
