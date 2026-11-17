import { describe, expect, it } from "vitest";
import { parseHarSummary } from "@/lib/har/parse";
import { sanitizeHar } from "@/lib/har/sanitize";
import { SAMPLE_CONSOLE_LOG, buildSampleHarJson } from "@/lib/demo/sampleData";

function harEntry(
  method: string,
  url: string,
  status: number,
  extra: Record<string, unknown> = {},
): unknown {
  return {
    startedDateTime: "2026-11-18T09:41:03Z",
    time: 120,
    request: {
      method,
      url,
      httpVersion: "http/2.0",
      headers: [{ name: "Accept", value: "application/json" }],
      queryString: [],
      cookies: [],
      headersSize: -1,
      bodySize: 0,
    },
    response: {
      status,
      statusText: "OK",
      headers: [],
      cookies: [],
      content: { size: 128, mimeType: "application/json" },
      bodySize: 128,
    },
    cache: {},
    timings: { send: 1, wait: 100, receive: 19 },
    ...extra,
  };
}

describe("HAR parsing", () => {
  it("summarises the synthetic sample HAR", () => {
    const result = parseHarSummary(buildSampleHarJson());
    expect(result.ok).toBe(true);
    const summary = result.summary!;
    expect(summary.entryCount).toBe(6);
    expect(summary.hostnames).toContain("api.aurora-notes.test");
    expect(summary.serverErrorCount).toBe(1);
    expect(summary.clientErrorCount).toBe(1);
    expect(summary.methodCounts["GET"]).toBe(4);
    expect(summary.entries.every((e) => !e.path.includes("Bearer"))).toBe(true);
    // Hostnames only — never full URLs with credentials.
    expect(summary.hostnames.every((h) => !h.includes("@"))).toBe(true);
  });

  it("rejects invalid JSON", () => {
    expect(parseHarSummary("{not json").ok).toBe(false);
  });

  it("rejects JSON without log.entries", () => {
    expect(parseHarSummary(JSON.stringify({ foo: 1 })).ok).toBe(false);
  });

  it("tolerates entries with missing optional fields", () => {
    const har = JSON.stringify({
      log: { entries: [{ request: { url: "https://a.test/x" }, response: {} }] },
    });
    const result = parseHarSummary(har);
    expect(result.ok).toBe(true);
    expect(result.summary?.entryCount).toBe(1);
    expect(result.summary?.entries[0]?.method).toBe("GET");
    expect(result.summary?.entries[0]?.status).toBe(0);
  });

  it("truncates beyond the entry cap with a warning", () => {
    const entries = Array.from({ length: 50_002 }, (_, i) =>
      harEntry("GET", `https://a.test/item/${i}`, 200),
    );
    const result = parseHarSummary(JSON.stringify({ log: { entries } }));
    expect(result.ok).toBe(true);
    expect(result.truncated).toBe(true);
    expect(result.summary?.entryCount).toBe(50_000);
    expect(result.summary?.parseWarnings.join(" ")).toContain("50000");
  });

  it("records observations without claiming root causes", () => {
    const result = parseHarSummary(buildSampleHarJson());
    const observations = result.summary!.observations.join(" ");
    expect(observations).toContain("browser-reported");
    expect(observations).not.toMatch(/root cause|definitely|always causes/i);
  });
});

describe("HAR sanitisation", () => {
  it("replaces authorization, cookies, API-key headers, query tokens and bodies", () => {
    const result = sanitizeHar(buildSampleHarJson());
    expect(result.ok).toBe(true);
    const sanitized = result.sanitizedHarJson!;
    expect(sanitized).not.toContain("demo_test_token_NOT_REAL_123456");
    expect(sanitized).not.toContain("demo_session_value_NOT_REAL");
    expect(sanitized).not.toContain("ak_live_demoNOTAREALKEY000000");
    expect(sanitized).toContain("[REDACTED]");
    expect(sanitized).toContain("[OMITTED BY BUGSNAP SANITIZER");
    // Non-sensitive headers survive.
    expect(sanitized).toContain("application/json");

    const counts = result.counts!;
    expect(counts.headers).toBeGreaterThanOrEqual(3); // Authorization + Cookie + X-Api-Key
    expect(counts.cookies).toBeGreaterThanOrEqual(1);
    expect(counts.queryParams).toBe(1);
    expect(counts.total).toBe(counts.headers + counts.cookies + counts.queryParams + counts.bodies);
  });

  it("preserves the HAR structure (same entry count)", () => {
    const original = JSON.parse(buildSampleHarJson()) as { log: { entries: unknown[] } };
    const result = sanitizeHar(buildSampleHarJson());
    const sanitized = JSON.parse(result.sanitizedHarJson!) as { log: { entries: unknown[] } };
    expect(sanitized.log.entries).toHaveLength(original.log.entries.length);
  });

  it("rejects invalid JSON", () => {
    expect(sanitizeHar("nope").ok).toBe(false);
  });

  it("never leaks raw values into parse warnings or summaries", () => {
    const parsed = parseHarSummary(buildSampleHarJson());
    const serialized = JSON.stringify(parsed);
    expect(serialized).not.toContain("demo_test_token_NOT_REAL");
    // Console sample is a separate fixture; guard against cross-contamination.
    expect(serialized).not.toContain(SAMPLE_CONSOLE_LOG.slice(0, 40));
  });
});
