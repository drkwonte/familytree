"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { fitCanvasZoom, stepCanvasZoom } from "@/lib/genogram/canvas-view";
import { CANVAS_ZOOM_DEFAULT, CANVAS_ZOOM_MAX, CANVAS_ZOOM_MIN } from "@/lib/genogram/constants";
import { renderFamilyGraphSvg } from "@/lib/genogram/draw";
import { readSvgPixelSize } from "@/lib/genogram/export-image";
import type { FamilyGraph, ViewMode } from "@/lib/genogram/types";

type GenogramCanvasProps = {
  graph: FamilyGraph;
  viewMode: ViewMode;
  onSelectPerson: (personId: string) => void;
};

export function GenogramCanvas({ graph, viewMode, onSelectPerson }: GenogramCanvasProps) {
  const [isClient, setIsClient] = useState(false);
  const [zoom, setZoom] = useState(CANVAS_ZOOM_DEFAULT);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const svg = useMemo(() => {
    if (!isClient || graph.nodes.length === 0) return null;
    return renderFamilyGraphSvg(graph, viewMode);
  }, [graph, isClient, viewMode]);

  const size = useMemo(() => {
    if (!svg) return null;
    return readSvgPixelSize(svg);
  }, [svg]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom((current) => stepCanvasZoom(current, event.deltaY < 0 ? 1 : -1));
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, [svg]);

  function zoomToFit() {
    const scroller = scrollerRef.current;
    const padded = scroller?.firstElementChild;
    if (!scroller || !padded || !size) return;
    const style = getComputedStyle(padded);
    const insetX = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
    const insetY = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
    setZoom(
      fitCanvasZoom(
        size.width,
        size.height,
        scroller.clientWidth - insetX,
        scroller.clientHeight - insetY,
      ),
    );
  }

  if (!isClient) {
    return <div className="h-full w-full" />;
  }

  if (!svg || !size) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        왼쪽에서 인물을 추가하거나 챗봇으로 가족을 설명해 주세요.
      </div>
    );
  }

  const scaledWidth = size.width * zoom;
  const scaledHeight = size.height * zoom;

  return (
    <div className="relative h-full min-h-0 w-full">
      <div ref={scrollerRef} className="h-full min-h-0 w-full overflow-auto">
        <div className="flex min-h-full w-max min-w-full items-safe-center justify-safe-center p-8">
          <div
            className="shrink-0 [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
            style={{ width: scaledWidth, height: scaledHeight }}
            onClick={(event) => {
              const node =
                event.target instanceof Element
                  ? event.target
                  : event.target instanceof Node
                    ? event.target.parentElement
                    : null;
              const personId = node?.closest("[data-person-id]")?.getAttribute("data-person-id");
              if (personId) onSelectPerson(personId);
            }}
          >
            <div
              dangerouslySetInnerHTML={{ __html: svg }}
              style={{
                width: size.width,
                height: size.height,
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
              }}
            />
          </div>
        </div>
      </div>
      <div className="absolute right-3 bottom-3 flex items-center gap-1 rounded-lg border bg-card/95 p-1 shadow-sm">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="축소"
          disabled={zoom <= CANVAS_ZOOM_MIN}
          onClick={() => setZoom((current) => stepCanvasZoom(current, -1))}
        >
          <Minus />
        </Button>
        <span className="min-w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="확대"
          disabled={zoom >= CANVAS_ZOOM_MAX}
          onClick={() => setZoom((current) => stepCanvasZoom(current, 1))}
        >
          <Plus />
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={zoomToFit}>
          전체
        </Button>
      </div>
    </div>
  );
}
