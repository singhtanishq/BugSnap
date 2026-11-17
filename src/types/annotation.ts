/**
 * Non-destructive annotation model.
 *
 * All coordinates are in *natural image pixel space* (the original image's
 * pixel dimensions), independent of the on-screen display size. The editor
 * maps pointer events into this space; the export flattener draws at 1:1
 * scale onto a canvas the size of the source image.
 */

export type AnnotationTool =
  | "select"
  | "arrow"
  | "rect"
  | "ellipse"
  | "pen"
  | "text"
  | "marker"
  | "redaction"
  /** Editor-only UI mode, never stored on an annotation. */
  | "pan";

interface AnnotationBase {
  id: string;
  color: string;
  strokeWidth: number;
}

export interface ArrowAnnotation extends AnnotationBase {
  tool: "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Rectangle outline; when `redacted` is true it renders as an opaque fill. */
export interface RectAnnotation extends AnnotationBase {
  tool: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  redacted?: boolean;
}

export interface EllipseAnnotation extends AnnotationBase {
  tool: "ellipse";
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PenAnnotation extends AnnotationBase {
  tool: "pen";
  points: Array<[number, number]>;
}

export interface TextAnnotation extends AnnotationBase {
  tool: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
}

export interface MarkerAnnotation extends AnnotationBase {
  tool: "marker";
  x: number;
  y: number;
  number: number;
}

export type Annotation =
  | ArrowAnnotation
  | RectAnnotation
  | EllipseAnnotation
  | PenAnnotation
  | TextAnnotation
  | MarkerAnnotation;

export const ANNOTATION_TOOL_LABELS: Record<
  Exclude<AnnotationTool, "select" | "pan">,
  string
> = {
  arrow: "Pointer arrow",
  rect: "Rectangle outline",
  ellipse: "Ellipse outline",
  pen: "Freehand pen",
  text: "Text label",
  marker: "Numbered step marker",
  redaction: "Opaque redaction",
};

export function isRedactionAnnotation(a: Annotation): a is RectAnnotation & { redacted: true } {
  return a.tool === "rect" && a.redacted === true;
}
