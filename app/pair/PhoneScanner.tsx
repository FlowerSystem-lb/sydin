"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import BarcodeScannerView, { type ScannerViewStatus } from "@/components/scanner/BarcodeScannerView";
import UiIcon from "@/components/UiIcon";
import { useScanSound } from "@/components/scanner/useScanSound";
import {
  claimPhoneLink,
  leavePhoneLink,
  pingPhoneLink,
  postPhoneScan,
  type PhoneLinkError,
} from "@/app/lib/devicePairing";
import { SCANNER_MODES, getScannerMode } from "@/app/lib/scannerModes";

/**
 * The phone as a wireless scanner (Sayed's spec, 8 Oct 2026). No app and no
 * login: the QR on the laptop opens /pair/<token>, this page claims the link
 * once, and from then on every code it reads is posted to the laptop through
 * the phase-38 functions. The phone only ever learns the name, code and
 * quantity of the item it just scanned.
 */

const LINK_STORAGE_KEY = "sydin:phone-link";
const SOUND_STORAGE_KEY = "sydin:phone-sound";
const HEARTBEAT_MS = 10_000;
const REPEAT_WINDOW_MS = 2_000;

interface StoredLink {
  key: string;
  secret: string;
  businessName: string;
}

type Phase =
  | { kind: "enter-code" }
  | { kind: "claiming" }
  | { kind: "failed"; error: PhoneLinkError }
  | { kind: "linked" }
  | { kind: "ended" };

interface ResultChip {
  tone: "ok" | "unknown" | "error";
  title: string;
  detail: string;
  at: string;
}

function readStoredLink(key: string): StoredLink | null {
  try {
    const raw = window.localStorage.getItem(LINK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLink;
    return parsed.key === key && parsed.secret ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredLink(link: StoredLink | null) {
  try {
    if (link) window.localStorage.setItem(LINK_STORAGE_KEY, JSON.stringify(link));
    else window.localStorage.removeItem(LINK_STORAGE_KEY);
  } catch {
    // Private mode: the link still works until the page reloads.
  }
}

/** "iPhone · Safari", "Android · Chrome": what the laptop shows. */
function describeDevice() {
  const ua = navigator.userAgent;
  const device = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : "Phone";
  const browser = /CriOS|Chrome/.test(ua) && !/Edg|OPR|SamsungBrowser/.test(ua)
    ? "Chrome"
    : /SamsungBrowser/.test(ua)
      ? "Samsung Internet"
      : /OPR|Opera/.test(ua)
        ? "Opera"
        : /Edg/.test(ua)
          ? "Edge"
          : /Firefox|FxiOS/.test(ua)
            ? "Firefox"
            : /Safari/.test(ua)
              ? "Safari"
              : "Browser";
  return `${device} · ${browser}`;
}

const ERROR_COPY: Record<PhoneLinkError, { title: string; body: string }> = {
  invalid: {
    title: "This code has expired",
    body: "Scan a new code from the laptop. Codes last 10 minutes.",
  },
  already_linked: {
    title: "Another phone is already linked",
    body: "On the laptop, press New code, then scan the new code with this phone.",
  },
  too_many: {
    title: "Too many tries",
    body: "Wait a few minutes, or scan the QR code on the laptop instead.",
  },
  closed: {
    title: "Disconnected from the laptop",
    body: "Scan a new code from the laptop to keep scanning.",
  },
  slow_down: {
    title: "Slow down",
    body: "Too many scans at once.",
  },
  network: {
    title: "No connection",
    body: "Check the phone's internet, then try again.",
  },
};

export default function PhoneScanner({ token, initialCode = "" }: { token?: string; initialCode?: string }) {
  const [phase, setPhase] = useState<Phase>(token || initialCode.length === 6 ? { kind: "claiming" } : { kind: "enter-code" });
  const [code, setCode] = useState(initialCode);
  const [link, setLink] = useState<StoredLink | null>(null);
  const [mode, setMode] = useState("lookup");
  const [soundOn, setSoundOn] = useState(true);
  const [vibrateOn, setVibrateOn] = useState(true);
  const [sentCount, setSentCount] = useState(0);
  const [chip, setChip] = useState<ResultChip | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<ScannerViewStatus>({ starting: false, status: "", error: "" });
  const [torchTrack, setTorchTrack] = useState<MediaStreamTrack | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typedCode, setTypedCode] = useState("");
  const [flash, setFlash] = useState<"ok" | "error" | null>(null);
  const lastRawRef = useRef<{ raw: string; at: number } | null>(null);
  const flashTimerRef = useRef<number | null>(null);

  const play = useScanSound({ enabled: soundOn, vibrate: vibrateOn });

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a per-device preference
      if (window.localStorage.getItem(SOUND_STORAGE_KEY) === "off") setSoundOn(false);
    } catch {
      // Default stays on.
    }
  }, []);

  const toggleSound = () => {
    setSoundOn((current) => {
      try {
        window.localStorage.setItem(SOUND_STORAGE_KEY, current ? "off" : "on");
      } catch {
        // Not remembered, still toggled.
      }
      return !current;
    });
  };

  const claim = useCallback(async (args: { token?: string; code?: string }) => {
    const key = args.token ? `t:${args.token}` : `c:${args.code}`;
    // A reload of the same link must not "claim" again (claiming is single
    // use): reuse the secret this phone already holds.
    const stored = readStoredLink(key);
    if (stored) {
      const check = await pingPhoneLink(stored.secret);
      if (check.ok) {
        setLink(stored);
        setMode(check.mode);
        setPhase({ kind: "linked" });
        return;
      }
      writeStoredLink(null);
    }

    setPhase({ kind: "claiming" });
    const result = await claimPhoneLink({ ...args, deviceLabel: describeDevice() });
    if (!result.ok) {
      setPhase({ kind: "failed", error: result.error });
      return;
    }
    const next = { key, secret: result.claim.secret, businessName: result.claim.businessName };
    writeStoredLink(next);
    setLink(next);
    setMode(result.claim.mode);
    setPhase({ kind: "linked" });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async network claim on load; state writes follow the await
    if (token) void claim({ token });
    else if (initialCode.length === 6) void claim({ code: initialCode });
  }, [token, initialCode, claim]);

  // Heartbeat: tells the laptop the phone is still here and picks up a mode
  // change made on the laptop.
  const secret = link?.secret;
  useEffect(() => {
    if (phase.kind !== "linked" || !secret) return;
    let active = true;
    const beat = async () => {
      const result = await pingPhoneLink(secret);
      if (!active) return;
      if (result.ok) {
        setReconnecting(false);
        setMode(result.mode);
        setVibrateOn(result.vibrate);
      } else if (result.error === "closed") {
        writeStoredLink(null);
        setPhase({ kind: "ended" });
      } else {
        setReconnecting(true);
      }
    };
    void beat();
    const timer = window.setInterval(() => void beat(), HEARTBEAT_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [phase.kind, secret]);

  // Keep the screen awake while scanning, where the browser allows it.
  useEffect(() => {
    if (phase.kind !== "linked") return;
    type WakeLockSentinelLike = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> } };
    if (!nav.wakeLock) return;
    let sentinel: WakeLockSentinelLike | null = null;
    const request = () => {
      nav.wakeLock
        ?.request("screen")
        .then((lock) => {
          sentinel = lock;
        })
        .catch(() => {});
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") request();
    };
    request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [phase.kind]);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    };
  }, []);

  const showFlash = (tone: "ok" | "error") => {
    setFlash(tone);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 320);
  };

  const sendScan = useCallback(
    async (raw: string) => {
      if (!secret) return;
      const text = raw.trim();
      if (!text) return;
      const now = Date.now();
      const previous = lastRawRef.current;
      if (previous && previous.raw === text && now - previous.at < REPEAT_WINDOW_MS) {
        play("duplicate");
        return;
      }
      lastRawRef.current = { raw: text, at: now };

      const at = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const result = await postPhoneScan(secret, text);
      if (!result.ok) {
        if (result.error === "closed") {
          writeStoredLink(null);
          setPhase({ kind: "ended" });
          return;
        }
        play("error");
        showFlash("error");
        setChip({ tone: "error", title: ERROR_COPY[result.error].title, detail: ERROR_COPY[result.error].body, at });
        if (result.error === "network") setReconnecting(true);
        return;
      }

      setReconnecting(false);
      setSentCount((count) => count + 1);
      const item = result.result.item;
      const unitLabel = (value: string | null) => (!value || /^pieces?$/i.test(value) ? "pcs" : value);
      if (item) {
        const title = item.code ? `${item.name} · ${item.code}` : item.name;
        if (mode === "add") {
          play("duplicate");
          setChip({ tone: "unknown", title, detail: "Already in SydIN, not added again", at });
          return;
        }
        play("success");
        showFlash("ok");
        setChip({
          tone: "ok",
          title,
          detail:
            mode === "receive" || mode === "issue"
              ? `Added to the ${mode} list on the laptop`
              : `Sent to laptop · ${item.quantity} ${unitLabel(item.unit)} on hand`,
          at,
        });
      } else if (mode === "add" && !/^https?:\/\//i.test(text)) {
        play("success");
        showFlash("ok");
        setChip({ tone: "ok", title: "New barcode", detail: `${text.slice(0, 32)} · added to the new items list`, at });
      } else {
        play("error");
        showFlash("error");
        setChip({ tone: "unknown", title: "Unknown code", detail: `${text.slice(0, 40)} · sent to laptop`, at });
      }
    },
    [mode, play, secret]
  );

  const changeMode = async (next: string) => {
    setMode(next);
    if (secret) await pingPhoneLink(secret, next);
  };

  const disconnect = async () => {
    if (secret) await leavePhoneLink(secret);
    writeStoredLink(null);
    setPhase({ kind: "ended" });
  };

  const handleStream = useCallback((stream: MediaStream | null) => {
    const track = stream?.getVideoTracks()[0] || null;
    const capabilities = (track?.getCapabilities?.() || {}) as MediaTrackCapabilities & { torch?: boolean };
    setTorchTrack(track && capabilities.torch ? track : null);
    if (!track) setTorchOn(false);
  }, []);

  const toggleTorch = async () => {
    if (!torchTrack) return;
    try {
      await torchTrack.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn(!torchOn);
    } catch {
      setTorchTrack(null);
    }
  };

  /* ---------------- not linked yet ---------------- */

  if (phase.kind !== "linked") {
    return (
      <main className="pair-screen pair-screen-center">
        <div className="pair-brand">
          <Image src="/brand/sydin-mark.svg" alt="" width={42} height={42} className="pair-logo" />
          <span>SydIN Scanner</span>
        </div>

        {phase.kind === "claiming" && (
          <div className="pair-panel" role="status">
            <span className="pair-spinner" aria-hidden />
            <p className="pair-panel-title">Linking to the laptop…</p>
          </div>
        )}

        {phase.kind === "enter-code" && (
          <form
            className="pair-panel"
            onSubmit={(event) => {
              event.preventDefault();
              if (code.length === 6) void claim({ code });
            }}
          >
            <p className="pair-panel-title">Enter the code on the laptop</p>
            <p className="pair-panel-body">Open Scanner on the laptop, choose Phone, and type the 6 digits shown there.</p>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label="6-digit code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="pair-code-input"
            />
            <button type="submit" disabled={code.length !== 6} className="pair-primary">
              Link this phone
            </button>
          </form>
        )}

        {(phase.kind === "failed" || phase.kind === "ended") && (
          <div className="pair-panel">
            <span className="pair-panel-icon is-danger" aria-hidden>
              <UiIcon name="alert" className="h-5 w-5" />
            </span>
            <p className="pair-panel-title">
              {phase.kind === "ended" ? ERROR_COPY.closed.title : ERROR_COPY[phase.error].title}
            </p>
            <p className="pair-panel-body">
              {phase.kind === "ended" ? ERROR_COPY.closed.body : ERROR_COPY[phase.error].body}
            </p>
            <button
              type="button"
              className="pair-secondary"
              onClick={() => {
                setCode("");
                setPhase({ kind: "enter-code" });
              }}
            >
              Type a code instead
            </button>
          </div>
        )}
      </main>
    );
  }

  /* ---------------- linked: the scanner ---------------- */

  const activeMode = getScannerMode(mode);

  return (
    <main className="pair-screen">
      <header className="pair-header">
        <Image src="/brand/sydin-mark.svg" alt="" width={42} height={42} className="pair-logo" />
        <div className="pair-header-text">
          <p className="pair-header-title">SydIN Scanner</p>
          <p className="pair-header-sub">
            <span className={`pair-dot ${reconnecting ? "is-warning" : ""}`} aria-hidden />
            {reconnecting ? "Reconnecting…" : `Linked to ${link?.businessName || "your business"} · Laptop`}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={soundOn}
          aria-label={soundOn ? "Sound on" : "Sound off"}
          className="pair-icon-button"
        >
          <UiIcon name={soundOn ? "volume" : "volume-off"} className="h-5 w-5" />
        </button>
      </header>

      <div className="pair-modes" role="group" aria-label="Scan mode">
        {SCANNER_MODES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={entry.id === activeMode.id}
            onClick={() => void changeMode(entry.id)}
            className={entry.id === activeMode.id ? "is-active" : ""}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <section className={`pair-viewfinder ${flash ? `is-flash-${flash}` : ""}`}>
        <BarcodeScannerView
          active
          continuous
          onDecode={(text) => void sendScan(text)}
          onStatusChange={setCameraStatus}
          onStream={handleStream}
          readyStatus="Point at a barcode or QR code."
          className="pair-video-wrap"
          videoClassName="pair-video"
        />
        <span className="pair-frame" aria-hidden>
          <i />
          <i />
          <i />
          <i />
          <b />
        </span>
        {cameraStatus.error && <p className="pair-camera-error">{cameraStatus.error}</p>}

        {chip && (
          <div className={`pair-chip is-${chip.tone}`} role="status" aria-live="polite">
            <span className="pair-chip-icon" aria-hidden>
              <UiIcon name={chip.tone === "ok" ? "check" : "alert"} className="h-5 w-5" />
            </span>
            <span className="pair-chip-text">
              <strong>{chip.title}</strong>
              <span>{chip.detail}</span>
            </span>
            <span className="pair-chip-time">{chip.at}</span>
          </div>
        )}
      </section>

      <footer className="pair-footer">
        {typing ? (
          <form
            className="pair-type-form"
            onSubmit={(event) => {
              event.preventDefault();
              const value = typedCode.trim();
              if (!value) return;
              void sendScan(value);
              setTypedCode("");
              setTyping(false);
            }}
          >
            <input
              autoFocus
              value={typedCode}
              onChange={(event) => setTypedCode(event.target.value)}
              placeholder="Code, SKU or barcode"
              aria-label="Type a code"
              className="pair-type-input"
            />
            <button type="submit" className="pair-primary">
              Send
            </button>
          </form>
        ) : (
          <div className="pair-buttons">
            <button type="button" onClick={() => void toggleTorch()} disabled={!torchTrack} className="pair-secondary" aria-pressed={torchOn}>
              {torchOn ? "Torch off" : "Torch"}
            </button>
            <button type="button" onClick={() => setTyping(true)} className="pair-secondary">
              Type code
            </button>
          </div>
        )}
        <p className="pair-footnote">
          {sentCount} {sentCount === 1 ? "scan" : "scans"} sent · keep this page open while scanning ·{" "}
          <button type="button" onClick={() => void disconnect()} className="pair-link">
            Disconnect
          </button>
        </p>
      </footer>
    </main>
  );
}
