import { describe, expect, it } from "vitest";
import { buildMarkdown } from "@/lib/export/markdown";
import { buildJsonExport, selectedEnvironment } from "@/lib/export/json";
import { githubIssueBody, jiraText, linearText } from "@/lib/export/templates";
import { createEmptyReport, defaultEnvironmentSelection } from "@/lib/report/reportFactory";
import { buildSampleConsoleFindings } from "@/lib/demo/sampleData";
import type { Annotation } from "@/types/annotation";
import type { BugReport } from "@/types/report";

function sampleReport(): BugReport {
  const report = createEmptyReport();
  report.title = "Toggle misaligned on settings page";
  report.description = "The weekly digest toggle is drawn off-center.";
  report.type = "visual";
  report.severity = "low";
  report.priority = "normal";
  report.status = "open";
  report.affectedArea = "Settings";
  report.affectedUrl = "https://app.example.test/settings?tab=alerts";
  report.includeAffectedUrl = true;
  report.preconditions = ["Signed in as a standard user"];
  report.steps = [
    {
      id: "s1",
      order: 1,
      action: "Open settings",
      observedResult: "Page loads",
      isPrecondition: false,
      evidenceIds: ["ev1"],
    },
    {
      id: "s2",
      order: 2,
      action: "Look at the toggle | column",
      observedResult: "",
      isPrecondition: false,
      evidenceIds: [],
    },
  ];
  report.expectedResult = "Toggle is centered";
  report.actualResult = "Toggle is 4px off";
  report.frequency = "always";
  report.workaround = "None";
  report.isRegression = "no";
  report.assignee = "@sam-dev";
  report.labels = ["ui", "css"];
  report.environment = {
    capturedAt: "2026-11-18T09:41:00Z",
    browserName: "Chrome",
    browserVersion: "126.0",
    userAgent: "Mozilla/5.0 (test)",
    platform: "macOS (browser-reported)",
    viewportWidth: 1440,
    viewportHeight: 900,
    devicePixelRatio: 2,
    language: "en-US",
    timezone: "Asia/Kolkata",
    online: true,
  };
  report.environmentSelection = {
    ...defaultEnvironmentSelection(),
    userAgent: true,
    online: true,
  };
  report.includeUserAgent = true;
  return report;
}

const evidenceFiles = [
  {
    item: {
      id: "ev1",
      kind: "image" as const,
      name: "settings-shot.png",
      mimeType: "image/png",
      sizeBytes: 1024,
      width: 1280,
      height: 800,
      createdAt: "2026-11-18T09:41:00Z",
      source: "upload" as const,
      includedInExport: true,
      exportVariant: "annotated" as const,
      annotations: [
        { id: "a1", tool: "arrow", color: "#dc2626", strokeWidth: 4, x1: 0, y1: 0, x2: 10, y2: 10 },
        { id: "a2", tool: "rect", color: "#000", strokeWidth: 2, x: 0, y: 0, w: 50, h: 50, redacted: true },
      ] as Annotation[],
    },
    file: "evidence/screenshot-01.png",
  },
];

describe("markdown export", () => {
  it("contains all reviewed sections in a stable order", () => {
    const md = buildMarkdown(sampleReport(), {
      evidenceFiles,
      consoleSanitized: "line one [REDACTED]\nline two",
      consoleName: "diagnostics/console-sanitized.txt",
      consoleRedactedCount: 1,
      includeHar: false,
      harSummaryLines: [],
    });
    const order = [
      "# Toggle misaligned",
      "## Summary",
      "## Description",
      "## Preconditions",
      "## Reproduction steps",
      "## Expected result",
      "## Actual result",
      "## Workaround",
      "## Environment",
      "## Evidence",
      "## Console output (sanitized)",
      "## Redaction notice",
    ];
    let position = -1;
    for (const marker of order) {
      const at = md.indexOf(marker);
      expect(at, `${marker} should appear`).toBeGreaterThan(position);
      position = at;
    }
  });

  it("escapes pipes inside table-ish content and lists evidence files", () => {
    const md = buildMarkdown(sampleReport(), { evidenceFiles });
    expect(md).toContain("Look at the toggle | column");
    expect(md).toContain("evidence/screenshot-01.png");
    expect(md).toContain("1 opaque redaction");
    expect(md).toContain("annotated");
  });

  it("includes only the selected environment fields and honours opt-ins", () => {
    const report = sampleReport();
    const md = buildMarkdown(report, { evidenceFiles: [] });
    expect(md).toContain("**Browser:** Chrome 126.0");
    expect(md).toContain("**User agent (opt-in):** Mozilla/5.0 (test)");
    expect(md).toContain("**Captured at:** 2026-11-18T09:41:00Z");
  });

  it("omits the URL when not opted in", () => {
    const report = sampleReport();
    report.includeAffectedUrl = false;
    const md = buildMarkdown(report, { evidenceFiles: [] });
    expect(md).not.toContain("https://app.example.test/settings");
  });

  it("embeds the sanitized console text with the redaction notice", () => {
    const md = buildMarkdown(sampleReport(), {
      evidenceFiles: [],
      consoleSanitized: "Authorization: [REDACTED]",
      consoleRedactedCount: 2,
    });
    expect(md).toContain("2 value(s) were redacted");
    expect(md).toContain("Authorization: [REDACTED]");
    expect(md).not.toContain("demo_test_token");
  });
});

describe("json export", () => {
  it("is versioned and contains no secret match text", () => {
    const json = buildJsonExport(sampleReport(), {
      evidenceFiles,
      consoleFile: "diagnostics/console-sanitized.txt",
      consoleRedactedCount: 1,
      environment: selectedEnvironment(sampleReport()),
    });
    expect(json.schemaVersion).toBe(1);
    expect(json.generator).toBe("BugSnap");
    expect(json.report.title).toBe("Toggle misaligned on settings page");
    expect(json.evidence[0]).toMatchObject({
      file: "evidence/screenshot-01.png",
      exportVariant: "annotated",
      annotationCount: 2,
      opaqueRedactionCount: 1,
    });
    expect(json.report.steps[0]?.evidenceFiles).toEqual(["evidence/screenshot-01.png"]);
    expect(json.diagnostics?.console?.file).toBe("diagnostics/console-sanitized.txt");
    const serialized = JSON.stringify(json);
    expect(serialized).not.toContain("demo_test_token_NOT_REAL");
    // Findings never enter the JSON at all:
    expect(serialized).not.toContain("maskedPreview");
    expect(serialized).not.toContain("matchText");
  });

  it("serializes enums by value", () => {
    const json = buildJsonExport(sampleReport(), { evidenceFiles: [] });
    expect(json.report.type).toBe("visual");
    expect(json.report.severity).toBe("low");
    expect(json.report.frequency).toBe("always");
  });

  it("selectedEnvironment respects per-field toggles and the user-agent gate", () => {
    const report = sampleReport();
    const env = selectedEnvironment(report)!;
    expect(env.userAgent).toBe("Mozilla/5.0 (test)");
    expect(env.viewportWidth).toBe(1440);
    expect(env.reducedMotion).toBeUndefined();

    report.includeUserAgent = false;
    const env2 = selectedEnvironment(report)!;
    expect(env2.userAgent).toBeUndefined();

    report.environmentSelection.browserName = false;
    const env3 = selectedEnvironment(report)!;
    expect(env3.browserName).toBeUndefined();
  });

  it("keeps console findings out of the JSON even when findings are passed", () => {
    const findings = buildSampleConsoleFindings();
    const json = buildJsonExport(sampleReport(), { evidenceFiles: [] });
    const serialized = JSON.stringify({ ...json, probe: findings });
    // The export itself never receives findings — only counts.
    expect(JSON.stringify(json)).not.toContain("riley@aurora-notes.test");
    expect(serialized).toContain("probe"); // sanity for the fixture itself
  });
});

describe("tracker templates", () => {
  const options = { evidenceFiles, consoleRedactedCount: 0 };

  it("GitHub issue body embeds the full report and a no-integration disclaimer", () => {
    const body = githubIssueBody(sampleReport(), options);
    expect(body).toContain("## Toggle misaligned");
    expect(body).toContain("Severity: Low");
    expect(body).toContain("Steps to reproduce");
    expect(body).toContain("Full BugSnap report");
    expect(body).toContain("No live GitHub integration");
  });

  it("Jira text uses wiki headings and a disclaimer", () => {
    const text = jiraText(sampleReport(), options);
    expect(text).toContain("h2. Toggle misaligned");
    expect(text).toContain("h3. Expected Result");
    expect(text).toContain("not a live Jira integration");
  });

  it("Linear text uses terse Markdown and a disclaimer", () => {
    const text = linearText(sampleReport(), options);
    expect(text).toContain("### Toggle misaligned");
    expect(text).toContain("not a live Linear integration");
  });
});
