"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GoogleMark from "@/components/GoogleMark";
import Wordmark from "@/components/Wordmark";
import { supabase } from "@/app/lib/supabase";
import {
  buildAuthHref,
} from "@/app/lib/authNavigation";
import useAuthIntent from "@/components/useAuthIntent";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");
  const [googleLoading, setGoogleLoading] =
    useState(false);
  const [oauthError, setOauthError] =
    useState("");
  const [signupError, setSignupError] =
    useState("");
  const [signupSuccess, setSignupSuccess] =
    useState(false);
  const [loading, setLoading] =
    useState(false);
  const { plan: planIntent, returnTo } = useAuthIntent();

  const handleGoogleSignup = async () => {
    if (googleLoading) return;

    try {
      setGoogleLoading(true);
      setOauthError("");

      const { error } =
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}${returnTo}`,
          },
        });

      if (error) {
        setOauthError(
          "Google sign-up could not start. Please try again."
        );
        setGoogleLoading(false);
      }
    } catch {
      setOauthError(
        "Google sign-up could not start. Please try again."
      );
      setGoogleLoading(false);
    }
  };

  const handleSignup = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (loading) return;

    try {
      setLoading(true);
      setSignupError("");

      const { error } =
        await supabase.auth.signUp({
          email,
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

      setSignupSuccess(true);
    } catch {
      setSignupError("Account creation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="liquid-bg relative flex min-h-[100svh] items-center justify-center overflow-hidden px-4 py-8 text-white sm:px-6 sm:py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="sydin-float-slower absolute left-[-14rem] top-[10%] hidden h-64 w-[38rem] -rotate-12 rounded-[44%] bg-blue-500/10 blur-3xl sm:block" />
        <div className="sydin-float-slow absolute bottom-[3%] right-[-12rem] hidden h-52 w-[34rem] rotate-12 rounded-[46%] bg-cyan-400/10 blur-3xl sm:block" />
        <div className="absolute left-1/2 top-1/2 hidden h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-[44%] border border-sky-300/[0.05] sm:block" />
      </div>

      <form
        onSubmit={handleSignup}
        className="glass-panel relative z-10 w-full max-w-[500px] overflow-hidden border-sky-200/20 bg-[#071a3a]/75 p-5 shadow-[0_32px_100px_rgba(0,4,18,0.52)] sm:p-8"
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent"
        />

        <div className="flex items-center justify-between gap-4">
          <Link href="/" aria-label="SydIN home">
            <Wordmark size="lg" />
          </Link>
          <Link
            href="/"
            className="glass-button glass-button-secondary min-h-10 shrink-0 px-3 py-2 text-xs sm:px-4 sm:text-sm"
          >
            Back to Home
          </Link>
        </div>

        <div className="mb-7 mt-8">
          <p className="text-xs font-bold uppercase text-sky-300">
            Start your workspace
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
            Create your account
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-300 sm:text-base">
            {planIntent === "free"
              ? "Build a clear, visual inventory workspace for your business in minutes."
              : `Create your account, then continue to the ${
                  planIntent === "standard" ? "Standard" : "Pro"
                } plan request.`}
          </p>
        </div>

        {signupSuccess ? (
          <div
            role="status"
            className="rounded-lg border border-emerald-300/25 bg-emerald-400/10 p-5 sm:p-6"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/10 text-lg font-bold text-emerald-200">
              OK
            </div>
            <p className="mt-5 text-xs font-bold uppercase text-emerald-200">
              Account created
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Your SydIN workspace is ready
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Your SydIN account is ready. Continue to sign in.
            </p>
            <button
              type="button"
              onClick={() =>
                router.push(buildAuthHref("/login", planIntent, returnTo))
              }
              className="glass-button mt-6 min-h-14 w-full rounded-lg px-5 py-3.5 text-base"
            >
              Continue to Sign In
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-col gap-4">
              <button
                type="button"
                onClick={handleGoogleSignup}
                disabled={googleLoading}
                aria-busy={googleLoading}
                className="flex min-h-14 w-full items-center justify-center gap-3 rounded-lg border border-white/70 bg-white px-5 py-3.5 text-sm font-bold text-slate-950 shadow-[0_12px_36px_rgba(191,219,254,0.14)] transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
              >
                <GoogleMark />
                {googleLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-blue-600" />
                    Connecting...
                  </>
                ) : (
                  "Sign up with Google"
                )}
              </button>

              {oauthError && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-medium leading-6 text-red-100"
                >
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-300" />
                  {oauthError}
                </div>
              )}

              <div className="flex items-center gap-3 py-1 text-xs font-semibold uppercase text-slate-500">
                <span className="h-px flex-1 bg-sky-200/10" />
                Or use email
                <span className="h-px flex-1 bg-sky-200/10" />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-5">
              <div>
                <label
                  htmlFor="signup-email"
                  className="mb-2 block text-sm font-semibold text-slate-200"
                >
                  Email address
                </label>
                <input
                  id="signup-email"
                  type="email"
                  required
                  autoComplete="email"
                  aria-label="Email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  className="glass-input min-h-14 rounded-lg border-sky-200/15 bg-[#020b20]/65 px-4 py-3.5 text-base text-white placeholder:text-slate-600"
                />
              </div>

              <div>
                <label
                  htmlFor="signup-password"
                  className="mb-2 block text-sm font-semibold text-slate-200"
                >
                  Password
                </label>
                <input
                  id="signup-password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  aria-label="Password"
                  placeholder="Create a secure password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  className="glass-input min-h-14 rounded-lg border-sky-200/15 bg-[#020b20]/65 px-4 py-3.5 text-base text-white placeholder:text-slate-600"
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Use at least 6 characters.
                </p>
              </div>

              {signupError && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-medium leading-6 text-red-100"
                >
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-300" />
                  {signupError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="glass-button min-h-14 w-full rounded-lg px-5 py-3.5 text-base shadow-[0_16px_42px_rgba(37,99,235,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </button>
            </div>
          </>
        )}

        <p className="mt-7 border-t border-sky-200/10 pt-6 text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link
            href={buildAuthHref("/login", planIntent, returnTo)}
            className="font-bold text-sky-300 transition hover:text-cyan-200"
          >
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
