import { useEffect, useRef } from "react";

/** A USB or Bluetooth scanner "types" each character a few ms apart. */
const MAX_GAP_MS = 35;
const MIN_LENGTH = 4;

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/**
 * Listens for keyboard-wedge barcode scanners anywhere on the page, so no
 * field needs focus. Characters that arrive less than 35ms apart are buffered
 * and Enter ends the code. Ignored while the person is typing in a field
 * (the manual input handles its own Enter).
 */
export function useKeyboardWedge({
  enabled,
  onCode,
}: {
  enabled: boolean;
  onCode: (code: string) => void;
}) {
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    if (!enabled) return;

    let buffer = "";
    let lastAt = 0;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) {
        buffer = "";
        return;
      }

      const now = performance.now();
      if (now - lastAt > MAX_GAP_MS) buffer = "";
      lastAt = now;

      if (event.key === "Enter") {
        if (buffer.length >= MIN_LENGTH) {
          event.preventDefault();
          onCodeRef.current(buffer);
        }
        buffer = "";
        return;
      }

      if (event.key.length === 1) {
        buffer += event.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [enabled]);
}
