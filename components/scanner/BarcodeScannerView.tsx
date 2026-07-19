"use client";

import { useEffect, useRef } from "react";
import {
  BrowserMultiFormatReader,
  type IScannerControls,
} from "@zxing/browser";
import {
  SCANNER_PREVIEW_NOT_READY_MESSAGE,
  SCANNER_UNSUPPORTED_MESSAGE,
  getScannerErrorMessage,
} from "@/app/lib/scannerErrors";

export interface ScannerViewStatus {
  starting: boolean;
  status: string;
  error: string;
}

/**
 * Owns the @zxing/browser camera lifecycle. Rendered by ScannerModal (the
 * Inventory quick-scan) and by the Scanner Workspace, so both share one
 * implementation of camera start/stop, decoding, and teardown.
 *
 * `continuous` is the only behavioural difference between the two callers:
 * - false (Inventory): stop on the first successful decode, matching the
 *   original inventory behaviour of scan-once-then-navigate.
 * - true (Scanner Workspace): keep the camera running for repeated scans,
 *   ignoring the same code repeated inside DUPLICATE_SCAN_WINDOW_MS.
 */
const DUPLICATE_SCAN_WINDOW_MS = 1500;

export default function BarcodeScannerView({
  active,
  onDecode,
  onStatusChange,
  continuous = false,
  readyStatus = "Scan a SydIN QR code or product barcode.",
  className,
  videoClassName = "aspect-[3/4] w-full bg-black object-cover sm:aspect-video",
}: {
  active: boolean;
  onDecode: (text: string) => void;
  onStatusChange?: (status: ScannerViewStatus) => void;
  continuous?: boolean;
  readyStatus?: string;
  className?: string;
  videoClassName?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const matchedRef = useRef(false);
  const lastScanRef = useRef<{ text: string; at: number } | null>(null);

  // Callbacks live in refs so the camera effect depends only on `active` /
  // `continuous`. Without this the camera would restart whenever the caller
  // re-created its handler (e.g. Inventory's handleScannedText changes
  // identity every time the item list reloads).
  const onDecodeRef = useRef(onDecode);
  const onStatusChangeRef = useRef(onStatusChange);
  const readyStatusRef = useRef(readyStatus);

  useEffect(() => {
    onDecodeRef.current = onDecode;
    onStatusChangeRef.current = onStatusChange;
    readyStatusRef.current = readyStatus;
  });

  useEffect(() => {
    if (!active) return;

    let isActive = true;

    const report = (status: ScannerViewStatus) => {
      if (!isActive) return;
      onStatusChangeRef.current?.(status);
    };

    const stop = () => {
      controlsRef.current?.stop();
      controlsRef.current = null;

      const stream = videoRef.current?.srcObject;

      if (stream instanceof MediaStream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    const startScanner = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        report({
          starting: false,
          status: "",
          error: SCANNER_UNSUPPORTED_MESSAGE,
        });
        return;
      }

      if (!videoRef.current) {
        report({
          starting: false,
          status: "",
          error: SCANNER_PREVIEW_NOT_READY_MESSAGE,
        });
        return;
      }

      try {
        report({ starting: true, status: "Starting camera...", error: "" });

        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: {
                ideal: "environment",
              },
            },
          },
          videoRef.current,
          (result, _error, scannerControls) => {
            if (!isActive || !result) return;

            const text = result.getText();

            if (continuous) {
              const previous = lastScanRef.current;
              const now = Date.now();

              if (
                previous &&
                previous.text === text &&
                now - previous.at < DUPLICATE_SCAN_WINDOW_MS
              ) {
                return;
              }

              lastScanRef.current = { text, at: now };
              onDecodeRef.current(text);
              return;
            }

            if (matchedRef.current) return;

            matchedRef.current = true;
            scannerControls.stop();
            controlsRef.current = null;
            onDecodeRef.current(text);
          }
        );

        if (!isActive) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        report({ starting: false, status: readyStatusRef.current, error: "" });
      } catch (error) {
        report({
          starting: false,
          status: "",
          error: getScannerErrorMessage(error),
        });
      }
    };

    void startScanner();

    return () => {
      isActive = false;
      matchedRef.current = false;
      lastScanRef.current = null;
      stop();
    };
  }, [active, continuous]);

  return (
    <div className={className}>
      <video ref={videoRef} muted playsInline className={videoClassName} />
    </div>
  );
}
