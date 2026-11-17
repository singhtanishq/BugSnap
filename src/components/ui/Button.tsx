import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-700 text-white border-accent-700 hover:bg-accent-800 hover:border-accent-800 disabled:bg-accent-700/60",
  secondary:
    "bg-white text-ink-800 border-ink-200 hover:border-ink-300 hover:bg-ink-50 disabled:text-ink-400",
  ghost:
    "bg-transparent text-ink-600 border-transparent hover:bg-ink-100 hover:text-ink-900",
  danger:
    "bg-white text-red-700 border-red-300 hover:bg-red-50 hover:border-red-400",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "text-xs px-2.5 py-1.5 gap-1.5",
  md: "text-sm px-3.5 py-2 gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-lg border font-medium transition-colors select-none",
        "disabled:cursor-not-allowed disabled:opacity-60",
        SIZE_STYLES[size],
        VARIANT_STYLES[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
