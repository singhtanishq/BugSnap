import { describe, expect, it } from "vitest";
import { scanLogText, luhnValid, validateUserRegex, maskValue } from "@/lib/redaction/patterns";

describe("luhn validation", () => {
  it("accepts a valid test card number", () => {
    expect(luhnValid("4111 1111 1111 1111")).toBe(true);
    expect(luhnValid("4111111111111111")).toBe(true);
  });

  it("rejects numbers that fail the checksum", () => {
    expect(luhnValid("4111111111111112")).toBe(false);
    expect(luhnValid("1234567890123456")).toBe(false);
  });

  it("rejects wrong lengths and non-numeric input", () => {
    expect(luhnValid("411111111111")).toBe(false);
    expect(luhnValid("abcdabcdabcdabcd")).toBe(false);
  });
});

describe("sensitive pattern detection", () => {
  it("finds email addresses with location", () => {
    const { findings } = scanLogText("Contact dev.admin@acme.test for access");
    const email = findings.find((f) => f.category === "email");
    expect(email).toBeDefined();
    expect(email?.location.line).toBe(1);
    expect(email?.location.column).toBe(9);
    expect(email?.maskedPreview).not.toContain("dev.admin@acme.test");
  });

  it("finds bearer tokens across lines", () => {
    const text = "[09:41:02] boot ok\n[09:41:03] Authorization: Bearer demo_test_token_NOT_REAL_123456\nend";
    const { findings } = scanLogText(text);
    const bearer = findings.find((f) => f.category === "bearer");
    expect(bearer?.location.line).toBe(2);
    expect(bearer?.matchText).toContain("demo_test_token");
  });

  it("finds JWT-shaped tokens", () => {
    const { findings } = scanLogText(
      "token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk",
    );
    expect(findings.some((f) => f.category === "jwt")).toBe(true);
  });

  it("finds private key markers", () => {
    const { findings } = scanLogText("-----BEGIN RSA PRIVATE KEY-----");
    expect(findings.some((f) => f.category === "private-key")).toBe(true);
  });

  it("finds cloud credential patterns", () => {
    const aws = scanLogText("key AKIAIOSFODNN7EXAMPLE in config").findings;
    expect(aws.some((f) => f.category === "cloud-credential")).toBe(true);
    const gh = scanLogText("token ghp_0123456789abcdefghijklmnopqrstuvwxyz012345").findings;
    expect(gh.some((f) => f.category === "cloud-credential")).toBe(true);
  });

  it("rejects invalid IPv4 octets", () => {
    const { findings } = scanLogText("version 999.999.999.999 should not match");
    expect(findings.some((f) => f.category === "ipv4")).toBe(false);
  });

  it("accepts valid IPv4 addresses", () => {
    const { findings } = scanLogText("request went to 10.0.42.7 internally");
    expect(findings.some((f) => f.category === "ipv4")).toBe(true);
  });

  it("flags credit-card-like numbers only when Luhn passes", () => {
    const good = scanLogText("card 4111 1111 1111 1111 on file").findings;
    expect(good.some((f) => f.category === "credit-card")).toBe(true);
    const bad = scanLogText("card 4111 1111 1111 1112 on file").findings;
    expect(bad.some((f) => f.category === "credit-card")).toBe(false);
  });

  it("flags sensitive URL query parameters but not benign ones", () => {
    const text = "GET /cb?token=abc123&tab=billing&page=2";
    const { findings } = scanLogText(text);
    const queryFindings = findings.filter((f) => f.category === "url-query-secret");
    expect(queryFindings).toHaveLength(1);
    expect(queryFindings[0]?.matchText).toContain("token=abc123");
    expect(text).not.toContain("tab=token"); // sanity on fixture
  });

  it("flags password and api key assignments", () => {
    const { findings } = scanLogText("api_key=ak_live_demoNOTAREALKEY000000 password=hunter2pass");
    expect(findings.some((f) => f.category === "api-key")).toBe(true);
    expect(findings.some((f) => f.category === "password-assignment")).toBe(true);
  });

  it("flags session cookies in Set-Cookie headers", () => {
    const { findings } = scanLogText("set-cookie: aurora_session=demo_session_value_NOT_REAL; Path=/");
    expect(findings.some((f) => f.category === "session-cookie")).toBe(true);
  });

  it("masks previews so full secrets are not exposed", () => {
    const masked = maskValue("demo_test_token_NOT_REAL_123456");
    expect(masked.startsWith("dem")).toBe(true);
    expect(masked.endsWith("456")).toBe(true);
    expect(masked).not.toContain("NOT_REAL");
    expect(maskValue("abc")).toBe("•••");
  });

  it("supports validated custom rules and rejects unsafe ones", () => {
    const { findings } = scanLogText("internal ref INT-4242 found", {
      customRules: [{ id: "custom-ref", pattern: "INT-\\d{4}", label: "Internal ref" }],
    });
    expect(findings.some((f) => f.category === "custom" && f.ruleSource === "custom")).toBe(true);

    const bad = scanLogText("anything", {
      customRules: [{ id: "bad", pattern: "(unclosed" }],
    });
    expect(bad.findings.some((f) => f.category === "custom")).toBe(false);
    expect(bad.warnings.some((w) => w.includes("rejected"))).toBe(true);

    const longPattern = "x".repeat(201);
    expect(validateUserRegex(longPattern).ok).toBe(false);
  });

  it("avoids common false positives", () => {
    const { findings } = scanLogText(
      "Build 2026.11.18 finished in 12.5s; see docs/build.md; viewport 1440x900; cost ~1500ms",
    );
    expect(findings.some((f) => f.category === "email")).toBe(false);
    expect(findings.some((f) => f.category === "credit-card")).toBe(false);
    expect(findings.some((f) => f.category === "url-query-secret")).toBe(false);
  });

  it("reports line numbers correctly across multi-line input", () => {
    const text = ["line one clean", "line two has admin@corp.test", "line three clean"].join("\n");
    const { findings } = scanLogText(text);
    const email = findings.find((f) => f.category === "email");
    expect(email?.location.line).toBe(2);
  });
});
