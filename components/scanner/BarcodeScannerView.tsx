"use client";

import { useEffect, useRef, useState } from "react";
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
 * Owns the camera lifecycle. Rendered by ScannerModal (the Inventory
 * quick-scan), the Scanner Workspace and the phone page (/pair), so all three
 * share one implementation of camera start/stop, decoding, and teardown.
 *
 * Decoding uses the browser's own BarcodeDetector where it exists (Chrome on
 * Android and desktop: faster, less battery) and @zxing/browser everywhere
 * else (Safari, Firefox).
 *
 * `continuous` is the only behavioural difference between the callers:
 * - false (Inventory): stop on the first successful decode, matching the
 *   original inventory behaviour of scan-once-then-navigate.
 * - true (Scanner Workspace, phone): keep the camera running for repeated
 *   scans, ignoring the same code repeated inside DUPLICATE_SCAN_WINDOW_MS.
 *
 * The camera stops while the tab is hidden and starts again when it returns.
 */
const DUPLICATE_SCAN_WINDOW_MS = 1500;
const DETECT_INTERVAL_MS = 120;
const NATIVE_FORMATS = ["qr_code", "ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"];

interface NativeDetector {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
}
type NativeDetectorConstructor = {
  new (options?: { formats?: string[] }): NativeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

async function createNativeDetector(): Promise<NativeDetector | null> {
  if (typeof window === "undefined") return null;
  const Ctor = (window as unknown as { BarcodeDetector?: NativeDetectorConstructor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    const supported = (await Ctor.getSupportedFormats?.()) || [];
    const formats = NATIVE_FORMATS.filter((format) => supported.includes(format));
    // Desktop Chrome on some platforms reports the API but no formats.
    if (!formats.includes("qr_code")) return null;
    return new Ctor({ formats });
  } catch {
    return null;
  }
}

export default function BarcodeScannerView({
  active,
  onDecode,
  onStatusChange,
  onStream,
  deviceId,
  continuous = false,
  readyStatus = "Scan a SydIN QR code or product barcode.",
  className,
  videoClassName = "aspect-[3/4] w-full bg-black object-cover sm:aspect-video",
}: {
  active: boolean;
  onDecode: (text: string) => void;
  onStatusChange?: (status: ScannerViewStatus) => void;
  /** The live stream once the camera starts (null when it stops): lets the
      caller read the camera name and turn the torch on. */
  onStream?: (stream: MediaStream | null) => void;
  /** A specific camera from enumerateDevices; default is the back camera. */
  deviceId?: string;
  continuous?: boolean;
  readyStatus?: string;
  className?: string;
  videoClassName?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const matchedRef = useRef(false);
  const lastScanRef = useRef<{ text: string; at: number } | null>(null);
  const [pageVisible, setPageVisible] = useState(true);

  // Callbacks live in refs so the camera effect depends only on `active` /
  // `continuous`. Without this the camera would restart whenever the caller
  // re-created its handler (e.g. Inventory's handleScannedText changes
  // identity every time the item list reloads).
  const onDecodeRef = useRef(onDecode);
  const onStatusChangeRef = useRef(onStatusChange);
  const onStreamRef = useRef(onStream);
  const readyStatusRef = useRef(readyStatus);

  useEffect(() => {
    onDecodeRef.current = onDecode;
    onStatusChangeRef.current = onStatusChange;
    onStreamRef.current = onStream;
    readyStatusRef.current = readyStatus;
  });

  useEffect(() => {
    const handleVisibility = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    if (!active || !pageVisible) return;

    let isActive = true;
    let detectTimer: number | null = null;

    const report = (status: ScannerViewStatus) => {
      if (!isActive) return;
      onStatusChangeRef.current?.(status);
    };

    const stop = () => {
      if (detectTimer) window.clearTimeout(detectTimer);
      detectTimer = null;
      controlsRef.current?.stop();
      controlsRef.current = null;

      const stream = videoRef.current?.srcObject;

      if (stream instanceof MediaStream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      onStreamRef.current?.(null);
    };

    /** Returns true when the caller should stop scanning. */
    const handleText = (text: string) => {
      if (!isActive) return true;

      if (continuous) {
        const previous = lastScanRef.current;
        const now = Date.now();

        if (
          previous &&
          previous.text === text &&
          now - previous.at < DUPLICATE_SCAN_WINDOW_MS
        ) {
          return false;
        }

        lastScanRef.current = { text, at: now };
        onDecodeRef.current(text);
        return false;
      }

      if (matchedRef.current) return true;
      matchedRef.current = true;
      onDecodeRef.current(text);
      return true;
    };

    const videoConstraints: MediaTrackConstraints = deviceId
      ? { deviceId: { exact: deviceId } }
      : { facingMode: { ideal: "environment" } };

    const startNative = async (detector: NativeDetector, video: HTMLVideoElement) => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: videoConstraints,
      });
      if (!isActive) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => {});
      onStreamRef.current?.(stream);

      const loop = async () => {
        if (!isActive) return;
        if (video.readyState >= 2) {
          try {
            const codes = await detector.detect(video);
            const text = codes[0]?.rawValue;
            if (text && handleText(text)) {
              stop();
              return;
            }
          } catch {
            // A frame that cannot be read; try the next one.
          }
        }
        detectTimer = window.setTimeout(() => void loop(), DETECT_INTERVAL_MS);
      };
      void loop();
    };

    const startZxing = async (video: HTMLVideoElement) => {
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints(
        { audio: false, video: videoConstraints },
        video,
        (result, _error, scannerControls) => {
          if (!isActive || !result) return;
          if (handleText(result.getText())) {
            scannerControls.stop();
            controlsRef.current = null;
          }
        }
      );

      if (!isActive) {
        controls.stop();
        return;
      }

      controlsRef.current = controls;
      const stream = video.srcObject;
      onStreamRef.current?.(stream instanceof MediaStream ? stream : null);
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

      const video = videoRef.current;
      if (!video) {
        report({
          starting: false,
          status: "",
          error: SCANNER_PREVIEW_NOT_READY_MESSAGE,
        });
        return;
      }

      try {
        report({ starting: true, status: "Starting camera...", error: "" });

        const detector = await createNativeDetector();
        if (detector) {
          await startNative(detector, video);
        } else {
          await startZxing(video);
        }

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
  }, [active, continuous, deviceId, pageVisible]);

  return (
    <div className={className}>
      <video ref={videoRef} muted playsInline className={videoClassName} />
    </div>
  );
}
