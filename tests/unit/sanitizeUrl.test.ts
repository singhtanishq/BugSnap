import { describe, expect, it } from "vitest";
import { sanitizeUrl, isSensitiveQueryKey } from "@/lib/validation/sanitizeUrl";

describe("sanitizeUrl", () => {
  it("keeps benign query parameters and the path", () => {
    const result = sanitizeUrl("https://app.example.test/settings/profile?tab=billing&sort=name");
    expect(result).not.toBeNull();
    expect(result?.sanitized).toBe("https://app.example.test/settings/profile?tab=billing&sort=name");
    expect(result?.redactedParamNames).toEqual([]);
    expect(result?.keptParamNames).toEqual(["tab", "sort"]);
  });

  it("removes userinfo credentials", () => {
    const result = sanitizeUrl("https://alice:hunter2@app.example.test/dashboard");
    expect(result?.removedCredentials).toBe(true);
    expect(result?.sanitized).toBe("https://app.example.test/dashboard");
    expect(result?.sanitized).not.toContain("hunter2");
  });

  it("redacts sensitive query parameter values", () => {
    const result = sanitizeUrl("https://app.example.test/cb?token=abc123&state=xyz");
    expect(result?.redactedParamNames).toEqual(["token"]);
    expect(result?.sanitized).toContain("token=%5BREDACTED%5D");
    expect(result?.sanitized).not.toContain("abc123");
    expect(result?.sanitized).toContain("state=xyz");
  });

  it("removes fragments by default", () => {
    const result = sanitizeUrl("https://app.example.test/page#section-anchor");
    expect(result?.removedFragment).toBe(true);
    expect(result?.sanitized).not.toContain("#section-anchor");
  });

  it("is case-insensitive about sensitive key names", () => {
    expect(isSensitiveQueryKey("ACCESS_TOKEN")).toBe(true);
    expect(isSensitiveQueryKey("ApiKey")).toBe(true);
    expect(isSensitiveQueryKey("session_id")).toBe(true);
  });

  it("treats code and session as sensitive", () => {
    const result = sanitizeUrl("https://app.example.test/oauth?code=s3cret&scope=read");
    expect(result?.redactedParamNames).toEqual(["code"]);
    expect(result?.sanitized).not.toContain("s3cret");
  });

  it("returns null for invalid URLs", () => {
    expect(sanitizeUrl("not a url")).toBeNull();
    expect(sanitizeUrl("")).toBeNull();
  });

  it("preserves non-sensitive values in known-benign parameters", () => {
    const result = sanitizeUrl("https://app.example.test/list?page=2&theme=dark");
    expect(result?.sanitized).toContain("page=2");
    expect(result?.sanitized).toContain("theme=dark");
  });
});
