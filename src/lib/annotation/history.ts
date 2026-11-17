import type { Annotation } from "@/types/annotation";

/**
 * Undo/redo history for annotation edits. Immutable snapshots keep the
 * reducer trivially testable; snapshots hold only small JSON objects.
 */

export interface AnnotationHistory {
  past: Annotation[][];
  present: Annotation[];
  future: Annotation[][];
}

export function createHistory(initial: Annotation[] = []): AnnotationHistory {
  return { past: [], present: [...initial], future: [] };
}

/** Commit a completed change: collapses the redo stack. */
export function commitChange(
  history: AnnotationHistory,
  next: Annotation[],
): AnnotationHistory {
  return {
    past: [...history.past, history.present].slice(-100),
    present: [...next],
    future: [],
  };
}

export function undo(history: AnnotationHistory): AnnotationHistory {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: [...previous],
    future: [history.present, ...history.future],
  };
}

export function redo(history: AnnotationHistory): AnnotationHistory {
  if (history.future.length === 0) return history;
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, history.present],
    present: [...next],
    future: history.future.slice(1),
  };
}

export function canUndo(history: AnnotationHistory): boolean {
  return history.past.length > 0;
}

export function canRedo(history: AnnotationHistory): boolean {
  return history.future.length > 0;
}
