import { useCallback, useEffect, useRef, useState } from "react";
import {
  createDevicePairing,
  getActivePairing,
  getUnprocessedBarcodes,
  markBarcodesProcessed,
  type DevicePairing,
} from "@/app/lib/devicePairing";

const DEVICE_ID_STORAGE_KEY = "sydin:laptop-device-id";
const POLL_INTERVAL_MS = 1500;

/**
 * A stable id for this browser, so reloading the scanner page reuses the same
 * pairing instead of orphaning the phone that already joined.
 */
function getLaptopDeviceId(): string {
  if (typeof window === "undefined") return "";

  try {
    const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) return existing;

    const generated =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    // Private mode / storage disabled — fall back to a per-session id.
    return `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

interface UseDevicePairingParams {
  userId: string;
  onBarcodeReceived?: (barcode: string) => void;
}

export function useDevicePairing({
  userId,
  onBarcodeReceived,
}: UseDevicePairingParams) {
  const [pairing, setPairing] = useState<DevicePairing | null>(null);
  const [loading, setLoading] = useState(true);

  // Kept in a ref so the polling effect never restarts just because the caller
  // passed a new inline callback — that would reset the interval every render.
  const onBarcodeRef = useRef(onBarcodeReceived);
  useEffect(() => {
    onBarcodeRef.current = onBarcodeReceived;
  }, [onBarcodeReceived]);

  const deviceIdRef = useRef<string | null>(null);
  if (deviceIdRef.current == null) {
    deviceIdRef.current = getLaptopDeviceId();
  }

  const startPairing = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    const created = await createDevicePairing({
      userId,
      laptopDeviceId: deviceIdRef.current!,
    });
    setPairing(created);
    setLoading(false);
  }, [userId]);

  // Reuse an existing unexpired pairing if there is one, otherwise create one.
  useEffect(() => {
    if (!userId) return;

    let active = true;

    (async () => {
      const existing = await getActivePairing(userId, deviceIdRef.current!);
      if (!active) return;

      if (existing) {
        setPairing(existing);
        setLoading(false);
        return;
      }

      const created = await createDevicePairing({
        userId,
        laptopDeviceId: deviceIdRef.current!,
      });
      if (!active) return;

      setPairing(created);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  // Poll for barcodes the phone has sent, and for the phone joining.
  useEffect(() => {
    if (!pairing || pairing.status === "expired") return;

    let active = true;
    let inFlight = false;

    const tick = async () => {
      // Skip if the previous poll is still running — on a slow connection
      // overlapping polls would deliver the same barcode twice.
      if (!active || inFlight) return;
      inFlight = true;

      try {
        if (pairing.status === "waiting") {
          const refreshed = await getActivePairing(userId, deviceIdRef.current!);
          if (active && refreshed && refreshed.status !== pairing.status) {
            setPairing(refreshed);
          }
          return;
        }

        const barcodes = await getUnprocessedBarcodes(pairing.id);
        if (!active || barcodes.length === 0) return;

        // Mark processed BEFORE dispatching: handleDecode navigates on a hit,
        // which unmounts this hook and would otherwise leave the rows unmarked
        // and replay them on the next mount.
        await markBarcodesProcessed(barcodes.map((item) => item.id));
        if (!active) return;

        for (const barcode of barcodes) {
          onBarcodeRef.current?.(barcode.barcode_data);
        }
      } finally {
        inFlight = false;
      }
    };

    const interval = window.setInterval(tick, POLL_INTERVAL_MS);
    void tick();

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [pairing, userId]);

  return { pairing, loading, startPairing };
}
