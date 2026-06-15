"use client";

import { useEffect, useState } from "react";
import UiIcon from "@/components/UiIcon";
import { supabase } from "@/app/lib/supabase";

const RESEND_COOLDOWN_SECONDS = 60;
const MIN_CODE_LENGTH = 6;
const MAX_CODE_LENGTH = 10;

function isValidVerificationCode(value: string) {
  return (
    /^\d+$/.test(value) &&
    value.length >= MIN_CODE_LENGTH &&
    value.length <= MAX_CODE_LENGTH
  );
}

function getVerificationError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("expired")) {
    return "That verification code has expired. Request a new code and try again.";
  }

  if (
    normalized.includes("invalid") ||
    normalized.includes("token") ||
    normalized.includes("otp")
  ) {
    return "That verification code is invalid. Check the code and try again.";
  }

  return message || "Email verification could not be completed.";
}

export default function EmailVerification({
  email,
  returnTo,
  lastSentAt,
  onChangeEmail,
  onCodeResent,
  onVerified,
}: {
  email: string;
  returnTo: string;
  lastSentAt: number;
  onChangeEmail: () => void;
  onCodeResent: (sentAt: number) => void;
  onVerified: () => void;
}) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const codeIsValid = isValidVerificationCode(code);

  useEffect(() => {
    const updateCooldown = () => {
      const elapsedSeconds = Math.floor((Date.now() - lastSentAt) / 1000);
      setCooldown(Math.max(0, RESEND_COOLDOWN_SECONDS - elapsedSeconds));
    };

    const initialTimer = window.setTimeout(updateCooldown, 0);
    const interval = window.setInterval(updateCooldown, 1000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [lastSentAt]);

  const handleCodeChange = (value: string) => {
    setCode(value.replace(/\D/g, "").slice(0, MAX_CODE_LENGTH));
    if (error) setError("");
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (verifying || resending || !codeIsValid) return;

    try {
      setVerifying(true);
      setError("");

      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });

      if (verifyError) {
        setError(getVerificationError(verifyError.message));
        return;
      }

      setVerified(true);
      onVerified();
      window.setTimeout(() => {
        window.location.href = returnTo;
      }, 900);
    } catch {
      setError(
        "We could not reach the verification service. Check your connection and try again."
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending || verifying) return;

    try {
      setResending(true);
      setError("");

      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
      });

      if (resendError) {
        setError(resendError.message);
        return;
      }

      const sentAt = Date.now();
      onCodeResent(sentAt);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setError(
        "We could not resend the code. Check your connection and try again."
      );
    } finally {
      setResending(false);
    }
  };

  if (verified) {
    return (
      <div className="auth-verification auth-verification-success" role="status">
        <span className="auth-verification-badge">
          <UiIcon name="check" className="h-6 w-6" />
        </span>
        <p className="auth-verification-eyebrow">Email verified</p>
        <h1>Your workspace is ready.</h1>
        <p>
          Your email is confirmed. We are taking you to the next step in SydIN.
        </p>
        <span className="auth-verification-progress" aria-hidden="true">
          <i />
        </span>
      </div>
    );
  }

  return (
    <div className="auth-verification">
      <span className="auth-verification-badge">
        <UiIcon name="file" className="h-6 w-6" />
      </span>
      <p className="auth-verification-eyebrow">Verify your email</p>
      <h1>Check your inbox.</h1>
      <p>
        We sent a verification code to <strong>{email}</strong>.
      </p>

      <form onSubmit={handleVerify} className="auth-verification-form">
        <label htmlFor="signup-verification-code">Verification code</label>
        <input
          id="signup-verification-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6,10}"
          minLength={MIN_CODE_LENGTH}
          maxLength={MAX_CODE_LENGTH}
          required
          autoFocus
          value={code}
          disabled={verifying || resending}
          onChange={(event) => handleCodeChange(event.target.value)}
          onPaste={(event) => {
            const pastedCode = event.clipboardData
              .getData("text")
              .replace(/\D/g, "")
              .slice(0, MAX_CODE_LENGTH);

            if (pastedCode) {
              event.preventDefault();
              handleCodeChange(pastedCode);
            }
          }}
          aria-describedby="signup-verification-help"
          aria-invalid={Boolean(error)}
          className="auth-code-input"
        />
        <p id="signup-verification-help" className="auth-verification-help">
          Enter the complete verification code from the SydIN email.
        </p>

        {error && (
          <div role="alert" className="login-alert">
            <UiIcon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={verifying || resending || !codeIsValid}
          aria-busy={verifying}
          className="login-submit"
        >
          {verifying ? (
            <>
              <span className="login-spinner" />
              Verifying...
            </>
          ) : (
            "Verify Email"
          )}
        </button>
      </form>

      <div className="auth-verification-actions">
        <button
          type="button"
          onClick={() => void handleResend()}
          disabled={cooldown > 0 || resending || verifying}
          aria-busy={resending}
        >
          {resending
            ? "Sending..."
            : cooldown > 0
              ? `Resend code in ${cooldown}s`
              : "Resend Code"}
        </button>
        <button type="button" onClick={onChangeEmail} disabled={verifying}>
          Change Email
        </button>
      </div>
    </div>
  );
}
