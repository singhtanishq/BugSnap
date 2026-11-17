import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/Feedback";
import { Link } from "@/app/router";
import { useReport } from "@/app/providers/ReportProvider";
import { useToast } from "@/components/feedback/Toast";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";
import { useDrafts } from "@/features/local-drafts/useDrafts";
import { formatBytes, formatTimestamp } from "@/lib/utils";

const STORAGE_TABLE: Array<{ what: string; where: string; detail: string }> = [
  {
    what: "Your report (title, steps, results, metadata)",
    where: "Memory (this tab)",
    detail: "Lost when you close or refresh the tab unless you enable drafts or export.",
  },
  {
    what: "Evidence image bytes",
    where: "Memory (this tab)",
    detail: "Held as Blobs with object URLs; revoked when removed. Never uploaded.",
  },
  {
    what: "Console log text and detected findings",
    where: "Memory (this tab)",
    detail: "Raw text and match values stay in memory; exports receive replacements only.",
  },
  {
    what: "Raw HAR file",
    where: "Memory (this tab)",
    detail: "Kept outside report state specifically so it cannot leak into exports or drafts.",
  },
  {
    what: "Saved drafts",
    where: "IndexedDB — only after you enable it",
    detail:
      "Drafts include the report, evidence images, logs and HAR so restore is complete. Not encrypted by BugSnap; anyone using this browser profile can read them.",
  },
  {
    what: "Exported files",
    where: "Your downloads folder",
    detail: "Written only when you click an export action. BugSnap has no server to receive them.",
  },
];

function PrivacyPageInner() {
  const { report, loadSample, resetReport } = useReport();
  const { showToast } = useToast();
  const draftApi = useDrafts();
  const { enabled, drafts, usage } = draftApi;

  const [enableConfirm, setEnableConfirm] = useState(false);
  const [disableConfirm, setDisableConfirm] = useState(false);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [clearMemoryConfirm, setClearMemoryConfirm] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handleSaveDraft = async () => {
    const { getEvidenceBlob } = await import("@/lib/files/evidenceStore");
    const blobs = new Map<string, Blob>();
    for (const item of report.evidence) {
      const blob = getEvidenceBlob(item.id);
      if (blob) blobs.set(item.id, blob);
    }
    const id = await draftApi.save(report, blobs);
    if (id) showToast("Draft saved to this browser (IndexedDB)", "success");
    else showToast("Draft saving is not enabled", "error");
  };

  const handleRestore = async (id: string) => {
    setRestoring(true);
    try {
      const loaded = await draftApi.restore(id);
      if (!loaded) {
        showToast("That draft could not be read.", "error");
        return;
      }
      loadSample(loaded.report, loaded.blobs);
      showToast(`Draft restored — "${loaded.report.title || "Untitled"}"`, "success");
    } finally {
      setRestoring(false);
    }
  };

  const handleEnable = async () => {
    setEnableConfirm(false);
    await draftApi.enable();
    showToast("Local draft saving enabled — drafts now persist in this browser profile", "success");
  };

  const handleDisable = async () => {
    setDisableConfirm(false);
    await draftApi.disable();
    showToast("Local draft saving disabled and all stored drafts deleted", "info");
  };

  const handleDeleteAll = async () => {
    setDeleteAllConfirm(false);
    const count = await draftApi.removeAll();
    showToast(count > 0 ? `${count} draft(s) deleted from IndexedDB` : "No drafts to delete", "info");
  };

  const handleClearMemory = () => {
    setClearMemoryConfirm(false);
    resetReport();
    showToast("In-memory report cleared — nothing was stored", "info");
  };

  return (
    <div>
      <PageHeader
        title="Privacy"
        description="BugSnap processes everything locally. This page documents exactly where data lives and gives you the controls."
        actions={
          <Link to="/help">
            <Button>Help & limitations</Button>
          </Link>
        }
      />

      <Card className="mb-5">
        <CardHeader title="Where your data lives" description="Precise, per-item storage map." />
        <CardBody className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-ink-500">
              <tr>
                <th className="pb-2 pr-4 font-semibold">Data</th>
                <th className="pb-2 pr-4 font-semibold">Location</th>
                <th className="pb-2 font-semibold">Behaviour</th>
              </tr>
            </thead>
            <tbody>
              {STORAGE_TABLE.map((row) => (
                <tr key={row.what} className="border-t border-ink-100">
                  <td className="py-2 pr-4 font-medium text-ink-800">{row.what}</td>
                  <td className="py-2 pr-4">
                    <Badge tone={row.where.includes("IndexedDB") ? "accent" : "neutral"}>
                      {row.where}
                    </Badge>
                  </td>
                  <td className="py-2 text-ink-500">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card className="mb-5">
        <CardHeader
          title="Local drafts (opt-in)"
          description={
            enabled === null
              ? "Checking storage…"
              : enabled
                ? "Draft saving is ON for this browser profile."
                : "Draft saving is OFF — nothing has ever been written to storage."
          }
          actions={
            enabled ? (
              <>
                <Button size="sm" onClick={handleSaveDraft}>
                  Save draft now
                </Button>
                <Button size="sm" variant="danger" onClick={() => setDisableConfirm(true)}>
                  Disable & delete drafts
                </Button>
              </>
            ) : (
              <Button size="sm" variant="primary" onClick={() => setEnableConfirm(true)}>
                Enable local draft saving
              </Button>
            )
          }
        />
        <CardBody className="grid gap-3">
          {enabled ? (
            <>
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-900">
                Drafts are stored unencrypted in this browser profile's IndexedDB. BugSnap does
                not encrypt them and cannot protect a shared or compromised device. Deleting
                browser site data removes them.
              </div>
              {usage ? (
                <p className="text-xs text-ink-500">
                  Origin storage in use: about {formatBytes(usage.usage)} of an estimated{" "}
                  {formatBytes(usage.quota)} quota (browser-reported estimate).
                </p>
              ) : (
                <p className="text-xs text-ink-400">
                  Storage usage estimate is not exposed by this browser.
                </p>
              )}
              {drafts.length === 0 ? (
                <EmptyState
                  title="No saved drafts yet"
                  description='Use "Save draft now" to store the current report, images, logs and HAR in IndexedDB.'
                />
              ) : (
                <ul className="grid gap-2" aria-label="Saved drafts">
                  {drafts.map((draft) => (
                    <li
                      key={draft.id}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-ink-100 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-800">{draft.title}</p>
                        <p className="text-[11px] text-ink-400">
                          Saved {formatTimestamp(draft.savedAt)} · {draft.evidenceCount} evidence
                          item(s)
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => void handleRestore(draft.id)}
                        disabled={restoring}
                        aria-label={`Restore draft ${draft.title}`}
                      >
                        {restoring ? "Restoring…" : "Restore"}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={async () => {
                          await draftApi.remove(draft.id);
                          showToast("Draft deleted", "info");
                        }}
                        aria-label={`Delete draft ${draft.title}`}
                      >
                        Delete
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div>
                <Button variant="danger" onClick={() => setDeleteAllConfirm(true)}>
                  Delete all local drafts
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-600">
              The default mode is memory-only: your report exists in this tab and disappears when
              it closes. Enable drafts only on a device you trust.
            </p>
          )}
        </CardBody>
      </Card>

      <Card className="mb-5">
        <CardHeader title="Clear data" description="Immediate actions, no network involved." />
        <CardBody className="flex flex-wrap gap-2">
          <Button variant="danger" onClick={() => setClearMemoryConfirm(true)}>
            Clear in-memory report
          </Button>
          {enabled ? (
            <Button variant="danger" onClick={() => setDeleteAllConfirm(true)}>
              Delete all local drafts
            </Button>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="grid gap-3 text-xs leading-relaxed text-ink-600">
          <p>
            <span className="font-semibold text-ink-900">No network transmission.</span> BugSnap
            makes no API calls, sends no analytics or telemetry, loads no remote fonts and never
            uploads report contents, images, logs or HAR data. An automated audit runs in CI to
            enforce this.
          </p>
          <p>
            <span className="font-semibold text-ink-900">Hosting caveat.</span> The static site is
            served by GitHub Pages. Like any web host, the hosting provider processes ordinary
            request logs (your IP address, requested URLs, timestamps) — BugSnap cannot see or
            change that. No report content is included in those requests beyond normal page loads.
          </p>
          <p>
            <span className="font-semibold text-ink-900">Your actions can still disclose data.</span>{" "}
            Anything you copy to the clipboard or share as an exported file is under your control —
            review before sharing.{" "}
            <Link to="/review" className="font-medium text-accent-700 underline underline-offset-2">
              The review screen
            </Link>{" "}
            shows exactly what an export contains.
          </p>
        </CardBody>
      </Card>

      <Dialog
        open={enableConfirm}
        title="Enable local draft saving?"
        description="Drafts (including evidence images, console logs and HAR content) will be stored unencrypted in this browser profile's IndexedDB so you can restore them later. Nothing is uploaded. You can disable and delete everything at any time."
        confirmLabel="Enable draft saving"
        onCancel={() => setEnableConfirm(false)}
        onConfirm={handleEnable}
      />
      <Dialog
        open={disableConfirm}
        title="Disable local draft saving?"
        description="All stored drafts will be deleted from IndexedDB, and nothing further will be written. The current in-memory report is untouched."
        confirmLabel="Disable & delete drafts"
        confirmVariant="danger"
        onCancel={() => setDisableConfirm(false)}
        onConfirm={handleDisable}
      />
      <Dialog
        open={deleteAllConfirm}
        title="Delete all local drafts?"
        description="Every saved draft in IndexedDB will be removed permanently. The current in-memory report is unaffected."
        confirmLabel="Delete all drafts"
        confirmVariant="danger"
        onCancel={() => setDeleteAllConfirm(false)}
        onConfirm={handleDeleteAll}
      />
      <Dialog
        open={clearMemoryConfirm}
        title="Clear the in-memory report?"
        description="The current report, evidence and diagnostics in this tab will be discarded. If draft saving is enabled, stored drafts are not affected."
        confirmLabel="Clear report"
        confirmVariant="danger"
        onCancel={() => setClearMemoryConfirm(false)}
        onConfirm={handleClearMemory}
      />
    </div>
  );
}

export function PrivacyPage() {
  return (
    <ErrorBoundary label="the privacy center">
      <PrivacyPageInner />
    </ErrorBoundary>
  );
}
