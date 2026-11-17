import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Link } from "@/app/router";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";

const FORMAT_ROWS: Array<[string, string, string]> = [
  ["Image evidence", "PNG, JPG/JPEG, WEBP", "Up to 20 MB each, 50 MP guard. Upload, drag-drop, paste or explicit screen capture."],
  ["Console text", "Pasted text, .txt, .log", "Up to 5 MB (larger is truncated with a warning). Parsed in a worker."],
  ["HTTP Archive", ".har", "Up to 20 MB and 50,000 entries. Summarised locally; raw file never attached to exports."],
  ["Exports", ".md, .json, .png, .zip", "Markdown, versioned JSON, flattened PNG evidence, ZIP bundle with README."],
];

const LIMITATIONS: Array<[string, string]> = [
  [
    "Automated redaction is a helper, not a guarantee",
    "The detectors are deterministic heuristics. They miss things and can mislabel things. Always review the sanitized preview and exported files.",
  ],
  [
    "Browser version / OS detection is approximate",
    "Browsers do not expose exact OS or always-true version strings. BugSnap labels these values as detected or browser-reported.",
  ],
  [
    "Screen capture needs permission and support",
    "getDisplayMedia requires a secure context (HTTPS/localhost) and a supporting browser. The browser's chooser decides what is shared; BugSnap reads one still frame and stops the stream immediately.",
  ],
  [
    "One tab's DevTools console is not reachable",
    "A web page cannot read another tab's console. Copy the output into BugSnap yourself — that is the honest limitation, not a bug.",
  ],
  [
    "Clipboard access can be denied",
    "Paste needs browser permission; the image import paths offer drag-drop and file-picker alternatives.",
  ],
  [
    "Drafts are unencrypted",
    "IndexedDB drafts (opt-in only) live in the browser profile. BugSnap does not encrypt them; use a trusted device.",
  ],
  [
    "No live tracker integrations",
    "GitHub/Jira/Linear outputs are clipboard templates. There is intentionally no OAuth, no API calls, no upload.",
  ],
];

const TROUBLESHOOTING: Array<[string, string]> = [
  ["An image fails to import", "Check the format (PNG/JPG/WEBP) and size (≤20 MB). Corrupt or unsupported files are rejected with a message; re-export from the source tool if needed."],
  ["Screen capture button says unsupported", "Use HTTPS or localhost, or update the browser. A manual OS screenshot + upload works everywhere."],
  ["Export buttons are disabled", "Complete the required fields listed in the amber banner on the Review & Export page (title, at least one step, expected and actual results)."],
  ["A draft won't restore", "The draft was saved by this browser profile; private/incognito profiles and cleared site data remove IndexedDB content."],
  ["Text looks garbled in an export", "Open the sanitized preview on the Diagnostics page — the export contains exactly what you see there."],
];

function HelpPageInner() {
  return (
    <div>
      <PageHeader
        title="Help"
        description="Supported inputs, honest limitations and troubleshooting for the BugSnap workflow."
        actions={
          <Link to="/privacy">
            <Button>Privacy model</Button>
          </Link>
        }
      />

      <Card className="mb-5">
        <CardHeader title="Supported formats" description="All processing happens in your browser." />
        <CardBody className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-ink-500">
              <tr>
                <th className="pb-2 pr-4 font-semibold">Input</th>
                <th className="pb-2 pr-4 font-semibold">Formats</th>
                <th className="pb-2 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {FORMAT_ROWS.map(([name, formats, notes]) => (
                <tr key={name} className="border-t border-ink-100">
                  <td className="py-2 pr-4 font-medium text-ink-800">{name}</td>
                  <td className="py-2 pr-4 font-mono text-ink-700">{formats}</td>
                  <td className="py-2 text-ink-500">{notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card className="mb-5">
        <CardHeader title="The workflow" description="Backwards and forwards without losing input." />
        <CardBody>
          <ol className="grid gap-2 text-sm text-ink-700">
            {[
              ["Overview", "Start a new report or load the clearly-labelled synthetic sample."],
              ["New Report", "Describe and classify the issue; affected URL is opt-in and sanitized."],
              ["Steps", "Ordered reproduction steps with observed results and prerequisites."],
              ["Evidence", "Capture/import screenshots and annotate them; redaction flattens opaque on export."],
              ["Environment", "Review each detected field; include only what you want."],
              ["Diagnostics", "Console text and HAR summaries with local redaction review."],
              ["Review & Export", "Acknowledge the privacy review, then export MD/JSON/PNG/ZIP or copy templates."],
            ].map(([step, detail], index) => (
              <li key={step} className="flex gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-700 text-[11px] font-bold text-white">
                  {index + 1}
                </span>
                <span>
                  <span className="font-semibold text-ink-900">{step}</span> — {detail}
                </span>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>

      <Card className="mb-5">
        <CardHeader
          title="Honest limitations"
          description="What BugSnap cannot do — stated plainly."
        />
        <CardBody className="grid gap-3">
          {LIMITATIONS.map(([title, detail]) => (
            <div key={title} className="rounded-lg border border-ink-100 px-3.5 py-2.5">
              <p className="text-sm font-semibold text-ink-900">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">{detail}</p>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Troubleshooting" description="Common situations and their fixes." />
        <CardBody className="grid gap-3">
          {TROUBLESHOOTING.map(([problem, fix]) => (
            <div key={problem} className="rounded-lg border border-ink-100 px-3.5 py-2.5">
              <p className="text-sm font-semibold text-ink-900">{problem}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">{fix}</p>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

export function HelpPage() {
  return (
    <ErrorBoundary label="the help page">
      <HelpPageInner />
    </ErrorBoundary>
  );
}
