import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone =
  | "neutral"
  | "accent"
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info";

const TONE_STYLES: Record<BadgeTone, string> = {
  neutral: "bg-ink-100 text-ink-700 border-ink-200",
  accent: "bg-accent-50 text-accent-800 border-accent-200",
  critical: "bg-red-50 text-red-800 border-red-300",
  high: "bg-orange-50 text-orange-800 border-orange-300",
  medium: "bg-amber-50 text-amber-800 border-amber-300",
  low: "bg-sky-50 text-sky-800 border-sky-300",
  info: "bg-indigo-50 text-indigo-800 border-indigo-200",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_STYLES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
