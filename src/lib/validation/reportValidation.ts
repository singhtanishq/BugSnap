import type { BugReport } from "@/types/report";

export interface ValidationIssue {
  field: string;
  message: string;
  route: string;
}

/**
 * Export-readiness validation. Returns human-readable issues; an empty list
 * means the report carries everything required for a useful export.
 */
export function validateReportForExport(report: BugReport): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!report.title.trim()) {
    issues.push({
      field: "title",
      message: "A short title is required.",
      route: "/report",
    });
  } else if (report.title.trim().length > 200) {
    issues.push({
      field: "title",
      message: "Keep the title under 200 characters.",
      route: "/report",
    });
  }

  const actionableSteps = report.steps.filter((step) => step.action.trim());
  if (actionableSteps.length === 0) {
    issues.push({
      field: "steps",
      message: "Add at least one reproduction step with an action.",
      route: "/steps",
    });
  } else if (actionableSteps.length !== report.steps.length) {
    issues.push({
      field: "steps",
      message: "Every step needs an action before export.",
      route: "/steps",
    });
  }

  if (!report.expectedResult.trim()) {
    issues.push({
      field: "expectedResult",
      message: "Expected result is required.",
      route: "/report",
    });
  }

  if (!report.actualResult.trim()) {
    issues.push({
      field: "actualResult",
      message: "Actual result is required.",
      route: "/report",
    });
  }

  if (report.includeAffectedUrl && !report.affectedUrl.trim()) {
    issues.push({
      field: "affectedUrl",
      message: "URL inclusion is enabled but no sanitized URL is set.",
      route: "/report",
    });
  }

  return issues;
}
