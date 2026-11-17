import {
  useId,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type InputHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

export function FieldLabel({
  htmlFor,
  children,
  required,
  hint,
}: {
  htmlFor: string;
  children: ReactNode;
  required?: boolean;
  hint?: ReactNode;
}) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-800">
        {children}
        {required ? (
          <span className="ml-1 text-red-600" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ml-1.5 text-xs font-normal text-ink-400">optional</span>
        )}
      </label>
      {hint ? <span className="text-xs text-ink-400">{hint}</span> : null}
    </div>
  );
}

const CONTROL_BASE =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 transition-colors focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-600/20";

export function TextField({
  label,
  required,
  hint,
  error,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  error?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} required={required} hint={hint}>
        {label}
      </FieldLabel>
      <input
        id={id}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL_BASE, error ? "border-red-400" : "border-ink-200")}
        {...rest}
      />
      {error ? (
        <p className="mt-1 text-xs font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextAreaField({
  label,
  required,
  hint,
  error,
  autoResize = true,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  autoResize?: boolean;
}) {
  const id = useId();

  const handleInput = (event: React.FormEvent<HTMLTextAreaElement>) => {
    if (autoResize) {
      const el = event.currentTarget;
      el.style.height = "auto";
      el.style.height = `${Math.min(600, el.scrollHeight + 2)}px`;
    }
  };

  return (
    <div className={className}>
      <FieldLabel htmlFor={id} required={required} hint={hint}>
        {label}
      </FieldLabel>
      <textarea
        id={id}
        rows={rest.rows ?? 3}
        onInput={handleInput}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        className={cn(
          CONTROL_BASE,
          "resize-y min-h-20",
          error ? "border-red-400" : "border-ink-200",
        )}
        {...rest}
      />
      {error ? (
        <p className="mt-1 text-xs font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  label,
  required,
  hint,
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} required={required} hint={hint}>
        {label}
      </FieldLabel>
      <select
        id={id}
        className={cn(CONTROL_BASE, "border-ink-200 cursor-pointer")}
        {...rest}
      >
        {children}
      </select>
    </div>
  );
}
