import { useCallback, useEffect, useRef } from "react";

export type ScanSound = "success" | "error" | "duplicate";

type AudioContextConstructor = typeof AudioContext;

/**
 * Scan beeps made with the Web Audio API: no audio files, no latency, works
 * offline. Browsers keep audio locked until the first user gesture, so the
 * context is created (or resumed) on the first pointer or key press.
 *
 * Also buzzes the phone where `navigator.vibrate` exists. iOS Safari has no
 * vibrate, so it is feature-detected and silently skipped.
 */
export function useScanSound({ enabled, vibrate = false }: { enabled: boolean; vibrate?: boolean }) {
  const contextRef = useRef<AudioContext | null>(null);
  const enabledRef = useRef(enabled);
  const vibrateRef = useRef(vibrate);

  useEffect(() => {
    enabledRef.current = enabled;
    vibrateRef.current = vibrate;
  }, [enabled, vibrate]);

  const ensureContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!contextRef.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        contextRef.current = new Ctor();
      } catch {
        return null;
      }
    }
    if (contextRef.current.state === "suspended") {
      void contextRef.current.resume().catch(() => {});
    }
    return contextRef.current;
  }, []);

  useEffect(() => {
    const unlock = () => {
      ensureContext();
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      void contextRef.current?.close().catch(() => {});
      contextRef.current = null;
    };
  }, [ensureContext]);

  const tone = useCallback(
    (
      context: AudioContext,
      type: OscillatorType,
      fromHz: number,
      toHz: number,
      startAt: number,
      duration: number,
      volume: number
    ) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(fromHz, startAt);
      if (toHz !== fromHz) {
        oscillator.frequency.linearRampToValueAtTime(toHz, startAt + duration);
      }
      // Fast attack and decay so the beep is crisp, not a click.
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + duration + 0.02);
    },
    []
  );

  const play = useCallback(
    (sound: ScanSound) => {
      if (vibrateRef.current && typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          if (sound === "success") navigator.vibrate(60);
          else if (sound === "error") navigator.vibrate([40, 60, 40]);
        } catch {
          // Some browsers throw without a recent gesture; nothing to do.
        }
      }

      if (!enabledRef.current) return;
      const context = ensureContext();
      if (!context) return;
      const now = context.currentTime + 0.01;

      if (sound === "success") {
        tone(context, "sine", 1046, 1046, now, 0.12, 0.25);
        tone(context, "sine", 1568, 1568, now + 0.08, 0.12, 0.25);
      } else if (sound === "error") {
        tone(context, "square", 220, 180, now, 0.25, 0.08);
      } else {
        tone(context, "sine", 660, 660, now, 0.06, 0.12);
      }
    },
    [ensureContext, tone]
  );

  return play;
}
