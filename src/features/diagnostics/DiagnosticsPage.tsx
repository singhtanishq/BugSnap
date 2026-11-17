import { useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState, Spinner } from "@/components/ui/Feedback";
import { Dialog } from "@/components/ui/Dialog";
import { Link } from "@/app/router";
import { useReport } from "@/app/providers/ReportProvider";
import { useToast } from "@/components/feedback/Toast";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";
import {
  scanTextWithWorker,
  parseHarWithWorker,
  sanitizeHarWithWorker,
} from "@/lib/diagnostics/clients";
import { applyFindings } from "@/lib/redaction/apply";
import { LIMITS } from "@/lib/files/fileValidation";
import { deleteRawHar, getRawHar, setRawHar } from "@/lib/files/harRawStore";
import { readFileAsText } from "@/lib/files/readFile";
import { formatBytes, formatTimestamp, localId } from "@/lib/utils";
import {
  FINDING_CATEGORY_LABELS,
  type Finding,
} from "@/types/redaction";

const SEVERITY_TONES: Record<Finding["severity"], BadgeTone> = {
  high: "critical",
  medium: "medium",
  low: "low",
};

/** Compute a 1-based line/column from a character offset. */
function lineColFromOffset(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, offset);
  const lines = before.split("\n");
  const line = lines.length;
  const column = (lines[lines.length - 1]?.length ?? 0) + 1;
  return { line, column };
}

function ConsoleSection() {
  const { report, dispatch } = useReport();
  const { showToast } = useToast();
  const state = report.consoleLog;
  const scanSeq = useRef(0);
  const [pasteText, setPasteText] = useState("");
  const [scanning, setScanning] = useState(false);
  const [showSanitized, setShowSanitized] = useState(false);
  const consoleAreaRef = useRef<HTMLTextAreaElement>(null);

  const sanitized = useMemo(() => {
    if (!state) return { sanitized: "", appliedCount: 0 };
    return applyFindings(state.rawText, state.findings);
  }, [state]);

  const runScan = async (text: string) => {
    const token = ++scanSeq.current;
    setScanning(true);
    try {
      const result = await scanTextWithWorker(text);
      if (token !== scanSeq.current) return; // stale scan, ignore
      dispatch({
        type: "update-console-log",
        patch: { findings: result.findings, truncated: state?.truncated ?? false },
      });
      if (result.warnings.length > 0) {
        showToast(result.warnings[0] ?? "Scan finished with warnings", "info");
      } else {
        showToast(
          result.findings.length === 0
            ? "Automated scan finished — nothing recognised. Manual review is still required."
            : `Automated scan found ${result.findings.length} item(s) — review each one before exporting.`,
          result.findings.length === 0 ? "info" : "success",
        );
      }
    } finally {
      if (token === scanSeq.current) setScanning(false);
    }
  };

  const importText = async (text: string, name: string, byteSize: number) => {
    const truncated = byteSize > LIMITS.textMaxBytes;
    const effectiveText = truncated ? text.slice(0, LIMITS.textMaxBytes) : text;
    dispatch({
      type: "set-console-log",
      state: {
        id: localId("console"),
        name,
        rawText: effectiveText,
        byteSize,
        importedAt: new Date().toISOString(),
        truncated,
        findings: [],
        replacement: "[REDACTED]",
        includedInExport: true,
      },
    });
    setShowSanitized(false);
    if (truncated) {
      showToast(
        `"${name}" exceeds the 5 MB limit — it was truncated to 5 MB and only that part will be scanned or exported.`,
        "error",
      );
    }
    await runScan(effectiveText);
  };

  const handleFile = async (file: File) => {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".txt") && !lower.endsWith(".log")) {
      showToast("Use a .txt or .log file — other formats are not scanned.", "error");
      return;
    }
    if (file.size > LIMITS.textMaxBytes * 4) {
      showToast(
        `"${file.name}" is far larger than the 5 MB limit (${formatBytes(file.size)}) and was not imported.`,
        "error",
      );
      return;
    }
    let text: string;
    try {
      text = await readFileAsText(file);
    } catch {
      showToast(`"${file.name}" could not be read.`, "error");
      return;
    }
    await importText(text, file.name, file.size);
  };

  const redactSelection = () => {
    const area = consoleAreaRef.current;
    if (!state || !area) return;
    const start = area.selectionStart;
    const end = area.selectionEnd;
    if (start === end) {
      showToast("Select part of the console text first, then redact it.", "info");
      return;
    }
    const matchText = state.rawText.slice(start, end);
    const { line, column } = lineColFromOffset(state.rawText, start);
    const finding: Finding = {
      id: localId("finding"),
      category: "custom",
      severity: "high",
      confidence: "high",
      location: { line, column, length: matchText.length },
      maskedPreview: matchText.length <= 6 ? "•".repeat(matchText.length) : `${matchText.slice(0, 2)}…`,
      replacement: state.replacement || "[REDACTED]",
      ruleSource: "custom",
      manual: true,
      status: "redacted",
      matchText,
    };
    dispatch({
      type: "update-console-log",
      patch: { findings: [...state.findings, finding] },
    });
    showToast(`Selection redacted (line ${line}) — it will be replaced in exports`, "success");
  };

  const setFindingStatus = (id: string, status: Finding["status"]) => {
    if (!state) return;
    dispatch({
      type: "update-console-log",
      patch: {
        findings: state.findings.map((f) =>
          f.id === id ? { ...f, status: status === f.status ? "pending" : status } : f,
        ),
      },
    });
  };

  const redactedCount = state?.findings.filter((f) => f.status === "redacted").length ?? 0;

  return (
    <Card>
      <CardHeader
        title="Console output"
        description="Paste console text or import a .txt/.log file. Scanning is local and heuristic — review every line before sharing."
        actions={
          state ? (
            <label className="flex items-center gap-2 text-xs text-ink-600">
              <input
                type="checkbox"
                className="accent-accent-700"
                checked={state.includedInExport}
                onChange={(event) =>
                  dispatch({
                    type: "update-console-log",
                    patch: { includedInExport: event.target.checked },
                  })
                }
              />
              Include sanitized log in exports
            </label>
          ) : null
        }
      />
      <CardBody className="grid gap-4">
        {!state ? (
          <div className="grid gap-3">
            <textarea
              className="min-h-32 w-full rounded-lg border border-ink-200 px-3 py-2 font-mono text-xs"
              placeholder="Paste console output here… (timestamps and line breaks are preserved)"
              aria-label="Paste console output"
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                disabled={!pasteText.trim()}
                onClick={() =>
                  void importText(
                    pasteText,
                    `console-${new Date().toISOString().slice(0, 10)}.log`,
                    new TextEncoder().encode(pasteText).length,
                  )
                }
              >
                Import pasted text
              </Button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ink-200 bg-white px-3.5 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50">
                Choose .txt / .log file…
                <input
                  type="file"
                  accept=".txt,.log"
                  className="sr-only"
                  aria-label="Choose console log file"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleFile(file);
                    event.target.value = "";
                  }}
                />
              </label>
              <span className="text-xs text-ink-400">
                Up to 5 MB. BugSnap cannot read another tab's DevTools console — copy the text here yourself.
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">{state.name}</Badge>
              <span className="text-xs text-ink-500">
                {formatBytes(state.byteSize)} · imported {formatTimestamp(state.importedAt)} ·{" "}
                {state.findings.length} finding(s), {redactedCount} marked for redaction
              </span>
              {state.truncated ? <Badge tone="critical">truncated at 5 MB</Badge> : null}
              <Button
                size="sm"
                variant="danger"
                className="ml-auto"
                onClick={() => {
                  dispatch({ type: "set-console-log", state: null });
                  setPasteText("");
                  showToast("Console log removed", "info");
                }}
                aria-label="Remove console log"
              >
                Remove log
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-ink-200 p-0.5" role="group" aria-label="Console text view">
                <button
                  type="button"
                  aria-pressed={!showSanitized}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${!showSanitized ? "bg-accent-700 text-white" : "text-ink-600"}`}
                  onClick={() => setShowSanitized(false)}
                >
                  Original
                </button>
                <button
                  type="button"
                  aria-pressed={showSanitized}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${showSanitized ? "bg-accent-700 text-white" : "text-ink-600"}`}
                  onClick={() => setShowSanitized(true)}
                >
                  Sanitized preview
                </button>
              </div>
              {!showSanitized ? (
                <Button size="sm" onClick={redactSelection}>
                  Redact selected text
                </Button>
              ) : null}
              <label className="ml-auto flex items-center gap-1.5 text-xs text-ink-600">
                Replacement
                <input
                  type="text"
                  className="w-36 rounded-md border border-ink-200 px-2 py-1 font-mono text-xs"
                  value={state.replacement}
                  aria-label="Redaction replacement text"
                  onChange={(event) =>
                    dispatch({
                      type: "update-console-log",
                      patch: { replacement: event.target.value || "[REDACTED]" },
                    })
                  }
                />
              </label>
              {scanning ? <Spinner label="Scanning…" /> : null}
            </div>

            <textarea
              ref={consoleAreaRef}
              className="h-64 w-full overflow-auto rounded-lg border border-ink-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed"
              aria-label={showSanitized ? "Sanitized console text preview" : "Original console text"}
              readOnly={showSanitized}
              value={showSanitized ? sanitized.sanitized : state.rawText}
              onChange={() => {}}
            />

            {state.findings.length === 0 ? (
              <EmptyState
                title="No findings from the automated scan"
                description="Automated detection can miss sensitive information. Read the text and redact anything private by selecting it."
              />
            ) : (
              <div className="overflow-hidden rounded-lg border border-ink-200">
                <table className="w-full text-left text-xs">
                  <caption className="sr-only">
                    Sensitive-data findings with locations and actions
                  </caption>
                  <thead className="bg-ink-50 text-ink-600">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Category</th>
                      <th className="px-3 py-2 font-semibold">Line : Col</th>
                      <th className="px-3 py-2 font-semibold">Masked preview</th>
                      <th className="px-3 py-2 font-semibold">Confidence</th>
                      <th className="px-3 py-2 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.findings.map((finding) => (
                      <tr
                        key={finding.id}
                        className={`border-t border-ink-100 ${finding.status === "redacted" ? "bg-red-50/60" : finding.status === "ignored" ? "opacity-50" : ""}`}
                      >
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={SEVERITY_TONES[finding.severity]}>
                              {FINDING_CATEGORY_LABELS[finding.category]}
                            </Badge>
                            {finding.manual ? <Badge tone="accent">manual</Badge> : null}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono text-ink-700">
                          {finding.location.line}:{finding.location.column}
                        </td>
                        <td className="max-w-56 truncate px-3 py-2 font-mono text-ink-800">
                          {finding.maskedPreview}
                        </td>
                        <td className="px-3 py-2 text-ink-500">{finding.confidence}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              variant={finding.status === "redacted" ? "primary" : "secondary"}
                              onClick={() => setFindingStatus(finding.id, "redacted")}
                              aria-label={`Redact finding at line ${finding.location.line}`}
                            >
                              {finding.status === "redacted" ? "Will redact" : "Redact"}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => setFindingStatus(finding.id, "ignored")}
                              aria-label={`Ignore finding at line ${finding.location.line}`}
                            >
                              {finding.status === "ignored" ? "Ignored" : "Ignore"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-xs leading-relaxed text-ink-500">
              BugSnap found the items shown above. Automated detection can miss sensitive
              information. Review every line, then verify the{" "}
              <span className="font-medium text-ink-700">sanitized preview</span> before exporting
              — exports contain the sanitized text only.
            </p>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function HarSection() {
  const { report, dispatch } = useReport();
  const { showToast } = useToast();
  const har = report.har;
  const harSeq = useRef(0);
  const [parsing, setParsing] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [confirmPrepare, setConfirmPrepare] = useState(false);
  const [showSanitizedCopy, setShowSanitizedCopy] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".har")) {
      showToast("Use a .har file exported from your browser's network panel.", "error");
      return;
    }
    if (file.size > LIMITS.harMaxBytes) {
      showToast(
        `"${file.name}" exceeds the 20 MB limit (${formatBytes(file.size)}) and was not imported.`,
        "error",
      );
      return;
    }
    const token = ++harSeq.current;
    setParsing(true);
    try {
      const raw = await readFileAsText(file);
      const result = await parseHarWithWorker(raw);
      if (token !== harSeq.current) return;
      if (!result.ok || !result.summary) {
        showToast(result.message ?? "The HAR file could not be parsed.", "error");
        return;
      }
      const id = localId("har");
      // Raw text lives in the memory-only store, never in report state.
      setRawHar(id, raw);
      dispatch({
        type: "set-har",
        state: {
          id,
          name: file.name,
          importedAt: new Date().toISOString(),
          entryCount: result.summary.entryCount,
          truncated: result.truncated,
          summary: result.summary,
          sanitizedReady: false,
          sanitizedHarJson: null,
          redactionCounts: null,
          includedInExport: false,
        },
      });
      showToast(`HAR parsed: ${result.summary.entryCount} entries — raw file stays in memory only`, "success");
    } finally {
      if (token === harSeq.current) setParsing(false);
    }
  };

  const prepareSanitized = async () => {
    if (!har) return;
    setPreparing(true);
    setConfirmPrepare(false);
    try {
      const token = ++harSeq.current;
      const raw = getRawHar(har.id);
      if (!raw) {
        showToast("The raw HAR is no longer in memory — re-import the file to sanitise it.", "error");
        return;
      }
      const result = await sanitizeHarWithWorker(raw);
      if (token !== harSeq.current) return;
      if (!result.ok || !result.sanitizedHarJson) {
        showToast(result.message ?? "Sanitising failed.", "error");
        return;
      }
      dispatch({
        type: "update-har",
        patch: {
          sanitizedReady: true,
          sanitizedHarJson: result.sanitizedHarJson,
          redactionCounts: result.counts ?? null,
        },
      });
      setShowSanitizedCopy(true);
      const counts = result.counts;
      showToast(
        counts
          ? `Sanitized copy ready — ${counts.total} value(s) replaced (headers: ${counts.headers}, cookies: ${counts.cookies}, query: ${counts.queryParams}, bodies: ${counts.bodies}). Manual review required.`
          : "Sanitized copy ready — manual review required.",
        "success",
      );
    } finally {
      setPreparing(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="HAR diagnostics"
        description="Optional. Import a browser-exported HTTP Archive (.har) for a request summary. HAR files routinely contain session cookies and tokens — treat the entire file as sensitive."
        actions={
          har ? (
            <label className="flex items-center gap-2 text-xs text-ink-600">
              <input
                type="checkbox"
                className="accent-accent-700"
                checked={har.includedInExport}
                disabled={!har.sanitizedReady}
                onChange={(event) =>
                  dispatch({
                    type: "update-har",
                    patch: { includedInExport: event.target.checked },
                  })
                }
              />
              Include sanitized HAR in exports
            </label>
          ) : null
        }
      />
      <CardBody className="grid gap-4">
        {!har ? (
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ink-200 bg-white px-3.5 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50">
              {parsing ? "Parsing…" : "Choose .har file…"}
              <input
                type="file"
                accept=".har,application/json"
                className="sr-only"
                aria-label="Choose HAR file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFile(file);
                  event.target.value = "";
                }}
              />
            </label>
            {parsing ? <Spinner label="Parsing HAR in a worker…" /> : null}
            <span className="text-xs text-ink-400">
              Up to 20 MB / 50,000 entries. The raw file is never attached to exports.
            </span>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">{har.name}</Badge>
              <span className="text-xs text-ink-500">
                {har.entryCount} entries · imported {formatTimestamp(har.importedAt)}
              </span>
              {har.truncated ? <Badge tone="critical">entry cap reached</Badge> : null}
              {har.sanitizedReady ? (
                <Badge tone="accent">sanitized copy ready</Badge>
              ) : (
                <Badge tone="neutral">not sanitized yet — raw cannot be exported</Badge>
              )}
              <Button
                size="sm"
                variant="danger"
                className="ml-auto"
                onClick={() => {
                  deleteRawHar(har.id);
                  dispatch({ type: "set-har", state: null });
                  setShowSanitizedCopy(false);
                  showToast("HAR removed", "info");
                }}
                aria-label="Remove HAR"
              >
                Remove HAR
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              {[
                { label: "Entries", value: String(har.summary.entryCount) },
                { label: "Failed", value: String(har.summary.failedCount) },
                { label: "4xx", value: String(har.summary.clientErrorCount) },
                { label: "5xx", value: String(har.summary.serverErrorCount) },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border border-ink-100 px-3 py-2">
                  <p className="text-[11px] text-ink-400">{stat.label}</p>
                  <p className="text-lg font-semibold text-ink-900">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-2 text-xs text-ink-600">
              <p>
                <span className="font-semibold text-ink-800">Hostnames:</span>{" "}
                {har.summary.hostnames.join(", ") || "—"}
              </p>
              <p>
                <span className="font-semibold text-ink-800">Methods:</span>{" "}
                {Object.entries(har.summary.methodCounts)
                  .map(([m, c]) => `${m} × ${c}`)
                  .join(" · ")}{" "}
                — <span className="font-semibold text-ink-800">Total duration:</span>{" "}
                {har.summary.totalDurationMs ?? "—"} ms —{" "}
                <span className="font-semibold text-ink-800">Response bytes:</span>{" "}
                {formatBytes(har.summary.totalResponseBytes ?? 0)}
              </p>
              <ul className="list-disc pl-5">
                {har.summary.observations.map((observation) => (
                  <li key={observation}>{observation}</li>
                ))}
              </ul>
            </div>

            {har.summary.parseWarnings.length > 0 ? (
              <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {har.summary.parseWarnings.join(" ")}
              </div>
            ) : null}

            <details className="rounded-lg border border-ink-200">
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-ink-700">
                Request list ({har.summary.entries.length})
              </summary>
              <div className="max-h-56 overflow-auto border-t border-ink-100">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-ink-50 text-ink-600">
                    <tr>
                      <th className="px-3 py-1.5">Method</th>
                      <th className="px-3 py-1.5">Status</th>
                      <th className="px-3 py-1.5">Host + path</th>
                      <th className="px-3 py-1.5">Size</th>
                      <th className="px-3 py-1.5">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {har.summary.entries.map((entry, index) => (
                      <tr
                        key={`${entry.host}-${index}`}
                        className={`border-t border-ink-100 ${entry.failed ? "bg-red-50/60" : ""}`}
                      >
                        <td className="px-3 py-1 font-mono">{entry.method}</td>
                        <td className="px-3 py-1 font-mono">
                          {entry.status === 0 ? "failed" : entry.status}
                        </td>
                        <td className="max-w-80 truncate px-3 py-1 font-mono" title={`${entry.host}${entry.path}`}>
                          {entry.host}
                          {entry.path}
                        </td>
                        <td className="px-3 py-1">{entry.responseSize !== undefined ? formatBytes(entry.responseSize) : "—"}</td>
                        <td className="px-3 py-1">{entry.timeMs !== undefined ? `${entry.timeMs} ms` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            <div className="rounded-lg border border-ink-200 bg-ink-50 px-3.5 py-3 text-xs leading-relaxed text-ink-600">
              <span className="font-semibold text-ink-800">Sanitized export:</span> the sanitized
              copy replaces authorization and cookie headers, API-key-like headers, sensitive query
              values, and drops request/response bodies entirely.{" "}
              <span className="font-medium text-ink-800">Automated redaction cannot guarantee
              every secret is removed — open the sanitized copy below and check it yourself.</span>
              {!har.sanitizedReady ? (
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setConfirmPrepare(true)}
                    disabled={preparing}
                  >
                    {preparing ? "Preparing…" : "Prepare sanitized HAR copy"}
                  </Button>
                </div>
              ) : null}
            </div>

            {har.sanitizedReady && har.redactionCounts ? (
              <div className="grid gap-2">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="accent">headers: {har.redactionCounts.headers}</Badge>
                  <Badge tone="accent">cookies: {har.redactionCounts.cookies}</Badge>
                  <Badge tone="accent">query params: {har.redactionCounts.queryParams}</Badge>
                  <Badge tone="accent">bodies omitted: {har.redactionCounts.bodies}</Badge>
                  <Button
                    size="sm"
                    onClick={() => setShowSanitizedCopy((v) => !v)}
                    aria-expanded={showSanitizedCopy}
                  >
                    {showSanitizedCopy ? "Hide sanitized copy" : "Review sanitized copy"}
                  </Button>
                </div>
                {showSanitizedCopy && har.sanitizedHarJson ? (
                  <pre className="max-h-64 overflow-auto rounded-lg border border-ink-200 bg-white px-3 py-2 font-mono text-[11px] leading-relaxed">
                    {har.sanitizedHarJson.slice(0, 40_000)}
                    {har.sanitizedHarJson.length > 40_000 ? "\n… (preview truncated; the export contains the full sanitized copy)" : ""}
                  </pre>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </CardBody>

      <Dialog
        open={confirmPrepare}
        title="Prepare a sanitized HAR copy?"
        description="BugSnap will replace auth/cookie headers, API-key-like headers, sensitive query values and omit all bodies. This is best-effort: automated redaction cannot guarantee every secret is found, so you must review the sanitized copy before including it."
        confirmLabel="Prepare sanitized copy"
        onCancel={() => setConfirmPrepare(false)}
        onConfirm={() => void prepareSanitized()}
      />
    </Card>
  );
}

function DiagnosticsPageInner() {
  return (
    <div>
      <PageHeader
        title="Diagnostics"
        description="Attach console output and an HAR summary. Both are parsed and sanitized locally; exports contain only what you explicitly include after review."
        actions={
          <Link to="/review">
            <Button variant="primary">Next: Review & Export →</Button>
          </Link>
        }
      />
      <div className="grid gap-5">
        <ConsoleSection />
        <HarSection />
      </div>
      <div className="mt-5 flex justify-between">
        <Link to="/environment">
          <Button>← Back to environment</Button>
        </Link>
        <Link to="/review">
          <Button variant="primary">Next: Review & Export →</Button>
        </Link>
      </div>
    </div>
  );
}

export function DiagnosticsPage() {
  return (
    <ErrorBoundary label="the diagnostics panel">
      <DiagnosticsPageInner />
    </ErrorBoundary>
  );
}
