import { COLLATERAL_SCALE_OPTIONS, type CollateralScale } from "./types";

export const NODE_SIZE = 40;
/**
 * Collateral scale used until the counselor picks another. The chosen scale is
 * a maximum: the layout may fit a smaller one when a collateral branch would
 * overlap someone, and every collateral person shares that fitted scale.
 */
export const COLLATERAL_SCALE: CollateralScale = 0.8;
export const COLLATERAL_SCALE_MIN: number = COLLATERAL_SCALE_OPTIONS[0];
export const COLLATERAL_SCALE_STEPS = 5;
export const NODE_HALF = NODE_SIZE / 2;
export const INDEX_INSET = 5;
export const DROP_LENGTH = 18;
export const GENERATION_GAP = 168;
/** Length of a full generation line from the couple bar to the child glyph. */
export const GENERATION_STEM = GENERATION_GAP - NODE_SIZE - DROP_LENGTH;
/**
 * Collateral stems, before scale. Shorter than a full generation so an aunt's
 * child stays up with that aunt instead of dropping onto the client, and long
 * enough that the line under the couple bar is still visible.
 */
export const COLLATERAL_STEM = GENERATION_STEM - NODE_SIZE - DROP_LENGTH;
/**
 * Clear air under a collateral descendant whose column runs through a
 * direct-line person. Half a generation, so that child stays with its own
 * branch. Less than this shrinks every collateral person together.
 */
export const COLLATERAL_DIRECT_AIR = GENERATION_GAP / 2;
export const COLLATERAL_SIBLING_GAP = 84;
/** Child line at the preferred collateral scale. The fitted scale may draw it shorter. */
export const COLLATERAL_CHILD_GAP = GENERATION_GAP * COLLATERAL_SCALE;
/** Married siblings sit one short step below unmarried ones, still above the index couple. */
export const MARRIED_COLLATERAL_GAP = COLLATERAL_SIBLING_GAP + NODE_HALF + DROP_LENGTH / 2;
/** Air between unmarried sibling shapes. A spouse reserves another seat beside them. */
export const SIBLING_CLEARANCE = 32;
export const CHILD_SLOT_WIDTH = NODE_SIZE + SIBLING_CLEARANCE;
export const CHILD_DROP_INSET = 28;
export const MIN_COUPLE_GAP = 80;
/**
 * Air between collateral siblings or spouses, as a share of their own glyph.
 * Tighter than the direct line so wide families stay narrow and the direct line
 * stays large once the whole genogram is fitted onto a page.
 */
export const COLLATERAL_CLEARANCE_RATIO = 0.3;
/** Collateral seat before scaling; the layout multiplies it by the collateral scale with the glyph. */
export const COLLATERAL_SLOT_WIDTH = NODE_SIZE * (1 + COLLATERAL_CLEARANCE_RATIO);
export const MIN_COLLATERAL_COUPLE_GAP = COLLATERAL_SLOT_WIDTH;
export const FOO_SIDE_CLEARANCE = NODE_SIZE;
export const FOO_CLEARANCE_PASSES = 12;
export const HOUSEHOLD_PAD_X = 36;
export const HOUSEHOLD_PAD_Y = 28;
export const HOUSEHOLD_DASH = "7 5";
export const HISTORY_LIMIT = 50;
export const CANVAS_PADDING_X = 80;
export const CANVAS_PADDING_Y = 96;
export const CANVAS_ZOOM_MIN = 0.25;
export const CANVAS_ZOOM_MAX = 3;
export const CANVAS_ZOOM_STEP = 0.25;
export const CANVAS_ZOOM_DEFAULT = 1;
export const LABEL_LINE_HEIGHT = 15;
export const AGE_FONT_SIZE = 12;
/** Drops the age baseline so the digits sit visually centered in the glyph. */
export const AGE_BASELINE_OFFSET = 4;
export const YEAR_GAP_ABOVE = 12;
export const YEAR_LABEL_BOX_HEIGHT = 16;
export const NOTE_GAP_BELOW = 18;
export const TEXT_BACKDROP_OPACITY = 0.68;
export const SHAPE_OUTLINE_CLEARANCE = 4;
export const STRUCTURE_COLOR = "#1c1917";
export const STRUCTURE_WIDTH = 1.7;
export const DEATH_MARK_INSET = STRUCTURE_WIDTH / 2;
export const CIRCLE_DEATH_MARK_ARM = (NODE_HALF - DEATH_MARK_INSET) / Math.SQRT2;
export const FILL_COLOR = "#ffffff";
export const YEAR_COLOR = "#44403c";
export const NOTE_COLOR = "#57534e";
export const PERSON_CODE_COLOR = "#0f766e";
/** Fixed break in the middle of a cutoff line. Never grows with the line. */
export const CUTOFF_GAP = 8;
export const CUTOFF_TICK_SIZE = 7;
/** Along-line distance from one conflict tip to the next. Same tooth as the legend. */
export const CONFLICT_TOOTH_WIDTH = 6;
/** How far each conflict tip leaves the straight line. */
export const CONFLICT_AMPLITUDE = 4;
/** Relationship lines bow this far off the chord, like an arc of a large circle. */
export const EMOTION_ARC_SAGITTA = 18;
/** Short relationship lines bow less, so the arc stays shallow. */
export const EMOTION_ARC_SAGITTA_RATIO = 0.1;
export const EMOTION_ARROW_LENGTH = 11;
export const EMOTION_ARROW_HALF_WIDTH = 5;
/** Air between an arrow tip and the outline it points at, so the outline stroke never hides the tip. */
export const EMOTION_ARROW_CLEARANCE = STRUCTURE_WIDTH + 2;
export const EMOTION_STROKE_OPACITY = 0.68;
export const CLOSE_LINE_OFFSET = 2.5;
export const FUSED_LINE_OFFSET = 3;
export const COUPLE_YEAR_EVENT_LABELS: Record<string, string> = {
  marriage: "결혼",
  remarriage: "재혼",
  sameSexUnion: "결혼",
  cohabitation: "동거",
  affair: "혼외",
  separation: "별거",
  divorce: "이혼",
};

export function coupleYearCaption(kind: string, year: number): string {
  const eventLabel = COUPLE_YEAR_EVENT_LABELS[kind] ?? "결혼";
  return `${year} ${eventLabel}`;
}

export const EMOTION_COLORS: Record<string, string> = {
  close: "#60a5fa",
  distant: "#94a3b8",
  fused: "#a78bfa",
  conflict: "#f87171",
  cutoff: "#e879f9",
  fusedConflict: "#fb7185",
  focused: "#fb923c",
  physicalAbuse: "#fb7185",
  sexualAbuse: "#f87171",
};
