import type { Annotation } from "@/types/annotation";

/**
 * Shared annotation drawing routines.
 *
 * The drawing context is always pre-transformed so that 1 unit == 1 image
 * pixel. Both the editor display canvas and the export flattener call these
 * functions, so what you see while editing is exactly what gets exported.
 */

export interface RenderOptions {
  /** Draw selection outline for the given annotation id. */
  selectedId?: string | null;
  /** In-progress annotation being drawn (drag draft). */
  draft?: Annotation | null;
  /** Optional pixel scale of the backing bitmap (device pixel ratio). */
  pixelRatio?: number;
}

export function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: Annotation[],
  options: RenderOptions = {},
) {
  for (const annotation of annotations) {
    drawAnnotation(ctx, annotation);
  }
  if (options.draft) {
    drawAnnotation(ctx, options.draft);
  }
  if (options.selectedId) {
    const selected = annotations.find((a) => a.id === options.selectedId);
    if (selected) drawSelectionOutline(ctx, selected);
  }
}

export function drawAnnotation(ctx: CanvasRenderingContext2D, a: Annotation) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = a.color;
  ctx.fillStyle = a.color;
  ctx.lineWidth = a.strokeWidth;

  switch (a.tool) {
    case "arrow": {
      drawArrow(ctx, a.x1, a.y1, a.x2, a.y2, a.strokeWidth);
      break;
    }
    case "rect": {
      if (a.redacted) {
        // Opaque redaction: solid fill only — hiding by blur or translucency
        // is never acceptable for exported evidence.
        ctx.fillStyle = a.color;
        ctx.fillRect(a.x, a.y, a.w, a.h);
        // Crisp 1px border so the redaction bounds are identifiable.
        ctx.strokeStyle = "rgba(255,255,255,0.65)";
        ctx.lineWidth = 1;
        ctx.strokeRect(a.x + 0.5, a.y + 0.5, Math.max(0, a.w - 1), Math.max(0, a.h - 1));
      } else {
        ctx.strokeRect(a.x, a.y, a.w, a.h);
      }
      break;
    }
    case "ellipse": {
      ctx.beginPath();
      ctx.ellipse(a.x + a.w / 2, a.y + a.h / 2, Math.abs(a.w / 2), Math.abs(a.h / 2), 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "pen": {
      if (a.points.length > 1) {
        ctx.beginPath();
        const first = a.points[0];
        if (!first) break;
        ctx.moveTo(first[0], first[1]);
        for (const [px, py] of a.points.slice(1)) {
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      break;
    }
    case "text": {
      const fontSize = Math.max(12, a.fontSize);
      ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
      ctx.textBaseline = "alphabetic";
      // Readability halo: paint color behind the text stroke.
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = Math.max(3, fontSize / 6);
      ctx.strokeText(a.text, a.x, a.y);
      ctx.fillStyle = a.color;
      ctx.fillText(a.text, a.x, a.y);
      break;
    }
    case "marker": {
      const radius = Math.max(10, 8 + a.strokeWidth * 1.5);
      ctx.beginPath();
      ctx.arc(a.x, a.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = a.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 ${Math.round(radius)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(a.number), a.x, a.y + radius * 0.05);
      break;
    }
  }
  ctx.restore();
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  strokeWidth: number,
) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLength = Math.max(10, strokeWidth * 3.5);
  // Line stops short of the head.
  const lineEndX = x2 - Math.cos(angle) * headLength * 0.7;
  const lineEndY = y2 - Math.sin(angle) * headLength * 0.7;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(lineEndX, lineEndY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - Math.cos(angle - Math.PI / 7) * headLength,
    y2 - Math.sin(angle - Math.PI / 7) * headLength,
  );
  ctx.lineTo(
    x2 - Math.cos(angle + Math.PI / 7) * headLength,
    y2 - Math.sin(angle + Math.PI / 7) * headLength,
  );
  ctx.closePath();
  ctx.fill();
}

function drawSelectionOutline(ctx: CanvasRenderingContext2D, a: Annotation) {
  ctx.save();
  const b = boundsOf(a);
  ctx.strokeStyle = "#0ea5e9";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
  ctx.setLineDash([]);
  // Corner handles
  ctx.fillStyle = "#ffffff";
  const handle = 7;
  const handlePoints: Array<[number, number]> = [
    [b.x - 6, b.y - 6],
    [b.x + b.w + 6, b.y - 6],
    [b.x - 6, b.y + b.h + 6],
    [b.x + b.w + 6, b.y + b.h + 6],
  ];
  for (const [hx, hy] of handlePoints) {
    ctx.beginPath();
    ctx.rect(hx - handle / 2, hy - handle / 2, handle, handle);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function boundsOf(a: Annotation): { x: number; y: number; w: number; h: number } {
  switch (a.tool) {
    case "arrow":
      return {
        x: Math.min(a.x1, a.x2),
        y: Math.min(a.y1, a.y2),
        w: Math.abs(a.x2 - a.x1),
        h: Math.abs(a.y2 - a.y1),
      };
    case "rect":
    case "ellipse":
      return { x: a.x, y: a.y, w: a.w, h: a.h };
    case "pen": {
      const xs = a.points.map((p) => p[0]);
      const ys = a.points.map((p) => p[1]);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
    }
    case "text":
      return {
        x: a.x,
        y: a.y - a.fontSize,
        w: a.text.length * a.fontSize * 0.62,
        h: a.fontSize,
      };
    case "marker":
      return { x: a.x - 14, y: a.y - 14, w: 28, h: 28 };
  }
}
