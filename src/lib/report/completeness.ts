import type { BugReport } from "@/types/report";

export interface CompletenessCheck {
  key: string;
  label: string;
  done: boolean;
  route: string;
}

export interface ReportCompleteness {
  fraction: number;
  checks: CompletenessCheck[];
  missingRequired: CompletenessCheck[];
}

/**
 * Derives report readiness from actual content — never a fabricated
 * percentage. Title plus one step with an action plus expected/actual
 * results are the minimum required to export.
 */
export function computeCompleteness(report: BugReport): ReportCompleteness {
  const checks: CompletenessCheck[] = [
    {
      key: "title",
      label: "Title",
      done: report.title.trim().length > 0,
      route: "/report",
    },
    {
      key: "description",
      label: "Description",
      done: report.description.trim().length > 0,
      route: "/report",
    },
    {
      key: "steps",
      label: "Reproduction steps",
      done:
        report.steps.length > 0 &&
        report.steps.every((step) => step.action.trim().length > 0),
      route: "/steps",
    },
    {
      key: "expected",
      label: "Expected result",
      done: report.expectedResult.trim().length > 0,
      route: "/report",
    },
    {
      key: "actual",
      label: "Actual result",
      done: report.actualResult.trim().length > 0,
      route: "/report",
    },
    {
      key: "environment",
      label: "Environment captured",
      done: report.environment !== null,
      route: "/environment",
    },
    {
      key: "evidence",
      label: "Evidence attached",
      done: report.evidence.length > 0,
      route: "/evidence",
    },
    {
      key: "review",
      label: "Privacy review",
      done: reviewComplete(report),
      route: "/review",
    },
  ];

  const doneCount = checks.filter((check) => check.done).length;
  const missingRequired = checks.filter(
    (check) => !check.done && REQUIRED_KEYS.has(check.key),
  );

  return {
    fraction: checks.length === 0 ? 0 : doneCount / checks.length,
    checks,
    missingRequired,
  };
}

const REQUIRED_KEYS = new Set(["title", "steps", "expected", "actual"]);

function reviewComplete(report: BugReport): boolean {
  return report.reviewAcknowledgedAt !== undefined;
}
