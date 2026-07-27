import { useEffect, useState, useCallback } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/app/lib/supabase";
import {
  createDevicePairing,
  getActivePairing,
  getUnprocessedBarcodes,
  markBarcodesProcessed,
  type DevicePairing,
} from "@/app/lib/devicePairing";

interface UseDevicePairingParams {
  userId: string;
  laptopDeviceId: string;
  onBarcodeReceived?: (barcode: string) => void;
}

export function useDevicePairing(params: UseDevicePairingParams) {
  const [pairing, setPairing] = useState<DevicePairing | null>(null);
  const [qrValue, setQrValue] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const realtimeChannelRef = useState<RealtimeChannel | null>(null)[0];

  // Initialize pairing on mount
  useEffect(() => {
    let isActive = true;

    const initialize = async () => {
      // Check if there's already an active pairing
      const existing = await getActivePairing(
        params.userId,
        params.laptopDeviceId
      );

      if (isActive) {
        if (existing) {
          setPairing(existing);
          // Generate QR code data: protocol://pairing_code
          setQrValue(`sydin://pair/${existing.pairing_code}`);
        } else {
          // Create new pairing
          const newPairing = await createDevicePairing({
            userId: params.userId,
            laptopDeviceId: params.laptopDeviceId,
          });

          if (newPairing) {
            setPairing(newPairing);
            setQrValue(`sydin://pair/${newPairing.pairing_code}`);
          }
        }

        setLoading(false);
      }
    };

    initialize();

    return () => {
      isActive = false;
    };
  }, [params.userId, params.laptopDeviceId]);

  // Listen for incoming barcodes via Supabase Realtime
  useEffect(() => {
    if (!pairing || pairing.status !== "paired") return;

    let isActive = true;
    const pollInterval = setInterval(async () => {
      if (!isActive) return;

      const barcodes = await getUnprocessedBarcodes(pairing.id);

      if (barcodes.length > 0) {
        // Process each barcode
        for (const barcode of barcodes) {
          params.onBarcodeReceived?.(barcode.barcode_data);
        }

        // Mark all as processed
        await markBarcodesProcessed(barcodes.map((b) => b.id));
      }
    }, 500); // Poll every 500ms for new barcodes

    return () => {
      isActive = false;
      clearInterval(pollInterval);
    };
  }, [pairing, params]);

  const startPairing = useCallback(async () => {
    setLoading(true);
    const newPairing = await createDevicePairing({
      userId: params.userId,
      laptopDeviceId: params.laptopDeviceId,
    });

    if (newPairing) {
      setPairing(newPairing);
      setQrValue(`sydin://pair/${newPairing.pairing_code}`);
    }

    setLoading(false);
  }, [params.userId, params.laptopDeviceId]);

  return {
    pairing,
    qrValue,
    loading,
    startPairing,
  };
}
