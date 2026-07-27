"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import UiIcon from "@/components/UiIcon";
import BarcodeScannerView from "@/components/scanner/BarcodeScannerView";
import {
  DashboardPageHeader,
  DashboardPageShell,
} from "@/components/dashboard/Workspace";
import { supabase } from "@/app/lib/supabase";
import {
  joinDevicePairing,
  sendBarcodeToLaptop,
  type DevicePairing,
} from "@/app/lib/devicePairing";

const PHONE_DEVICE_ID_KEY = "sydin:phone-device-id";

function getPhoneDeviceId(): string {
  try {
    const existing = window.localStorage.getItem(PHONE_DEVICE_ID_KEY);
    if (existing) return existing;

    const generated =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `phone-${Date.now()}`;
    window.localStorage.setItem(PHONE_DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return `phone-${Date.now()}`;
  }
}

function PhoneScannerInner() {
  const searchParams = useSearchParams();
  const prefilledCode = searchParams.get("code") || "";

  const [code, setCode] = useState(prefilledCode);
  const [pairing, setPairing] = useState<DevicePairing | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [sentCount, setSentCount] = useState(0);
  const [lastSent, setLastSent] = useState("");
  const [scanning, setScanning] = useState(false);

  const join = useCallback(async (pairingCode: string) => {
    // The Connect button is disabled below 6 digits and the QR path supplies a
    // full code, so there is no length branch here — which also keeps this
    // function free of synchronous state writes for the effect call site.
    const trimmed = pairingCode.trim();
    if (trimmed.length !== 6) return;

    // Resolve the session first, so nothing here writes state synchronously.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setJoining(true);
    setError("");

    if (!user) {
      setError("Please sign in on this phone first, then reopen this link.");
      setJoining(false);
      return;
    }

    const joined = await joinDevicePairing({
      userId: user.id,
      pairingCode: trimmed,
      phoneDeviceId: getPhoneDeviceId(),
    });

    if (!joined) {
      setError("That code is invalid or has expired. Generate a new one.");
      setJoining(false);
      return;
    }

    setPairing(joined);
    setScanning(true);
    setJoining(false);
  }, []);

  // Auto-join when the QR code supplied the code — scanning the QR should just
  // connect, not drop the user on a prefilled form asking for another tap.
  // `join` awaits the session before touching state, so nothing is written
  // synchronously here; the rule flags any call into a setState-containing
  // function and cannot see that.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async network join, state writes happen post-await
    if (prefilledCode) void join(prefilledCode);
  }, [prefilledCode, join]);

  const handleDecode = useCallback(
    async (text: string) => {
      if (!pairing) return;

      const ok = await sendBarcodeToLaptop({
        pairingId: pairing.id,
        barcodeData: text,
      });

      if (ok) {
        setLastSent(text);
        setSentCount((count) => count + 1);
        // Short buzz so the user knows it landed without looking at the screen.
        if ("vibrate" in navigator) navigator.vibrate(60);
      } else {
        setError("Could not send that code. Check your connection.");
      }
    },
    [pairing]
  );

  return (
    <DashboardPageShell>
      <DashboardPageHeader
        eyebrow="Scanner"
        title="Phone scanner"
        description={
          pairing
            ? "Point at a barcode — every scan appears on your laptop."
            : "Connect this phone to the scanner open on your laptop."
        }
      />

      {!pairing ? (
        <section className="dashboard-card p-4">
          <label
            htmlFor="pairing-code"
            className="mb-2 block text-sm font-semibold text-theme-secondary"
          >
            Pairing code
          </label>
          <input
            id="pairing-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="123456"
            className="w-full rounded-xl border border-theme bg-[var(--sydin-input-bg)] px-4 py-3 text-center font-mono text-2xl font-black tracking-[0.3em] text-theme-primary outline-none"
          />

          {error && (
            <p role="alert" className="mt-3 text-sm font-semibold text-theme-danger">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() => void join(code)}
            disabled={joining || code.length !== 6}
            className="mt-4 w-full rounded-xl bg-[linear-gradient(135deg,#10c4dc,#2563eb_58%,#7d5cff)] px-5 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {joining ? "Connecting…" : "Connect to laptop"}
          </button>
        </section>
      ) : (
        <>
          <section className="dashboard-card overflow-hidden p-0">
            <BarcodeScannerView
              active={scanning}
              continuous
              onDecode={(text) => void handleDecode(text)}
              readyStatus="Point the camera at a barcode."
              className="bg-black"
              videoClassName="aspect-[3/4] w-full bg-black object-cover"
            />
          </section>

          <section className="dashboard-card p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-theme-success">
                <UiIcon name="check" className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-black text-theme-primary">
                  Connected — {sentCount} sent
                </p>
                {lastSent && (
                  <p className="truncate font-mono text-xs text-theme-muted">
                    Last: {lastSent}
                  </p>
                )}
              </div>
            </div>

            {error && (
              <p role="alert" className="mt-3 text-sm font-semibold text-theme-danger">
                {error}
              </p>
            )}
          </section>
        </>
      )}
    </DashboardPageShell>
  );
}

export default function PhoneScannerPage() {
  return (
    <Suspense fallback={null}>
      <PhoneScannerInner />
    </Suspense>
  );
}
