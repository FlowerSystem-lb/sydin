"use client";

import { useCallback, useState } from "react";
import BarcodeScannerView, {
  type ScannerViewStatus,
} from "@/components/scanner/BarcodeScannerView";

const INITIAL_STATUS: ScannerViewStatus = {
  starting: false,
  status: "",
  error: "",
};

/**
 * The quick-scan modal used by the Inventory workspace. Chrome + status only —
 * the camera lifecycle lives in BarcodeScannerView.
 */
export default function ScannerModal({
  open,
  onClose,
  onDecode,
  eyebrow = "Inventory scanner",
  title = "Scan Item",
  description = "Scan a SydIN QR code or product barcode.",
}: {
  open: boolean;
  onClose: () => void;
  onDecode: (text: string) => void;
  eyebrow?: string;
  title?: string;
  description?: string;
}) {
  const [{ starting, status, error }, setStatus] =
    useState<ScannerViewStatus>(INITIAL_STATUS);
  // Bumping this remounts the scanner view, which restarts the camera from a
  // clean state after a failure (replaces the previous close/reopen dance).
  const [retryNonce, setRetryNonce] = useState(0);

  const handleStatusChange = useCallback((next: ScannerViewStatus) => {
    setStatus(next);
  }, []);

  const handleClose = useCallback(() => {
    setStatus(INITIAL_STATUS);
    onClose();
  }, [onClose]);

  const handleRetry = useCallback(() => {
    setStatus({ starting: true, status: "Starting camera...", error: "" });
    setRetryNonce((current) => current + 1);
  }, []);

  if (!open) return null;

  return (
    <div className="inventory-modal-overlay fixed inset-0 flex items-center justify-center overflow-y-auto theme-overlay p-4 backdrop-blur-xl">
      <div className="my-8 w-full max-w-2xl overflow-hidden rounded-[32px] border border-theme bg-[var(--sydin-surface-strong)] shadow-[0_30px_120px_rgba(15,23,42,0.28)] backdrop-blur-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-theme p-5 sm:p-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-theme-accent">
              {eyebrow}
            </p>

            <h2 className="mt-2 text-3xl font-bold tracking-tight text-theme-primary">
              {title}
            </h2>

            <p className="mt-2 max-w-md text-sm leading-6 text-theme-muted">
              {description}
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 rounded-2xl border border-theme bg-theme-surface p-2 text-theme-muted transition hover:bg-theme-hover hover:text-theme-primary"
            aria-label="Close scanner"
          >
            <svg
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.6}
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-5 sm:p-6">
          <BarcodeScannerView
            key={retryNonce}
            active={open}
            onDecode={onDecode}
            onStatusChange={handleStatusChange}
            className="overflow-hidden rounded-[28px] border border-[#2563eb]/20 bg-black"
          />

          <div
            className="mt-4 rounded-2xl border border-theme bg-theme-surface px-4 py-3"
            role="status"
            aria-live="polite"
          >
            {error ? (
              <p className="text-sm font-semibold text-theme-danger">{error}</p>
            ) : (
              <p className="text-sm font-semibold text-theme-secondary">
                {starting
                  ? "Starting camera..."
                  : status || "Point the camera at a code."}
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-2xl border border-theme bg-theme-surface px-5 py-3 text-base font-bold text-theme-primary transition hover:bg-theme-hover"
            >
              Close
            </button>

            {error && (
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-2xl bg-[linear-gradient(135deg,#10c4dc,#2563eb_58%,#7d5cff)] px-5 py-3 text-base font-bold text-white shadow-[0_12px_28px_rgba(37,99,235,0.16)] transition hover:brightness-110"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
