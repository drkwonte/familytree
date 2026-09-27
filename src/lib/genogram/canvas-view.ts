import {
  CANVAS_ZOOM_DEFAULT,
  CANVAS_ZOOM_MAX,
  CANVAS_ZOOM_MIN,
  CANVAS_ZOOM_STEP,
} from "./constants";

function clampZoom(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Math.min(CANVAS_ZOOM_MAX, Math.max(CANVAS_ZOOM_MIN, rounded));
}

export function stepCanvasZoom(current: number, direction: 1 | -1): number {
  return clampZoom(current + direction * CANVAS_ZOOM_STEP);
}

export function fitCanvasZoom(
  contentWidth: number,
  contentHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): number {
  if (contentWidth <= 0 || contentHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return CANVAS_ZOOM_DEFAULT;
  }
  return clampZoom(Math.min(viewportWidth / contentWidth, viewportHeight / contentHeight));
}
