import { describe, expect, it } from "vitest";
import { computeCompleteness } from "@/lib/report/completeness";
import { createEmptyReport } from "@/lib/report/reportFactory";
import { localId } from "@/lib/utils";

describe("report completeness", () => {
  it("starts at zero for an empty report", () => {
    const result = computeCompleteness(createEmptyReport());
    expect(result.fraction).toBe(0);
    expect(result.checks.every((check) => !check.done)).toBe(true);
  });

  it("marks required checks missing", () => {
    const report = createEmptyReport();
    const result = computeCompleteness(report);
    const missingKeys = result.missingRequired.map((check) => check.key);
    expect(missingKeys).toEqual(
      expect.arrayContaining(["title", "steps", "expected", "actual"]),
    );
  });

  it("reaches full completion on a fully filled report", () => {
    const report = createEmptyReport();
    report.title = "Sample bug";
    report.description = "Something broke";
    report.expectedResult = "It works";
    report.actualResult = "It does not";
    report.steps = [
      {
        id: localId("step"),
        order: 1,
        action: "Open the page",
        observedResult: "",
        isPrecondition: false,
        evidenceIds: [],
      },
    ];
    report.evidence = [
      {
        id: localId("ev"),
        kind: "image",
        name: "screenshot.png",
        mimeType: "image/png",
        sizeBytes: 100,
        width: 10,
        height: 10,
        createdAt: report.createdAt,
        source: "upload",
        includedInExport: true,
        exportVariant: "annotated",
        annotations: [],
      },
    ];
    report.environment = {
      capturedAt: report.createdAt,
      browserName: "Test browser",
    };
    report.reviewAcknowledgedAt = report.createdAt;

    const result = computeCompleteness(report);
    expect(result.fraction).toBe(1);
    expect(result.missingRequired).toHaveLength(0);
  });

  it("fails steps completeness when any step has an empty action", () => {
    const report = createEmptyReport();
    report.steps = [
      {
        id: localId("step"),
        order: 1,
        action: "",
        observedResult: "",
        isPrecondition: false,
        evidenceIds: [],
      },
    ];
    const result = computeCompleteness(report);
    const stepsCheck = result.checks.find((check) => check.key === "steps");
    expect(stepsCheck?.done).toBe(false);
  });
});
