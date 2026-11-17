import type { BugReport, EvidenceItem } from "@/types/report";

/**
 * Versioned JSON export. Contains only metadata the user reviewed — never
 * image bytes, never raw log text, never raw HAR content, never redaction
 * match values.
 */

export const EXPORT_SCHEMA_VERSION = 1;
export const GENERATOR = "BugSnap";

export interface JsonEvidenceRef {
  file: string;
  originalName: string;
  width: number;
  height: number;
  exportVariant: "annotated" | "original";
  annotationCount: number;
  opaqueRedactionCount: number;
  source: string;
}

export interface JsonExport {
  schemaVersion: typeof EXPORT_SCHEMA_VERSION;
  generator: string;
  generatedAt: string;
  report: {
    id: string;
    createdAt: string;
    updatedAt: string;
    title: string;
    description: string;
    type: BugReport["type"];
    severity: BugReport["severity"];
    priority: BugReport["priority"];
    status: BugReport["status"];
    affectedArea: string;
    affectedUrl?: string;
    preconditions: string[];
    steps: Array<{
      order: number;
      action: string;
      observedResult?: string;
      isPrecondition: boolean;
      evidenceFiles?: string[];
    }>;
    expectedResult: string;
    actualResult: string;
    frequency: BugReport["frequency"];
    workaround?: string;
    isRegression: BugReport["isRegression"];
    assignee: string;
    labels: string[];
    environment?: Record<string, unknown>;
  };
  evidence: JsonEvidenceRef[];
  diagnostics?: {
    console?: {
      file: string;
      redactedCount: number;
      truncated?: boolean;
    };
    har?: {
      file?: string;
      summary: Record<string, unknown>;
    };
  };
}

export interface JsonOptions {
  evidenceFiles: Array<{ item: EvidenceItem; file: string }>;
  consoleFile?: string;
  consoleRedactedCount?: number;
  consoleTruncated?: boolean;
  includeHar?: boolean;
  harFile?: string;
  harSummary?: Record<string, unknown>;
  environment?: Record<string, unknown>;
}

export function buildJsonExport(report: BugReport, options: JsonOptions): JsonExport {
  const evidence: JsonEvidenceRef[] = options.evidenceFiles.map(({ item, file }) => ({
    file,
    originalName: item.name,
    width: item.width,
    height: item.height,
    exportVariant: item.exportVariant,
    annotationCount: item.annotations.length,
    opaqueRedactionCount: item.annotations.filter((a) => a.tool === "rect" && a.redacted).length,
    source: item.source,
  }));

  const includedIds = new Set(options.evidenceFiles.map((e) => e.item.id));
  const steps = report.steps
    .filter((step) => step.action.trim())
    .map((step) => {
      const files = step.evidenceIds
        .filter((id) => includedIds.has(id))
        .map((id) => options.evidenceFiles.find((e) => e.item.id === id)?.file)
        .filter((f): f is string => Boolean(f));
      return {
        order: step.order,
        action: step.action.trim(),
        ...(step.observedResult?.trim() ? { observedResult: step.observedResult.trim() } : {}),
        isPrecondition: step.isPrecondition,
        ...(files.length > 0 ? { evidenceFiles: files } : {}),
      };
    });

  const diagnostics: NonNullable<JsonExport["diagnostics"]> = {};
  if (options.consoleFile) {
    diagnostics.console = {
      file: options.consoleFile,
      redactedCount: options.consoleRedactedCount ?? 0,
      ...(options.consoleTruncated ? { truncated: true } : {}),
    };
  }
  if (options.includeHar && options.harSummary) {
    diagnostics.har = {
      ...(options.harFile ? { file: options.harFile } : {}),
      summary: options.harSummary,
    };
  }

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    generator: GENERATOR,
    generatedAt: new Date().toISOString(),
    report: {
      id: report.id,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      title: report.title.trim() || "Untitled bug report",
      description: report.description,
      type: report.type,
      severity: report.severity,
      priority: report.priority,
      status: report.status,
      affectedArea: report.affectedArea,
      ...(report.includeAffectedUrl && report.affectedUrl.trim()
        ? { affectedUrl: report.affectedUrl }
        : {}),
      preconditions: report.preconditions,
      steps,
      expectedResult: report.expectedResult,
      actualResult: report.actualResult,
      frequency: report.frequency,
      ...(report.workaround.trim() ? { workaround: report.workaround } : {}),
      isRegression: report.isRegression,
      assignee: report.assignee,
      labels: report.labels,
      ...(options.environment ? { environment: options.environment } : {}),
    },
    evidence,
    ...(diagnostics.console || diagnostics.har ? { diagnostics } : {}),
  };
}

/** Environment subset honouring the user's per-field selection. */
export function selectedEnvironment(
  report: BugReport,
): Record<string, unknown> | undefined {
  const env = report.environment;
  if (!env) return undefined;
  const s = report.environmentSelection;
  const out: Record<string, unknown> = { capturedAt: s.capturedAt ? env.capturedAt : undefined };
  if (s.browserName) out.browserName = env.browserName;
  if (s.browserVersion) out.browserVersion = env.browserVersion;
  if (s.userAgent && report.includeUserAgent) out.userAgent = env.userAgent;
  if (s.platform) out.platform = env.platform;
  if (s.viewport) {
    out.viewportWidth = env.viewportWidth;
    out.viewportHeight = env.viewportHeight;
  }
  if (s.screen) {
    out.screenWidth = env.screenWidth;
    out.screenHeight = env.screenHeight;
  }
  if (s.devicePixelRatio) out.devicePixelRatio = env.devicePixelRatio;
  if (s.language) out.language = env.language;
  if (s.timezone) out.timezone = env.timezone;
  if (s.online) out.online = env.online;
  if (s.colorScheme) out.colorScheme = env.colorScheme;
  if (s.reducedMotion) out.reducedMotion = env.reducedMotion;
  if (s.touchPoints) out.touchPoints = env.touchPoints;
  for (const key of Object.keys(out)) {
    if (out[key] === undefined) delete out[key];
  }
  return out;
}
