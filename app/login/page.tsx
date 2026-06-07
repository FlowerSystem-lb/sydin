"use client";

import { useState } from "react";
import Link from "next/link";
import GoogleMark from "@/components/GoogleMark";
import Wordmark from "@/components/Wordmark";
import { supabase } from "@/app/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);
  const [googleLoading, setGoogleLoading] =
    useState(false);
  const [oauthError, setOauthError] =
    useState("");
  const [loginError, setLoginError] =
    useState("");

  const handleGoogleLogin = async () => {
    if (googleLoading) return;

    try {
      setGoogleLoading(true);
      setOauthError("");

      const { error } =
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/dashboard`,
          },
        });

      if (error) {
        setOauthError(
          "Google sign-in could not start. Please try again."
        );
        setGoogleLoading(false);
      }
    } catch {
      setOauthError(
        "Google sign-in could not start. Please try again."
      );
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    try {
      setLoading(true);
      setLoginError("");

      const { error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (error) {
        setLoginError(error.message);
        setLoading(false);
        return;
      }

      window.location.href =
        "/dashboard";
    } catch {
      setLoginError("Login failed. Check your details and try again.");
    }

    setLoading(false);
  };

  return (
    <main className="liquid-bg relative flex min-h-[100svh] items-center justify-center overflow-hidden px-4 py-8 text-white sm:px-6 sm:py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="sydin-float-slow absolute left-[-12rem] top-[8%] hidden h-52 w-[34rem] -rotate-12 rounded-[46%] bg-sky-400/10 blur-3xl sm:block" />
        <div className="sydin-float-slower absolute bottom-[4%] right-[-14rem] hidden h-64 w-[38rem] rotate-12 rounded-[44%] bg-blue-500/10 blur-3xl sm:block" />
        <div className="absolute left-1/2 top-1/2 hidden h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-[44%] border border-sky-300/[0.05] sm:block" />
      </div>

      <form
        onSubmit={handleLogin}
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
            Secure workspace
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
            Welcome back
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-300 sm:text-base">
            Sign in to manage inventory, stock movements, and your SydIN
            workspace.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={handleGoogleLogin}
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
              "Continue with Google"
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
              htmlFor="login-email"
              className="mb-2 block text-sm font-semibold text-slate-200"
            >
              Email address
            </label>
            <input
              id="login-email"
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
              htmlFor="login-password"
              className="mb-2 block text-sm font-semibold text-slate-200"
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              aria-label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              className="glass-input min-h-14 rounded-lg border-sky-200/15 bg-[#020b20]/65 px-4 py-3.5 text-base text-white placeholder:text-slate-600"
            />
          </div>

          {loginError && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-medium leading-6 text-red-100"
            >
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-300" />
              {loginError}
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
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </div>

        <p className="mt-7 border-t border-sky-200/10 pt-6 text-center text-sm text-slate-400">
          New to SydIN?{" "}
          <Link
            href="/signup"
            className="font-bold text-sky-300 transition hover:text-cyan-200"
          >
            Create account
          </Link>
        </p>
      </form>
    </main>
  );
}
