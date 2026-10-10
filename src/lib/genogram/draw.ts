import {
  AGE_BASELINE_OFFSET,
  AGE_FONT_SIZE,
  CIRCLE_DEATH_MARK_ARM,
  CLOSE_LINE_OFFSET,
  CONFLICT_AMPLITUDE,
  CONFLICT_TOOTH_WIDTH,
  coupleYearCaption,
  CUTOFF_GAP,
  DROP_LENGTH,
  EMOTION_ARC_SAGITTA,
  EMOTION_ARC_SAGITTA_RATIO,
  EMOTION_ARROW_CLEARANCE,
  EMOTION_ARROW_HALF_WIDTH,
  EMOTION_ARROW_LENGTH,
  FUSED_LINE_OFFSET,
  CUTOFF_TICK_SIZE,
  DEATH_MARK_INSET,
  EMOTION_COLORS,
  EMOTION_STROKE_OPACITY,
  FILL_COLOR,
  HOUSEHOLD_DASH,
  INDEX_RING_GAP,
  LABEL_LINE_HEIGHT,
  NOTE_GAP_BELOW,
  NODE_HALF,
  NOTE_COLOR,
  PERSON_CODE_COLOR,
  SHAPE_OUTLINE_CLEARANCE,
  STRUCTURE_COLOR,
  STRUCTURE_WIDTH,
  TEXT_BACKDROP_OPACITY,
  YEAR_COLOR,
  YEAR_GAP_ABOVE,
} from "./constants";
import { glyphReach, hasIndexRing } from "./glyph";
import { directLineIds, layoutFamily, type ChildDrop, type CoupleBar, type EmotionalLink } from "./layout";
import { personCode } from "./relations";
import { type FamilyGraph, isDirectionalEmotion, type PersonData, type ViewMode } from "./types";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function lineSegment(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { x1: number; y1: number; x2: number; y2: number; dx: number; dy: number; length: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return { x1, y1, x2, y2, dx, dy, length: Math.hypot(dx, dy) || 1 };
}

function pointOnLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t: number,
): { x: number; y: number } {
  return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
}

function unitNormal(x1: number, y1: number, x2: number, y2: number): { x: number; y: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  return { x: -dy / length, y: dx / length };
}

function arcSagitta(length: number): number {
  return Math.min(EMOTION_ARC_SAGITTA, length * EMOTION_ARC_SAGITTA_RATIO);
}

function arcRadius(length: number, sagitta: number): number {
  return (sagitta * sagitta + (length * length) / 4) / (2 * sagitta);
}

type Point = { x: number; y: number };

type ArcCircle = { center: Point; radius: number };

/** Circle a relationship line bends along; null when the line is short enough to stay straight. */
function emotionArcCircle(x1: number, y1: number, x2: number, y2: number): ArcCircle | null {
  const length = Math.hypot(x2 - x1, y2 - y1) || 1;
  const sagitta = arcSagitta(length);
  if (sagitta < 1) return null;
  const radius = arcRadius(length, sagitta);
  const normal = unitNormal(x1, y1, x2, y2);
  const centerOffset = radius - sagitta;
  // The arc's sweep flag turns clockwise on screen, so its center is the side the end lies clockwise of.
  for (const side of [1, -1]) {
    const center = {
      x: (x1 + x2) / 2 + normal.x * centerOffset * side,
      y: (y1 + y2) / 2 + normal.y * centerOffset * side,
    };
    const turn = (x1 - center.x) * (y2 - center.y) - (y1 - center.y) * (x2 - center.x);
    if (turn > 0) return { center, radius };
  }
  return null;
}

function emotionArc(x1: number, y1: number, x2: number, y2: number, radius?: number): string {
  const resolved = radius ?? emotionArcCircle(x1, y1, x2, y2)?.radius ?? 0;
  if (!resolved) return `M ${x1} ${y1} L ${x2} ${y2}`;
  return `M ${x1} ${y1} A ${resolved} ${resolved} 0 0 1 ${x2} ${y2}`;
}

/** Point `distance` back from the end along the drawn line, following its arc when it bends. */
function pointBeforeEnd(start: Point, end: Point, circle: ArcCircle | null, distance: number): Point {
  if (!circle) {
    const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
    return {
      x: end.x - ((end.x - start.x) / length) * distance,
      y: end.y - ((end.y - start.y) / length) * distance,
    };
  }
  const endAngle = Math.atan2(end.y - circle.center.y, end.x - circle.center.x);
  const angle = endAngle - distance / circle.radius;
  return {
    x: circle.center.x + circle.radius * Math.cos(angle),
    y: circle.center.y + circle.radius * Math.sin(angle),
  };
}

type ArrowTarget = { data: PersonData; scale: number };

/** Distance from an unscaled glyph's center to its outline along a unit direction. */
function glyphOutlineDistance(data: PersonData, direction: Point): number {
  const across = Math.abs(direction.x);
  const down = Math.abs(direction.y);
  const reach = glyphReach(data);
  const isBoxed = data.vitalStatus === "pregnancy" || (data.vitalStatus !== "miscarriage" && data.gender === "M");
  if (isBoxed) return reach / Math.max(across, down);
  const isDiamond = data.vitalStatus !== "miscarriage" && data.gender === "U";
  if (isDiamond) return reach / (across + down);
  return reach;
}

/** The line stops short of the receiving person so the arrowhead sits whole outside that glyph. */
function drawDirectedEmotion(link: EmotionalLink, color: string, target: ArrowTarget): string {
  const start = link.source;
  const end = link.target;
  const circle = emotionArcCircle(start.x, start.y, end.x, end.y);
  const approach = pointBeforeEnd(start, end, circle, NODE_HALF * target.scale);
  const approachLength = Math.hypot(approach.x - end.x, approach.y - end.y) || 1;
  const direction = { x: (approach.x - end.x) / approachLength, y: (approach.y - end.y) / approachLength };
  const tipDistance = glyphOutlineDistance(target.data, direction) * target.scale + EMOTION_ARROW_CLEARANCE;
  const tip = pointBeforeEnd(start, end, circle, tipDistance);
  const base = pointBeforeEnd(start, end, circle, tipDistance + EMOTION_ARROW_LENGTH);
  const wing = unitNormal(base.x, base.y, tip.x, tip.y);
  const left = { x: base.x + wing.x * EMOTION_ARROW_HALF_WIDTH, y: base.y + wing.y * EMOTION_ARROW_HALF_WIDTH };
  const right = { x: base.x - wing.x * EMOTION_ARROW_HALF_WIDTH, y: base.y - wing.y * EMOTION_ARROW_HALF_WIDTH };
  const line = emotionArc(start.x, start.y, base.x, base.y, circle?.radius ?? 0);
  return `<path d="${line}" fill="none" ${emotionPaint(color)} stroke-width="1.8"/><polygon points="${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}" fill="${color}" fill-opacity="${EMOTION_STROKE_OPACITY}"/>`;
}

function shiftEnds(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  amount: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const normal = unitNormal(x1, y1, x2, y2);
  return {
    x1: x1 + normal.x * amount,
    y1: y1 + normal.y * amount,
    x2: x2 + normal.x * amount,
    y2: y2 + normal.y * amount,
  };
}

function zigzagAlong(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  const normal = unitNormal(x1, y1, x2, y2);
  let steps = Math.max(2, Math.round(length / CONFLICT_TOOTH_WIDTH));
  if (steps % 2 !== 0) steps += 1;
  const points: string[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const point = pointOnLine(x1, y1, x2, y2, index / steps);
    const atEnd = index === 0 || index === steps;
    const offset = atEnd ? 0 : index % 2 === 1 ? CONFLICT_AMPLITUDE : -CONFLICT_AMPLITUDE;
    points.push(`${point.x + normal.x * offset},${point.y + normal.y * offset}`);
  }
  return `M ${points.join(" L ")}`;
}

type Segment = { x1: number; y1: number; x2: number; y2: number };

function childDropSegments(drop: ChildDrop): Segment[] {
  const offset = drop.fromX != null && drop.elbowY != null && Math.abs(drop.fromX - drop.x) > 0.01;
  if (!offset || drop.elbowY == null || drop.fromX == null) {
    return [{ x1: drop.x, y1: drop.fromY, x2: drop.x, y2: drop.toY }];
  }
  return [
    { x1: drop.fromX, y1: drop.fromY, x2: drop.fromX, y2: drop.elbowY },
    { x1: drop.fromX, y1: drop.elbowY, x2: drop.x, y2: drop.elbowY },
    { x1: drop.x, y1: drop.elbowY, x2: drop.x, y2: drop.toY },
  ];
}

function paintChildDrop(drop: ChildDrop, strokeWidth: number): string {
  const dashed = drop.dashed ? ' stroke-dasharray="5 4"' : "";
  const paint = `stroke="${STRUCTURE_COLOR}" stroke-width="${strokeWidth}"${dashed}`;
  return childDropSegments(drop)
    .map((piece) => `<line x1="${piece.x1}" y1="${piece.y1}" x2="${piece.x2}" y2="${piece.y2}" ${paint}/>`)
    .join("");
}

function deathMark(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number): string {
  return `<path d="M ${x1} ${y1} L ${x2} ${y2} M ${x3} ${y3} L ${x4} ${y4}" stroke="${STRUCTURE_COLOR}" stroke-width="${STRUCTURE_WIDTH}" fill="none"/>`;
}

const OUTLINE_PAINT = `fill="${FILL_COLOR}" stroke="${STRUCTURE_COLOR}" stroke-width="${STRUCTURE_WIDTH}"`;

function square(x: number, y: number, half: number): string {
  return `<rect x="${x - half}" y="${y - half}" width="${half * 2}" height="${half * 2}" ${OUTLINE_PAINT}/>`;
}

function circle(x: number, y: number, radius: number): string {
  return `<circle cx="${x}" cy="${y}" r="${radius}" ${OUTLINE_PAINT}/>`;
}

/** The outer ring is filled and painted first, so lines meeting the client stop at the ring. */
function withIndexRing(outline: (half: number) => string, hasRing: boolean): string {
  return (hasRing ? outline(NODE_HALF + INDEX_RING_GAP) : "") + outline(NODE_HALF);
}

function maleSquare(x: number, y: number, hasRing: boolean): string {
  return withIndexRing((half) => square(x, y, half), hasRing);
}

function femaleCircle(x: number, y: number, hasRing: boolean): string {
  return withIndexRing((radius) => circle(x, y, radius), hasRing);
}

function unknownDiamond(x: number, y: number): string {
  return `<polygon points="${x},${y - NODE_HALF} ${x + NODE_HALF},${y} ${x},${y + NODE_HALF} ${x - NODE_HALF},${y}" ${OUTLINE_PAINT}/>`;
}

function deceasedMaleMark(x: number, y: number): string {
  const left = x - NODE_HALF + DEATH_MARK_INSET;
  const right = x + NODE_HALF - DEATH_MARK_INSET;
  const top = y - NODE_HALF + DEATH_MARK_INSET;
  const bottom = y + NODE_HALF - DEATH_MARK_INSET;
  return deathMark(left, top, right, bottom, right, top, left, bottom);
}

function deceasedFemaleMark(x: number, y: number): string {
  const arm = CIRCLE_DEATH_MARK_ARM;
  return deathMark(x - arm, y - arm, x + arm, y + arm, x + arm, y - arm, x - arm, y + arm);
}

function deceasedDiamondMark(x: number, y: number): string {
  const inset = DEATH_MARK_INSET;
  return deathMark(x, y - NODE_HALF + inset, x, y + NODE_HALF - inset, x + NODE_HALF - inset, y, x - NODE_HALF + inset, y);
}

type PlacedPerson = { x: number; y: number; data: PersonData };

function personShape(node: PlacedPerson): string {
  const { x, y, data } = node;
  const parts: string[] = [];
  if (data.vitalStatus === "pregnancy") {
    parts.push(
      `<polygon points="${x},${y - NODE_HALF} ${x + NODE_HALF},${y + NODE_HALF} ${x - NODE_HALF},${y + NODE_HALF}" fill="${FILL_COLOR}" stroke="${STRUCTURE_COLOR}" stroke-width="${STRUCTURE_WIDTH}"/>`,
    );
  } else if (data.vitalStatus === "miscarriage") {
    parts.push(
      `<path d="M ${x - 8} ${y - 8} L ${x + 8} ${y + 8} M ${x + 8} ${y - 8} L ${x - 8} ${y + 8}" stroke="${STRUCTURE_COLOR}" stroke-width="${STRUCTURE_WIDTH}" fill="none"/>`,
    );
  } else if (data.gender === "F") {
    parts.push(femaleCircle(x, y, hasIndexRing(data)));
  } else if (data.gender === "M") {
    parts.push(maleSquare(x, y, hasIndexRing(data)));
  } else {
    parts.push(unknownDiamond(x, y));
  }

  if (data.vitalStatus === "deceased" || data.vitalStatus === "stillbirth") {
    if (data.gender === "F") parts.push(deceasedFemaleMark(x, y));
    else if (data.gender === "M") parts.push(deceasedMaleMark(x, y));
    else parts.push(deceasedDiamondMark(x, y));
  }
  return parts.join("");
}

/** Drawn outside any glyph scaling: a shrunken collateral person must keep a readable age. */
function ageCaption(node: PlacedPerson): string {
  const { x, y, data } = node;
  if (data.age === undefined || data.vitalStatus === "miscarriage") return "";
  return `<text x="${x}" y="${y + AGE_BASELINE_OFFSET}" text-anchor="middle" font-size="${AGE_FONT_SIZE}" fill="${STRUCTURE_COLOR}">${data.age}</text>`;
}

function scaledPersonShape(node: PlacedPerson, scale: number): string {
  const shape = personShape(node);
  if (scale === 1) return shape;
  return `<g transform="translate(${node.x} ${node.y}) scale(${scale}) translate(${-node.x} ${-node.y})">${shape}</g>`;
}

function labeledText(
  x: number,
  baseline: number,
  text: string,
  fill: string,
  shapeTop: number,
  shapeBottom: number,
): string {
  const width = Math.max(28, [...text].length * 7.2 + 10);
  const height = 14;
  let boxTop = baseline - 11;
  const boxBottom = boxTop + height;
  if (boxBottom > shapeTop - SHAPE_OUTLINE_CLEARANCE && boxTop < shapeBottom + SHAPE_OUTLINE_CLEARANCE) {
    if (baseline < (shapeTop + shapeBottom) / 2) {
      boxTop = shapeTop - SHAPE_OUTLINE_CLEARANCE - height;
    } else {
      boxTop = shapeBottom + SHAPE_OUTLINE_CLEARANCE;
    }
  }
  const textY = boxTop + 11;
  return `<rect x="${x - width / 2}" y="${boxTop}" width="${width}" height="${height}" fill="${FILL_COLOR}" fill-opacity="${TEXT_BACKDROP_OPACITY}"/><text x="${x}" y="${textY}" text-anchor="middle" font-size="11" fill="${fill}">${escapeXml(text)}</text>`;
}

function coupleMarks(kind: string, midX: number, barY: number): string {
  if (kind === "separation") {
    return `<line x1="${midX - 6}" y1="${barY - 10}" x2="${midX + 6}" y2="${barY + 10}" stroke="${STRUCTURE_COLOR}" stroke-width="${STRUCTURE_WIDTH}"/>`;
  }
  if (kind === "divorce") {
    return `<line x1="${midX - 10}" y1="${barY - 10}" x2="${midX}" y2="${barY + 10}" stroke="${STRUCTURE_COLOR}" stroke-width="${STRUCTURE_WIDTH}"/><line x1="${midX}" y1="${barY - 10}" x2="${midX + 10}" y2="${barY + 10}" stroke="${STRUCTURE_COLOR}" stroke-width="${STRUCTURE_WIDTH}"/>`;
  }
  return "";
}

function emotionPaint(color: string): string {
  return `stroke="${color}" stroke-opacity="${EMOTION_STROKE_OPACITY}"`;
}

function drawEmotion(link: EmotionalLink, target: ArrowTarget | null): string {
  const color = EMOTION_COLORS[String(link.kind)] ?? "#fda4af";
  if (target && isDirectionalEmotion(String(link.kind))) return drawDirectedEmotion(link, color, target);
  const paint = emotionPaint(color);
  const { x1, y1, x2, y2, length } = lineSegment(
    link.source.x,
    link.source.y,
    link.target.x,
    link.target.y,
  );
  const normal = unitNormal(x1, y1, x2, y2);

  if (link.kind === "conflict" || link.kind === "fusedConflict") {
    return `<path d="${zigzagAlong(x1, y1, x2, y2)}" fill="none" ${paint} stroke-width="${link.kind === "fusedConflict" ? 2.4 : 1.8}" stroke-linejoin="miter" stroke-miterlimit="8"/>`;
  }
  if (link.kind === "close") {
    const left = shiftEnds(x1, y1, x2, y2, -CLOSE_LINE_OFFSET);
    const right = shiftEnds(x1, y1, x2, y2, CLOSE_LINE_OFFSET);
    return `<path d="${emotionArc(left.x1, left.y1, left.x2, left.y2)}" fill="none" ${paint} stroke-width="2"/><path d="${emotionArc(right.x1, right.y1, right.x2, right.y2)}" fill="none" ${paint} stroke-width="2"/>`;
  }
  if (link.kind === "fused") {
    const left = shiftEnds(x1, y1, x2, y2, -FUSED_LINE_OFFSET);
    const right = shiftEnds(x1, y1, x2, y2, FUSED_LINE_OFFSET);
    return `<path d="${emotionArc(left.x1, left.y1, left.x2, left.y2)}" fill="none" ${paint} stroke-width="1.8"/><path d="${emotionArc(x1, y1, x2, y2)}" fill="none" ${paint} stroke-width="1.8"/><path d="${emotionArc(right.x1, right.y1, right.x2, right.y2)}" fill="none" ${paint} stroke-width="1.8"/>`;
  }
  if (link.kind === "distant") {
    return `<path d="${emotionArc(x1, y1, x2, y2)}" fill="none" ${paint} stroke-width="1.6" stroke-dasharray="5 4"/>`;
  }
  if (link.kind === "cutoff") {
    const alongX = (x2 - x1) / length;
    const alongY = (y2 - y1) / length;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const halfGap = Math.min(CUTOFF_GAP, length / 4) / 2;
    const gapStart = { x: midX - alongX * halfGap, y: midY - alongY * halfGap };
    const gapEnd = { x: midX + alongX * halfGap, y: midY + alongY * halfGap };
    const tick = (point: { x: number; y: number }) =>
      `<line x1="${point.x + normal.x * CUTOFF_TICK_SIZE}" y1="${point.y + normal.y * CUTOFF_TICK_SIZE}" x2="${point.x - normal.x * CUTOFF_TICK_SIZE}" y2="${point.y - normal.y * CUTOFF_TICK_SIZE}" ${paint} stroke-width="1.8"/>`;
    return `<line x1="${x1}" y1="${y1}" x2="${gapStart.x}" y2="${gapStart.y}" ${paint} stroke-width="1.8"/><line x1="${gapEnd.x}" y1="${gapEnd.y}" x2="${x2}" y2="${y2}" ${paint} stroke-width="1.8"/>${tick(gapStart)}${tick(gapEnd)}`;
  }
  return `<path d="${emotionArc(x1, y1, x2, y2)}" fill="none" ${paint} stroke-width="1.8"/>`;
}

function personScale(directLine: Set<string>, personId: string, collateralScale: number): number {
  return directLine.has(personId) ? 1 : collateralScale;
}

function coupleLineScale(directLine: Set<string>, bar: CoupleBar, collateralScale: number): number {
  return directLine.has(bar.leftId) && directLine.has(bar.rightId) ? 1 : collateralScale;
}

function drawnCoupleBarY(directLine: Set<string>, bar: CoupleBar, collateralScale: number): number {
  const scale = coupleLineScale(directLine, bar, collateralScale);
  const glyph = Math.max(
    personScale(directLine, bar.leftId, collateralScale),
    personScale(directLine, bar.rightId, collateralScale),
  );
  return bar.leftCenterY + NODE_HALF * glyph + DROP_LENGTH * scale;
}

export function renderFamilyGraphSvg(graph: FamilyGraph, viewMode: ViewMode = "edit"): string {
  const layout = layoutFamily(graph);
  const directLine = directLineIds(graph);
  const layers: string[] = [];
  const nodesById = new Map(layout.nodes.map((node) => [node.id, node]));

  // Relationship lines run center to center on the bottom layer; every structural line and
  // glyph is painted over them, so a crossing never breaks family lines.
  for (const link of layout.emotional) {
    const target = nodesById.get(link.targetId);
    const arrowTarget = target
      ? { data: target.data, scale: personScale(directLine, target.id, layout.collateralScale) }
      : null;
    layers.push(drawEmotion(link, arrowTarget));
  }

  for (const box of layout.householdBoxes) {
    layers.push(
      `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="none" stroke="${STRUCTURE_COLOR}" stroke-width="${STRUCTURE_WIDTH}" stroke-dasharray="${HOUSEHOLD_DASH}"/>`,
    );
  }

  for (const bar of layout.coupleBars) {
    const dashed = bar.kind === "cohabitation" || bar.kind === "affair" ? ' stroke-dasharray="5 4"' : "";
    const barY = drawnCoupleBarY(directLine, bar, layout.collateralScale);
    const strokeWidth = STRUCTURE_WIDTH * coupleLineScale(directLine, bar, layout.collateralScale);
    layers.push(
      `<path d="M ${bar.leftX} ${bar.leftCenterY} L ${bar.leftX} ${barY} L ${bar.rightX} ${barY} L ${bar.rightX} ${bar.rightCenterY}" fill="none" stroke="${STRUCTURE_COLOR}" stroke-width="${strokeWidth}"${dashed}/>`,
    );
    const midX = (bar.leftX + bar.rightX) / 2;
    layers.push(coupleMarks(String(bar.kind), midX, barY));
    if (bar.year) {
      layers.push(
        `<text x="${midX}" y="${barY - 5}" text-anchor="middle" font-size="11" fill="${YEAR_COLOR}">${coupleYearCaption(String(bar.kind), bar.year)}</text>`,
      );
    }
  }

  for (const drop of layout.childDrops) {
    const sourceBar = layout.coupleBars.find(
      (bar) =>
        Math.abs(bar.barY - drop.fromY) < 0.01 &&
        drop.x + 0.01 >= Math.min(bar.leftX, bar.rightX) &&
        drop.x - 0.01 <= Math.max(bar.leftX, bar.rightX),
    );
    let painted = drop;
    if (sourceBar) {
      painted = { ...drop, fromY: drawnCoupleBarY(directLine, sourceBar, layout.collateralScale) };
    } else if (drop.fromX != null && drop.elbowY != null) {
      const parent = layout.nodes.find(
        (node) => Math.abs(node.x - drop.fromX!) < 0.01 && Math.abs(node.y + NODE_HALF - drop.fromY) < 0.01,
      );
      if (parent) {
        const scale = personScale(directLine, parent.id, layout.collateralScale);
        const fromY = parent.y + NODE_HALF * scale;
        painted = { ...drop, fromY, elbowY: fromY + (drop.elbowY - drop.fromY) * scale };
      }
    }
    const child = layout.nodes.find(
      (node) => Math.abs(node.x - drop.x) < 0.01 && Math.abs(node.y - drop.toY) < 0.01,
    );
    const strokeWidth = STRUCTURE_WIDTH * (child ? personScale(directLine, child.id, layout.collateralScale) : 1);
    layers.push(paintChildDrop(painted, strokeWidth));
  }

  for (const node of layout.nodes) {
    const scale = personScale(directLine, node.id, layout.collateralScale);
    const shapeTop = node.y - glyphReach(node.data) * scale;
    const shapeBottom = node.y + glyphReach(node.data) * scale;
    const glyph = scaledPersonShape(node, scale) + ageCaption(node);
    const labels: string[] = [];
    if (node.data.birthYear != null && Number.isFinite(node.data.birthYear)) {
      labels.push(
        labeledText(
          node.x,
          shapeTop - YEAR_GAP_ABOVE,
          String(node.data.birthYear),
          YEAR_COLOR,
          shapeTop,
          shapeBottom,
        ),
      );
    }
    const notes: string[] = [];
    if (viewMode === "edit") notes.push(personCode(node.data.displayNumber));
    if (node.data.occupation) notes.push(node.data.occupation);
    notes.push(...node.data.tags);
    notes.forEach((note, index) => {
      const fill = viewMode === "edit" && index === 0 ? PERSON_CODE_COLOR : NOTE_COLOR;
      labels.push(
        labeledText(
          node.x,
          shapeBottom + NOTE_GAP_BELOW + index * LABEL_LINE_HEIGHT,
          note,
          fill,
          shapeTop,
          shapeBottom,
        ),
      );
    });
    layers.push(
      `<g data-person-id="${node.id}" style="cursor:pointer">${glyph}${labels.join("")}</g>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${layout.viewMinX} ${layout.viewMinY} ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}" font-family="Noto Sans KR, Malgun Gothic, sans-serif">${layers.join("")}</svg>`;
}
