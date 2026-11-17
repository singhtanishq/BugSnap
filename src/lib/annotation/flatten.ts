import type { Annotation } from "@/types/annotation";
import { drawAnnotations } from "./render";
import { createDrawableSource } from "@/lib/images/decodeImage";

export interface FlattenResult {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Flatten the original image plus final annotations into a fresh PNG at the
 * source image's natural resolution. Redaction rectangles are opaque fills,
 * so exported pixels genuinely cover the underlying content.
 *
 * This runs on an offscreen canvas; the editor's display canvas is never a
 * source for the export.
 */
export async function flattenEvidencePng(
  sourceBlob: Blob,
  annotations: Annotation[],
): Promise<FlattenResult> {
  const source = await createDrawableSource(sourceBlob);
  const width = "naturalWidth" in source ? source.naturalWidth : source.width;
  const height = "naturalHeight" in source ? source.naturalHeight : source.height;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D is unavailable in this browser.");
  }
  ctx.drawImage(source, 0, 0, width, height);
  if ("close" in source && typeof source.close === "function") {
    source.close();
  }
  drawAnnotations(ctx, annotations);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
  if (!blob) {
    throw new Error("Flattened PNG could not be encoded.");
  }
  return { blob, width, height };
}
