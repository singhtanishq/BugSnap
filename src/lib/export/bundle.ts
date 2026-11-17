import JSZip from "jszip";
import type { BugReport, EvidenceItem } from "@/types/report";
import { getEvidenceBlob } from "@/lib/files/evidenceStore";
import { flattenEvidencePng } from "@/lib/annotation/flatten";
import { applyFindings } from "@/lib/redaction/apply";
import {
  buildMarkdown,
  type MarkdownOptions,
} from "./markdown";
import {
  buildJsonExport,
  selectedEnvironment,
  type JsonOptions,
} from "./json";
import { indexedName, reportFolderName, uniqueName } from "./filenames";
import { parseHarSummary } from "@/lib/har/parse";

export interface EvidenceExportFile {
  item: EvidenceItem;
  file: string;
  blob: Blob;
}

export interface ExportPlan {
  folder: string;
  markdown: string;
  json: string;
  markdownOptions: MarkdownOptions;
  jsonOptions: JsonOptions;
  evidenceFiles: EvidenceExportFile[];
  consoleSanitized?: string;
  consoleRedactedCount: number;
  includeConsoleFile: boolean;
  includeHarFile: boolean;
  harSanitizedJson?: string;
}

export interface ExportAssemblyError {
  message: string;
}

/**
 * Build the complete export plan from the current report snapshot.
 * Everything runs locally; failures surface per-file with actionable text.
 */
export async function buildExportPlan(report: BugReport): Promise<ExportPlan> {
  const evidenceFiles: EvidenceExportFile[] = [];
  const taken = new Set<string>();

  const included = report.evidence.filter((item) => item.includedInExport);
  let index = 1;
  for (const item of included) {
    const blob = getEvidenceBlob(item.id);
    if (!blob) {
      throw {
        message: `Image bytes for "${item.name}" are no longer in memory. Re-import it or exclude it from the export.`,
      } as ExportAssemblyError;
    }
    let pngBlob: Blob;
    if (item.exportVariant === "annotated") {
      const flattened = await flattenEvidencePng(blob, item.annotations);
      pngBlob = flattened.blob;
    } else {
      pngBlob = blob;
    }
    const file = uniqueName(indexedName(index, "png"), taken);
    evidenceFiles.push({ item, file, blob: pngBlob });
    index += 1;
  }

  const consoleState = report.consoleLog;
  let consoleSanitized: string | undefined;
  let consoleRedactedCount = 0;
  if (consoleState && consoleState.includedInExport) {
    const applied = applyFindings(consoleState.rawText, consoleState.findings);
    consoleSanitized = applied.sanitized;
    consoleRedactedCount = applied.appliedCount;
  }

  let harSanitizedJson: string | undefined;
  let harSummaryForExport: Record<string, unknown> | undefined;
  if (report.har && report.har.includedInExport && report.har.sanitizedReady && report.har.sanitizedHarJson) {
    harSanitizedJson = report.har.sanitizedHarJson;
    // The summary included in exports comes from the sanitized copy — it
    // never contains raw header values.
    const summaryResult = parseHarSummary(report.har.sanitizedHarJson);
    if (summaryResult.ok && summaryResult.summary) {
      const s = summaryResult.summary;
      harSummaryForExport = {
        entryCount: s.entryCount,
        hostnames: s.hostnames,
        methodCounts: s.methodCounts,
        statusCounts: s.statusCounts,
        failedCount: s.failedCount,
        clientErrorCount: s.clientErrorCount,
        serverErrorCount: s.serverErrorCount,
        totalDurationMs: s.totalDurationMs,
        totalResponseBytes: s.totalResponseBytes,
      };
    }
  }

  const evidenceRefs = evidenceFiles.map(({ item, file }) => ({
    item,
    file: `evidence/${file}`,
    blob: evidenceFiles.find((e) => e.item.id === item.id)!.blob,
  }));
  const harSummaryLines = report.har
    ? [
        `Entries: ${report.har.summary.entryCount}`,
        `Hostnames: ${report.har.summary.hostnames.join(", ") || "—"}`,
        `Failed: ${report.har.summary.failedCount}, 4xx: ${report.har.summary.clientErrorCount}, 5xx: ${report.har.summary.serverErrorCount}`,
        `Total duration: ${report.har.summary.totalDurationMs ?? "—"} ms (browser-reported)`,
        ...(report.har.redactionCounts
          ? [
              `Sanitized copy redactions — headers: ${report.har.redactionCounts.headers}, cookies: ${report.har.redactionCounts.cookies}, query: ${report.har.redactionCounts.queryParams}, bodies omitted: ${report.har.redactionCounts.bodies}`,
            ]
          : []),
      ]
    : [];

  const markdownOptions: MarkdownOptions = {
    consoleSanitized,
    consoleName: consoleSanitized !== undefined ? "diagnostics/console-sanitized.txt" : undefined,
    includeHar: Boolean(harSanitizedJson),
    harName: report.har?.name,
    harSummaryLines,
    evidenceFiles: evidenceRefs,
    consoleRedactedCount,
  };

  const jsonOptions: JsonOptions = {
    evidenceFiles: evidenceRefs,
    consoleFile: consoleSanitized !== undefined ? "diagnostics/console-sanitized.txt" : undefined,
    consoleRedactedCount,
    consoleTruncated: consoleState?.truncated,
    includeHar: Boolean(harSanitizedJson),
    harFile: harSanitizedJson ? "diagnostics/har-sanitized.har" : undefined,
    harSummary: harSummaryForExport,
    environment: selectedEnvironment(report),
  };

  return {
    folder: reportFolderName(),
    markdown: buildMarkdown(report, markdownOptions),
    json: JSON.stringify(buildJsonExport(report, jsonOptions), null, 2),
    markdownOptions,
    jsonOptions,
    evidenceFiles: evidenceRefs,
    consoleSanitized,
    consoleRedactedCount,
    includeConsoleFile: consoleSanitized !== undefined,
    includeHarFile: harSanitizedJson !== undefined,
    harSanitizedJson,
  };
}

export const ZIP_README = (plan: ExportPlan): string =>
  [
    `BugSnap report bundle — ${plan.folder}`,
    "",
    "Contents:",
    "- report.md      — human-readable Markdown report",
    "- report.json    — structured, versioned report data (schemaVersion 1)",
    `- evidence/      — ${plan.evidenceFiles.length} PNG file(s); annotated/redacted variants were flattened at export time`,
    ...(plan.includeConsoleFile ? ["- diagnostics/console-sanitized.txt — console output after redaction"] : []),
    ...(plan.includeHarFile ? ["- diagnostics/har-sanitized.har  — sanitized HAR copy (auth/cookie headers and bodies removed)"] : []),
    "",
    "Privacy reminder:",
    "This bundle was produced locally in the reporter's browser. Automated redaction",
    "(opaque blocks, value replacement) is best-effort — review every file before",
    "sharing it with anyone else.",
    "",
    "This report was generated with BugSnap.",
  ].join("\n");

export async function buildZipBlob(report: BugReport): Promise<Blob> {
  const plan = await buildExportPlan(report);
  const zip = new JSZip();
  const root = zip.folder(plan.folder);
  if (!root) throw new Error("ZIP root could not be created.");

  root.file("report.md", plan.markdown);
  root.file("report.json", plan.json);

  // Evidence files carry their full bundle-relative path (evidence/…).
  for (const evidenceFile of plan.evidenceFiles) {
    root.file(evidenceFile.file, evidenceFile.blob);
  }

  if (plan.includeConsoleFile && plan.consoleSanitized) {
    root.file("diagnostics/console-sanitized.txt", plan.consoleSanitized);
  }
  if (plan.includeHarFile && plan.harSanitizedJson) {
    root.file("diagnostics/har-sanitized.har", plan.harSanitizedJson);
  }

  root.file("README.txt", ZIP_README(plan));

  return await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand?.("copy") ?? false;
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
