"use client";

import { useEffect, useState } from "react";
import UiIcon from "@/components/UiIcon";
import CodeInput, { CODE_LENGTH } from "@/components/auth/CodeInput";
import { supabase } from "@/app/lib/supabase";

const RESEND_COOLDOWN_SECONDS = 60;
// Six digits: Supabase > Authentication > Providers > Email > "Email OTP
// Length" must be 6 to match (28 Sep 2026).
function isValidVerificationCode(value: string) {
  return value.length === CODE_LENGTH && /^\d+$/.test(value);
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
    setCode(value);
    if (error) setError("");
  };

  // Called by the form (Verify button) or by the boxes once all six digits
  // are in -- then with the fresh code, before state has caught up.
  const handleVerify = async (event?: React.FormEvent, typedCode = code) => {
    event?.preventDefault();
    if (verifying || resending || !isValidVerificationCode(typedCode)) return;

    try {
      setVerifying(true);
      setError("");

      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: typedCode,
        type: "email",
      });

      if (verifyError) {
        setError(getVerificationError(verifyError.message));
        setCode("");
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
        <UiIcon name="mail" className="h-6 w-6" />
      </span>
      <p className="auth-verification-eyebrow">Verify your email</p>
      <h1>Check your inbox.</h1>
      <p>
        We sent a verification code to <strong>{email}</strong>.
      </p>

      <form onSubmit={handleVerify} className="auth-verification-form">
        <label htmlFor="signup-verification-code-0">Verification code</label>
        <CodeInput
          idPrefix="signup-verification-code"
          value={code}
          onChange={handleCodeChange}
          onComplete={(complete) => void handleVerify(undefined, complete)}
          disabled={verifying || resending}
          invalid={Boolean(error)}
          autoFocus
          describedBy="signup-verification-help"
        />
        <p id="signup-verification-help" className="auth-verification-help">
          Enter the {CODE_LENGTH}-digit code from the SydIN email. It works for 10 minutes.
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
