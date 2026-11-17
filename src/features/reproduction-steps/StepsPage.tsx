import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { TextAreaField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/Feedback";
import { Link } from "@/app/router";
import { useReport, STEP_TEMPLATE } from "@/app/providers/ReportProvider";
import { useToast } from "@/components/feedback/Toast";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";
import { cn } from "@/lib/utils";

function StepCard({ stepId }: { stepId: string }) {
  const { report, dispatch } = useReport();
  const { showToast } = useToast();
  const step = report.steps.find((s) => s.id === stepId);
  if (!step) return null;

  const attachedEvidence = report.evidence.filter((item) =>
    step.evidenceIds.includes(item.id),
  );
  const unattachedEvidence = report.evidence.filter(
    (item) => !step.evidenceIds.includes(item.id),
  );

  const isFirst = report.steps[0]?.id === stepId;
  const isLast = report.steps[report.steps.length - 1]?.id === stepId;

  return (
    <li
      className={cn(
        "rounded-xl border bg-white shadow-panel",
        step.isPrecondition ? "border-indigo-300" : "border-ink-200",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent-700 text-xs font-bold text-white"
          >
            {step.order}
          </span>
          <span className="sr-only">Step {step.order}</span>
          {step.isPrecondition ? (
            <Badge tone="info">Prerequisite</Badge>
          ) : null}
          {attachedEvidence.length > 0 ? (
            <Badge tone="accent">
              {attachedEvidence.length} evidence attached
            </Badge>
          ) : null}
        </div>
        <div
          className="flex items-center gap-1"
          role="group"
          aria-label={`Actions for step ${step.order}`}
        >
          <Button
            size="sm"
            variant="ghost"
            disabled={isFirst}
            aria-label={`Move step ${step.order} up`}
            onClick={() => dispatch({ type: "move-step", id: stepId, direction: -1 })}
          >
            ↑
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={isLast}
            aria-label={`Move step ${step.order} down`}
            onClick={() => dispatch({ type: "move-step", id: stepId, direction: 1 })}
          >
            ↓
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Duplicate step ${step.order}`}
            onClick={() => {
              dispatch({ type: "duplicate-step", id: stepId });
              showToast("Step duplicated", "success");
            }}
          >
            Duplicate
          </Button>
          <Button
            size="sm"
            variant="danger"
            aria-label={`Delete step ${step.order}`}
            onClick={() => {
              dispatch({ type: "remove-step", id: stepId });
              showToast(`Step ${step.order} deleted`, "info");
            }}
          >
            Delete
          </Button>
        </div>
      </div>
      <CardBody className="grid gap-3">
        <TextAreaField
          label={`Step ${step.order} action`}
          required
          autoResize
          rows={2}
          placeholder="Open the affected page."
          value={step.action}
          onChange={(event) =>
            dispatch({
              type: "update-step",
              id: stepId,
              patch: { action: event.target.value },
            })
          }
        />
        <TextAreaField
          label="Observed result at this step"
          autoResize
          rows={2}
          placeholder="What you actually saw at this point."
          value={step.observedResult ?? ""}
          onChange={(event) =>
            dispatch({
              type: "update-step",
              id: stepId,
              patch: { observedResult: event.target.value },
            })
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              className="accent-accent-700"
              checked={step.isPrecondition}
              onChange={(event) =>
                dispatch({
                  type: "update-step",
                  id: stepId,
                  patch: { isPrecondition: event.target.checked },
                })
              }
            />
            This step is a prerequisite (state to set up before the repro)
          </label>
          <span className="text-xs text-ink-400">
            Numbers re-order automatically
          </span>
        </div>
        {report.evidence.length > 0 ? (
          <fieldset className="rounded-lg border border-ink-100 px-3 py-2.5">
            <legend className="px-1 text-xs font-semibold text-ink-600">
              Evidence attached to this step
            </legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {attachedEvidence.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-2.5 py-1 text-xs text-accent-800"
                >
                  {item.name}
                  <button
                    type="button"
                    className="text-accent-700 hover:text-accent-900"
                    aria-label={`Detach ${item.name} from step ${step.order}`}
                    onClick={() =>
                      dispatch({
                        type: "update-step",
                        id: stepId,
                        patch: {
                          evidenceIds: step.evidenceIds.filter((id) => id !== item.id),
                        },
                      })
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
              {unattachedEvidence.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-ink-300 px-2.5 py-1 text-xs text-ink-500 hover:border-accent-400 hover:text-accent-700"
                  aria-label={`Attach ${item.name} to step ${step.order}`}
                  onClick={() =>
                    dispatch({
                      type: "update-step",
                      id: stepId,
                      patch: { evidenceIds: [...step.evidenceIds, item.id] },
                    })
                  }
                >
                  + {item.name}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}
      </CardBody>
    </li>
  );
}

function StepsPageInner() {
  const { report, dispatch } = useReport();
  const { showToast } = useToast();
  const [confirmClear, setConfirmClear] = useState(false);
  const templateInserted =
    report.steps.length > 0 &&
    STEP_TEMPLATE.every((templateAction) =>
      report.steps.some((step) => step.action === templateAction),
    );

  return (
    <div>
      <PageHeader
        title="Reproduction steps"
        description="Write steps a teammate can follow exactly. Never invent steps — the template below inserts clearly editable placeholders."
        actions={
          <Link to="/evidence">
            <Button variant="primary">Next: Evidence →</Button>
          </Link>
        }
      />

      <Card className="mb-5">
        <CardBody className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            onClick={() => {
              dispatch({ type: "add-step" });
              showToast("Step added", "success");
            }}
          >
            + Add step
          </Button>
          <Button
            disabled={templateInserted}
            onClick={() => {
              dispatch({ type: "insert-template-steps" });
              showToast("Template steps inserted — edit them to match what actually happened", "info");
            }}
          >
            Insert quick template
          </Button>
          <Button
            variant="danger"
            disabled={report.steps.length === 0}
            onClick={() => setConfirmClear(true)}
          >
            Clear all steps
          </Button>
          <p className="ml-auto max-w-xs text-xs text-ink-400">
            Suggested format: open the page → navigate (credentials omitted) → trigger → observe.
          </p>
        </CardBody>
      </Card>

      {report.steps.length === 0 ? (
        <EmptyState
          icon={
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <path d="M4 6h6M4 12h6M4 18h6m4-13l3-2 3 2v4l-3 2-3-2V5zm0 11l3-2 3 2v4l-3 2-3-2v-4z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          title="No reproduction steps yet"
          description="Add steps manually or insert the quick template. A report needs at least one step with an action before it can be exported."
        />
      ) : (
        <ol className="grid gap-3" aria-label="Reproduction steps">
          {report.steps.map((step) => (
            <StepCard key={step.id} stepId={step.id} />
          ))}
        </ol>
      )}

      <div className="mt-5 flex justify-between">
        <Link to="/report">
          <Button>← Back to description</Button>
        </Link>
        <Link to="/evidence">
          <Button variant="primary">Next: Evidence →</Button>
        </Link>
      </div>

      <Dialog
        open={confirmClear}
        title="Clear all reproduction steps?"
        description="This removes every step from the current in-memory report. This cannot be undone."
        confirmLabel="Clear all steps"
        confirmVariant="danger"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          dispatch({ type: "remove-steps" });
          setConfirmClear(false);
          showToast("All steps cleared", "info");
        }}
      />
    </div>
  );
}

export function StepsPage() {
  return (
    <ErrorBoundary label="the reproduction steps editor">
      <StepsPageInner />
    </ErrorBoundary>
  );
}
