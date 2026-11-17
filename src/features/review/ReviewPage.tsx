import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { Link } from "@/app/router";
import { useReport } from "@/app/providers/ReportProvider";
import { useToast } from "@/components/feedback/Toast";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";
import { validateReportForExport } from "@/lib/validation/reportValidation";
import { applyFindings } from "@/lib/redaction/apply";
import { getEvidenceUrl } from "@/lib/files/evidenceStore";
import {
  buildExportPlan,
  buildZipBlob,
  copyTextToClipboard,
  downloadBlob,
} from "@/lib/export/bundle";
import { githubIssueBody, jiraText, linearText } from "@/lib/export/templates";
import { computeCompleteness } from "@/lib/report/completeness";
import { formatBytes, formatTimestamp } from "@/lib/utils";
import {
  FREQUENCY_LABELS,
  PRIORITY_LABELS,
  REGRESSION_LABELS,
  REPORT_TYPE_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
} from "@/types/report";

const SEVERITY_TONES = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
  informational: "neutral",
} as const;

function ReviewPageInner() {
  const { report, dispatch } = useReport();
  const { showToast } = useToast();
  const [confirmAck, setConfirmAck] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const issues = useMemo(() => validateReportForExport(report), [report]);
  const completeness = computeCompleteness(report);
  const consoleSanitized = useMemo(() => {
    if (!report.consoleLog) return null;
    return applyFindings(report.consoleLog.rawText, report.consoleLog.findings);
  }, [report.consoleLog]);
  const redactedFindings = report.consoleLog?.findings.filter((f) => f.status === "redacted").length ?? 0;
  const totalRedactionRects = report.evidence.reduce(
    (count, item) =>
      count + item.annotations.filter((a) => a.tool === "rect" && a.redacted).length,
    0,
  );

  const acknowledge = () => {
    dispatch({ type: "patch-report", patch: { reviewAcknowledgedAt: new Date().toISOString() } });
    setConfirmAck(false);
    showToast("Privacy review acknowledged — you can export now", "success");
  };

  const withPlan = async (
    action: (plan: Awaited<ReturnType<typeof buildExportPlan>>) => Promise<void> | void,
    successMessage: string,
  ) => {
    try {
      const plan = await buildExportPlan(report);
      await action(plan);
      showToast(successMessage, "success");
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: string }).message)
          : "The export could not be assembled.";
      setExportError(message);
      showToast(message, "error");
    }
  };

  const downloadMarkdown = () =>
    withPlan(
      (plan) => downloadBlob(new Blob([plan.markdown], { type: "text/markdown" }), "report.md"),
      "Markdown report downloaded",
    );

  const downloadJson = () =>
    withPlan(
      (plan) => downloadBlob(new Blob([plan.json], { type: "application/json" }), "report.json"),
      "JSON report downloaded",
    );

  const downloadZip = async () => {
    setExportingZip(true);
    try {
      const blob = await buildZipBlob(report);
      downloadBlob(blob, `${reportFolderNameSafe(report)}.zip`);
      showToast("ZIP bundle downloaded", "success");
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: string }).message)
          : "The ZIP bundle could not be assembled.";
      setExportError(message);
      showToast(message, "error");
    } finally {
      setExportingZip(false);
    }
  };

  const copyVia = (builder: (plan: Awaited<ReturnType<typeof buildExportPlan>>) => string) =>
    withPlan(async (plan) => {
      const ok = await copyTextToClipboard(builder(plan));
      if (!ok) {
        throw { message: "Clipboard access was denied by the browser — download the file instead." };
      }
    }, "Copied to clipboard");

  return (
    <div>
      <PageHeader
        title="Review & Export"
        description="This is exactly what an export will contain — nothing more, nothing less. Confirm the privacy review, then pick a format."
        actions={
          <Link to="/privacy">
            <Button>Privacy center</Button>
          </Link>
        }
      />

      {issues.length > 0 ? (
        <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5" role="alert">
          <p className="text-sm font-semibold text-amber-900">
            Before exporting, complete the required fields:
          </p>
          <ul className="mt-1.5 space-y-1 text-xs text-amber-800">
            {issues.map((issue) => (
              <li key={issue.field}>
                <Link to={issue.route} className="underline underline-offset-2">
                  {issue.message}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Card className="mb-5">
        <CardHeader
          title="Privacy review"
          description="Confirm that evidence, diagnostics and URLs have been reviewed and sanitized."
          actions={
            report.reviewAcknowledgedAt ? (
              <Badge tone="accent">
                Reviewed {formatTimestamp(report.reviewAcknowledgedAt)}
              </Badge>
            ) : (
              <Button variant="primary" onClick={() => setConfirmAck(true)}>
                Acknowledge privacy review
              </Button>
            )
          }
        />
        <CardBody>
          <div className="grid gap-2 text-xs text-ink-600 sm:grid-cols-2">
            <p>
              <span className="font-semibold text-ink-800">Evidence images:</span>{" "}
              {report.evidence.filter((e) => e.includedInExport).length} of{" "}
              {report.evidence.length} included · {totalRedactionRects} opaque redaction
              {totalRedactionRects === 1 ? "" : "s"} flattened on export
            </p>
            <p>
              <span className="font-semibold text-ink-800">Console log:</span>{" "}
              {report.consoleLog
                ? report.consoleLog.includedInExport
                  ? `${redactedFindings} redaction(s) applied, sanitized text only`
                  : "not included"
                : "none imported"}
            </p>
            <p>
              <span className="font-semibold text-ink-800">HAR:</span>{" "}
              {report.har
                ? report.har.includedInExport && report.har.sanitizedReady
                  ? "sanitized copy only (headers, cookies, bodies removed)"
                  : "summary only — raw file is never exported"
                : "none imported"}
            </p>
            <p>
              <span className="font-semibold text-ink-800">Affected URL:</span>{" "}
              {report.includeAffectedUrl && report.affectedUrl
                ? `included as ${report.affectedUrl}`
                : "not included"}
            </p>
            <p>
              <span className="font-semibold text-ink-800">User agent:</span>{" "}
              {report.includeUserAgent && report.environmentSelection.userAgent
                ? "included (opt-in)"
                : "excluded"}
            </p>
            <p>
              <span className="font-semibold text-ink-800">Report readiness:</span>{" "}
              {Math.round(completeness.fraction * 100)}%
            </p>
          </div>
        </CardBody>
      </Card>

      {/* Export actions */}
      <Card className="mb-5">
        <CardHeader
          title="Export formats"
          description="Files are generated in your browser and saved directly to your downloads folder."
        />
        <CardBody>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={downloadMarkdown} disabled={issues.length > 0}>
              Download Markdown
            </Button>
            <Button onClick={downloadJson} disabled={issues.length > 0}>
              Download JSON
            </Button>
            <Button onClick={downloadZip} disabled={issues.length > 0 || exportingZip}>
              {exportingZip ? "Assembling ZIP…" : "Download ZIP bundle"}
            </Button>
            <span className="mx-1 w-px self-stretch bg-ink-200" aria-hidden="true" />
            <Button onClick={() => copyVia((plan) => plan.markdown)} disabled={issues.length > 0}>
              Copy Markdown
            </Button>
            <Button
              onClick={() => copyVia((plan) => githubIssueBody(report, plan.markdownOptions))}
              disabled={issues.length > 0}
            >
              Copy GitHub issue body
            </Button>
            <Button
              onClick={() => copyVia((plan) => jiraText(report, plan.markdownOptions))}
              disabled={issues.length > 0}
            >
              Copy Jira-style text
            </Button>
            <Button
              onClick={() => copyVia((plan) => linearText(report, plan.markdownOptions))}
              disabled={issues.length > 0}
            >
              Copy Linear-style text
            </Button>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-500">
            Copy actions use clipboard templates only — BugSnap has no live Jira, Linear or GitHub
            integration and never uploads report contents. If the browser denies clipboard
            access, download the Markdown file instead.
          </p>
          {exportError ? (
            <p role="alert" className="mt-2 text-xs font-medium text-red-700">
              {exportError}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {/* Report preview */}
      <Card className="mb-5">
        <CardHeader title="Report preview" description="Section-by-section view of the export contents." />
        <CardBody className="grid gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-ink-900">
                {report.title.trim() || "Untitled report"}
              </h3>
              <Badge tone="neutral">{REPORT_TYPE_LABELS[report.type]}</Badge>
              <Badge tone={SEVERITY_TONES[report.severity] as BadgeTone}>
                {SEVERITY_LABELS[report.severity]}
              </Badge>
              <Badge tone="neutral">{PRIORITY_LABELS[report.priority]}</Badge>
              <Badge tone="neutral">{STATUS_LABELS[report.status]}</Badge>
              <Badge tone="neutral">{FREQUENCY_LABELS[report.frequency]}</Badge>
              {report.isRegression !== "unknown" ? (
                <Badge tone={report.isRegression === "yes" ? "critical" : "neutral"}>
                  Regression: {REGRESSION_LABELS[report.isRegression]}
                </Badge>
              ) : null}
            </div>
            {report.affectedArea ? (
              <p className="mt-1.5 text-xs text-ink-500">Area: {report.affectedArea}</p>
            ) : null}
            {report.includeAffectedUrl && report.affectedUrl ? (
              <p className="mt-1 break-all font-mono text-xs text-ink-700">
                URL: {report.affectedUrl}
              </p>
            ) : (
              <p className="mt-1 text-xs text-ink-400">URL excluded from exports</p>
            )}
          </div>

          {report.description.trim() ? (
            <section>
              <h4 className="text-xs font-semibold text-ink-700">Description</h4>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{report.description}</p>
            </section>
          ) : null}

          {report.preconditions.length > 0 ? (
            <section>
              <h4 className="text-xs font-semibold text-ink-700">Preconditions</h4>
              <ul className="mt-1 list-disc pl-5 text-sm text-ink-700">
                {report.preconditions.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {report.steps.filter((s) => s.action.trim()).length > 0 ? (
            <section>
              <h4 className="text-xs font-semibold text-ink-700">Reproduction steps</h4>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-ink-700">
                {report.steps
                  .filter((s) => s.action.trim())
                  .map((step) => (
                    <li key={step.id}>
                      {step.isPrecondition ? <Badge tone="info">prerequisite</Badge> : null}{" "}
                      {step.action}
                      {step.observedResult?.trim() ? (
                        <span className="block pl-3 text-xs text-ink-500">
                          Observed: {step.observedResult}
                        </span>
                      ) : null}
                    </li>
                  ))}
              </ol>
            </section>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <section>
              <h4 className="text-xs font-semibold text-ink-700">Expected result</h4>
              <p className="mt-1 text-sm text-ink-700">{report.expectedResult || "—"}</p>
            </section>
            <section>
              <h4 className="text-xs font-semibold text-ink-700">Actual result</h4>
              <p className="mt-1 text-sm text-ink-700">{report.actualResult || "—"}</p>
            </section>
          </div>

          {report.workaround.trim() ? (
            <section>
              <h4 className="text-xs font-semibold text-ink-700">Workaround</h4>
              <p className="mt-1 text-sm text-ink-700">{report.workaround}</p>
            </section>
          ) : null}

          {/* Evidence preview with export controls */}
          <section>
            <h4 className="text-xs font-semibold text-ink-700">
              Evidence ({report.evidence.filter((e) => e.includedInExport).length} of{" "}
              {report.evidence.length} included)
            </h4>
            {report.evidence.length === 0 ? (
              <p className="mt-1 text-xs text-ink-400">No evidence attached.</p>
            ) : (
              <ul className="mt-2 grid gap-2">
                {report.evidence.map((item, index) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-ink-100 px-3 py-2"
                  >
                    <span className="w-6 text-center font-mono text-xs text-ink-400">
                      {index + 1}
                    </span>
                    {getEvidenceUrl(item.id) ? (
                      <img
                        src={getEvidenceUrl(item.id)}
                        alt={`Thumbnail of ${item.name}`}
                        className="h-12 w-20 rounded border border-ink-200 object-cover"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-ink-800">{item.name}</p>
                      <p className="text-[11px] text-ink-400">
                        {item.width}×{item.height} · {formatBytes(item.sizeBytes)} ·{" "}
                        {item.annotations.filter((a) => a.tool === "rect" && a.redacted).length}{" "}
                        redaction(s)
                      </p>
                    </div>
                    <label className="flex items-center gap-1.5 text-[11px] text-ink-600">
                      <input
                        type="checkbox"
                        className="accent-accent-700"
                        checked={item.includedInExport}
                        onChange={(event) =>
                          dispatch({
                            type: "update-evidence",
                            id: item.id,
                            patch: { includedInExport: event.target.checked },
                          })
                        }
                        aria-label={`Include ${item.name} in exports`}
                      />
                      Include
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] text-ink-600">
                      Export as
                      <select
                        className="rounded-md border border-ink-200 bg-white px-1.5 py-1 text-[11px]"
                        value={item.exportVariant}
                        onChange={(event) =>
                          dispatch({
                            type: "update-evidence",
                            id: item.id,
                            patch: {
                              exportVariant: event.target.value as "annotated" | "original",
                            },
                          })
                        }
                        aria-label={`Export variant for ${item.name}`}
                      >
                        <option value="annotated">
                          annotated/redacted (flattened)
                        </option>
                        <option value="original">original pixels</option>
                      </select>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {report.consoleLog ? (
            <section>
              <h4 className="text-xs font-semibold text-ink-700">
                Console output — sanitized preview
              </h4>
              {report.consoleLog.includedInExport ? (
                <>
                  <pre className="mt-1 max-h-40 overflow-auto rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 font-mono text-[11px] whitespace-pre-wrap">
                    {consoleSanitized?.sanitized}
                  </pre>
                  <p className="mt-1 text-[11px] text-ink-500">
                    {consoleSanitized?.appliedCount ?? 0} redacted value(s) applied; exports contain
                    only this sanitized text — never the raw log.
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xs text-ink-400">
                  Console log imported but excluded from exports.
                </p>
              )}
            </section>
          ) : null}

          {report.har ? (
            <section>
              <h4 className="text-xs font-semibold text-ink-700">HAR capture</h4>
              <p className="mt-1 text-xs text-ink-600">
                {report.har.summary.entryCount} entries · {report.har.summary.hostnames.join(", ") || "no hosts"} ·{" "}
                {report.har.summary.failedCount} failed, {report.har.summary.clientErrorCount} 4xx,{" "}
                {report.har.summary.serverErrorCount} 5xx
              </p>
              <p className="mt-1 text-[11px] text-ink-500">
                {report.har.includedInExport && report.har.sanitizedReady
                  ? "A sanitized copy (headers, cookies, query tokens redacted; bodies omitted) will be included."
                  : "Summary only in exports — the raw HAR file is never attached."}
              </p>
            </section>
          ) : null}
        </CardBody>
      </Card>

      <div className="flex justify-between">
        <Link to="/diagnostics">
          <Button>← Back to diagnostics</Button>
        </Link>
        <Link to="/privacy">
          <Button>Privacy center →</Button>
        </Link>
      </div>

      <Dialog
        open={confirmAck}
        title="Acknowledge the privacy review?"
        description="Confirm you have reviewed every image, log, HAR copy and URL in this report, and that automated redaction is a helper — not a guarantee. Exports are your responsibility before sharing."
        confirmLabel="I have reviewed the report"
        onCancel={() => setConfirmAck(false)}
        onConfirm={acknowledge}
      />
    </div>
  );
}

function reportFolderNameSafe(report: { updatedAt: string }): string {
  // Folder name derives from today's date at export time; this preview is
  // informational only.
  const date = new Date(report.updatedAt || Date.now());
  return `bugsnap-report-${date.toISOString().slice(0, 10)}`;
}

export function ReviewPage() {
  return (
    <ErrorBoundary label="the review and export panel">
      <ReviewPageInner />
    </ErrorBoundary>
  );
}
