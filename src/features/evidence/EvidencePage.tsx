import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/Feedback";
import { Link } from "@/app/router";
import { useReport } from "@/app/providers/ReportProvider";
import { useToast } from "@/components/feedback/Toast";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";
import { AnnotationStudio } from "@/features/annotation/AnnotationStudio";
import { checkImageFile } from "@/lib/files/fileValidation";
import { decodeImage } from "@/lib/images/decodeImage";
import { getEvidenceUrl, hasEvidenceBlob } from "@/lib/files/evidenceStore";
import {
  captureScreenStill,
  isScreenCaptureSupported,
} from "@/lib/browser/screenCapture";
import { formatBytes, cn } from "@/lib/utils";
import type { EvidenceSource } from "@/types/report";

const SOURCE_LABELS: Record<EvidenceSource, string> = {
  upload: "Uploaded",
  paste: "Pasted",
  drop: "Dragged",
  capture: "Captured",
  sample: "Sample",
};

function EvidenceCard({
  evidenceId,
  index,
  count,
  onAnnotate,
}: {
  evidenceId: string;
  index: number;
  count: number;
  onAnnotate: (id: string) => void;
}) {
  const { report, dispatch } = useReport();
  const { showToast } = useToast();
  const [previewOpen, setPreviewOpen] = useState(false);
  const item = report.evidence.find((e) => e.id === evidenceId);
  if (!item) return null;
  const url = getEvidenceUrl(item.id);
  const blobPresent = hasEvidenceBlob(item.id);

  return (
    <li className="rounded-xl border border-ink-200 bg-white shadow-panel">
      <div className="flex gap-4 px-4 py-3.5">
        <button
          type="button"
          className="h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-ink-200 bg-ink-50"
          onClick={() => setPreviewOpen(true)}
          aria-label={`Preview ${item.name}`}
        >
          {url ? (
            <img
              src={url}
              alt={`Thumbnail of ${item.name}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="text-xs text-ink-400">unavailable</span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-ink-900">
              {item.name}
            </span>
            <Badge tone="neutral">{SOURCE_LABELS[item.source]}</Badge>
            {item.annotations.length > 0 ? (
              <Badge tone="accent">{item.annotations.length} annotations</Badge>
            ) : null}
            {item.annotations.some((a) => a.tool === "rect" && a.redacted) ? (
              <Badge tone="critical">contains redaction</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-ink-500">
            {item.width} × {item.height} px · {formatBytes(item.sizeBytes)} ·{" "}
            {item.mimeType}
          </p>
          {!blobPresent ? (
            <p className="mt-1 text-xs font-medium text-red-700" role="alert">
              Image bytes are missing from memory — remove and re-import this item.
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-ink-600">
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
              />
              Include in exports
            </label>
            <Button
              size="sm"
              variant="ghost"
              disabled={index === 0}
              aria-label={`Move ${item.name} earlier in export order`}
              onClick={() => dispatch({ type: "move-evidence", id: item.id, direction: -1 })}
            >
              ↑ Earlier
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={index === count - 1}
              aria-label={`Move ${item.name} later in export order`}
              onClick={() => dispatch({ type: "move-evidence", id: item.id, direction: 1 })}
            >
              ↓ Later
            </Button>
            <Button
              size="sm"
              onClick={() => onAnnotate(item.id)}
              aria-label={`Annotate ${item.name}`}
            >
              Annotate
            </Button>
            <Button
              size="sm"
              variant="danger"
              aria-label={`Remove ${item.name}`}
              onClick={() => {
                dispatch({ type: "remove-evidence", id: item.id });
                showToast(`${item.name} removed`, "info");
              }}
            >
              Remove
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={previewOpen}
        title={item.name}
        size="lg"
        closeLabel="Close preview"
        onCancel={() => setPreviewOpen(false)}
      >
        {url ? (
          <div className="overflow-hidden rounded-lg border border-ink-200">
            <img
              src={url}
              alt={`Full preview of ${item.name}`}
              className="max-h-[60vh] w-full object-contain"
            />
          </div>
        ) : null}
        <p className="mt-3 text-xs text-ink-500">
          {item.width} × {item.height} px · {formatBytes(item.sizeBytes)} ·{" "}
          {item.mimeType} · source: {SOURCE_LABELS[item.source]}
        </p>
      </Dialog>
    </li>
  );
}

function EvidencePageInner() {
  const { report, addEvidence } = useReport();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [annotatingId, setAnnotatingId] = useState<string | null>(null);

  const captureSupported = isScreenCaptureSupported();

  const importFile = useCallback(
    async (file: File, source: EvidenceSource) => {
      const check = checkImageFile(file);
      if (!check.ok) {
        showToast(check.message, "error");
        return;
      }
      try {
        const dims = await decodeImage(file);
        addEvidence({
          blob: file,
          name: file.name,
          mimeType: check.mimeType,
          width: dims.width,
          height: dims.height,
          source,
        });
        showToast(`${file.name} added as evidence`, "success");
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : "Image could not be imported.",
          "error",
        );
      }
    },
    [addEvidence, showToast],
  );

  const importBlob = useCallback(
    async (blob: Blob, name: string, source: EvidenceSource) => {
      try {
        const dims = await decodeImage(blob);
        addEvidence({
          blob,
          name,
          mimeType: blob.type || "image/png",
          width: dims.width,
          height: dims.height,
          source,
        });
        showToast(`${name} added as evidence`, "success");
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : "Image could not be imported.",
          "error",
        );
      }
    },
    [addEvidence, showToast],
  );

  // Global paste handler for image clipboard content.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            const stamp = new Date()
              .toISOString()
              .replace(/[:T]/g, "-")
              .slice(0, 19);
            const ext = item.type === "image/jpeg" ? "jpg" : "png";
            void importBlob(file, `pasted-image-${stamp}.${ext}`, "paste");
            event.preventDefault();
            return;
          }
        }
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [importBlob]);

  const handleCapture = async () => {
    setCapturing(true);
    try {
      const outcome = await captureScreenStill();
      if (outcome.ok) {
        const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
        await importBlob(outcome.blob, `screen-capture-${stamp}.png`, "capture");
      } else {
        showToast(outcome.message, outcome.reason === "denied" ? "info" : "error");
      }
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Evidence"
        description="Add screenshots by upload, drag-and-drop, clipboard paste or explicit screen capture. Images stay in this browser tab and are only written to files when you export."
        actions={
          <Link to="/environment">
            <Button variant="primary">Next: Environment →</Button>
          </Link>
        }
      />

      <Card className="mb-5">
        <CardBody>
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
              dragActive
                ? "border-accent-500 bg-accent-50"
                : "border-ink-200 bg-ink-50/50",
            )}
            data-testid="evidence-dropzone"
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              const files = Array.from(event.dataTransfer.files).slice(0, 10);
              files.forEach((file) => void importFile(file, "drop"));
            }}
          >
            <p className="text-sm font-semibold text-ink-800">
              Drop screenshot files here
            </p>
            <p className="max-w-md text-xs leading-relaxed text-ink-500">
              PNG, JPG or WEBP up to 20 MB each. Multiple images are supported and can be
              reordered. Nothing is uploaded anywhere.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="primary"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose files…
              </Button>
              <Button
                onClick={handleCapture}
                disabled={capturing}
                title={
                  captureSupported
                    ? "Opens the browser's screen/window/tab chooser"
                    : "Screen capture is unavailable in this browser"
                }
              >
                {capturing ? "Capturing…" : "Capture screen"}
              </Button>
              <span className="text-xs text-ink-400">or paste from clipboard</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              multiple
              className="sr-only"
              aria-label="Choose evidence image files"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []).slice(0, 10);
                files.forEach((file) => void importFile(file, "upload"));
                event.target.value = "";
              }}
            />
          </div>

          <div className="mt-3 rounded-lg border border-ink-100 bg-white px-3.5 py-3 text-xs leading-relaxed text-ink-600">
            <span className="font-semibold text-ink-800">About screen capture:</span>{" "}
            {captureSupported ? (
              <>
                Clicking <strong>Capture screen</strong> opens your browser's chooser, where
                you explicitly pick a screen, window or tab and approve sharing. BugSnap reads
                a single still frame, then immediately stops the stream — no recording, no
                upload. If you deny or dismiss the chooser, nothing is captured.
              </>
            ) : (
              <>
                This browser does not offer screen capture (it requires a secure context and
                browser support). Use file upload, drag-and-drop or clipboard paste instead —
                a manual OS screenshot works just as well.
              </>
            )}
          </div>
        </CardBody>
      </Card>

      {report.evidence.length === 0 ? (
        <EmptyState
          icon={
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <path d="M4 8.5A2.5 2.5 0 016.5 6H9l2-2.5h4L17 6h2.5A2.5 2.5 0 0122 8.5v9a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 014 17.5v-9zm6 4.5a3 3 0 106 0 3 3 0 00-6 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          title="No evidence yet"
          description="Evidence images are first-class: annotate them, attach them to reproduction steps, and export the annotated PNGs."
        />
      ) : (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">
              Evidence ({report.evidence.length})
            </h2>
            <p className="text-xs text-ink-500">Export order: top to bottom</p>
          </div>
          <ol className="grid gap-3" aria-label="Evidence images in export order">
            {report.evidence.map((item, index) => (
              <EvidenceCard
                key={item.id}
                evidenceId={item.id}
                index={index}
                count={report.evidence.length}
                onAnnotate={setAnnotatingId}
              />
            ))}
          </ol>
        </div>
      )}

      <div className="mt-5 flex justify-between">
        <Link to="/steps">
          <Button>← Back to steps</Button>
        </Link>
        <Link to="/environment">
          <Button variant="primary">Next: Environment →</Button>
        </Link>
      </div>

      {annotatingId ? (
        <AnnotationStudio
          evidenceId={annotatingId}
          onClose={() => setAnnotatingId(null)}
        />
      ) : null}
    </div>
  );
}

export function EvidencePage() {
  return (
    <ErrorBoundary label="the evidence workspace">
      <EvidencePageInner />
    </ErrorBoundary>
  );
}
