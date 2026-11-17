import { describe, expect, it } from "vitest";
import {
  canRedo,
  canUndo,
  commitChange,
  createHistory,
  redo,
  undo,
} from "@/lib/annotation/history";
import type { Annotation } from "@/types/annotation";

const a: Annotation = {
  id: "1",
  tool: "rect",
  x: 0,
  y: 0,
  w: 10,
  h: 10,
  color: "#000",
  strokeWidth: 2,
};
const b: Annotation = { ...a, id: "2" };

describe("annotation history", () => {
  it("commits changes and undoes them", () => {
    let history = createHistory([a]);
    history = commitChange(history, [a, b]);
    expect(history.present).toHaveLength(2);
    expect(canUndo(history)).toBe(true);
    history = undo(history);
    expect(history.present).toHaveLength(1);
    expect(canRedo(history)).toBe(true);
    history = redo(history);
    expect(history.present).toHaveLength(2);
  });

  it("collapses the redo stack on a new commit", () => {
    let history = createHistory([a]);
    history = commitChange(history, [a, b]);
    history = undo(history);
    history = commitChange(history, [b]);
    expect(canRedo(history)).toBe(false);
    expect(history.present).toEqual([b]);
    history = undo(history);
    expect(history.present).toEqual([a]);
  });

  it("is a no-op when undoing at the start or redoing at the end", () => {
    const history = createHistory([a]);
    expect(undo(history)).toBe(history);
    expect(redo(history)).toBe(history);
  });
});
