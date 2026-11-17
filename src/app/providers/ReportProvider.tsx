import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import type {
  BugReport,
  ConsoleLogState,
  EnvironmentSnapshot,
  EvidenceItem,
  EvidenceSource,
  HarImportState,
  ReproductionStep,
} from "@/types/report";
import { localId, nowIso } from "@/lib/utils";
import { createEmptyReport, renumberSteps } from "@/lib/report/reportFactory";
import { captureEnvironmentSnapshot } from "@/lib/browser/environment";
import {
  clearEvidenceBlobs,
  putEvidenceBlob,
  removeEvidenceBlob,
} from "@/lib/files/evidenceStore";

export const STEP_TEMPLATE = [
  "Open the affected page.",
  "Sign in or navigate to the relevant section (credentials omitted).",
  "Perform the action that triggers the issue.",
  "Observe the unexpected result.",
];

type Action =
  | { type: "patch-report"; patch: Partial<BugReport> }
  | { type: "add-step" }
  | { type: "update-step"; id: string; patch: Partial<Omit<ReproductionStep, "id" | "order">> }
  | { type: "remove-step"; id: string }
  | { type: "move-step"; id: string; direction: -1 | 1 }
  | { type: "duplicate-step"; id: string }
  | { type: "insert-template-steps" }
  | { type: "remove-steps" }
  | { type: "add-evidence"; item: EvidenceItem; blob: Blob }
  | { type: "update-evidence"; id: string; patch: Partial<EvidenceItem> }
  | { type: "remove-evidence"; id: string }
  | { type: "move-evidence"; id: string; direction: -1 | 1 }
  | { type: "set-console-log"; state: ConsoleLogState | null }
  | { type: "update-console-log"; patch: Partial<ConsoleLogState> }
  | { type: "set-har"; state: HarImportState | null }
  | { type: "update-har"; patch: Partial<HarImportState> }
  | { type: "set-environment"; snapshot: EnvironmentSnapshot }
  | { type: "replace-report"; report: BugReport; blobs: Map<string, Blob> }
  | { type: "reset-report" };

function touch(report: BugReport): BugReport {
  return { ...report, updatedAt: nowIso() };
}

function reducer(report: BugReport, action: Action): BugReport {
  switch (action.type) {
    case "patch-report":
      return touch({ ...report, ...action.patch });

    case "add-step":
      return touch({
        ...report,
        steps: renumberSteps([
          ...report.steps,
          {
            id: localId("step"),
            order: report.steps.length + 1,
            action: "",
            observedResult: "",
            isPrecondition: false,
            evidenceIds: [],
          },
        ]),
      });

    case "update-step":
      return touch({
        ...report,
        steps: report.steps.map((step) =>
          step.id === action.id ? { ...step, ...action.patch } : step,
        ),
      });

    case "remove-step":
      return touch({
        ...report,
        steps: renumberSteps(report.steps.filter((step) => step.id !== action.id)),
      });

    case "move-step": {
      const index = report.steps.findIndex((s) => s.id === action.id);
      const target = index + action.direction;
      if (index === -1 || target < 0 || target >= report.steps.length) return report;
      const steps = [...report.steps];
      const [moved] = steps.splice(index, 1);
      if (!moved) return report;
      steps.splice(target, 0, moved);
      return touch({ ...report, steps: renumberSteps(steps) });
    }

    case "duplicate-step": {
      const index = report.steps.findIndex((s) => s.id === action.id);
      if (index === -1) return report;
      const source = report.steps[index];
      if (!source) return report;
      const steps = [...report.steps];
      steps.splice(index + 1, 0, {
        ...source,
        id: localId("step"),
        evidenceIds: [...source.evidenceIds],
      });
      return touch({ ...report, steps: renumberSteps(steps) });
    }

    case "insert-template-steps":
      return touch({
        ...report,
        steps: renumberSteps([
          ...report.steps,
          ...STEP_TEMPLATE.map((action) => ({
            id: localId("step"),
            order: 0,
            action,
            observedResult: "",
            isPrecondition: false,
            evidenceIds: [],
          })),
        ]),
      });

    case "remove-steps":
      return touch({ ...report, steps: [] });

    case "add-evidence":
      return touch({
        ...report,
        evidence: [...report.evidence, action.item],
        steps: report.steps,
      });

    case "update-evidence":
      return touch({
        ...report,
        evidence: report.evidence.map((item) =>
          item.id === action.id ? { ...item, ...action.patch } : item,
        ),
      });

    case "remove-evidence":
      removeEvidenceBlob(action.id);
      return touch({
        ...report,
        evidence: report.evidence.filter((item) => item.id !== action.id),
        steps: renumberSteps(
          report.steps.map((step) => ({
            ...step,
            evidenceIds: step.evidenceIds.filter((id) => id !== action.id),
          })),
        ),
      });

    case "move-evidence": {
      const index = report.evidence.findIndex((e) => e.id === action.id);
      const target = index + action.direction;
      if (index === -1 || target < 0 || target >= report.evidence.length) return report;
      const evidence = [...report.evidence];
      const [moved] = evidence.splice(index, 1);
      if (!moved) return report;
      evidence.splice(target, 0, moved);
      return touch({ ...report, evidence });
    }

    case "set-console-log":
      return touch({ ...report, consoleLog: action.state });

    case "update-console-log":
      return touch({
        ...report,
        consoleLog: report.consoleLog
          ? { ...report.consoleLog, ...action.patch }
          : report.consoleLog,
      });

    case "set-har":
      return touch({ ...report, har: action.state });

    case "update-har":
      return touch({
        ...report,
        har: report.har ? { ...report.har, ...action.patch } : report.har,
      });

    case "set-environment":
      return touch({ ...report, environment: action.snapshot });

    case "replace-report": {
      clearEvidenceBlobs();
      for (const [id, blob] of action.blobs) {
        putEvidenceBlob(id, blob);
      }
      return action.report;
    }

    case "reset-report": {
      clearEvidenceBlobs();
      return createEmptyReport();
    }

    default:
      return report;
  }
}

export interface EvidenceInput {
  blob: Blob;
  name: string;
  mimeType: string;
  width: number;
  height: number;
  source: EvidenceSource;
}

export interface ReportContextValue {
  report: BugReport;
  dispatch: Dispatch<Action>;
  addEvidence: (input: EvidenceInput) => EvidenceItem;
  loadSample: (report: BugReport, blobs: Map<string, Blob>) => void;
  resetReport: () => void;
  captureEnvironment: () => EnvironmentSnapshot;
}

const ReportContext = createContext<ReportContextValue | null>(null);

export function ReportProvider({
  children,
  initialReport,
}: {
  children: ReactNode;
  initialReport?: BugReport;
}) {
  const [report, dispatch] = useReducer(
    reducer,
    undefined,
    () => initialReport ?? createEmptyReport(),
  );

  const value = useMemo<ReportContextValue>(() => {
    const addEvidence = (input: EvidenceInput): EvidenceItem => {
      const item: EvidenceItem = {
        id: localId("ev"),
        kind: "image",
        name: input.name,
        mimeType: input.mimeType,
        sizeBytes: input.blob.size,
        width: input.width,
        height: input.height,
        createdAt: nowIso(),
        source: input.source,
        includedInExport: true,
        exportVariant: "annotated",
        annotations: [],
      };
      // Blob bytes live in the side store, never in React state.
      putEvidenceBlob(item.id, input.blob);
      dispatch({ type: "add-evidence", item, blob: input.blob });
      return item;
    };

    return {
      report,
      dispatch,
      addEvidence,
      loadSample: (sampleReport, blobs) =>
        dispatch({ type: "replace-report", report: sampleReport, blobs }),
      resetReport: () => dispatch({ type: "reset-report" }),
      captureEnvironment: () => {
        const snapshot = captureEnvironmentSnapshot();
        dispatch({ type: "set-environment", snapshot });
        return snapshot;
      },
    };
  }, [report]);

  return <ReportContext.Provider value={value}>{children}</ReportContext.Provider>;
}

export function useReport(): ReportContextValue {
  const ctx = useContext(ReportContext);
  if (!ctx) throw new Error("useReport must be used inside ReportProvider");
  return ctx;
}

/** Convenience hook for read-only report access in lightweight components. */
export function useReportState(): BugReport {
  return useReport().report;
}
