import type { Annotation } from "./annotation";
import type { Finding } from "./redaction";
import type { HarSummary, RedactionCounts } from "./diagnostics";

export type BugSeverity = "critical" | "high" | "medium" | "low" | "informational";
export type BugPriority = "urgent" | "high" | "normal" | "low";
export type ReportType =
  | "bug"
  | "visual"
  | "functional"
  | "performance"
  | "accessibility"
  | "compatibility"
  | "regression"
  | "other";
export type ReportStatus = "open" | "triaged" | "in-progress" | "blocked" | "resolved";
export type ReportFrequency = "always" | "often" | "sometimes" | "once" | "unable";
export type RegressionFlag = "yes" | "no" | "unknown";

export interface ReproductionStep {
  id: string;
  order: number;
  action: string;
  observedResult?: string;
  isPrecondition: boolean;
  evidenceIds: string[];
}

export interface EnvironmentSnapshot {
  capturedAt: string;
  browserName?: string;
  browserVersion?: string;
  userAgent?: string;
  platform?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  screenWidth?: number;
  screenHeight?: number;
  devicePixelRatio?: number;
  language?: string;
  timezone?: string;
  online?: boolean;
  colorScheme?: string;
  reducedMotion?: boolean;
  touchPoints?: number;
}

/**
 * Which environment fields the user has opted to include in exports.
 * Everything is opt-in except the capture timestamp, which is required for
 * report context; user agent is additionally gated behind its own toggle.
 */
export interface EnvironmentSelection {
  browserName: boolean;
  browserVersion: boolean;
  userAgent: boolean;
  platform: boolean;
  viewport: boolean;
  screen: boolean;
  devicePixelRatio: boolean;
  language: boolean;
  timezone: boolean;
  capturedAt: boolean;
  online: boolean;
  colorScheme: boolean;
  reducedMotion: boolean;
  touchPoints: boolean;
}

export type EvidenceSource = "upload" | "paste" | "drop" | "capture" | "sample";
export type EvidenceExportVariant = "annotated" | "original";

export interface EvidenceItem {
  id: string;
  kind: "image";
  name: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  createdAt: string;
  source: EvidenceSource;
  includedInExport: boolean;
  /** Which pixel version to export: flattened annotated/redacted or untouched original. */
  exportVariant: EvidenceExportVariant;
  annotations: Annotation[];
}

export interface ConsoleLogState {
  id: string;
  name: string;
  /** Raw text lives in memory only and is never written to exports directly. */
  rawText: string;
  byteSize: number;
  importedAt: string;
  truncated: boolean;
  findings: Finding[];
  replacement: string;
  includedInExport: boolean;
}

export interface HarImportState {
  id: string;
  name: string;
  importedAt: string;
  entryCount: number;
  truncated: boolean;
  summary: HarSummary;
  /** Set only after the user completes the sanitized-HAR review flow. */
  sanitizedReady: boolean;
  /** Sanitized copy, in memory only. Never the raw file. */
  sanitizedHarJson: string | null;
  redactionCounts: RedactionCounts | null;
  includedInExport: boolean;
}

export interface BugReport {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  description: string;
  type: ReportType;
  severity: BugSeverity;
  priority: BugPriority;
  status: ReportStatus;
  affectedArea: string;
  affectedUrl: string;
  includeAffectedUrl: boolean;
  includeUserAgent: boolean;
  preconditions: string[];
  steps: ReproductionStep[];
  expectedResult: string;
  actualResult: string;
  frequency: ReportFrequency;
  workaround: string;
  isRegression: RegressionFlag;
  assignee: string;
  labels: string[];
  environment: EnvironmentSnapshot | null;
  environmentSelection: EnvironmentSelection;
  evidence: EvidenceItem[];
  consoleLog: ConsoleLogState | null;
  har: HarImportState | null;
  /** ISO timestamp when the user completed the privacy review, if they did. */
  reviewAcknowledgedAt?: string;
}

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  bug: "Bug",
  visual: "UI / Visual",
  functional: "Functional",
  performance: "Performance",
  accessibility: "Accessibility",
  compatibility: "Compatibility",
  regression: "Regression",
  other: "Other",
};

export const SEVERITY_LABELS: Record<BugSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  informational: "Informational",
};

export const PRIORITY_LABELS: Record<BugPriority, string> = {
  urgent: "Urgent",
  high: "High",
  normal: "Normal",
  low: "Low",
};

export const STATUS_LABELS: Record<ReportStatus, string> = {
  open: "Open",
  triaged: "Triaged",
  "in-progress": "In Progress",
  blocked: "Blocked",
  resolved: "Resolved",
};

export const FREQUENCY_LABELS: Record<ReportFrequency, string> = {
  always: "Always",
  often: "Often",
  sometimes: "Sometimes",
  once: "Once",
  unable: "Unable to reproduce",
};

export const REGRESSION_LABELS: Record<RegressionFlag, string> = {
  yes: "Yes",
  no: "No",
  unknown: "Unknown",
};
