"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Wordmark from "@/components/Wordmark";
import { supabase } from "@/app/lib/supabase";

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

  const handleGoogleSignup = async () => {
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
    <div className="liquid-bg flex min-h-screen items-center justify-center px-4 py-8 text-white">
      <form
        onSubmit={handleSignup}
        className="w-full max-w-[500px] rounded-[30px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_28px_100px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-10"
      >
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <Wordmark size="lg" />

            <h1 className="mt-6 text-4xl font-bold tracking-tight">
              Create account
            </h1>
          </div>

          <Link
            href="/"
            className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/[0.1] hover:text-white"
          >
            Back to Home
          </Link>
        </div>

        {signupSuccess ? (
          <div
            role="status"
            className="rounded-3xl border border-emerald-400/25 bg-emerald-500/10 p-6"
          >
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-200">
              Account created
            </p>
            <p className="mt-3 leading-7 text-slate-300">
              Your SydIN account is ready. Continue to sign in.
            </p>
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="mt-6 w-full rounded-2xl bg-white py-4 text-base font-black text-black transition hover:bg-slate-200"
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
                className="flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white px-5 py-4 text-base font-black text-black shadow-[0_18px_60px_rgba(255,255,255,0.12)] transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white text-sm font-black text-black">
                  G
                </span>
                {googleLoading ? "Connecting..." : "Sign up with Google"}
              </button>

              {oauthError && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
                  {oauthError}
                </div>
              )}

              <div className="flex items-center gap-3 text-sm font-semibold text-neutral-500">
                <span className="h-px flex-1 bg-neutral-800" />
                or sign up with email
                <span className="h-px flex-1 bg-neutral-800" />
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <input
                type="email"
                required
                autoComplete="email"
                aria-label="Email"
                placeholder="Email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                className="rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-black/45 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
              />

              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                aria-label="Password"
                placeholder="Password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                className="rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-black/45 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
              />

              {signupError && (
                <div
                  role="alert"
                  className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200"
                >
                  {signupError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="rounded-2xl bg-white py-4 text-base font-black text-black shadow-[0_18px_60px_rgba(255,255,255,0.12)] transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Creating account..." : "Create Account"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
