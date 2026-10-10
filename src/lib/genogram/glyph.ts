import { INDEX_RING_GAP, NODE_HALF } from "./constants";
import type { PersonData } from "./types";

/**
 * The client's double outline goes outside the shape, not inside it, so the most important
 * person reads larger than the people around them. Only the circle and square carry it.
 */
export function hasIndexRing(data: PersonData): boolean {
  const drawnAsShape = data.vitalStatus !== "pregnancy" && data.vitalStatus !== "miscarriage";
  return data.isIndexPerson && drawnAsShape && (data.gender === "F" || data.gender === "M");
}

/** Distance from an unscaled glyph's center to its outermost outline. */
export function glyphReach(data: PersonData): number {
  return NODE_HALF + (hasIndexRing(data) ? INDEX_RING_GAP : 0);
}
