import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import {
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Link } from "@/app/router";
import { useReport } from "@/app/providers/ReportProvider";
import { useToast } from "@/components/feedback/Toast";
import { sanitizeUrl } from "@/lib/validation/sanitizeUrl";
import {
  FREQUENCY_LABELS,
  PRIORITY_LABELS,
  REGRESSION_LABELS,
  REPORT_TYPE_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
  type BugPriority,
  type BugSeverity,
  type BugReport,
  type ReportFrequency,
  type ReportStatus,
  type ReportType,
  type RegressionFlag,
} from "@/types/report";

const SEVERITY_TONES = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
  informational: "neutral",
} as const;

export function ReportBuilderPage() {
  const { report, dispatch } = useReport();
  const { showToast } = useToast();

  const [urlDraft, setUrlDraft] = useState(report.affectedUrl);
  const [labelsDraft, setLabelsDraft] = useState(report.labels.join(", "));

  const patch = (partial: Partial<BugReport>) => {
    dispatch({ type: "patch-report", patch: partial });
  };

  const handleUrlApply = () => {
    const draft = urlDraft.trim();
    if (!draft) {
      patch({ affectedUrl: "", includeAffectedUrl: false });
      return;
    }
    const result = sanitizeUrl(draft);
    if (!result) {
      showToast("That does not look like a valid URL — example: https://app.example.test/settings", "error");
      return;
    }
    const notices: string[] = [];
    if (result.removedCredentials) notices.push("login credentials removed");
    if (result.removedFragment) notices.push("fragment removed");
    if (result.redactedParamNames.length > 0)
      notices.push(`redacted values of: ${result.redactedParamNames.join(", ")}`);
    patch({ affectedUrl: result.sanitized, includeAffectedUrl: true });
    setUrlDraft(result.sanitized);
    showToast(
      notices.length > 0
        ? `URL sanitized: ${notices.join("; ")}`
        : "URL checked — nothing sensitive found by the automated rules",
      notices.length > 0 ? "success" : "info",
    );
  };

  const handleLabelsApply = () => {
    const labels = labelsDraft
      .split(",")
      .map((label) => label.trim())
      .filter(Boolean)
      .slice(0, 20);
    patch({ labels });
    showToast(`Labels saved (${labels.length})`, "success");
  };

  return (
    <div>
      <PageHeader
        title="Describe the issue"
        description="Required fields are marked. Everything you enter stays in this browser tab until you export or explicitly enable draft saving."
        actions={
          <Link to="/steps">
            <Button variant="primary">
              Next: Reproduction steps →
            </Button>
          </Link>
        }
      />

      <div className="grid gap-5">
        <Card>
          <CardHeader
            title="Summary"
            description="Lead with the observable behavior, not the guess at the cause."
          />
          <CardBody className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
              <TextField
                label="Title"
                required
                placeholder="Save button remains disabled after editing profile details"
                value={report.title}
                maxLength={200}
                onChange={(event) => patch({ title: event.target.value })}
                hint={`${report.title.trim().length}/200`}
              />
              <SelectField
                label="Report type"
                value={report.type}
                onChange={(event) => patch({ type: event.target.value as ReportType })}
              >
                {Object.entries(REPORT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
            </div>
            <TextAreaField
              label="Description"
              placeholder="What happened, where, and what makes it notable. Mention anything unusual about the data or state involved."
              value={report.description}
              rows={5}
              onChange={(event) => patch({ description: event.target.value })}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <SelectField
                  label="Severity"
                  value={report.severity}
                  onChange={(event) => patch({ severity: event.target.value as BugSeverity })}
                >
                  {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectField>
                <div className="mt-1.5">
                  <Badge tone={SEVERITY_TONES[report.severity]}>
                    {SEVERITY_LABELS[report.severity]}
                  </Badge>
                </div>
              </div>
              <SelectField
                label="Priority"
                value={report.priority}
                onChange={(event) => patch({ priority: event.target.value as BugPriority })}
              >
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Status"
                value={report.status}
                onChange={(event) => patch({ status: event.target.value as ReportStatus })}
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Results"
            description="A developer should be able to tell success from failure from these two fields alone."
          />
          <CardBody className="grid gap-4">
            <TextAreaField
              label="Expected result"
              required
              placeholder="Save becomes enabled and persists the updated display name."
              value={report.expectedResult}
              onChange={(event) => patch({ expectedResult: event.target.value })}
            />
            <TextAreaField
              label="Actual result"
              required
              placeholder="Save remains disabled even after a valid field change."
              value={report.actualResult}
              onChange={(event) => patch({ actualResult: event.target.value })}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField
                label="Frequency"
                value={report.frequency}
                onChange={(event) => patch({ frequency: event.target.value as ReportFrequency })}
              >
                {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Regression?"
                value={report.isRegression}
                onChange={(event) => patch({ isRegression: event.target.value as RegressionFlag })}
              >
                {Object.entries(REGRESSION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Affected area / component"
                placeholder="Profile settings form"
                value={report.affectedArea}
                onChange={(event) => patch({ affectedArea: event.target.value })}
              />
            </div>
            <TextAreaField
              label="Workaround"
              hint="If none exists, leave this empty"
              placeholder="Any temporary way to avoid the problem."
              value={report.workaround}
              rows={2}
              onChange={(event) => patch({ workaround: event.target.value })}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Context & assignment"
            description="Free-text fields only — BugSnap does not integrate with trackers."
          />
          <CardBody className="grid gap-4">
            <TextAreaField
              label="Preconditions"
              hint="One per line"
              placeholder={"Signed in with a standard (non-admin) account\nWorkspace has at least one shared note"}
              value={report.preconditions.join("\n")}
              rows={2}
              onChange={(event) =>
                patch({
                  preconditions: event.target.value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean),
                })
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Assignee"
                hint="free text, not an integration"
                placeholder="e.g. @sam-dev"
                value={report.assignee}
                onChange={(event) => patch({ assignee: event.target.value })}
              />
              <TextField
                label="Labels"
                hint="comma-separated, then press Apply"
                placeholder="forms, settings, safari"
                value={labelsDraft}
                onChange={(event) => setLabelsDraft(event.target.value)}
              />
            </div>
            {labelsDraft !== report.labels.join(", ") ? (
              <div>
                <Button size="sm" onClick={handleLabelsApply}>
                  Apply labels
                </Button>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Affected page URL"
            description="Opt-in. Query values that look sensitive (token, key, session…) are redacted automatically and the final value is shown here and in the review screen."
          />
          <CardBody className="grid gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <TextField
                label="URL"
                className="min-w-0 flex-1 basis-72"
                placeholder="https://app.example.test/settings/profile?tab=billing"
                value={urlDraft}
                onChange={(event) => setUrlDraft(event.target.value)}
                hint="nothing is stored until you apply"
              />
              <Button onClick={handleUrlApply}>Apply & sanitize</Button>
            </div>
            {report.affectedUrl ? (
              <div className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-ink-700">Will be exported as</span>
                  <label className="flex items-center gap-2 text-xs text-ink-600">
                    <input
                      type="checkbox"
                      checked={report.includeAffectedUrl}
                      onChange={(event) =>
                        patch({ includeAffectedUrl: event.target.checked })
                      }
                      className="accent-accent-700"
                    />
                    Include in exports
                  </label>
                </div>
                <p className="mt-1.5 break-all font-mono text-xs text-ink-800">
                  {report.affectedUrl}
                </p>
              </div>
            ) : (
              <p className="text-xs text-ink-500">
                No URL included. Exports stay URL-free unless you explicitly add and apply one.
              </p>
            )}
          </CardBody>
        </Card>

        <div className="flex justify-between">
          <Link to="/">
            <Button>← Overview</Button>
          </Link>
          <Link to="/steps">
            <Button variant="primary">Next: Reproduction steps →</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
