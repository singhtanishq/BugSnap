import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn, localId } from "@/lib/utils";

export type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  showToast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastApi>({ showToast: () => {} });

const KIND_STYLES: Record<ToastKind, string> = {
  success: "border-accent-300 bg-accent-50 text-accent-900",
  error: "border-red-300 bg-red-50 text-red-900",
  info: "border-ink-200 bg-white text-ink-800",
};

const KIND_LABEL: Record<ToastKind, string> = {
  success: "Success",
  error: "Error",
  info: "Notice",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = localId("toast");
      setToasts((current) => [...current.slice(-4), { id, kind, message }]);
      timersRef.current.set(
        id,
        setTimeout(() => removeToast(id), kind === "error" ? 7000 : 4500),
      );
    },
    [removeToast],
  );

  const api = useMemo<ToastApi>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-start justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-sm shadow-pop",
              KIND_STYLES[toast.kind],
            )}
          >
            <span>
              <span className="font-semibold">{KIND_LABEL[toast.kind]}: </span>
              {toast.message}
            </span>
            <button
              type="button"
              className="shrink-0 rounded p-0.5 text-current opacity-60 hover:opacity-100"
              aria-label={`Dismiss ${KIND_LABEL[toast.kind].toLowerCase()} message`}
              onClick={() => removeToast(toast.id)}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path
                  d="M3 3l8 8M11 3l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
