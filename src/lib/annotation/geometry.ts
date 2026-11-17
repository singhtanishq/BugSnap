import type { Annotation } from "@/types/annotation";

/**
 * Pure geometry helpers for the annotation editor.
 * All annotation coordinates live in natural image pixel space.
 */

export interface EditorView {
  /** Display scale: image pixels → screen pixels. */
  scale: number;
  /** Pan offset in screen pixels. */
  offsetX: number;
  offsetY: number;
}

export interface RectLike {
  left: number;
  top: number;
}

/** Convert a client (screen) point into image pixel space. */
export function toImageCoords(
  clientX: number,
  clientY: number,
  view: EditorView,
  canvasOrigin: RectLike,
): { x: number; y: number } {
  return {
    x: (clientX - canvasOrigin.left - view.offsetX) / view.scale,
    y: (clientY - canvasOrigin.top - view.offsetY) / view.scale,
  };
}

/** Scale that fits an image inside a container with a small margin. */
export function computeFitScale(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
): number {
  if (imageWidth <= 0 || imageHeight <= 0) return 1;
  const margin = 24;
  const scale = Math.min(
    (containerWidth - margin) / imageWidth,
    (containerHeight - margin) / imageHeight,
  );
  return Math.max(0.05, Math.min(8, scale));
}

export function clampZoom(scale: number): number {
  return Math.max(0.05, Math.min(8, scale));
}

/** Zoom around a point (image-space anchor stays fixed on screen). */
export function zoomAroundPoint(
  view: EditorView,
  nextScale: number,
  anchorClient: { x: number; y: number },
  canvasOrigin: RectLike,
): EditorView {
  const clamped = clampZoom(nextScale);
  const before = toImageCoords(anchorClient.x, anchorClient.y, view, canvasOrigin);
  const offsetX = anchorClient.x - canvasOrigin.left - before.x * clamped;
  const offsetY = anchorClient.y - canvasOrigin.top - before.y * clamped;
  return { scale: clamped, offsetX, offsetY };
}

function pointInRect(x: number, y: number, rx: number, ry: number, rw: number, rh: number, tol: number): boolean {
  const minX = Math.min(rx, rx + rw) - tol;
  const maxX = Math.max(rx, rx + rw) + tol;
  const minY = Math.min(ry, ry + rh) - tol;
  const maxY = Math.max(ry, ry + rh) + tol;
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/**
 * Hit-test annotations, topmost first (end of the array renders on top).
 * Returns the annotation id or null. Hit tolerance is in image pixels.
 */
export function hitTestAnnotation(
  annotations: Annotation[],
  x: number,
  y: number,
  tolerance: number,
): string | null {
  for (let i = annotations.length - 1; i >= 0; i -= 1) {
    const a = annotations[i];
    if (!a) continue;
    switch (a.tool) {
      case "arrow":
        if (distanceToSegment(x, y, a.x1, a.y1, a.x2, a.y2) <= tolerance + a.strokeWidth) {
          return a.id;
        }
        break;
      case "rect":
        if (pointInRect(x, y, a.x, a.y, a.w, a.h, tolerance)) {
          return a.id;
        }
        break;
      case "ellipse": {
        const rx = Math.abs(a.w) / 2 || 1;
        const ry = Math.abs(a.h) / 2 || 1;
        const cx = a.x + a.w / 2;
        const cy = a.y + a.h / 2;
        const norm = ((x - cx) / (rx + tolerance)) ** 2 + ((y - cy) / (ry + tolerance)) ** 2;
        if (norm <= 1) return a.id;
        break;
      }
      case "pen":
        for (let p = 1; p < a.points.length; p += 1) {
          const prev = a.points[p - 1];
          const curr = a.points[p];
          if (!prev || !curr) continue;
          if (distanceToSegment(x, y, prev[0], prev[1], curr[0], curr[1]) <= tolerance + a.strokeWidth) {
            return a.id;
          }
        }
        break;
      case "text": {
        const approxWidth = a.text.length * a.fontSize * 0.62;
        if (
          x >= a.x - tolerance &&
          x <= a.x + approxWidth + tolerance &&
          y >= a.y - a.fontSize - tolerance &&
          y <= a.y + tolerance
        ) {
          return a.id;
        }
        break;
      }
      case "marker": {
        const r = 12 + a.strokeWidth;
        if (Math.hypot(x - a.x, y - a.y) <= r + tolerance) return a.id;
        break;
      }
    }
  }
  return null;
}

/** Translate an annotation by (dx, dy) in image pixels. Pure. */
export function moveAnnotation(annotation: Annotation, dx: number, dy: number): Annotation {
  switch (annotation.tool) {
    case "arrow":
      return {
        ...annotation,
        x1: annotation.x1 + dx,
        y1: annotation.y1 + dy,
        x2: annotation.x2 + dx,
        y2: annotation.y2 + dy,
      };
    case "rect":
    case "ellipse":
      return { ...annotation, x: annotation.x + dx, y: annotation.y + dy };
    case "pen":
      return {
        ...annotation,
        points: annotation.points.map(([px, py]) => [px + dx, py + dy] as [number, number]),
      };
    case "text":
      return { ...annotation, x: annotation.x + dx, y: annotation.y + dy };
    case "marker":
      return { ...annotation, x: annotation.x + dx, y: annotation.y + dy };
  }
}

/** Bounding box of an annotation in image pixels (for selection outlines). */
export function annotationBounds(annotation: Annotation): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  switch (annotation.tool) {
    case "arrow":
      return {
        x: Math.min(annotation.x1, annotation.x2),
        y: Math.min(annotation.y1, annotation.y2),
        w: Math.abs(annotation.x2 - annotation.x1),
        h: Math.abs(annotation.y2 - annotation.y1),
      };
    case "rect":
    case "ellipse":
      return {
        x: Math.min(annotation.x, annotation.x + annotation.w),
        y: Math.min(annotation.y, annotation.y + annotation.h),
        w: Math.abs(annotation.w),
        h: Math.abs(annotation.h),
      };
    case "pen": {
      const xs = annotation.points.map((p) => p[0]);
      const ys = annotation.points.map((p) => p[1]);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      return {
        x: minX,
        y: minY,
        w: Math.max(...xs) - minX,
        h: Math.max(...ys) - minY,
      };
    }
    case "text":
      return {
        x: annotation.x,
        y: annotation.y - annotation.fontSize,
        w: annotation.text.length * annotation.fontSize * 0.62,
        h: annotation.fontSize,
      };
    case "marker":
      return {
        x: annotation.x - 14,
        y: annotation.y - 14,
        w: 28,
        h: 28,
      };
  }
}

/** Resize a rect-like annotation from its corner drag. Pure. */
export function resizeRectLike(
  annotation: Annotation & { tool: "rect" | "ellipse" },
  corner: "nw" | "ne" | "sw" | "se",
  dx: number,
  dy: number,
): Annotation & { tool: "rect" | "ellipse" } {
  const x = corner.includes("w") ? annotation.x + dx : annotation.x;
  const y = corner.includes("n") ? annotation.y + dy : annotation.y;
  const w = corner.includes("w") ? annotation.w - dx : annotation.w + dx;
  const h = corner.includes("n") ? annotation.h - dy : annotation.h + dy;
  return { ...annotation, x, y, w, h };
}

/** Next numbered marker value: one above the highest existing marker. */
export function nextMarkerNumber(annotations: Annotation[]): number {
  const numbers = annotations
    .filter((a): a is Extract<Annotation, { tool: "marker" }> => a.tool === "marker")
    .map((a) => a.number);
  return numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
}
