import { describe, expect, it } from "vitest";
import {
  annotationBounds,
  clampZoom,
  computeFitScale,
  hitTestAnnotation,
  moveAnnotation,
  nextMarkerNumber,
  resizeRectLike,
  toImageCoords,
  zoomAroundPoint,
} from "@/lib/annotation/geometry";
import type { Annotation } from "@/types/annotation";

const arrow: Annotation = {
  id: "a1",
  tool: "arrow",
  x1: 10,
  y1: 10,
  x2: 60,
  y2: 40,
  color: "#dc2626",
  strokeWidth: 4,
};

describe("annotation geometry", () => {
  it("converts screen coordinates to image coordinates through the view transform", () => {
    const view = { scale: 0.5, offsetX: 20, offsetY: 10 };
    const point = toImageCoords(120, 60, view, { left: 0, top: 0 });
    // (120 - 20) / 0.5 = 200, (60 - 10) / 0.5 = 100
    expect(point).toEqual({ x: 200, y: 100 });
  });

  it("computes a fit scale that keeps the image inside the container", () => {
    const scale = computeFitScale(800, 600, 1600, 800);
    // (800 - 24) / 1600 = 0.485 constrains width
    expect(scale).toBeCloseTo(0.485, 2);
    const tooLarge = computeFitScale(100, 100, 4000, 4000);
    expect(tooLarge).toBeLessThanOrEqual(1);
  });

  it("clamps zoom to the supported range", () => {
    expect(clampZoom(0.001)).toBe(0.05);
    expect(clampZoom(100)).toBe(8);
    expect(clampZoom(1.5)).toBe(1.5);
  });

  it("zooms around an anchor point, keeping it visually fixed", () => {
    const origin = { left: 0, top: 0 };
    // Before zoom, screen (100,100) shows image point (100,100).
    const after = zoomAroundPoint(
      { scale: 1, offsetX: 0, offsetY: 0 },
      2,
      { x: 100, y: 100 },
      origin,
    );
    const imagePoint = toImageCoords(100, 100, after, origin);
    expect(imagePoint).toEqual({ x: 100, y: 100 }); // unchanged image anchor
  });

  it("hit-tests annotations topmost first", () => {
    const rect: Annotation = {
      id: "r1",
      tool: "rect",
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      color: "#000",
      strokeWidth: 2,
    };
    const rect2: Annotation = { ...rect, id: "r2", x: 40, y: 40, w: 100, h: 100 };
    // r2 renders later (on top) and covers (60, 60)
    expect(hitTestAnnotation([rect, rect2], 60, 60, 4)).toBe("r2");
    expect(hitTestAnnotation([rect, rect2], 10, 10, 4)).toBe("r1");
    expect(hitTestAnnotation([rect, rect2], 300, 300, 4)).toBeNull();
  });

  it("hit-tests arrows along the segment", () => {
    expect(hitTestAnnotation([arrow], 35, 26, 6)).toBe("a1");
    expect(hitTestAnnotation([arrow], 80, 80, 4)).toBeNull();
  });

  it("moves annotations of every tool type", () => {
    const movedArrow = moveAnnotation(arrow, 5, -5) as Extract<Annotation, { tool: "arrow" }>;
    expect([movedArrow.x1, movedArrow.y1, movedArrow.x2, movedArrow.y2]).toEqual([
      15, 5, 65, 35,
    ]);
    const pen: Annotation = {
      id: "p1",
      tool: "pen",
      points: [[0, 0], [10, 10]],
      color: "#000",
      strokeWidth: 2,
    };
    const movedPen = moveAnnotation(pen, 3, 4) as Extract<Annotation, { tool: "pen" }>;
    expect(movedPen.points).toEqual([[3, 4], [13, 14]]);
    const text: Annotation = {
      id: "t1",
      tool: "text",
      x: 5,
      y: 20,
      text: "Hello",
      fontSize: 18,
      color: "#000",
      strokeWidth: 2,
    };
    const movedText = moveAnnotation(text, 2, 2) as Extract<Annotation, { tool: "text" }>;
    expect([movedText.x, movedText.y]).toEqual([7, 22]);
  });

  it("resizes rect-like annotations from each corner", () => {
    const rect: Annotation & { tool: "rect" } = {
      id: "r1",
      tool: "rect",
      x: 10,
      y: 10,
      w: 50,
      h: 50,
      color: "#000",
      strokeWidth: 2,
    };
    const nw = resizeRectLike(rect, "nw", 5, 5) as Annotation & { tool: "rect" };
    expect([nw.x, nw.y, nw.w, nw.h]).toEqual([15, 15, 45, 45]);
    const se = resizeRectLike(rect, "se", 10, -10) as Annotation & { tool: "rect" };
    expect([se.x, se.y, se.w, se.h]).toEqual([10, 10, 60, 40]);
  });

  it("computes bounding boxes and marker numbering", () => {
    expect(annotationBounds(arrow)).toEqual({ x: 10, y: 10, w: 50, h: 30 });
    const marker: Annotation = {
      id: "m1",
      tool: "marker",
      x: 0,
      y: 0,
      number: 3,
      color: "#000",
      strokeWidth: 2,
    };
    expect(nextMarkerNumber([marker])).toBe(4);
    expect(nextMarkerNumber([])).toBe(1);
  });
});
