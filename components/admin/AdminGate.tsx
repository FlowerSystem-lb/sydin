"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import { supabase } from "@/app/lib/supabase";

/* The door to /admin (30 Sep 2026, Sayed: "password and strict privacy").
 *
 *   not signed in   -> sign in first
 *   not an admin    -> the same "page could not be found" as any bad URL
 *   admin, no app   -> set up an authenticator app (scan the QR once)
 *   admin, has app  -> enter the 6-digit code
 *   code entered    -> the admin screens
 *
 * The code step is what makes a stolen password useless here. This screen is
 * the friendly part; the real lock is on the server: every /api/admin data
 * route refuses a session that has not passed the code (app/lib/adminAuth). */

type Stage =
  | { kind: "checking" }
  | { kind: "signed-out" }
  | { kind: "not-found" }
  | { kind: "enroll"; factorId: string; qr: string; secret: string }
  | { kind: "verify"; factorId: string }
  | { kind: "open" };

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<Stage>({ kind: "checking" });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const decide = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setStage({ kind: "signed-out" });
      return;
    }

    const answer = await fetch("/api/admin/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .catch(() => ({ admin: false }));
    if (!(answer as { admin?: boolean }).admin) {
      setStage({ kind: "not-found" });
      return;
    }

    const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (level?.currentLevel === "aal2") {
      setStage({ kind: "open" });
      return;
    }

    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verified = factors?.totp?.find((factor) => factor.status === "verified");
    if (verified) {
      setStage({ kind: "verify", factorId: verified.id });
      return;
    }

    // Clear a half-finished setup from an earlier visit, then start fresh.
    for (const factor of factors?.all ?? []) {
      if (factor.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
    const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `SydIN admin ${new Date().toISOString().slice(0, 10)}`,
    });
    if (enrollError || !enrolled) {
      // Show Supabase's own reason: the usual one is that authenticator-app
      // sign-in (TOTP) is switched off in Supabase > Authentication > MFA.
      setError(`Couldn't start the authenticator setup: ${enrollError?.message || "unknown error"}.`);
      setStage({ kind: "verify", factorId: "" });
      return;
    }
    setStage({ kind: "enroll", factorId: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret });
  }, []);

  // Once per visit: two overlapping runs (React runs effects twice in
  // development) would each create an authenticator setup and remove the
  // other's, leaving a QR code that no longer works.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void decide();
  }, [decide]);

  const submitCode = async (factorId: string) => {
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6 digits from your authenticator app.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (verifyError) {
      setCode("");
      setError("That code didn't work. Codes change every 30 seconds; enter the current one.");
      return;
    }
    setCode("");
    setStage({ kind: "open" });
  };

  if (stage.kind === "open") return <>{children}</>;

  if (stage.kind === "not-found") {
    // Same answer as any unknown page: nothing tells a stranger /admin exists.
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6 text-slate-800">
        <div className="flex items-center gap-5">
          <h1 className="border-r border-slate-300 pr-5 text-2xl font-semibold">404</h1>
          <p className="text-sm">This page could not be found.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-console liquid-bg flex min-h-screen items-center justify-center px-4 py-10 text-white">
      <section className="glass-panel w-full max-w-md p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <BrandMark compact />
          <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-300">SydIN admin</p>
        </div>

        {stage.kind === "checking" && <p className="mt-6 text-sm text-slate-300">Checking your access…</p>}

        {stage.kind === "signed-out" && (
          <>
            <h1 className="mt-5 text-2xl font-black">Sign in first</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">Sign in with your SydIN admin account, then come back here.</p>
            <Link href="/login" className="glass-button mt-6 flex min-h-12 items-center justify-center rounded-2xl text-sm">
              Go to sign in
            </Link>
          </>
        )}

        {stage.kind === "enroll" && (
          <>
            <h1 className="mt-5 text-2xl font-black">Protect the admin area</h1>
            <ol className="mt-3 grid gap-2 text-sm leading-6 text-slate-300">
              <li>1. Install Google Authenticator or Microsoft Authenticator on your phone.</li>
              <li>2. In the app, tap + and scan this code.</li>
              <li>3. Type the 6-digit code the app shows.</li>
            </ol>
            <div className="mt-5 flex justify-center rounded-2xl bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- Supabase returns the QR as an SVG data URL */}
              <img src={stage.qr} alt="QR code for your authenticator app" className="h-48 w-48" />
            </div>
            <p className="mt-3 text-center text-xs text-slate-400">
              Can&apos;t scan? Enter this key in the app: <span className="font-mono text-slate-200">{stage.secret}</span>
            </p>
          </>
        )}

        {stage.kind === "verify" && (
          <>
            <h1 className="mt-5 text-2xl font-black">Enter your code</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Open your authenticator app and type the 6-digit code for SydIN.
            </p>
          </>
        )}

        {(stage.kind === "enroll" || stage.kind === "verify") && stage.factorId && (
          <form
            className="mt-5 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submitCode(stage.factorId);
            }}
          >
            <input
              className="glass-input min-h-14 text-center font-mono text-2xl tracking-[0.5em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              aria-label="6-digit code"
              autoFocus
            />
            <button type="submit" className="glass-button min-h-12 rounded-2xl text-sm" disabled={busy || code.length !== 6}>
              {busy ? "Checking…" : stage.kind === "enroll" ? "Turn on and open admin" : "Open admin"}
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-rose-500/15 px-4 py-3 text-sm font-semibold text-rose-200">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
