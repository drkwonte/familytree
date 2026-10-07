export const NODE_SIZE = 40;
export const NODE_HALF = NODE_SIZE / 2;
export const INDEX_INSET = 5;
export const DROP_LENGTH = 18;
export const GENERATION_GAP = 168;
export const COLLATERAL_SIBLING_GAP = 84;
/** Married siblings sit one short step below unmarried ones, still above the index couple. */
export const MARRIED_COLLATERAL_GAP = COLLATERAL_SIBLING_GAP + NODE_HALF + DROP_LENGTH / 2;
/** Air between unmarried sibling shapes. A spouse reserves another seat beside them. */
export const SIBLING_CLEARANCE = 32;
export const CHILD_SLOT_WIDTH = NODE_SIZE + SIBLING_CLEARANCE;
export const CHILD_DROP_INSET = 28;
export const MIN_COUPLE_GAP = 80;
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
/** Child lines open this far on each side of a relationship line they cross. */
export const EMOTION_CHILD_CLEARANCE = CONFLICT_AMPLITUDE * 2 + 4;
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
