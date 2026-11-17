import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

export interface DialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  closeLabel?: string;
  onCancel: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  confirmVariant?: "primary" | "danger" | "secondary";
  size?: "sm" | "md" | "lg";
}

const SIZE_STYLES = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-3xl",
} as const;

/**
 * Accessible modal dialog:
 * focus is trapped inside, Escape cancels, background scroll is locked.
 */
export function Dialog({
  open,
  title,
  description,
  children,
  onCancel,
  onConfirm,
  confirmLabel,
  confirmVariant = "primary",
  closeLabel = "Cancel",
  size = "md",
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusables = dialog?.querySelectorAll<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    const first = focusables?.[0];
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const items = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (items.length === 0) return;
      const activeIndex = items.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && activeIndex <= 0) {
        event.preventDefault();
        items[items.length - 1]?.focus();
      } else if (!event.shiftKey && activeIndex === items.length - 1) {
        event.preventDefault();
        items[0]?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = "";
      previouslyFocused?.focus();
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink-950/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "w-full rounded-xl border border-ink-200 bg-white shadow-pop",
          SIZE_STYLES[size],
        )}
      >
        <div className="border-b border-ink-100 px-5 py-4">
          <h2 id={titleId} className="text-sm font-semibold text-ink-900">
            {title}
          </h2>
          {description ? (
            <div className="mt-1 text-xs leading-relaxed text-ink-500">{description}</div>
          ) : null}
        </div>
        {children ? <div className="px-5 py-4 text-sm text-ink-700">{children}</div> : null}
        <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3.5">
          <Button onClick={onCancel}>{closeLabel}</Button>
          {onConfirm && confirmLabel ? (
            <Button variant={confirmVariant} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
