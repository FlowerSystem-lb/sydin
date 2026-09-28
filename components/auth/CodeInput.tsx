"use client";

import { useRef } from "react";

/* Six separate digit boxes for an emailed code (28 Sep 2026) -- the pattern
   banks and Apple use. Typing moves to the next box, Backspace goes back,
   pasting a whole code (or the phone's one-time-code suggestion) fills every
   box, and onComplete fires once all boxes are full so the form can verify
   without an extra tap. The value is one plain string of digits, so callers
   stay the same shape as a single text input. */

export const CODE_LENGTH = 6;

export default function CodeInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  invalid = false,
  autoFocus = false,
  idPrefix = "code",
  describedBy,
  length = CODE_LENGTH,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  idPrefix?: string;
  describedBy?: string;
  length?: number;
}) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, index) => value[index] ?? "");

  const focusBox = (index: number) => {
    const box = boxes.current[Math.max(0, Math.min(length - 1, index))];
    box?.focus();
    box?.select();
  };

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
    return clean;
  };

  const fillFrom = (index: number, typed: string) => {
    const incoming = typed.replace(/\D/g, "");
    if (!incoming) return;
    // A paste or autofill arrives as several digits at once: lay them out
    // from this box onward.
    const before = value.slice(0, index);
    const clean = commit(before + incoming);
    focusBox(clean.length >= length ? length - 1 : clean.length);
  };

  return (
    <div
      className={`auth-code-boxes${invalid ? " auth-code-boxes-invalid" : ""}`}
      role="group"
      aria-label={`${length}-digit code`}
      aria-describedby={describedBy}
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            boxes.current[index] = element;
          }}
          id={`${idPrefix}-${index}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={index === 0 ? length : 1}
          aria-label={`Digit ${index + 1} of ${length}`}
          aria-invalid={invalid}
          autoFocus={autoFocus && index === 0}
          disabled={disabled}
          value={digit}
          className="auth-code-box"
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            const typed = event.target.value;
            if (!typed) {
              commit(value.slice(0, index) + value.slice(index + 1));
              return;
            }
            fillFrom(index, typed.slice(-length));
          }}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData("text");
            if (/\d/.test(pasted)) {
              event.preventDefault();
              fillFrom(0, pasted);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !digit && index > 0) {
              event.preventDefault();
              commit(value.slice(0, index - 1) + value.slice(index));
              focusBox(index - 1);
            } else if (event.key === "ArrowLeft") {
              event.preventDefault();
              focusBox(index - 1);
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              focusBox(index + 1);
            }
          }}
        />
      ))}
    </div>
  );
}
