import type { BugReport, EnvironmentSelection, EvidenceItem } from "@/types/report";
import type { Finding } from "@/types/redaction";
import { SEVERITY_LABELS, PRIORITY_LABELS, REPORT_TYPE_LABELS, STATUS_LABELS, FREQUENCY_LABELS, REGRESSION_LABELS } from "@/types/report";

/** Stable, deterministic Markdown sections with minimal escaping. */

function escapeTableCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function listField(label: string, value: string | undefined): string {
  if (!value || !value.trim()) return "";
  return `- **${label}:** ${escapeTableCell(value.trim())}\n`;
}

export interface MarkdownOptions {
  /** Sanitized console text to embed (already computed from redacted findings). */
  consoleSanitized?: string;
  consoleName?: string;
  /** Whether the sanitized HAR will be attached. */
  includeHar?: boolean;
  harName?: string;
  harSummaryLines?: string[];
  /** Evidence files by evidence id, in export order. */
  evidenceFiles: Array<{ item: EvidenceItem; file: string }>;
  /** Redacted finding count for the redaction note. */
  consoleRedactedCount?: number;
}

export function buildMarkdown(report: BugReport, options: MarkdownOptions): string {
  const parts: string[] = [];

  parts.push(`# ${report.title.trim() || "Untitled bug report"}\n`);
  parts.push(
    `> Report generated with BugSnap — a local-first bug reporting tool. Evidence was reviewed and sanitized before export.\n`,
  );

  parts.push("## Summary\n");
  let meta = "";
  meta += listField("Type", REPORT_TYPE_LABELS[report.type]);
  meta += listField("Severity", SEVERITY_LABELS[report.severity]);
  meta += listField("Priority", PRIORITY_LABELS[report.priority]);
  meta += listField("Status", STATUS_LABELS[report.status]);
  meta += listField("Affected area", report.affectedArea);
  if (report.includeAffectedUrl && report.affectedUrl.trim()) {
    meta += listField("Affected URL", report.affectedUrl);
  }
  meta += listField("Frequency", FREQUENCY_LABELS[report.frequency]);
  meta += listField(
    "Regression",
    report.isRegression === "unknown" ? undefined : REGRESSION_LABELS[report.isRegression],
  );
  meta += listField("Assignee", report.assignee);
  if (report.labels.length > 0) {
    meta += `- **Labels:** ${report.labels.map((l) => escapeTableCell(l)).join(", ")}\n`;
  }
  parts.push(meta);

  if (report.description.trim()) {
    parts.push("## Description\n");
    parts.push(`${report.description.trim()}\n`);
  }

  if (report.preconditions.length > 0) {
    parts.push("## Preconditions\n");
    parts.push(report.preconditions.map((p) => `- ${escapeTableCell(p)}`).join("\n") + "\n");
  }

  const actionableSteps = report.steps.filter((s) => s.action.trim());
  if (actionableSteps.length > 0) {
    parts.push("## Reproduction steps\n");
    const numbered = report.steps
      .map((step, index) => ({ step, index }))
      .filter(({ step }) => step.action.trim());
    for (const { step, index } of numbered) {
      const prefix = step.isPrecondition ? `${index + 1} (prerequisite)` : `${index + 1}`;
      const evidenceNote =
        step.evidenceIds.length > 0
          ? ` — see ${step.evidenceIds
              .map((id) => options.evidenceFiles.find((e) => e.item.id === id)?.file)
              .filter(Boolean)
              .join(", ")}`
          : "";
      parts.push(`${prefix}. ${step.action.trim()}${evidenceNote}`);
      if (step.observedResult?.trim()) {
        parts.push(`   - Observed: ${step.observedResult.trim()}`);
      }
    }
    parts.push("");
  }

  parts.push("## Expected result\n");
  parts.push(`${report.expectedResult.trim() || "—"}\n`);
  parts.push("## Actual result\n");
  parts.push(`${report.actualResult.trim() || "—"}\n`);

  if (report.workaround.trim()) {
    parts.push("## Workaround\n");
    parts.push(`${report.workaround.trim()}\n`);
  }

  const envSection = buildEnvironmentSection(report.environment, report.environmentSelection, report.includeUserAgent);
  if (envSection) {
    parts.push(envSection);
  }

  if (options.evidenceFiles.length > 0) {
    parts.push("## Evidence\n");
    for (const { item, file } of options.evidenceFiles) {
      const redactions = item.annotations.filter((a) => a.tool === "rect" && a.redacted).length;
      const variant = item.exportVariant === "annotated" ? "annotated" : "original";
      parts.push(
        `![${item.name}](${file})\n\n- File: \`${file}\` (${item.width}×${item.height}, ${variant}${
          redactions > 0 ? `, ${redactions} opaque redaction${redactions === 1 ? "" : "s"}` : ""
        })\n`,
      );
    }
    parts.push("");
  }

  if (options.consoleSanitized) {
    parts.push("## Console output (sanitized)\n");
    if ((options.consoleRedactedCount ?? 0) > 0) {
      parts.push(
        `> ${options.consoleRedactedCount} value(s) were redacted from the console output before export.\n`,
      );
    }
    parts.push("```\n" + options.consoleSanitized + "\n```\n");
    if (options.consoleName) {
      parts.push(`*Also attached as \`${options.consoleName}\`.*\n`);
    }
  }

  if (options.includeHar && options.harSummaryLines && options.harSummaryLines.length > 0) {
    parts.push("## Network capture (HAR summary)\n");
    parts.push(
      options.includeHar && options.harName
        ? `> A sanitized copy of \`${options.harName}\` is included in the ZIP bundle (headers, cookies, query tokens redacted; bodies omitted).\n`
        : "> Raw HAR files are never included; only this summary.\n",
    );
    parts.push(options.harSummaryLines.map((line) => `- ${line}`).join("\n") + "\n");
  }

  parts.push("## Redaction notice\n");
  parts.push(
    "Automated redaction was applied where marked, but it cannot guarantee that all sensitive " +
      "information was found. Review every section before sharing this report.\n",
  );

  return parts.join("\n");
}

export function buildEnvironmentSection(
  environment: BugReport["environment"],
  selection: EnvironmentSelection,
  includeUserAgent: boolean,
): string {
  if (!environment) return "";
  const lines: string[] = [];
  if (selection.browserName && environment.browserName) {
    lines.push(`- **Browser:** ${environment.browserName}${selection.browserVersion && environment.browserVersion ? ` ${environment.browserVersion}` : ""}`);
  } else if (selection.browserVersion && environment.browserVersion && !selection.browserName) {
    lines.push(`- **Browser version:** ${environment.browserVersion}`);
  }
  if (selection.platform && environment.platform) {
    lines.push(`- **Platform (browser-reported):** ${environment.platform}`);
  }
  if (includeUserAgent && selection.userAgent && environment.userAgent) {
    lines.push(`- **User agent (opt-in):** ${environment.userAgent}`);
  }
  if (selection.viewport && environment.viewportWidth !== undefined) {
    lines.push(`- **Viewport:** ${environment.viewportWidth} × ${environment.viewportHeight} CSS px`);
  }
  if (selection.screen && environment.screenWidth !== undefined) {
    lines.push(`- **Screen:** ${environment.screenWidth} × ${environment.screenHeight} px`);
  }
  if (selection.devicePixelRatio && environment.devicePixelRatio !== undefined) {
    lines.push(`- **Device pixel ratio:** ${environment.devicePixelRatio}×`);
  }
  if (selection.language && environment.language) {
    lines.push(`- **Language:** ${environment.language}`);
  }
  if (selection.timezone && environment.timezone) {
    lines.push(`- **Timezone:** ${environment.timezone}`);
  }
  if (selection.capturedAt) {
    lines.push(`- **Captured at:** ${environment.capturedAt}`);
  }
  if (selection.online && environment.online !== undefined) {
    lines.push(`- **Online:** ${environment.online ? "yes" : "no"}`);
  }
  if (selection.colorScheme && environment.colorScheme) {
    lines.push(`- **Colour scheme:** ${environment.colorScheme}`);
  }
  if (selection.reducedMotion && environment.reducedMotion !== undefined) {
    lines.push(`- **Reduced motion:** ${environment.reducedMotion ? "on" : "off"}`);
  }
  if (selection.touchPoints && environment.touchPoints !== undefined) {
    lines.push(`- **Touch points:** ${environment.touchPoints}`);
  }
  if (lines.length === 0) return "";
  return `## Environment\n\n${lines.join("\n")}\n`;
}

export function findingSummaryLines(findings: Finding[]): string[] {
  return findings
    .filter((f) => f.status === "redacted")
    .map((f) => `Line ${f.location.line}: ${f.category} (${f.confidence} confidence) redacted`);
}
