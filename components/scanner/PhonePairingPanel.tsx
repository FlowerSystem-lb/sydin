"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import UiIcon from "@/components/UiIcon";
import { useDevicePairing } from "@/components/scanner/useDevicePairing";

interface PhonePairingPanelProps {
  userId: string;
  /** Called with each barcode the paired phone sends. */
  onBarcodeReceived: (barcode: string) => void;
}

/**
 * Laptop-side surface for note #5: "scan on the laptop using the phone".
 *
 * Laptops usually have no usable camera for barcodes, so instead of scanning
 * here we pair a phone: this panel shows a QR code (and a typed fallback code),
 * the phone opens /dashboard/scanner/phone, and every code it scans arrives
 * here and is handled exactly as if it had been scanned locally.
 */
export default function PhonePairingPanel({
  userId,
  onBarcodeReceived,
}: PhonePairingPanelProps) {
  // Lazy init rather than an effect: the QR block only renders once the async
  // pairing has resolved, which is after hydration, so there is no SSR/client
  // mismatch to worry about.
  const [origin] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin
  );
  const [lastReceived, setLastReceived] = useState<string | null>(null);
  const [receivedCount, setReceivedCount] = useState(0);

  const { pairing, loading, startPairing } = useDevicePairing({
    userId,
    onBarcodeReceived: (barcode) => {
      setLastReceived(barcode);
      setReceivedCount((count) => count + 1);
      onBarcodeReceived(barcode);
    },
  });

  // The phone opens a real URL rather than a custom scheme, so the QR works
  // with any stock camera app — no SydIN app install required.
  const joinUrl =
    pairing && origin
      ? `${origin}/dashboard/scanner/phone?code=${pairing.pairing_code}`
      : "";

  return (
    <section className="dashboard-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-theme-accent">
            No camera on this device?
          </p>
          <h3 className="mt-1 text-base font-black text-theme-primary">
            Use your phone as the scanner
          </h3>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${
            pairing?.status === "paired"
              ? "border-emerald-400/30 bg-emerald-500/10 text-theme-success"
              : "border-theme bg-theme-inset text-theme-secondary"
          }`}
        >
          {pairing?.status === "paired" ? "Phone connected" : "Waiting"}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-theme-accent border-t-transparent" />
          <p className="text-sm text-theme-muted">Preparing pairing code…</p>
        </div>
      ) : !pairing ? (
        <div className="py-6 text-center">
          <p className="text-sm text-theme-muted">
            Could not create a pairing code.
          </p>
          <button
            type="button"
            onClick={startPairing}
            className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl border border-theme bg-theme-surface px-4 py-2 text-sm font-bold text-theme-primary transition hover:bg-theme-hover"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="mx-auto rounded-xl bg-white p-3 sm:mx-0">
              {joinUrl && (
                <QRCode value={joinUrl} size={132} level="M" />
              )}
            </div>

            <div className="min-w-0">
              <p className="text-sm font-semibold text-theme-primary">
                Scan this with your phone camera
              </p>
              <p className="mt-1 text-xs leading-5 text-theme-muted">
                Or open <strong>Scanner → Use as phone scanner</strong> on your
                phone and enter this code:
              </p>
              <p className="mt-2 font-mono text-2xl font-black tracking-[0.3em] text-theme-primary">
                {pairing.pairing_code}
              </p>
              <p className="mt-2 text-[11px] text-theme-subtle">
                Code expires 10 minutes after it was created.
              </p>
            </div>
          </div>

          {receivedCount > 0 && (
            <div className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.08] px-3 py-2.5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-success">
                {receivedCount} code{receivedCount === 1 ? "" : "s"} received
              </p>
              <p className="mt-1 truncate font-mono text-sm text-theme-primary">
                {lastReceived}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={startPairing}
            className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-theme-secondary transition hover:text-theme-primary"
          >
            <UiIcon name="scan" className="h-3.5 w-3.5" />
            Generate a new code
          </button>
        </>
      )}
    </section>
  );
}
