"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");
  const [googleLoading, setGoogleLoading] =
    useState(false);
  const [oauthError, setOauthError] =
    useState("");

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

    const { error } =
      await supabase.auth.signUp({
        email,
        password,
      });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Account created");

    router.push("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 py-8 text-white">
      <form
        onSubmit={handleSignup}
        className="w-full max-w-[500px] rounded-[30px] border border-neutral-800 bg-[#080808] p-6 sm:p-10"
      >
        <h1 className="text-5xl font-bold mb-10">
          Signup
        </h1>

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
            placeholder="Email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            className="bg-black border border-neutral-800 rounded-2xl px-6 py-5 text-2xl outline-none"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            className="bg-black border border-neutral-800 rounded-2xl px-6 py-5 text-2xl outline-none"
          />

          <button
            type="submit"
            className="bg-white text-black py-5 rounded-2xl text-2xl font-semibold"
          >
            Create Account
          </button>
        </div>
      </form>
    </div>
  );
}
