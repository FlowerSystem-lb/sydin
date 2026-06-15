"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Provider } from "@supabase/supabase-js";
import AuthPageShell from "@/components/auth/AuthPageShell";
import EmailVerification from "@/components/auth/EmailVerification";
import GoogleMark from "@/components/GoogleMark";
import MicrosoftMark from "@/components/MicrosoftMark";
import UiIcon from "@/components/UiIcon";
import { supabase } from "@/app/lib/supabase";
import { buildAuthHref } from "@/app/lib/authNavigation";
import useAuthIntent from "@/components/useAuthIntent";

type OAuthProvider = Extract<Provider, "google" | "azure">;

interface PendingVerification {
  email: string;
  plan: "free" | "standard" | "pro";
  returnTo: string;
  lastSentAt: number;
}

const PENDING_VERIFICATION_KEY = "sydin:pending-email-verification";

const oauthLabels: Record<OAuthProvider, string> = {
  google: "Google",
  azure: "Microsoft",
};

function readPendingVerification(): PendingVerification | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.sessionStorage.getItem(PENDING_VERIFICATION_KEY);
    if (!stored) return null;

    const pending = JSON.parse(stored) as Partial<PendingVerification>;
    if (
      !pending.email ||
      !pending.returnTo ||
      !pending.lastSentAt ||
      !["free", "standard", "pro"].includes(String(pending.plan))
    ) {
      return null;
    }

    return pending as PendingVerification;
  } catch {
    return null;
  }
}

function writePendingVerification(pending: PendingVerification | null) {
  if (pending) {
    window.sessionStorage.setItem(
      PENDING_VERIFICATION_KEY,
      JSON.stringify(pending)
    );
    return;
  }

  window.sessionStorage.removeItem(PENDING_VERIFICATION_KEY);
}

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthProvider, setOauthProvider] =
    useState<OAuthProvider | null>(null);
  const [oauthError, setOauthError] = useState("");
  const [signupError, setSignupError] = useState("");
  const [pendingVerification, setPendingVerification] =
    useState<PendingVerification | null>(null);
  const oauthStartingRef = useRef(false);
  const { plan: planIntent, returnTo } = useAuthIntent();
  const busy = loading || oauthProvider !== null;

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const pending = readPendingVerification();
      if (pending) {
        setPendingVerification(pending);
        setEmail(pending.email);
      }
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, []);

  const handleOAuthSignup = async (provider: OAuthProvider) => {
    if (busy || oauthStartingRef.current) return;
    oauthStartingRef.current = true;

    try {
      setOauthProvider(provider);
      setOauthError("");
      setSignupError("");

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          ...(provider === "azure" ? { scopes: "email" } : {}),
          redirectTo: `${window.location.origin}${returnTo}`,
        },
      });

      if (error) {
        setOauthError(
          `${oauthLabels[provider]} sign-up could not start. ${error.message}`
        );
        setOauthProvider(null);
        oauthStartingRef.current = false;
      }
    } catch {
      setOauthError(
        `${oauthLabels[provider]} sign-up could not start. Please try again.`
      );
      setOauthProvider(null);
      oauthStartingRef.current = false;
    }
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    try {
      setLoading(true);
      setSignupError("");
      setOauthError("");

      const normalizedEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${buildAuthHref(
            "/login",
            planIntent,
            returnTo
          )}`,
        },
      });

      if (error) {
        setSignupError(error.message);
        return;
      }

      const pending: PendingVerification = {
        email: normalizedEmail,
        plan: planIntent,
        returnTo,
        lastSentAt: Date.now(),
      };
      writePendingVerification(pending);
      setPendingVerification(pending);
      setPassword("");
    } catch {
      setSignupError("Account creation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = () => {
    writePendingVerification(null);
    setPendingVerification(null);
    setSignupError("");
    setPassword("");
  };

  return (
    <AuthPageShell>
      <div className="login-form-wrap signup-form-wrap">
        {pendingVerification ? (
          <EmailVerification
            email={pendingVerification.email}
            returnTo={pendingVerification.returnTo}
            lastSentAt={pendingVerification.lastSentAt}
            onChangeEmail={handleChangeEmail}
            onCodeResent={(lastSentAt) => {
              const updated = {
                ...pendingVerification,
                lastSentAt,
              };
              writePendingVerification(updated);
              setPendingVerification(updated);
            }}
            onVerified={() => writePendingVerification(null)}
          />
        ) : (
          <>
            <div className="login-heading signup-heading">
              <h1>
                Create your <span>account</span>
              </h1>
              <p>Build your SydIN workspace in minutes.</p>
            </div>

            <div className="login-oauth-stack">
              <button
                type="button"
                onClick={() => void handleOAuthSignup("google")}
                disabled={busy}
                aria-busy={oauthProvider === "google"}
                className="login-provider-button"
              >
                <GoogleMark />
                <span>
                  {oauthProvider === "google"
                    ? "Connecting to Google..."
                    : "Continue with Google"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => void handleOAuthSignup("azure")}
                disabled={busy}
                aria-busy={oauthProvider === "azure"}
                className="login-provider-button login-provider-microsoft"
              >
                <span className="login-provider-icon">
                  <MicrosoftMark />
                </span>
                <span>
                  {oauthProvider === "azure"
                    ? "Connecting to Microsoft..."
                    : "Continue with Microsoft"}
                </span>
              </button>
            </div>

            {oauthError && (
              <div role="alert" className="login-alert">
                <UiIcon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{oauthError}</span>
              </div>
            )}

            <div className="login-divider" aria-hidden="true">
              <span />
              <p>OR</p>
              <span />
            </div>

            <form onSubmit={handleSignup} className="login-form">
              <div className="login-field">
                <label htmlFor="signup-email">Email address</label>
                <div className="login-input-wrap">
                  <input
                    id="signup-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="Enter your email"
                    value={email}
                    disabled={busy}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <span aria-hidden="true" className="login-field-icon">
                    @
                  </span>
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="signup-password">Password</label>
                <div className="login-input-wrap">
                  <input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="Create a secure password"
                    value={password}
                    disabled={busy}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-describedby="signup-password-help"
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <p id="signup-password-help" className="signup-password-help">
                  Use at least 6 characters.
                </p>
              </div>

              {signupError && (
                <div role="alert" className="login-alert">
                  <UiIcon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{signupError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                aria-busy={loading}
                className="login-submit"
              >
                {loading ? (
                  <>
                    <span className="login-spinner" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </button>
            </form>

            <p className="login-signup-copy">
              Already have an account?{" "}
              <Link href={buildAuthHref("/login", planIntent, returnTo)}>
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </AuthPageShell>
  );
}
