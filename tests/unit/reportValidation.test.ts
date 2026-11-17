import { describe, expect, it } from "vitest";
import { validateReportForExport } from "@/lib/validation/reportValidation";
import { createEmptyReport } from "@/lib/report/reportFactory";
import type { BugReport } from "@/types/report";

function filledReport(): BugReport {
  const report = createEmptyReport();
  report.title = "Save button stays disabled";
  report.expectedResult = "Save is enabled";
  report.actualResult = "Save stays disabled";
  report.steps = [
    {
      id: "s1",
      order: 1,
      action: "Open settings",
      observedResult: "",
      isPrecondition: false,
      evidenceIds: [],
    },
  ];
  return report;
}

describe("validateReportForExport", () => {
  it("passes a complete report", () => {
    expect(validateReportForExport(filledReport())).toEqual([]);
  });

  it("flags missing title, steps, expected and actual", () => {
    const issues = validateReportForExport(createEmptyReport());
    const fields = issues.map((issue) => issue.field);
    expect(fields).toContain("title");
    expect(fields).toContain("steps");
    expect(fields).toContain("expectedResult");
    expect(fields).toContain("actualResult");
  });

  it("flags steps whose action is empty", () => {
    const report = filledReport();
    report.steps[0]!.action = "  ";
    const issues = validateReportForExport(report);
    expect(issues.some((issue) => issue.field === "steps")).toBe(true);
  });

  it("flags URL inclusion enabled with no URL", () => {
    const report = filledReport();
    report.includeAffectedUrl = true;
    report.affectedUrl = "";
    const issues = validateReportForExport(report);
    expect(issues.some((issue) => issue.field === "affectedUrl")).toBe(true);
  });

  it("rejects an over-long title", () => {
    const report = filledReport();
    report.title = "x".repeat(201);
    const issues = validateReportForExport(report);
    expect(issues.some((issue) => issue.field === "title")).toBe(true);
  });
});
