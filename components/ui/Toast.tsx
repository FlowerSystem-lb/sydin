"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import UiIcon from "@/components/UiIcon";

/**
 * "Did that actually work?"
 *
 * Until now SydIN answered that with an inline notice rendered wherever the
 * page happened to put it -- which is fine on a short page and useless on a
 * long one. Save a purchase order from the bar at the bottom and the
 * confirmation appears somewhere above the fold you are not looking at. The
 * repository had no toast, snackbar or transient-feedback component of any
 * kind.
 *
 * This is that, and nothing more than that: a short-lived message in a fixed
 * corner, announced to screen readers, dismissible, and gone on its own.
 *
 * Announcement detail worth keeping: the live region is mounted permanently
 * and empty, not created when a message arrives. A region that appears at the
 * same moment as its text is frequently missed by screen readers -- the text
 * has to change INSIDE a region that was already being watched.
 */

export type ToastTone = "success" | "danger" | "info";

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  /** Kept short: "Undo", "View item". */
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  showToast: (toast: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Milliseconds a message stays. Danger lingers -- it is usually longer to read. */
const TONE_DURATION: Record<ToastTone, number> = {
  success: 4000,
  info: 5000,
  danger: 7000,
};

const TONE_ICON: Record<ToastTone, "check" | "alert" | "info"> = {
  success: "check",
  danger: "alert",
  info: "info",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  // Only clears pending timers on unmount. Whether we can portal is answered
  // by `document` itself further down, the way ItemPanel already does it --
  // a `mounted` state flag would be a setState in an effect for no gain.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = nextId.current++;
      // Three at a time. A stack taller than that stops being feedback and
      // starts being a wall in the corner of the screen.
      setToasts((current) => [...current.slice(-2), { ...toast, id }]);
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), TONE_DURATION[toast.tone])
      );
    },
    [dismiss]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {typeof document !== "undefined" &&
        createPortal(
          <>
            {/* Mounted always, empty until there is something to say. */}
            <div className="sr-only" role="status" aria-live="polite">
              {toasts
                .filter((toast) => toast.tone !== "danger")
                .map((toast) => toast.message)
                .join(". ")}
            </div>
            <div className="sr-only" role="alert" aria-live="assertive">
              {toasts
                .filter((toast) => toast.tone === "danger")
                .map((toast) => toast.message)
                .join(". ")}
            </div>

            <div className="ui-toast-stack">
              {toasts.map((toast) => (
                <div
                  key={toast.id}
                  className={`ui-toast ui-toast-${toast.tone}`}
                  // The text is already announced by the regions above; the
                  // visible copy must not be read a second time.
                  aria-hidden="true"
                >
                  <UiIcon
                    name={TONE_ICON[toast.tone]}
                    className="ui-toast-icon h-4 w-4"
                  />
                  <p className="ui-toast-message">{toast.message}</p>

                  {toast.action && (
                    <button
                      type="button"
                      className="ui-toast-action"
                      onClick={() => {
                        toast.action?.onClick();
                        dismiss(toast.id);
                      }}
                    >
                      {toast.action.label}
                    </button>
                  )}

                  <button
                    type="button"
                    className="ui-toast-close"
                    onClick={() => dismiss(toast.id)}
                    title="Dismiss"
                  >
                    <UiIcon name="close" className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

/**
 * Returns a no-op outside the provider rather than throwing. A form that
 * reports success is not worth crashing a page over, and several of these
 * components render in places (dialogs, the phone shell) that do not always
 * sit under the dashboard layout.
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  return context ?? { showToast: () => {} };
}
