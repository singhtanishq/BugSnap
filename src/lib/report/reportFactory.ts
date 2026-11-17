import type {
  BugReport,
  EnvironmentSelection,
  ReproductionStep,
} from "@/types/report";
import { localId, nowIso } from "@/lib/utils";

export function defaultEnvironmentSelection(): EnvironmentSelection {
  // Reasonable, privacy-conscious defaults: technical shape is useful for
  // reproduction, the raw user-agent string stays off until the user opts in.
  return {
    browserName: true,
    browserVersion: true,
    userAgent: false,
    platform: true,
    viewport: true,
    screen: true,
    devicePixelRatio: true,
    language: true,
    timezone: true,
    capturedAt: true,
    online: false,
    colorScheme: false,
    reducedMotion: false,
    touchPoints: false,
  };
}

export function createEmptyReport(): BugReport {
  const createdAt = nowIso();
  return {
    schemaVersion: 1,
    id: localId("report"),
    createdAt,
    updatedAt: createdAt,
    title: "",
    description: "",
    type: "bug",
    severity: "medium",
    priority: "normal",
    status: "open",
    affectedArea: "",
    affectedUrl: "",
    includeAffectedUrl: false,
    includeUserAgent: false,
    preconditions: [],
    steps: [],
    expectedResult: "",
    actualResult: "",
    frequency: "sometimes",
    workaround: "",
    isRegression: "unknown",
    assignee: "",
    labels: [],
    environment: null,
    environmentSelection: defaultEnvironmentSelection(),
    evidence: [],
    consoleLog: null,
    har: null,
  };
}

export function renumberSteps(steps: ReproductionStep[]): ReproductionStep[] {
  return steps.map((step, index) => ({ ...step, order: index + 1 }));
}
