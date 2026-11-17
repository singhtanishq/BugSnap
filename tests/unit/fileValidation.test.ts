import { describe, expect, it } from "vitest";
import { checkImageFile, checkTextContent, LIMITS } from "@/lib/files/fileValidation";

function makeFile(
  name: string,
  type: string,
  sizeBytes: number,
): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

describe("image file validation", () => {
  it("accepts a valid PNG under the size cap", () => {
    const result = checkImageFile(makeFile("shot.png", "image/png", 1024));
    expect(result.ok).toBe(true);
  });

  it("accepts jpg, jpeg and webp variants", () => {
    expect(checkImageFile(makeFile("a.jpg", "image/jpeg", 10)).ok).toBe(true);
    expect(checkImageFile(makeFile("a.jpeg", "image/jpeg", 10)).ok).toBe(true);
    expect(checkImageFile(makeFile("a.webp", "image/webp", 10)).ok).toBe(true);
  });

  it("rejects mismatched extension and MIME type", () => {
    const result = checkImageFile(makeFile("malware.png", "application/javascript", 10));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("type");
    }
  });

  it("rejects unsupported image formats", () => {
    const result = checkImageFile(makeFile("clip.gif", "image/gif", 10));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("type");
  });

  it("rejects files over the 20 MB cap", () => {
    const result = checkImageFile(
      makeFile("huge.png", "image/png", LIMITS.imageMaxBytes + 1),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("size");
      expect(result.message).toContain("20 MB");
    }
  });

  it("rejects empty files", () => {
    const result = checkImageFile(makeFile("empty.png", "image/png", 0));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("empty");
  });
});

describe("text content validation", () => {
  it("accepts small text without truncation", () => {
    const result = checkTextContent("[09:41:02] log line", "console.log");
    expect(result.ok).toBe(true);
    expect(result.truncated).toBe(false);
  });

  it("flags truncation for oversized text instead of failing silently", () => {
    const text = "x".repeat(LIMITS.textMaxBytes + 100);
    const result = checkTextContent(text, "console.log");
    expect(result.ok).toBe(true);
    expect(result.truncated).toBe(true);
    expect(result.message).toContain("truncated");
  });
});
