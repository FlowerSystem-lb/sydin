import { useCallback, useEffect, useRef, useState } from "react";
import {
  createDevicePairing,
  getActivePairing,
  getPairing,
  getUnprocessedBarcodes,
  markBarcodesProcessed,
  setPairingMode,
  terminatePairing,
  type DevicePairing,
  type PairedBarcode,
} from "@/app/lib/devicePairing";

const DEVICE_ID_STORAGE_KEY = "sydin:laptop-device-id";
const POLL_INTERVAL_MS = 1000;
/** Re-read the pairing row (status, heartbeat, mode) every few polls. */
const PAIRING_REFRESH_EVERY = 4;
/** The phone pings every 10s; 30s of silence reads as disconnected. */
export const PHONE_OFFLINE_AFTER_MS = 30_000;

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
  onBarcodeReceived?: (barcode: string, row: PairedBarcode) => void;
  /** Create a pairing on mount when none is live. The Scanner page passes
      false until the Phone tab is opened, but still picks up a phone that is
      already linked. */
  autoCreate?: boolean;
  /** Called when the phone changes the scan mode. */
  onModeChange?: (mode: string) => void;
}

export function useDevicePairing({
  userId,
  onBarcodeReceived,
  autoCreate = true,
  onModeChange,
}: UseDevicePairingParams) {
  const [pairing, setPairing] = useState<DevicePairing | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanCount, setScanCount] = useState(0);

  // Kept in refs so the polling effect never restarts just because the caller
  // passed a new inline callback — that would reset the interval every render.
  const onBarcodeRef = useRef(onBarcodeReceived);
  const onModeRef = useRef(onModeChange);
  useEffect(() => {
    onBarcodeRef.current = onBarcodeReceived;
    onModeRef.current = onModeChange;
  }, [onBarcodeReceived, onModeChange]);

  // The mode last seen on the pairing row, to spot the phone changing it.
  const lastModeRef = useRef<string | null>(null);
  useEffect(() => {
    lastModeRef.current = pairing?.mode || null;
  }, [pairing?.mode]);

  const deviceIdRef = useRef<string | null>(null);
  if (deviceIdRef.current == null) {
    deviceIdRef.current = getLaptopDeviceId();
  }

  const startPairing = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    if (pairing && pairing.status !== "expired") {
      await terminatePairing(pairing.id);
    }
    const created = await createDevicePairing({
      userId,
      laptopDeviceId: deviceIdRef.current!,
    });
    setPairing(created);
    setScanCount(0);
    setLoading(false);
  }, [pairing, userId]);

  const disconnect = useCallback(async () => {
    if (!pairing) return;
    await terminatePairing(pairing.id);
    setPairing(null);
    setScanCount(0);
  }, [pairing]);

  const changeMode = useCallback(
    (mode: string) => {
      if (!pairing || pairing.mode === mode) return;
      setPairing({ ...pairing, mode });
      void setPairingMode(pairing.id, mode);
    },
    [pairing]
  );

  // Reuse an existing unexpired pairing if there is one, otherwise create one.
  useEffect(() => {
    if (!userId) return;

    let active = true;

    (async () => {
      const existing = await getActivePairing(userId, deviceIdRef.current!);
      if (!active) return;

      if (existing || !autoCreate) {
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
  }, [userId, autoCreate]);

  // Poll for barcodes the phone has sent, and for the phone joining.
  const pairingId = pairing?.id;
  const pairingStatus = pairing?.status;
  useEffect(() => {
    if (!pairingId || pairingStatus === "expired") return;

    let active = true;
    let inFlight = false;
    let tickCount = 0;

    const tick = async () => {
      // Skip if the previous poll is still running — on a slow connection
      // overlapping polls would deliver the same barcode twice.
      if (!active || inFlight) return;
      inFlight = true;
      tickCount += 1;

      try {
        if (pairingStatus === "waiting" || tickCount % PAIRING_REFRESH_EVERY === 1) {
          const refreshed = await getPairing(pairingId);
          if (!active) return;
          if (refreshed) {
            if (refreshed.mode && lastModeRef.current && refreshed.mode !== lastModeRef.current) {
              onModeRef.current?.(refreshed.mode);
            }
            lastModeRef.current = refreshed.mode || null;
            setPairing(refreshed);
          }
          if (pairingStatus === "waiting") return;
        }

        const barcodes = await getUnprocessedBarcodes(pairingId);
        if (!active || barcodes.length === 0) return;

        // Mark processed BEFORE dispatching: handleDecode navigates on a hit,
        // which unmounts this hook and would otherwise leave the rows unmarked
        // and replay them on the next mount.
        await markBarcodesProcessed(barcodes.map((item) => item.id));
        if (!active) return;

        setScanCount((count) => count + barcodes.length);
        for (const barcode of barcodes) {
          onBarcodeRef.current?.(barcode.barcode_data, barcode);
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
  }, [pairingId, pairingStatus]);

  return { pairing, loading, scanCount, startPairing, disconnect, changeMode };
}
