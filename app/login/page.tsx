"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Provider } from "@supabase/supabase-js";
import GoogleMark from "@/components/GoogleMark";
import MicrosoftMark from "@/components/MicrosoftMark";
import SydINLoginVisual from "@/components/auth/SydINLoginVisual";
import SydINMark from "@/components/brand/SydINMark";
import Wordmark from "@/components/Wordmark";
import UiIcon from "@/components/UiIcon";
import { supabase } from "@/app/lib/supabase";
import { buildAuthHref } from "@/app/lib/authNavigation";
import useAuthIntent from "@/components/useAuthIntent";

type OAuthProvider = Extract<Provider, "google" | "azure">;

const oauthLabels: Record<OAuthProvider, string> = {
  google: "Google",
  azure: "Microsoft",
};

function getOAuthRedirectError(search: string) {
  const params = new URLSearchParams(search);
  const oauthCode = params.get("error");
  const oauthDescription = params.get("error_description");

  if (!oauthCode && !oauthDescription) return "";

  const cancelled =
    oauthCode === "access_denied" ||
    /cancel|denied/i.test(oauthDescription || "");

  return cancelled
    ? "Sign-in was cancelled. You can try again whenever you are ready."
    : oauthDescription || "Social sign-in could not be completed.";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [oauthProvider, setOauthProvider] =
    useState<OAuthProvider | null>(null);
  const [oauthError, setOauthError] = useState("");
  const [loginError, setLoginError] = useState("");
  const oauthStartingRef = useRef(false);
  const { plan: planIntent, returnTo } = useAuthIntent();
  const busy = loading || oauthProvider !== null;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("error") && !params.has("error_description")) return;

    const redirectError = getOAuthRedirectError(window.location.search);
    const errorTimer = window.setTimeout(() => {
      setOauthError(redirectError);
    }, 0);

    params.delete("error");
    params.delete("error_code");
    params.delete("error_description");
    const cleanSearch = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${cleanSearch ? `?${cleanSearch}` : ""}`
    );

    return () => window.clearTimeout(errorTimer);
  }, []);

  const handleOAuthLogin = async (provider: OAuthProvider) => {
    if (busy || oauthStartingRef.current) return;
    oauthStartingRef.current = true;

    try {
      setOauthProvider(provider);
      setOauthError("");
      setLoginError("");

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          ...(provider === "azure" ? { scopes: "email" } : {}),
          redirectTo: `${window.location.origin}${returnTo}`,
        },
      });

      if (error) {
        setOauthError(
          `${oauthLabels[provider]} sign-in could not start. ${error.message}`
        );
        setOauthProvider(null);
        oauthStartingRef.current = false;
      }
    } catch {
      setOauthError(
        `${oauthLabels[provider]} sign-in could not start. Please try again.`
      );
      setOauthProvider(null);
      oauthStartingRef.current = false;
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    try {
      setLoading(true);
      setLoginError("");
      setOauthError("");
      window.localStorage.setItem(
        "sydin:remember-login",
        rememberMe ? "true" : "false"
      );

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setLoginError(error.message);
        return;
      }

      window.location.href = returnTo;
    } catch {
      setLoginError("Login failed. Check your details and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-auth-panel">
        <div className="login-auth-inner">
          <header className="login-auth-header">
            <Link href="/" className="login-brand" aria-label="SydIN home">
              <SydINMark size="md" />
              <Wordmark size="md" variant="light-background" />
            </Link>

            <Link href="/" className="login-back-link">
              <UiIcon name="chevron-left" className="h-4 w-4" />
              Back to Home
            </Link>
          </header>

          <div className="login-form-wrap">
            <div className="login-heading">
              <h1>
                Welcome <span>back</span>
              </h1>
              <p>Sign in to access your SydIN workspace.</p>
            </div>

            <div className="login-oauth-stack">
              <button
                type="button"
                onClick={() => void handleOAuthLogin("google")}
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
                onClick={() => void handleOAuthLogin("azure")}
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

            <form onSubmit={handleLogin} className="login-form">
              <div className="login-field">
                <label htmlFor="login-email">Email address</label>
                <div className="login-input-wrap">
                  <input
                    id="login-email"
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
                <label htmlFor="login-password">Password</label>
                <div className="login-input-wrap">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
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
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className="login-form-options">
                <label className="login-checkbox">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    disabled={busy}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  <span aria-hidden="true">
                    <UiIcon name="check" className="h-3 w-3" />
                  </span>
                  Remember me
                </label>

                <Link href="/contact?topic=password-help">
                  Forgot password?
                </Link>
              </div>

              {loginError && (
                <div role="alert" className="login-alert">
                  <UiIcon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{loginError}</span>
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
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <p className="login-signup-copy">
              Don&apos;t have an account?{" "}
              <Link href={buildAuthHref("/signup", planIntent, returnTo)}>
                Create one
              </Link>
            </p>
          </div>

          <footer className="login-legal">
            <Link href="/terms">Terms of Service</Link>
            <span aria-hidden="true">•</span>
            <Link href="/privacy">Privacy Policy</Link>
          </footer>
        </div>
      </section>

      <SydINLoginVisual />
    </main>
  );
}
