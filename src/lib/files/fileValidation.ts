/**
 * Configurable input size caps. Kept in one place, surfaced in the UI and
 * covered by tests so changes here cannot silently break validation.
 */

export const LIMITS = {
  /** Per-image cap: 20 MB. */
  imageMaxBytes: 20 * 1024 * 1024,
  /** Console/text log cap: 5 MB (larger inputs are truncated with a warning). */
  textMaxBytes: 5 * 1024 * 1024,
  /** HAR file cap: 20 MB. */
  harMaxBytes: 20 * 1024 * 1024,
  /** Maximum HAR entries parsed before stopping with a warning. */
  harMaxEntries: 50_000,
  /** Reject images whose pixel area exceeds this (guards canvas limits). */
  imageMaxPixels: 50_000_000,
} as const;

export const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);

export type FileCheckResult =
  | { ok: true; mimeType: string }
  | { ok: false; reason: "type" | "size" | "empty"; message: string };

/**
 * Validate a candidate image file by MIME type *and* extension, then size.
 * Filenames alone are never trusted — the MIME type must also agree.
 */
export function checkImageFile(file: File): FileCheckResult {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const mimeOk = IMAGE_MIME_TYPES.has(file.type);
  const extOk = IMAGE_EXTENSIONS.has(ext);
  if (!mimeOk || !extOk) {
    return {
      ok: false,
      reason: "type",
      message: `Unsupported image type. Use PNG, JPG or WEBP (received "${file.type || `no MIME type (${ext || "no extension"})`}" from ${file.name}).`,
    };
  }
  if (file.size === 0) {
    return { ok: false, reason: "empty", message: `"${file.name}" is empty.` };
  }
  if (file.size > LIMITS.imageMaxBytes) {
    return {
      ok: false,
      reason: "size",
      message: `"${file.name}" is larger than the 20 MB limit.`,
    };
  }
  return { ok: true, mimeType: file.type };
}

export interface TextCheckResult {
  ok: boolean;
  message?: string;
  truncated: boolean;
}

/** Validate a text/log payload; oversized content is truncated, never dropped silently. */
export function checkTextContent(text: string, label: string): TextCheckResult {
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > LIMITS.textMaxBytes) {
    return {
      ok: true,
      truncated: true,
      message: `${label} exceeds the 5 MB limit — it was truncated to 5 MB so nothing is uploaded silently, but some trailing lines are missing.`,
    };
  }
  return { ok: true, truncated: false };
}
