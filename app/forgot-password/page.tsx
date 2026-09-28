"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthPageShell from "@/components/auth/AuthPageShell";
import CodeInput, { CODE_LENGTH } from "@/components/auth/CodeInput";
import UiIcon from "@/components/UiIcon";
import { supabase } from "@/app/lib/supabase";

/* Forgot password, all inside SydIN (28 Sep 2026). Replaces a "Forgot
 * password?" link that went to the Contact page.
 *
 * 1. Email  -> supabase.auth.resetPasswordForEmail sends the "Reset password"
 *    email, whose template shows a 6-digit code ({{ .Token }}).
 * 2. Code + new password -> verifyOtp(type "recovery") signs them in for
 *    this one purpose, then updateUser sets the new password.
 * Supabase answers the same whether or not the email has an account, so the
 * page never says which -- otherwise it would tell strangers who uses SydIN. */

const RESEND_COOLDOWN_SECONDS = 60;
const MIN_PASSWORD_LENGTH = 8;

type Step = "email" | "code" | "done";

function friendly(message: string) {
  const text = message.toLowerCase();
  if (text.includes("expired")) return "That code has expired. Send a new one and try again.";
  if (text.includes("invalid") || text.includes("otp") || text.includes("token")) {
    return "That code is not right. Check the latest SydIN email and try again.";
  }
  if (text.includes("rate") || text.includes("seconds")) {
    return "Please wait a minute before asking for another code.";
  }
  if (text.includes("same") && text.includes("password")) {
    return "Choose a password you haven't used for SydIN before.";
  }
  return message || "Something went wrong. Please try again.";
}

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentAt, setSentAt] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  // Arriving from the login page with the email already typed.
  useEffect(() => {
    const fromLogin = new URLSearchParams(window.location.search).get("email");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the ?email= link after mount
    if (fromLogin) setEmail(fromLogin);
  }, []);

  useEffect(() => {
    if (!sentAt) return;
    const tick = () =>
      setCooldown(Math.max(0, RESEND_COOLDOWN_SECONDS - Math.floor((Date.now() - sentAt) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [sentAt]);

  const sendCode = async () => {
    const address = email.trim().toLowerCase();
    if (!address) return;
    setBusy(true);
    setError("");
    try {
      const { error: sendError } = await supabase.auth.resetPasswordForEmail(address, {
        redirectTo: `${window.location.origin}/forgot-password`,
      });
      if (sendError) {
        setError(friendly(sendError.message));
        return;
      }
      setEmail(address);
      setCode("");
      setSentAt(Date.now());
      setStep("code");
    } catch {
      setError("We could not reach SydIN. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const passwordProblem =
    password.length > 0 && password.length < MIN_PASSWORD_LENGTH
      ? `Use at least ${MIN_PASSWORD_LENGTH} characters.`
      : confirm.length > 0 && confirm !== password
        ? "The two passwords don't match."
        : "";

  const canReset =
    code.length === CODE_LENGTH &&
    password.length >= MIN_PASSWORD_LENGTH &&
    confirm === password &&
    !busy;

  const resetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canReset) return;
    setBusy(true);
    setError("");
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "recovery",
      });
      if (verifyError) {
        setError(friendly(verifyError.message));
        setCode("");
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(friendly(updateError.message));
        return;
      }
      setStep("done");
      window.setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1400);
    } catch {
      setError("We could not reach SydIN. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const errorBox = error && (
    <div role="alert" className="login-alert">
      <UiIcon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{error}</span>
    </div>
  );

  return (
    <AuthPageShell>
      <div className="login-form-wrap">
        {step === "done" ? (
          <div className="auth-verification auth-verification-success" role="status">
            <span className="auth-verification-badge">
              <UiIcon name="check" className="h-6 w-6" />
            </span>
            <p className="auth-verification-eyebrow">Password changed</p>
            <h1>You&apos;re all set.</h1>
            <p>Your new password is saved. Taking you to your workspace.</p>
            <span className="auth-verification-progress" aria-hidden="true">
              <i />
            </span>
          </div>
        ) : step === "email" ? (
          <>
            <div className="login-heading">
              <h1>
                Reset your <span>password</span>
              </h1>
              <p>Enter the email you use for SydIN. We&apos;ll send you a {CODE_LENGTH}-digit code.</p>
            </div>

            <form
              className="login-form"
              onSubmit={(event) => {
                event.preventDefault();
                void sendCode();
              }}
            >
              <div className="login-field">
                <label htmlFor="reset-email">Email address</label>
                <div className="login-input-wrap">
                  <input
                    id="reset-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="Enter your email"
                    value={email}
                    disabled={busy}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <UiIcon name="mail" className="login-lead-icon" />
                </div>
              </div>

              {errorBox}

              <button type="submit" disabled={busy || !email.trim()} aria-busy={busy} className="login-submit">
                {busy ? (
                  <>
                    <span className="login-spinner" />
                    Sending code...
                  </>
                ) : (
                  "Send code"
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="auth-verification">
            <span className="auth-verification-badge">
              <UiIcon name="mail" className="h-6 w-6" />
            </span>
            <p className="auth-verification-eyebrow">Check your inbox</p>
            <h1>Enter the code.</h1>
            <p>
              If <strong>{email}</strong> has a SydIN account, we sent it a {CODE_LENGTH}-digit
              code. It works for 10 minutes.
            </p>

            <form onSubmit={resetPassword} className="auth-verification-form">
              <label htmlFor="reset-code-0">Code</label>
              <CodeInput
                idPrefix="reset-code"
                value={code}
                onChange={(value) => {
                  setCode(value);
                  if (error) setError("");
                }}
                disabled={busy}
                invalid={Boolean(error)}
                autoFocus
              />

              <div className="login-field auth-reset-field">
                <label htmlFor="reset-password">New password</label>
                <div className="login-input-wrap">
                  <UiIcon name="lock" className="login-lead-icon" />
                  <input
                    id="reset-password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    autoComplete="new-password"
                    placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                    value={password}
                    disabled={busy}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    <UiIcon name={showPassword ? "eye-off" : "eye"} className="h-[1.1rem] w-[1.1rem]" />
                  </button>
                </div>
              </div>

              <div className="login-field auth-reset-field">
                <label htmlFor="reset-confirm">Confirm new password</label>
                <div className="login-input-wrap">
                  <UiIcon name="lock" className="login-lead-icon" />
                  <input
                    id="reset-confirm"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    placeholder="Type it again"
                    value={confirm}
                    disabled={busy}
                    onChange={(event) => setConfirm(event.target.value)}
                  />
                </div>
              </div>

              {passwordProblem && <p className="auth-verification-help">{passwordProblem}</p>}
              {errorBox}

              <button type="submit" disabled={!canReset} aria-busy={busy} className="login-submit">
                {busy ? (
                  <>
                    <span className="login-spinner" />
                    Saving...
                  </>
                ) : (
                  "Save new password"
                )}
              </button>
            </form>

            <div className="auth-verification-actions">
              <button type="button" onClick={() => void sendCode()} disabled={cooldown > 0 || busy}>
                {cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setError("");
                }}
                disabled={busy}
              >
                Use a different email
              </button>
            </div>
          </div>
        )}

        {step !== "done" && (
          <p className="login-signup-copy">
            Remembered it? <Link href="/login">Back to sign in</Link>
          </p>
        )}
      </div>
    </AuthPageShell>
  );
}
