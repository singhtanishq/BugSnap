import { LIMITS } from "@/lib/files/fileValidation";

export interface DecodedImage {
  width: number;
  height: number;
}

/**
 * Decode an image blob to obtain natural dimensions. Uses createImageBitmap
 * where available with an <img> fallback, and guards against oversized or
 * corrupt images instead of letting canvas operations crash the editor.
 */
export async function decodeImage(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(blob);
      const dims = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      if (dims.width * dims.height > LIMITS.imageMaxPixels) {
        throw new Error("pixels");
      }
      return dims;
    } catch (error) {
      bitmap?.close();
      if (error instanceof Error && error.message === "pixels") {
        throw new Error(
          "Image is too large to edit safely in the browser (over 50 megapixels).",
          { cause: error },
        );
      }
      // fall through to <img> fallback; corrupt images will fail there too
    }
  }

  return await new Promise<DecodedImage>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    const cleanup = () => URL.revokeObjectURL(url);
    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      cleanup();
      if (width === 0 || height === 0) {
        reject(new Error("Image has no pixels — the file may be corrupt."));
        return;
      }
      if (width * height > LIMITS.imageMaxPixels) {
        reject(
          new Error(
            "Image is too large to edit safely in the browser (over 50 megapixels).",
          ),
        );
        return;
      }
      resolve({ width, height });
    };
    image.onerror = () => {
      cleanup();
      reject(
        new Error(
          "Image could not be decoded — the file may be corrupt or an unsupported format.",
        ),
      );
    };
    image.src = url;
  });
}

/** Render a blob to a canvas-sized ImageBitmap for the annotation editor. */
export async function createDrawableSource(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob);
    } catch {
      // fall through
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image could not be decoded for the editor."));
    };
    image.src = url;
  });
}
