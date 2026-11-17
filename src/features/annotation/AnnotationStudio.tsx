import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Annotation, AnnotationTool } from "@/types/annotation";
import { useReport } from "@/app/providers/ReportProvider";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Spinner } from "@/components/ui/Feedback";
import { useToast } from "@/components/feedback/Toast";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";
import { getEvidenceBlob } from "@/lib/files/evidenceStore";
import { createDrawableSource } from "@/lib/images/decodeImage";
import {
  annotationBounds,
  clampZoom,
  computeFitScale,
  hitTestAnnotation,
  moveAnnotation,
  nextMarkerNumber,
  resizeRectLike,
  toImageCoords,
  zoomAroundPoint,
  type EditorView,
} from "@/lib/annotation/geometry";
import {
  canRedo,
  canUndo,
  commitChange,
  createHistory,
  redo,
  undo,
  type AnnotationHistory,
} from "@/lib/annotation/history";
import { drawAnnotations } from "@/lib/annotation/render";
import { cn, localId } from "@/lib/utils";

const TOOL_LABELS: Array<{ tool: AnnotationTool; label: string; hint: string }> = [
  { tool: "select", label: "Select", hint: "Select and move annotations (V)" },
  { tool: "arrow", label: "Arrow", hint: "Pointer arrow (A)" },
  { tool: "rect", label: "Rect", hint: "Rectangle outline (R)" },
  { tool: "ellipse", label: "Ellipse", hint: "Ellipse outline (E)" },
  { tool: "pen", label: "Pen", hint: "Freehand pen (P)" },
  { tool: "text", label: "Text", hint: "Text label (T)" },
  { tool: "marker", label: "Marker", hint: "Numbered step marker (M)" },
  { tool: "redaction", label: "Redact", hint: "Opaque redaction rectangle (X)" },
  { tool: "pan", label: "Pan", hint: "Pan the view (H, or hold Space)" },
];

const COLORS = [
  { value: "#dc2626", label: "Red" },
  { value: "#0d9488", label: "Teal" },
  { value: "#d97706", label: "Amber" },
  { value: "#4f46e5", label: "Indigo" },
  { value: "#101a2e", label: "Ink" },
];

const STROKE_WIDTHS = [2, 4, 6, 8];

type DrawableTool = "arrow" | "rect" | "ellipse" | "redaction";

type DragState =
  | { kind: "none" }
  | { kind: "draw"; startImage: { x: number; y: number }; tool: DrawableTool }
  | { kind: "pen" }
  | {
      kind: "move";
      id: string;
      lastImage: { x: number; y: number };
      original: Annotation;
      originals: Annotation[];
    }
  | {
      kind: "resize";
      id: string;
      corner: "nw" | "ne" | "sw" | "se";
      original: Annotation & { tool: "rect" | "ellipse" };
      originals: Annotation[];
    }
  | { kind: "pan"; startClient: { x: number; y: number }; startView: EditorView };

function StudioInner({ evidenceId, onClose }: { evidenceId: string; onClose: () => void }) {
  const { report, dispatch } = useReport();
  const { showToast } = useToast();

  const item = report.evidence.find((e) => e.id === evidenceId);
  const blob = item ? getEvidenceBlob(item.id) : undefined;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<ImageBitmap | HTMLImageElement | null>(null);

  const [history, setHistory] = useState<AnnotationHistory>(() =>
    createHistory(item?.annotations ?? []),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<AnnotationTool>("arrow");
  const [color, setColor] = useState("#dc2626");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [draft, setDraft] = useState<Annotation | null>(null);
  const [drag, setDrag] = useState<DragState>({ kind: "none" });
  const [view, setView] = useState<EditorView>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [imageDims, setImageDims] = useState<{ w: number; h: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [textDialog, setTextDialog] = useState<{ x: number; y: number; value: string } | null>(null);

  const annotations = history.present;

  // Load the source image once.
  useEffect(() => {
    let cancelled = false;
    if (!blob) {
      setLoadError(
        "The image bytes are no longer in memory. Close the studio and re-import the image.",
      );
      setLoading(false);
      return;
    }
    setLoading(true);
    createDrawableSource(blob)
      .then((source) => {
        if (cancelled) return;
        sourceRef.current = source;
        setImageDims({
          w: "naturalWidth" in source ? source.naturalWidth : source.width,
          h: "naturalHeight" in source ? source.naturalHeight : source.height,
        });
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("The image could not be decoded for editing.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
      const source = sourceRef.current;
      if (source && "close" in source && typeof source.close === "function") {
        source.close();
      }
      sourceRef.current = null;
    };
  }, [blob]);

  // Fit view when the image or container size changes.
  const fitToContainer = useCallback(() => {
    const container = containerRef.current;
    if (!container || !imageDims) return;
    const rect = container.getBoundingClientRect();
    const scale = computeFitScale(rect.width, rect.height, imageDims.w, imageDims.h);
    setView({
      scale,
      offsetX: (rect.width - imageDims.w * scale) / 2,
      offsetY: (rect.height - imageDims.h * scale) / 2,
    });
  }, [imageDims]);

  useEffect(() => {
    fitToContainer();
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => fitToContainer());
    observer.observe(container);
    return () => observer.disconnect();
  }, [fitToContainer]);

  // Redraw whenever anything relevant changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    const source = sourceRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (!source) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.save();
    ctx.translate(view.offsetX, view.offsetY);
    ctx.scale(view.scale, view.scale);
    const w = "naturalWidth" in source ? source.naturalWidth : source.width;
    const h = "naturalHeight" in source ? source.naturalHeight : source.height;
    ctx.drawImage(source, 0, 0, w, h);
    drawAnnotations(ctx, annotations, { draft, selectedId });
    ctx.restore();
  }, [annotations, draft, selectedId, view, imageDims, loading]);

  const commit = useCallback(
    (next: Annotation[]) => {
      setHistory((current) => commitChange(current, next));
      if (item) {
        dispatch({ type: "update-evidence", id: item.id, patch: { annotations: next } });
      }
    },
    [dispatch, item],
  );

  const pointFromEvent = useCallback(
    (event: PointerEvent | React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return toImageCoords(event.clientX, event.clientY, view, {
        left: rect.left,
        top: rect.top,
      });
    },
    [view],
  );

  const effectiveTool = spaceHeld ? "pan" : activeTool;

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    const canvas = canvasRef.current;
    canvas?.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);

    if (effectiveTool === "pan") {
      setDrag({
        kind: "pan",
        startClient: { x: event.clientX, y: event.clientY },
        startView: view,
      });
      return;
    }

    if (effectiveTool === "select") {
      // Corner-resize detection for rect-like annotations.
      if (selectedId) {
        const selected = annotations.find((a) => a.id === selectedId);
        if (selected && (selected.tool === "rect" || selected.tool === "ellipse")) {
          const bounds = annotationBounds(selected);
          const handleSize = 10 / view.scale;
          const corners: Array<{ corner: "nw" | "ne" | "sw" | "se"; x: number; y: number }> = [
            { corner: "nw", x: bounds.x, y: bounds.y },
            { corner: "ne", x: bounds.x + bounds.w, y: bounds.y },
            { corner: "sw", x: bounds.x, y: bounds.y + bounds.h },
            { corner: "se", x: bounds.x + bounds.w, y: bounds.y + bounds.h },
          ];
          const hitCorner = corners.find(
            (c) => Math.abs(point.x - c.x) <= handleSize && Math.abs(point.y - c.y) <= handleSize,
          );
          if (hitCorner) {
            setDrag({
              kind: "resize",
              id: selected.id,
              corner: hitCorner.corner,
              original: selected as Annotation & { tool: "rect" | "ellipse" },
              originals: [...annotations],
            });
            return;
          }
        }
      }
      const hitId = hitTestAnnotation(annotations, point.x, point.y, 6 / view.scale);
      if (hitId) {
        const hit = annotations.find((a) => a.id === hitId);
        if (hit) {
          setSelectedId(hitId);
          setDrag({
            kind: "move",
            id: hitId,
            lastImage: point,
            original: hit,
            originals: [...annotations],
          });
        }
      } else {
        setSelectedId(null);
      }
      return;
    }

    if (effectiveTool === "text") {
      setTextDialog({ x: point.x, y: point.y, value: "" });
      return;
    }

    if (effectiveTool === "marker") {
      const marker: Annotation = {
        id: localId("ann"),
        tool: "marker",
        x: point.x,
        y: point.y,
        number: nextMarkerNumber(annotations),
        color,
        strokeWidth,
      };
      commit([...annotations, marker]);
      setSelectedId(marker.id);
      return;
    }

    if (effectiveTool === "arrow" || effectiveTool === "rect" || effectiveTool === "ellipse" || effectiveTool === "redaction") {
      setDrag({
        kind: "draw",
        startImage: point,
        tool: effectiveTool,
      });
      setDraft(null);
      return;
    }
    if (effectiveTool === "pen") {
      setDrag({ kind: "pen" });
      setDraft({
        id: localId("ann"),
        tool: "pen",
        points: [[point.x, point.y]],
        color,
        strokeWidth,
      });
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (drag.kind === "none") return;
    const point = pointFromEvent(event);

    if (drag.kind === "pan") {
      const dx = event.clientX - drag.startClient.x;
      const dy = event.clientY - drag.startClient.y;
      setView({
        scale: drag.startView.scale,
        offsetX: drag.startView.offsetX + dx,
        offsetY: drag.startView.offsetY + dy,
      });
      return;
    }

    if (drag.kind === "draw") {
      const { startImage, tool } = drag;
      let nextDraft: Annotation;
      if (tool === "arrow") {
        nextDraft = {
          id: "draft",
          tool: "arrow",
          x1: startImage.x,
          y1: startImage.y,
          x2: point.x,
          y2: point.y,
          color,
          strokeWidth,
        };
      } else {
        const shapeTool: "rect" | "ellipse" = tool === "redaction" ? "rect" : tool;
        nextDraft = {
          id: "draft",
          tool: shapeTool,
          x: Math.min(startImage.x, point.x),
          y: Math.min(startImage.y, point.y),
          w: Math.abs(point.x - startImage.x),
          h: Math.abs(point.y - startImage.y),
          redacted: tool === "redaction" ? true : undefined,
          color,
          strokeWidth,
        };
      }
      setDraft(nextDraft);
      return;
    }

    if (drag.kind === "pen") {
      setDraft((current) => {
        if (!current || current.tool !== "pen") return current;
        const last = current.points[current.points.length - 1];
        if (last && Math.hypot(point.x - last[0], point.y - last[1]) < 2 / view.scale) {
          return current;
        }
        return { ...current, points: [...current.points, [point.x, point.y]] };
      });
      return;
    }

    if (drag.kind === "move") {
      const dx = point.x - drag.lastImage.x;
      const dy = point.y - drag.lastImage.y;
      const moved = moveAnnotation(drag.original, dx, dy);
      // live preview without committing
      const next = annotations.map((a) => (a.id === drag.id ? moved : a));
      setHistory((current) => ({ ...current, present: next }));
      setDrag({ ...drag, lastImage: point, original: moved });
      return;
    }

    if (drag.kind === "resize") {
      const bounds = annotationBounds(drag.original);
      let ddx = 0;
      let ddy = 0;
      if (drag.corner.includes("e")) ddx = point.x - (bounds.x + bounds.w);
      if (drag.corner.includes("w")) ddx = point.x - bounds.x;
      if (drag.corner.includes("s")) ddy = point.y - (bounds.y + bounds.h);
      if (drag.corner.includes("n")) ddy = point.y - bounds.y;
      const resized = resizeRectLike(drag.original, drag.corner, ddx, ddy);
      const next = annotations.map((a) => (a.id === drag.id ? resized : a));
      setHistory((current) => ({ ...current, present: next }));
      return;
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    canvas?.releasePointerCapture?.(event.pointerId);

    if (drag.kind === "draw") {
      const { startImage, tool } = drag;
      const point = pointFromEvent(event);
      const dx = Math.abs(point.x - startImage.x);
      const dy = Math.abs(point.y - startImage.y);
      const minSize = 4 / view.scale;
      if (tool === "arrow" ? dx + dy > minSize : dx > minSize && dy > minSize) {
        let finalAnnotation: Annotation;
        if (tool === "arrow") {
          finalAnnotation = {
            id: localId("ann"),
            tool: "arrow",
            x1: startImage.x,
            y1: startImage.y,
            x2: point.x,
            y2: point.y,
            color,
            strokeWidth,
          };
        } else if (tool === "redaction") {
          finalAnnotation = {
            id: localId("ann"),
            tool: "rect",
            x: Math.min(startImage.x, point.x),
            y: Math.min(startImage.y, point.y),
            w: Math.abs(point.x - startImage.x),
            h: Math.abs(point.y - startImage.y),
            redacted: true,
            color,
            strokeWidth,
          };
        } else {
          finalAnnotation = {
            id: localId("ann"),
            tool,
            x: Math.min(startImage.x, point.x),
            y: Math.min(startImage.y, point.y),
            w: Math.abs(point.x - startImage.x),
            h: Math.abs(point.y - startImage.y),
            color,
            strokeWidth,
          };
        }
        commit([...annotations, finalAnnotation]);
        setSelectedId(finalAnnotation.id);
        if (tool === "redaction") {
          showToast(
            "Redaction added — it will be flattened as an opaque block into the exported PNG.",
            "success",
          );
        }
      }
      setDraft(null);
    } else if (drag.kind === "pen") {
      if (draft && draft.tool === "pen" && draft.points.length > 2) {
        const finalPen: Annotation = { ...draft, id: localId("ann") };
        commit([...annotations, finalPen]);
        setSelectedId(finalPen.id);
      }
      setDraft(null);
    } else if (drag.kind === "move" || drag.kind === "resize") {
      // Persist the final position after live preview. The drag-start
      // snapshot becomes the undo target so one undo reverts the whole drag.
      const originals = drag.originals;
      setHistory((current) => ({
        past: [...current.past, originals].slice(-100),
        present: current.present,
        future: [],
      }));
    }
    setDrag({ kind: "none" });
  };

  // Keyboard interactions.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (typing) return;

      if (event.code === "Space") {
        setSpaceHeld(true);
        event.preventDefault();
        return;
      }
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          setHistory((current) => redo(current));
        } else {
          setHistory((current) => undo(current));
        }
        return;
      }
      if (meta && event.key.toLowerCase() === "y") {
        event.preventDefault();
        setHistory((current) => redo(current));
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        event.preventDefault();
        commit(annotations.filter((a) => a.id !== selectedId));
        setSelectedId(null);
        return;
      }
      if (event.key === "Escape") {
        if (selectedId) setSelectedId(null);
        else onClose();
        return;
      }
      const toolKeys: Record<string, AnnotationTool> = {
        v: "select",
        a: "arrow",
        r: "rect",
        e: "ellipse",
        p: "pen",
        t: "text",
        m: "marker",
        x: "redaction",
        h: "pan",
      };
      const toolKey = toolKeys[event.key.toLowerCase()];
      if (toolKey && !meta) {
        setActiveTool(toolKey);
        return;
      }
      if (event.key === "+" || event.key === "=") {
        setView((v) => ({ ...v, scale: clampZoom(v.scale * 1.25) }));
      }
      if (event.key === "-") {
        setView((v) => ({ ...v, scale: clampZoom(v.scale / 1.25) }));
      }
      if (event.key === "0") {
        fitToContainer();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [annotations, commit, fitToContainer, onClose, selectedId]);

  // Undo/redo must also sync report state.
  useEffect(() => {
    if (item && history.present !== item.annotations) {
      // Present changed through undo/redo; sync unless a drag is mid-flight.
      if (drag.kind === "none") {
        dispatch({
          type: "update-evidence",
          id: item.id,
          patch: { annotations: history.present },
        });
      }
    }
  }, [history.present, dispatch, item, drag.kind]);

  const zoomIn = () => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setView((v) =>
      zoomAroundPoint(
        v,
        v.scale * 1.25,
        { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
        { left: rect.left, top: rect.top },
      ),
    );
  };

  const zoomOut = () => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setView((v) =>
      zoomAroundPoint(
        v,
        v.scale / 1.25,
        { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
        { left: rect.left, top: rect.top },
      ),
    );
  };

  const exportPng = async () => {
    if (!blob || !item) return;
    try {
      const { flattenEvidencePng } = await import("@/lib/annotation/flatten");
      const { blob: pngBlob } = await flattenEvidencePng(blob, annotations);
      const url = URL.createObjectURL(pngBlob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = item.name.replace(/\.[a-z0-9]+$/i, "") + "-annotated.png";
      anchor.click();
      URL.revokeObjectURL(url);
      showToast("Annotated PNG downloaded", "success");
    } catch {
      showToast("Could not generate the annotated PNG in this browser", "error");
    }
  };

  const zoomPercent = useMemo(() => Math.round(view.scale * 100), [view.scale]);

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-ink-950/95"
      role="dialog"
      aria-modal="true"
      aria-label={`Annotation studio for ${item?.name ?? "evidence"}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-ink-800 bg-ink-900 px-4 py-2.5">
        <span className="max-w-[220px] truncate text-sm font-semibold text-white">
          {item?.name ?? "Evidence"}
        </span>
        {imageDims ? (
          <span className="font-mono text-xs text-ink-300">
            {imageDims.w} × {imageDims.h}
          </span>
        ) : null}
        <div className="flex flex-wrap items-center gap-1.5">
          {TOOL_LABELS.map((tool) => (
            <button
              key={tool.tool}
              type="button"
              title={tool.hint}
              aria-pressed={effectiveTool === tool.tool}
              aria-label={`${tool.label} tool — ${tool.hint}`}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                effectiveTool === tool.tool
                  ? "bg-accent-700 text-white"
                  : "bg-ink-800 text-ink-200 hover:bg-ink-700",
                tool.tool === "redaction" && effectiveTool !== tool.tool
                  ? "ring-1 ring-red-400/60"
                  : "",
              )}
              onClick={() => setActiveTool(tool.tool as AnnotationTool)}
            >
              {tool.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" onClick={() => setHistory((c) => undo(c))} disabled={!canUndo(history)} aria-label="Undo annotation change">
            Undo
          </Button>
          <Button size="sm" onClick={() => setHistory((c) => redo(c))} disabled={!canRedo(history)} aria-label="Redo annotation change">
            Redo
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (selectedId) {
                commit(annotations.filter((a) => a.id !== selectedId));
                setSelectedId(null);
              }
            }}
            disabled={!selectedId}
            aria-label="Delete selected annotation"
          >
            Delete
          </Button>
          <Button size="sm" variant="danger" onClick={() => setConfirmClear(true)} disabled={annotations.length === 0} aria-label="Clear all annotations">
            Clear all
          </Button>
          <Button size="sm" variant="primary" onClick={exportPng} disabled={!blob}>
            Save PNG
          </Button>
          <Button size="sm" onClick={onClose} aria-label="Done — close annotation studio">
            Done
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        <div
          ref={containerRef}
          className="relative min-w-0 flex-1 overflow-hidden"
          style={{
            backgroundColor: "#1b2740",
            backgroundImage:
              "linear-gradient(45deg, #22304b 25%, transparent 25%), linear-gradient(-45deg, #22304b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #22304b 75%), linear-gradient(-45deg, transparent 75%, #22304b 75%)",
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
          }}
        >
          <canvas
            ref={canvasRef}
            className="h-full w-full touch-none select-none"
            style={{ cursor: effectiveTool === "pan" ? "grab" : "crosshair" }}
            role="application"
            aria-label={`Annotation canvas for ${item?.name ?? "image"}. Current tool: ${activeTool}. Arrow keys pan; Delete removes the selection.`}
            tabIndex={0}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={(event) => {
              if (!event.ctrlKey && !event.metaKey) return;
              event.preventDefault();
              const rect = containerRef.current?.getBoundingClientRect();
              if (!rect) return;
              setView((v) =>
                zoomAroundPoint(
                  v,
                  event.deltaY < 0 ? v.scale * 1.1 : v.scale / 1.1,
                  { x: event.clientX, y: event.clientY },
                  { left: rect.left, top: rect.top },
                ),
              );
            }}
          />
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner label="Decoding image…" />
            </div>
          ) : null}
          {loadError ? (
            <div className="absolute inset-0 flex items-center justify-center px-6">
              <div role="alert" className="rounded-xl border border-red-400 bg-red-50 px-5 py-4 text-sm text-red-800">
                {loadError}
              </div>
            </div>
          ) : null}
          <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-ink-900/85 px-2 py-1.5 text-xs text-ink-100">
            <button
              type="button"
              className="pointer-events-auto rounded px-2 py-0.5 hover:bg-ink-700"
              onClick={zoomOut}
              aria-label="Zoom out"
            >
              −
            </button>
            <span className="font-mono w-12 text-center" data-testid="zoom-level">
              {zoomPercent}%
            </span>
            <button
              type="button"
              className="pointer-events-auto rounded px-2 py-0.5 hover:bg-ink-700"
              onClick={zoomIn}
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              className="pointer-events-auto rounded px-2 py-0.5 hover:bg-ink-700"
              onClick={fitToContainer}
              aria-label="Zoom to fit"
            >
              Fit
            </button>
            <button
              type="button"
              className="pointer-events-auto rounded px-2 py-0.5 hover:bg-ink-700"
              onClick={() => setView((v) => ({ ...v, scale: 1 }))}
              aria-label="Reset zoom to 100 percent"
            >
              100%
            </button>
          </div>
        </div>

        {/* Style sidebar */}
        <aside className="hidden w-56 shrink-0 flex-col gap-5 overflow-y-auto border-l border-ink-800 bg-ink-900 px-4 py-4 sm:flex">
          <div>
            <p className="mb-2 text-xs font-semibold text-ink-200">Colour</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Annotation colour">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={color === c.value}
                  aria-label={c.label}
                  title={c.label}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-transform",
                    color === c.value ? "border-white scale-110" : "border-transparent",
                  )}
                  style={{ backgroundColor: c.value }}
                  onClick={() => setColor(c.value)}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-ink-200">Stroke width</p>
            <div className="flex gap-1.5" role="radiogroup" aria-label="Stroke width">
              {STROKE_WIDTHS.map((w) => (
                <button
                  key={w}
                  type="button"
                  role="radio"
                  aria-checked={strokeWidth === w}
                  aria-label={`${w} pixels`}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium",
                    strokeWidth === w ? "bg-accent-700 text-white" : "bg-ink-800 text-ink-200 hover:bg-ink-700",
                  )}
                  onClick={() => setStrokeWidth(w)}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-red-400/40 bg-red-950/40 px-3 py-2.5 text-[11px] leading-relaxed text-red-200">
            <span className="font-semibold text-red-100">Redaction is opaque.</span> Exported
            PNGs replace the covered pixels with a solid block. Never trust blur-only hiding
            for secrets.
          </div>
          <div className="text-[11px] leading-relaxed text-ink-300">
            <p className="font-semibold text-ink-100">Shortcuts</p>
            <p className="mt-1">V select · A arrow · R rect · E ellipse</p>
            <p>P pen · T text · M marker · X redact · H pan</p>
            <p>⌘/Ctrl+Z undo · ⇧+⌘/Ctrl+Z redo · Del delete</p>
            <p>Space pan · +/− zoom · 0 fit · Esc deselect/close</p>
          </div>
          <p className="text-[11px] leading-relaxed text-ink-300">
            Source pixels stay untouched in memory. The export flattens the original image
            with these annotations into a fresh PNG.
          </p>
        </aside>
      </div>

      {/* Text dialog */}
      <Dialog
        open={textDialog !== null}
        title="Add text label"
        description="The label is drawn onto the flattened export using the selected colour and a readable size."
        confirmLabel="Add label"
        onCancel={() => setTextDialog(null)}
        onConfirm={() => {
          if (textDialog && textDialog.value.trim()) {
            const text: Annotation = {
              id: localId("ann"),
              tool: "text",
              x: textDialog.x,
              y: textDialog.y,
              text: textDialog.value.trim().slice(0, 200),
              fontSize: Math.max(16, 12 + strokeWidth * 2),
              color,
              strokeWidth: 2,
            };
            commit([...annotations, text]);
            setSelectedId(text.id);
          }
          setTextDialog(null);
        }}
      >
        <input
          type="text"
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
          placeholder="e.g. Misaligned toggle"
          aria-label="Text label content"
          value={textDialog?.value ?? ""}
          autoFocus
          onChange={(event) =>
            setTextDialog((current) =>
              current ? { ...current, value: event.target.value } : current,
            )
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              (event.target as HTMLInputElement).form?.requestSubmit?.();
              if (textDialog?.value.trim()) {
                const text: Annotation = {
                  id: localId("ann"),
                  tool: "text",
                  x: textDialog.x,
                  y: textDialog.y,
                  text: textDialog.value.trim().slice(0, 200),
                  fontSize: Math.max(16, 12 + strokeWidth * 2),
                  color,
                  strokeWidth: 2,
                };
                commit([...annotations, text]);
                setSelectedId(text.id);
                setTextDialog(null);
              }
            }
          }}
        />
      </Dialog>

      {/* Clear confirmation */}
      <Dialog
        open={confirmClear}
        title="Clear all annotations?"
        description="Every annotation on this image will be removed. The source image is never modified; undo still works within this session."
        confirmLabel="Clear annotations"
        confirmVariant="danger"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          commit([]);
          setSelectedId(null);
          setConfirmClear(false);
          showToast("All annotations cleared", "info");
        }}
      />
    </div>
  );
}

export function AnnotationStudio(props: { evidenceId: string; onClose: () => void }) {
  return (
    <ErrorBoundary label="the annotation studio">
      <StudioInner {...props} />
    </ErrorBoundary>
  );
}
