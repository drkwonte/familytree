import { FILL_COLOR } from "./constants";
import { renderFamilyGraphSvg } from "./draw";
import type { FamilyGraph, ViewMode } from "./types";

export const EXPORT_PIXEL_RATIO = 2;
export const EXPORT_JPEG_QUALITY = 0.92;
export const EXPORT_FILE_PREFIX = "가계도";

export type RasterFormat = "png" | "jpg";

const RASTER_MIME: Record<RasterFormat, string> = {
  png: "image/png",
  jpg: "image/jpeg",
};

function padTwoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

export function buildExportFileName(format: RasterFormat, now = new Date()): string {
  const stamp = `${now.getFullYear()}-${padTwoDigits(now.getMonth() + 1)}-${padTwoDigits(now.getDate())}`;
  return `${EXPORT_FILE_PREFIX}-${stamp}.${format}`;
}

export function readSvgPixelSize(svg: string): { width: number; height: number } {
  const width = Number(/width="([\d.]+)"/.exec(svg)?.[1]);
  const height = Number(/height="([\d.]+)"/.exec(svg)?.[1]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("가계도 크기를 읽을 수 없습니다.");
  }
  return { width, height };
}

export function familyGraphSvg(graph: FamilyGraph, viewMode: ViewMode): string {
  if (graph.nodes.length === 0) {
    throw new Error("내보낼 가계도가 없습니다.");
  }
  return renderFamilyGraphSvg(graph, viewMode);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("가계도 이미지를 만들지 못했습니다."));
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("가계도 파일을 만들지 못했습니다."));
          return;
        }
        resolve(blob);
      },
      mime,
      quality,
    );
  });
}

export async function rasterizeFamilySvg(svg: string, format: RasterFormat): Promise<Blob> {
  const { width, height } = readSvgPixelSize(svg);
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * EXPORT_PIXEL_RATIO);
    canvas.height = Math.round(height * EXPORT_PIXEL_RATIO);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("가계도 이미지를 만들지 못했습니다.");
    }
    context.fillStyle = FILL_COLOR;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvasToBlob(
      canvas,
      RASTER_MIME[format],
      format === "jpg" ? EXPORT_JPEG_QUALITY : undefined,
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadFamilyGraph(
  graph: FamilyGraph,
  viewMode: ViewMode,
  format: RasterFormat,
): Promise<void> {
  const svg = familyGraphSvg(graph, viewMode);
  const blob = await rasterizeFamilySvg(svg, format);
  downloadBlob(blob, buildExportFileName(format));
}

export function printFamilyGraph(graph: FamilyGraph, viewMode: ViewMode): void {
  const svg = familyGraphSvg(graph, viewMode);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const frameWindow = frame.contentWindow;
  const frameDocument = frame.contentDocument;
  if (!frameWindow || !frameDocument) {
    frame.remove();
    throw new Error("인쇄 창을 열 수 없습니다.");
  }
  frameDocument.open();
  frameDocument.write(`<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>가계도</title>
    <style>
      @page { size: landscape; margin: 10mm; }
      html, body { margin: 0; background: ${FILL_COLOR}; }
      svg { display: block; max-width: 100%; height: auto; }
    </style>
  </head>
  <body>${svg}</body>
</html>`);
  frameDocument.close();
  const cleanup = () => frame.remove();
  frameWindow.addEventListener("afterprint", cleanup);
  frameWindow.focus();
  frameWindow.print();
}
