import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Link } from "@/app/router";
import { useReport } from "@/app/providers/ReportProvider";
import { useToast } from "@/components/feedback/Toast";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";
import { captureEnvironmentSnapshot } from "@/lib/browser/environment";
import { formatTimestamp } from "@/lib/utils";
import type { BugReport, EnvironmentSelection, EnvironmentSnapshot } from "@/types/report";

interface EnvFieldMeta {
  key: keyof EnvironmentSelection;
  label: string;
  description: string;
  caveat?: "detected" | "browser-reported";
}

const FIELD_ORDER: Array<{ title: string; fields: EnvFieldMeta[] }> = [
  {
    title: "Browser & platform",
    fields: [
      {
        key: "browserName",
        label: "Browser name",
        description: "Parsed from the user-agent string by BugSnap.",
        caveat: "detected",
      },
      {
        key: "browserVersion",
        label: "Browser version",
        description: "Major version reported by the user agent; not always precise.",
        caveat: "browser-reported",
      },
      {
        key: "platform",
        label: "Platform / OS hint",
        description: "An operating system hint only — browsers do not expose the exact OS.",
        caveat: "browser-reported",
      },
      {
        key: "userAgent",
        label: "Full user-agent string",
        description: "The complete browser-reported string. Excluded unless you opt in — it can fingerprint your setup.",
        caveat: "browser-reported",
      },
    ],
  },
  {
    title: "Display & layout",
    fields: [
      { key: "viewport", label: "Viewport size", description: "Inner window size in CSS pixels at capture time." },
      { key: "screen", label: "Screen size", description: "Physical screen dimensions reported by the browser." },
      { key: "devicePixelRatio", label: "Device pixel ratio", description: "Screen scaling factor at capture time." },
      { key: "colorScheme", label: "Colour scheme", description: "Light or dark preference at capture time." },
    ],
  },
  {
    title: "Locale & session context",
    fields: [
      { key: "language", label: "Language / locale", description: "The browser's primary language tag." },
      { key: "timezone", label: "Timezone", description: "IANA timezone name from browser settings." },
      { key: "capturedAt", label: "Capture timestamp", description: "When the snapshot was taken. Always shown in exports for context." },
      { key: "online", label: "Online state", description: "Whether the browser reported being online at capture time." },
      { key: "reducedMotion", label: "Reduced motion preference", description: "The OS-level reduced-motion accessibility preference." },
      { key: "touchPoints", label: "Touch points", description: "Maximum simultaneous touch points the browser reports." },
    ],
  },
];

function EnvironmentPageInner() {
  const { report, dispatch } = useReport();
  const { showToast } = useToast();
  const [capturing, setCapturing] = useState(false);

  const patch = (partial: Partial<BugReport>) =>
    dispatch({ type: "patch-report", patch: partial });

  const handleCapture = async () => {
    setCapturing(true);
    try {
      const snapshot = captureEnvironmentSnapshot();
      dispatch({ type: "set-environment", snapshot });
      showToast("Environment snapshot captured — review each field before export", "success");
    } finally {
      setCapturing(false);
    }
  };

  const environment = report.environment;
  const selection = report.environmentSelection;

  const toggle = (key: keyof EnvironmentSelection) => {
    patch({
      environmentSelection: { ...selection, [key]: !selection[key] },
    });
  };

  const includedCount = Object.values(selection).filter(Boolean).length;

  return (
    <div>
      <PageHeader
        title="Environment details"
        description="Everything here is read locally from standard browser APIs. Uncertain values are labelled honestly. You choose exactly which fields appear in exports."
        actions={
          <Link to="/diagnostics">
            <Button variant="primary">Next: Diagnostics →</Button>
          </Link>
        }
      />

      <Card className="mb-5">
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          {environment ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">Captured</Badge>
              <span className="text-sm text-ink-700">
                {environment.browserName}
                {environment.browserVersion ? ` ${environment.browserVersion}` : ""} ·{" "}
                {formatTimestamp(environment.capturedAt)}
              </span>
            </div>
          ) : (
            <p className="text-sm text-ink-600">
              No snapshot yet. Capture one now, or leave environment details out of the report.
            </p>
          )}
          <Button variant="primary" onClick={handleCapture} disabled={capturing}>
            {environment ? "Recapture snapshot" : "Capture snapshot"}
          </Button>
        </CardBody>
      </Card>

      {environment ? (
        <div className="grid gap-5">
          {FIELD_ORDER.map((group) => (
            <Card key={group.title}>
              <CardHeader
                title={group.title}
                description={`${group.fields.filter((f) => selection[f.key]).length} of ${group.fields.length} fields included`}
              />
              <CardBody className="grid gap-3">
                {group.fields.map((field) => {
                  const value = envValue(environment, field.key);
                  const included = selection[field.key];
                  return (
                    <div
                      key={field.key}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-ink-100 px-3.5 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-ink-900">{field.label}</span>
                          {field.caveat === "detected" ? (
                            <Badge tone="neutral">detected</Badge>
                          ) : null}
                          {field.caveat === "browser-reported" ? (
                            <Badge tone="info">browser-reported</Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-ink-500">{field.description}</p>
                        <p className="mt-1.5 break-all font-mono text-xs text-ink-800">
                          {value ?? "— not exposed by this browser —"}
                        </p>
                      </div>
                      <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-ink-700">
                        <input
                          type="checkbox"
                          className="accent-accent-700"
                          checked={included}
                          onChange={() => toggle(field.key)}
                          aria-label={`Include ${field.label} in exports`}
                        />
                        Include
                      </label>
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          ))}

          <Card>
            <CardBody className="text-xs leading-relaxed text-ink-600">
              <span className="font-semibold text-ink-800">{includedCount} fields</span> will be
              included in exports. The capture timestamp is part of the report context; every
              other field, including the user-agent string, is opt-in. BugSnap never collects
              geolocation, device identifiers or browsing history.{" "}
              <Link to="/review" className="font-medium text-accent-700 underline underline-offset-2">
                The review screen shows exactly what an export will contain.
              </Link>
            </CardBody>
          </Card>
        </div>
      ) : null}

      <div className="mt-5 flex justify-between">
        <Link to="/evidence">
          <Button>← Back to evidence</Button>
        </Link>
        <Link to="/diagnostics">
          <Button variant="primary">Next: Diagnostics →</Button>
        </Link>
      </div>
    </div>
  );
}

function envValue(
  environment: EnvironmentSnapshot,
  key: keyof EnvironmentSelection,
): string | undefined {
  const env = environment;
  switch (key) {
    case "browserName":
      return env.browserName;
    case "browserVersion":
      return env.browserVersion;
    case "platform":
      return env.platform;
    case "userAgent":
      return env.userAgent;
    case "viewport":
      return env.viewportWidth !== undefined && env.viewportHeight !== undefined
        ? `${env.viewportWidth} × ${env.viewportHeight} CSS px`
        : undefined;
    case "screen":
      return env.screenWidth !== undefined && env.screenHeight !== undefined
        ? `${env.screenWidth} × ${env.screenHeight} px`
        : undefined;
    case "devicePixelRatio":
      return env.devicePixelRatio !== undefined ? `${env.devicePixelRatio}×` : undefined;
    case "language":
      return env.language;
    case "timezone":
      return env.timezone;
    case "capturedAt":
      return env.capturedAt;
    case "online":
      return env.online !== undefined ? (env.online ? "Online" : "Offline") : undefined;
    case "colorScheme":
      return env.colorScheme;
    case "reducedMotion":
      return env.reducedMotion !== undefined ? (env.reducedMotion ? "Reduced" : "No preference") : undefined;
    case "touchPoints":
      return env.touchPoints !== undefined ? `${env.touchPoints}` : undefined;
    default:
      return undefined;
  }
}

export function EnvironmentPage() {
  return (
    <ErrorBoundary label="the environment panel">
      <EnvironmentPageInner />
    </ErrorBoundary>
  );
}
