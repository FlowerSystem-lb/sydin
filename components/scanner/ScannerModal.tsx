"use client";

import { useCallback, useEffect, useState } from "react";
import BarcodeScannerView, {
  type ScannerViewStatus,
} from "@/components/scanner/BarcodeScannerView";
import PhonePairingPanel from "@/components/scanner/PhonePairingPanel";
import { supabase } from "@/app/lib/supabase";

const INITIAL_STATUS: ScannerViewStatus = {
  starting: false,
  status: "",
  error: "",
};

/**
 * The quick-scan modal used by the Inventory workspace and the top bar.
 * Chrome + status only — the camera lifecycle lives in BarcodeScannerView.
 *
 * Sayed, 31 Aug: "why is there a scan button if we are on laptop, it is
 * useless." He was right about this modal, and the answer was already in the
 * codebase. The Scanner PAGE pairs a phone — it shows a QR code, the phone
 * opens /dashboard/scanner/phone, and every code it scans arrives back here
 * through the same decode path as a local scan. Its own comment says why:
 * "Laptops rarely have a usable barcode camera."
 *
 * This modal never offered that, so the Scan button on Inventory opened a
 * laptop webcam and nothing else — which is the useless experience he means.
 * The fix is not to hide the button or apologise in a dialog; it is to offer
 * the phone here too, the way the page already does.
 *
 * The user id is read here rather than passed in, so both callers get it
 * without touching their code.
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
  const [userId, setUserId] = useState<string | null>(null);
  // Which input this device is actually good at. `pointer: coarse` is true for
  // a finger and false for a mouse, which is a better question than screen
  // width: it asks "is this a thing you hold and point at a carton?" A tablet
  // answers yes and should lead with its camera; a laptop answers no however
  // wide its screen is.
  const [handheld, setHandheld] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const query = window.matchMedia("(pointer: coarse)");
    const sync = () => setHandheld(query.matches);

    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  // Bumping this remounts the scanner view, which restarts the camera from a
  // clean state after a failure (replaces the previous close/reopen dance).
  const [retryNonce, setRetryNonce] = useState(0);

  // Only while the modal is open: no reason to ask who is signed in for a
  // dialog nobody has opened.
  useEffect(() => {
    if (!open || userId) return;

    let cancelled = false;

    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data.user?.id ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [open, userId]);

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
      <div className="scanner-modal-card m-auto flex w-full max-w-xl flex-col overflow-hidden rounded-[20px] border border-theme bg-[var(--sydin-surface-strong)] shadow-[0_30px_120px_rgba(15,23,42,0.28)] backdrop-blur-2xl">
        <div className="flex flex-none items-start justify-between gap-4 border-b border-theme p-4 sm:p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-theme-accent">
              {eyebrow}
            </p>

            <h2 className="mt-1 text-xl font-semibold tracking-tight text-theme-primary">
              {title}
            </h2>

            <p className="mt-1.5 max-w-md text-sm leading-6 text-theme-muted">
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

        <div className="scanner-modal-body min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {/* On a laptop the phone IS the scanner, so it leads. Offering it
              underneath a failed camera, phrased as "no camera on this
              device?", made the right answer look like the consolation prize.
              On a handheld the camera leads, because there the device in your
              hand is already the right tool and pairing it to itself is
              nonsense. */}
          {!handheld && userId && (
            <div className="rounded-2xl border border-theme bg-theme-surface p-4">
              <PhonePairingPanel
                userId={userId}
                onBarcodeReceived={onDecode}
                eyebrow="Recommended on a computer"
                heading="Scan with your phone"
              />
            </div>
          )}

          {!handheld && (
            <p className="mt-5 mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-theme-subtle">
              Or use this device&rsquo;s camera
            </p>
          )}

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

          {/* Handheld: the camera led, so pairing sits below as the genuine
              fallback it is there. */}
          {handheld && userId && (
            <div className="mt-4 rounded-2xl border border-theme bg-theme-surface p-4">
              <PhonePairingPanel userId={userId} onBarcodeReceived={onDecode} />
            </div>
          )}

          <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-2xl border border-theme bg-theme-surface px-5 py-3 text-base font-semibold text-theme-primary transition hover:bg-theme-hover"
            >
              Close
            </button>

            {error && (
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-2xl bg-[linear-gradient(135deg,#10c4dc,#2563eb_58%,#7d5cff)] px-5 py-3 text-base font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.16)] transition hover:brightness-110"
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
