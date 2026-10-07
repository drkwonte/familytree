import {
  CIRCLE_DEATH_MARK_ARM,
  CLOSE_LINE_OFFSET,
  CONFLICT_AMPLITUDE,
  CONFLICT_TOOTH_WIDTH,
  coupleYearCaption,
  CUTOFF_GAP,
  EMOTION_ARC_SAGITTA,
  EMOTION_ARC_SAGITTA_RATIO,
  EMOTION_CHILD_CLEARANCE,
  FUSED_LINE_OFFSET,
  CUTOFF_TICK_SIZE,
  DEATH_MARK_INSET,
  EMOTION_COLORS,
  EMOTION_STROKE_OPACITY,
  FILL_COLOR,
  HOUSEHOLD_DASH,
  INDEX_INSET,
  LABEL_LINE_HEIGHT,
  NOTE_GAP_BELOW,
  NODE_HALF,
  NODE_SIZE,
  NOTE_COLOR,
  PERSON_CODE_COLOR,
  SHAPE_OUTLINE_CLEARANCE,
  STRUCTURE_COLOR,
  STRUCTURE_WIDTH,
  TEXT_BACKDROP_OPACITY,
  YEAR_COLOR,
  YEAR_GAP_ABOVE,
} from "./constants";
import { layoutFamily, type ChildDrop, type EmotionalLink } from "./layout";
import { personCode } from "./relations";
import type { FamilyGraph, ViewMode } from "./types";

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

function emotionArc(x1: number, y1: number, x2: number, y2: number, radius?: number): string {
  const length = Math.hypot(x2 - x1, y2 - y1) || 1;
  const sagitta = arcSagitta(length);
  const resolved = radius ?? (sagitta < 1 ? 0 : arcRadius(length, sagitta));
  if (!resolved) return `M ${x1} ${y1} L ${x2} ${y2}`;
  return `M ${x1} ${y1} A ${resolved} ${resolved} 0 0 1 ${x2} ${y2}`;
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

type Interval = { start: number; end: number };

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

function crossParameter(child: Segment, emotion: Segment): number | null {
  const denom = (child.x1 - child.x2) * (emotion.y1 - emotion.y2) - (child.y1 - child.y2) * (emotion.x1 - emotion.x2);
  if (Math.abs(denom) < 1e-6) return null;
  const t =
    ((child.x1 - emotion.x1) * (emotion.y1 - emotion.y2) - (child.y1 - emotion.y1) * (emotion.x1 - emotion.x2)) /
    denom;
  const u =
    ((child.x1 - emotion.x1) * (child.y1 - child.y2) - (child.y1 - emotion.y1) * (child.x1 - child.x2)) / denom;
  if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return null;
  const x = child.x1 + (child.x2 - child.x1) * t;
  const y = child.y1 + (child.y2 - child.y1) * t;
  const nearPerson =
    Math.hypot(x - emotion.x1, y - emotion.y1) <= NODE_HALF ||
    Math.hypot(x - emotion.x2, y - emotion.y2) <= NODE_HALF;
  return nearPerson ? null : t;
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((left, right) => left.start - right.start);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (!last || interval.start > last.end) merged.push({ ...interval });
    else last.end = Math.max(last.end, interval.end);
  }
  return merged;
}

function openChildSegment(segment: Segment, links: EmotionalLink[]): Segment[] {
  const length = Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1) || 1;
  const gaps = links.flatMap((link) => {
    const t = crossParameter(segment, {
      x1: link.source.x,
      y1: link.source.y,
      x2: link.target.x,
      y2: link.target.y,
    });
    if (t == null) return [];
    const half = EMOTION_CHILD_CLEARANCE / length;
    return [{ start: t - half, end: t + half }];
  });
  const blocked = mergeIntervals(gaps);
  const pieces: Segment[] = [];
  let cursor = 0;
  const push = (from: number, to: number) => {
    if (to - from <= 2 / length) return;
    pieces.push({
      x1: segment.x1 + (segment.x2 - segment.x1) * from,
      y1: segment.y1 + (segment.y2 - segment.y1) * from,
      x2: segment.x1 + (segment.x2 - segment.x1) * to,
      y2: segment.y1 + (segment.y2 - segment.y1) * to,
    });
  };
  for (const gap of blocked) {
    push(cursor, Math.max(0, gap.start));
    cursor = Math.min(1, gap.end);
  }
  push(cursor, 1);
  return pieces;
}

function paintChildPieces(drop: ChildDrop, links: EmotionalLink[]): string {
  const dashed = drop.dashed ? ' stroke-dasharray="5 4"' : "";
  const paint = `stroke="${STRUCTURE_COLOR}" stroke-width="${STRUCTURE_WIDTH}"${dashed}`;
  return childDropSegments(drop)
    .flatMap((segment) => openChildSegment(segment, links))
    .map((piece) => `<line x1="${piece.x1}" y1="${piece.y1}" x2="${piece.x2}" y2="${piece.y2}" ${paint}/>`)
    .join("");
}

function deathMark(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number): string {
  return `<path d="M ${x1} ${y1} L ${x2} ${y2} M ${x3} ${y3} L ${x4} ${y4}" stroke="${STRUCTURE_COLOR}" stroke-width="${STRUCTURE_WIDTH}" fill="none"/>`;
}

function maleSquare(x: number, y: number, isIndex: boolean): string {
  const parts = [
    `<rect x="${x - NODE_HALF}" y="${y - NODE_HALF}" width="${NODE_SIZE}" height="${NODE_SIZE}" fill="${FILL_COLOR}" stroke="${STRUCTURE_COLOR}" stroke-width="${STRUCTURE_WIDTH}"/>`,
  ];
  if (isIndex) {
    parts.push(
      `<rect x="${x - NODE_HALF + INDEX_INSET}" y="${y - NODE_HALF + INDEX_INSET}" width="${NODE_SIZE - INDEX_INSET * 2}" height="${NODE_SIZE - INDEX_INSET * 2}" fill="none" stroke="${STRUCTURE_COLOR}" stroke-width="${STRUCTURE_WIDTH}"/>`,
    );
  }
  return parts.join("");
}

function femaleCircle(x: number, y: number, isIndex: boolean): string {
  const parts = [
    `<circle cx="${x}" cy="${y}" r="${NODE_HALF}" fill="${FILL_COLOR}" stroke="${STRUCTURE_COLOR}" stroke-width="${STRUCTURE_WIDTH}"/>`,
  ];
  if (isIndex) {
    parts.push(
      `<circle cx="${x}" cy="${y}" r="${NODE_HALF - INDEX_INSET}" fill="none" stroke="${STRUCTURE_COLOR}" stroke-width="${STRUCTURE_WIDTH}"/>`,
    );
  }
  return parts.join("");
}

function unknownDiamond(x: number, y: number): string {
  return `<polygon points="${x},${y - NODE_HALF} ${x + NODE_HALF},${y} ${x},${y + NODE_HALF} ${x - NODE_HALF},${y}" fill="${FILL_COLOR}" stroke="${STRUCTURE_COLOR}" stroke-width="${STRUCTURE_WIDTH}"/>`;
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

function personShape(node: {
  x: number;
  y: number;
  data: FamilyGraph["nodes"][number]["data"];
}): string {
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
    parts.push(femaleCircle(x, y, data.isIndexPerson));
  } else if (data.gender === "M") {
    parts.push(maleSquare(x, y, data.isIndexPerson));
  } else {
    parts.push(unknownDiamond(x, y));
  }

  if (data.vitalStatus === "deceased" || data.vitalStatus === "stillbirth") {
    if (data.gender === "F") parts.push(deceasedFemaleMark(x, y));
    else if (data.gender === "M") parts.push(deceasedMaleMark(x, y));
    else parts.push(deceasedDiamondMark(x, y));
  }
  if (data.age !== undefined && data.vitalStatus !== "miscarriage") {
    parts.push(
      `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="12" fill="${STRUCTURE_COLOR}">${data.age}</text>`,
    );
  }
  return parts.join("");
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

function drawEmotion(link: EmotionalLink): string {
  const color = EMOTION_COLORS[String(link.kind)] ?? "#fda4af";
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

export function renderFamilyGraphSvg(graph: FamilyGraph, viewMode: ViewMode = "edit"): string {
  const layout = layoutFamily(graph);
  const layers: string[] = [];

  for (const box of layout.householdBoxes) {
    layers.push(
      `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="none" stroke="${STRUCTURE_COLOR}" stroke-width="${STRUCTURE_WIDTH}" stroke-dasharray="${HOUSEHOLD_DASH}"/>`,
    );
  }

  for (const bar of layout.coupleBars) {
    const dashed = bar.kind === "cohabitation" || bar.kind === "affair" ? ' stroke-dasharray="5 4"' : "";
    layers.push(
      `<path d="M ${bar.leftX} ${bar.leftCenterY} L ${bar.leftX} ${bar.barY} L ${bar.rightX} ${bar.barY} L ${bar.rightX} ${bar.rightCenterY}" fill="none" stroke="${STRUCTURE_COLOR}" stroke-width="${STRUCTURE_WIDTH}"${dashed}/>`,
    );
    const midX = (bar.leftX + bar.rightX) / 2;
    layers.push(coupleMarks(String(bar.kind), midX, bar.barY));
    if (bar.year) {
      layers.push(
        `<text x="${midX}" y="${bar.barY - 5}" text-anchor="middle" font-size="11" fill="${YEAR_COLOR}">${coupleYearCaption(String(bar.kind), bar.year)}</text>`,
      );
    }
  }

  for (const drop of layout.childDrops) {
    layers.push(paintChildPieces(drop, layout.emotional));
  }

  for (const link of layout.emotional) {
    layers.push(drawEmotion(link));
  }

  for (const node of layout.nodes) {
    const shapeTop = node.y - NODE_HALF;
    const shapeBottom = node.y + NODE_HALF;
    const labels: string[] = [];
    if (node.data.birthYear != null && Number.isFinite(node.data.birthYear)) {
      labels.push(
        labeledText(
          node.x,
          node.y - NODE_HALF - YEAR_GAP_ABOVE,
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
          node.y + NODE_HALF + NOTE_GAP_BELOW + index * LABEL_LINE_HEIGHT,
          note,
          fill,
          shapeTop,
          shapeBottom,
        ),
      );
    });
    layers.push(
      `<g data-person-id="${node.id}" style="cursor:pointer">${personShape(node)}${labels.join("")}</g>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${layout.viewMinX} ${layout.viewMinY} ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}" font-family="Noto Sans KR, Malgun Gothic, sans-serif">${layers.join("")}</svg>`;
}
