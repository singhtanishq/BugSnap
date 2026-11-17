import { describe, expect, it } from "vitest";
import { applyFindings } from "@/lib/redaction/apply";
import { scanLogText } from "@/lib/redaction/patterns";
import type { Finding } from "@/types/redaction";

function findingAt(
  line: number,
  column: number,
  matchText: string,
  status: Finding["status"],
  replacement = "[REDACTED]",
): Finding {
  return {
    id: `f_${line}_${column}`,
    category: "custom",
    severity: "high",
    confidence: "high",
    location: { line, column, length: matchText.length },
    maskedPreview: "•••",
    replacement,
    ruleSource: "custom",
    status,
    matchText,
  };
}

describe("applyFindings", () => {
  it("replaces only findings marked redacted", () => {
    const text = "token=abc123\nsafe line";
    const result = applyFindings(text, [findingAt(1, 7, "abc123", "redacted")]);
    expect(result.sanitized).toBe("token=[REDACTED]\nsafe line");
    expect(result.appliedCount).toBe(1);
  });

  it("leaves pending and ignored findings untouched", () => {
    const text = "token=abc123";
    const result = applyFindings(text, [
      findingAt(1, 7, "abc123", "pending"),
      findingAt(1, 7, "abc123", "ignored"),
    ]);
    expect(result.sanitized).toBe("token=abc123");
    expect(result.appliedCount).toBe(0);
  });

  it("uses each finding's replacement value", () => {
    const text = "password=hunter2pass";
    const result = applyFindings(text, [
      findingAt(1, 10, "hunter2pass", "redacted", "***"),
    ]);
    expect(result.sanitized).toBe("password=***");
  });

  it("handles multiple redactions on one line", () => {
    const text = "user admin@x.test key abc123def456 end";
    // "abc123def456" starts at character index 22 → column 23.
    const result = applyFindings(text, [
      findingAt(1, 23, "abc123def456", "redacted"),
      findingAt(1, 6, "admin@x.test", "redacted"),
    ]);
    expect(result.sanitized).toBe("user [REDACTED] key [REDACTED] end");
    expect(result.appliedCount).toBe(2);
  });

  it("skips findings whose stored match no longer matches the text", () => {
    const text = "token=abc123";
    const result = applyFindings(text, [findingAt(1, 7, "WRONG", "redacted")]);
    expect(result.sanitized).toBe("token=abc123");
    expect(result.appliedCount).toBe(0);
  });

  it("produces sanitized output through the full scan→apply pipeline", () => {
    const log = "[09:41] Authorization: Bearer demo_test_token_NOT_REAL_123456";
    const { findings } = scanLogText(log);
    const bearer = findings.find((f) => f.category === "bearer");
    const result = applyFindings(
      log,
      findings.map((f) => (f.id === bearer?.id ? { ...f, status: "redacted" as const } : f)),
    );
    // The bearer finding covers the whole "Bearer …" match, so the scheme is
    // replaced together with the token value.
    expect(result.sanitized).not.toContain("demo_test_token_NOT_REAL_123456");
    expect(result.sanitized).toContain("[REDACTED]");
    expect(result.sanitized).toContain("[09:41] Authorization:");
  });
});
