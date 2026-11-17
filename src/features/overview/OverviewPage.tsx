import { useState } from "react";
import { Link } from "@/app/router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useReport } from "@/app/providers/ReportProvider";
import { useToast } from "@/components/feedback/Toast";
import { buildSampleReport } from "@/lib/demo/sampleData";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";
import { computeCompleteness } from "@/lib/report/completeness";

const WORKFLOW: Array<{ title: string; detail: string }> = [
  { title: "1 · Describe & classify", detail: "Title, description, type, severity, priority." },
  { title: "2 · Reproduction steps", detail: "Ordered, editable steps with observed results." },
  { title: "3 · Evidence", detail: "Upload, paste, drop or capture screenshots, then annotate." },
  { title: "4 · Environment", detail: "Browser and device context — every field is opt-in." },
  { title: "5 · Diagnostics", detail: "Console text and HAR summaries, sanitized locally." },
  { title: "6 · Review & export", detail: "Preview the exact report, then export MD/JSON/PNG/ZIP." },
];

export function OverviewPage() {
  const { report, loadSample, resetReport } = useReport();
  const { showToast } = useToast();
  const [loadingSample, setLoadingSample] = useState(false);
  const completeness = computeCompleteness(report);
  const hasContent =
    report.title.trim().length > 0 ||
    report.steps.length > 0 ||
    report.evidence.length > 0;

  const handleLoadSample = async () => {
    setLoadingSample(true);
    try {
      const sample = await buildSampleReport();
      const blobs = new Map([[sample.evidenceId, sample.imageBlob]]);
      loadSample(sample.report, blobs);
      showToast("Synthetic sample report loaded — all data is fictional", "success");
    } catch {
      showToast("Could not generate the sample report in this browser", "error");
    } finally {
      setLoadingSample(false);
    }
  };

  return (
    <ErrorBoundary label="the overview">
      <PageHeader
        title="Overview"
        description="BugSnap turns screenshots, reproduction steps and diagnostics into clear, shareable bug reports — processed entirely in your browser."
      />

      <section className="mb-8 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-panel">
        <div className="flex flex-col gap-6 px-6 py-8 sm:px-10">
          <div className="max-w-2xl">
            <Badge tone="accent">Local-first · Private by default</Badge>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
              Capture it. Explain it. Ship the fix.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-600">
              A clearer bug report starts with better evidence. Build a structured, annotated,
              sanitized bug report without uploading a single byte to a BugSnap server — there
              isn't one.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/report">
              <Button variant="primary">Start a new report</Button>
            </Link>
            <Button onClick={handleLoadSample} disabled={loadingSample}>
              {loadingSample ? "Generating sample…" : "Load sample report"}
            </Button>
            {hasContent ? (
              <Button
                variant="danger"
                onClick={() => {
                  resetReport();
                  showToast("In-memory report cleared", "info");
                }}
              >
                Clear current report
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {hasContent ? (
        <section className="mb-8">
          <Card>
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink-900">Current report</p>
                <p className="mt-0.5 text-xs text-ink-500">
                  {report.title.trim() || "Untitled report"} ·{" "}
                  {Math.round(completeness.fraction * 100)}% complete
                </p>
              </div>
              <Link to="/report">
                <Button size="sm">Continue editing</Button>
              </Link>
            </CardBody>
          </Card>
        </section>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-ink-900">The workflow</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {WORKFLOW.map((stage) => (
            <Card key={stage.title}>
              <CardBody>
                <p className="text-sm font-semibold text-ink-900">{stage.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-500">{stage.detail}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <Card>
          <CardBody>
            <h2 className="text-sm font-semibold text-ink-900">Privacy in one paragraph</h2>
            <p className="mt-2 text-xs leading-relaxed text-ink-600">
              Your report, screenshots, logs and HAR data are processed in this browser tab and
              stay in memory unless you explicitly enable local draft saving or export files.
              BugSnap has no backend and no analytics. Screen capture only starts when you click
              it and approve it in your browser. Local drafts, if you enable them, are stored
              unencrypted in this browser profile. Automated redaction helps, but you must
              review every export before sharing it.{" "}
              <Link to="/privacy" className="font-medium text-accent-700 underline underline-offset-2">
                Read the full privacy model
              </Link>
              .
            </p>
          </CardBody>
        </Card>
      </section>
    </ErrorBoundary>
  );
}
