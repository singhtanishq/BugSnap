import type { BugReport } from "@/types/report";
import { SEVERITY_LABELS, PRIORITY_LABELS, REPORT_TYPE_LABELS } from "@/types/report";
import { buildMarkdown, type MarkdownOptions } from "./markdown";

/**
 * Tracker-style text templates. These are formatting helpers only — BugSnap
 * does not integrate with Jira, Linear or GitHub APIs.
 */

function sharedHeader(report: BugReport): string {
  const lines = [
    `Type: ${REPORT_TYPE_LABELS[report.type]}`,
    `Severity: ${SEVERITY_LABELS[report.severity]}`,
    `Priority: ${PRIORITY_LABELS[report.priority]}`,
  ];
  if (report.affectedArea.trim()) lines.push(`Area: ${report.affectedArea.trim()}`);
  if (report.includeAffectedUrl && report.affectedUrl.trim()) {
    lines.push(`URL: ${report.affectedUrl}`);
  }
  if (report.assignee.trim()) lines.push(`Assignee: ${report.assignee.trim()}`);
  if (report.labels.length > 0) lines.push(`Labels: ${report.labels.join(", ")}`);
  return lines.join("\n");
}

function sharedBody(report: BugReport): string {
  const steps = report.steps
    .filter((s) => s.action.trim())
    .map((s, i) => `${i + 1}. ${s.action.trim()}${s.observedResult?.trim() ? ` → Observed: ${s.observedResult.trim()}` : ""}`)
    .join("\n");
  const preconditions = report.preconditions.length > 0
    ? `Preconditions:\n${report.preconditions.map((p) => `  - ${p}`).join("\n")}\n`
    : "";
  return [
    report.description.trim() ? `Description:\n${report.description.trim()}\n` : "",
    preconditions,
    steps ? `Steps to reproduce:\n${steps}\n` : "",
    `Expected: ${report.expectedResult.trim() || "—"}`,
    `Actual: ${report.actualResult.trim() || "—"}`,
    report.workaround.trim() ? `Workaround: ${report.workaround.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function githubIssueBody(report: BugReport, markdownOptions: MarkdownOptions): string {
  const header = sharedHeader(report);
  const body = sharedBody(report);
  const markdown = buildMarkdown(report, markdownOptions);
  return [
    `## ${report.title.trim() || "Untitled bug report"}`,
    "",
    header,
    "",
    body,
    "",
    "---",
    "<details><summary>Full BugSnap report</summary>",
    "",
    markdown,
    "",
    "</details>",
    "",
    "_Generated locally with BugSnap. No live GitHub integration — paste this into a new issue._",
  ].join("\n");
}

/** Jira-style plain text with a wiki-markup flavour. */
export function jiraText(report: BugReport, markdownOptions: MarkdownOptions): string {
  const stepsBlock = report.steps
    .filter((s) => s.action.trim())
    .map((s, i) => `*Step ${i + 1}:* ${s.action.trim()}`)
    .join("\n");
  return [
    `h2. ${report.title.trim() || "Untitled bug report"}`,
    "",
    sharedHeader(report),
    "",
    report.description.trim() ? `h3. Description\n${report.description.trim()}` : "",
    stepsBlock,
    "",
    `h3. Expected Result\n${report.expectedResult.trim() || "—"}`,
    `h3. Actual Result\n${report.actualResult.trim() || "—"}`,
    report.workaround.trim() ? `h3. Workaround\n${report.workaround.trim()}` : "",
    "",
    evidenceNote(markdownOptions),
    "_Template generated locally by BugSnap — not a live Jira integration._",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** Linear-style Markdown, terse. */
export function linearText(report: BugReport, markdownOptions: MarkdownOptions): string {
  const body = sharedBody(report);
  return [
    `### ${report.title.trim() || "Untitled bug report"}`,
    "",
    sharedHeader(report),
    "",
    body,
    "",
    evidenceNote(markdownOptions),
    "_Template generated locally by BugSnap — not a live Linear integration._",
  ].join("\n");
}

function evidenceNote(options: MarkdownOptions): string {
  if (options.evidenceFiles.length === 0 && !options.consoleSanitized) return "";
  const files = options.evidenceFiles.map((e) => e.file).join(", ");
  const consoleNote = options.consoleSanitized ? ` Sanitized console output: ${options.consoleName ?? "console-sanitized.txt"}.` : "";
  return `Evidence: ${files || "(none)"}${consoleNote} Automated redaction was applied where marked; review before sharing.`;
}
