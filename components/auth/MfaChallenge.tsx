"use client";

import { useState } from "react";
import BrandMark from "@/components/BrandMark";
import CodeInput from "@/components/auth/CodeInput";
import UiIcon from "@/components/UiIcon";
import { supabase } from "@/app/lib/supabase";

/* "Enter your app code" -- shown after sign-in when the account has two-step
   verification on (Settings > My profile). The database only serves this
   account's data once the code is entered (sql/phase-35), so this screen is
   the friendly half of a real lock, not decoration. Works for password,
   Google and Microsoft sign-ins alike: all of them land here first. */
export default function MfaChallenge({ onVerified }: { onVerified: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (code.length !== 6 || busy) return;
    setBusy(true);
    setError("");
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp?.find((entry) => entry.status === "verified");
    if (!factor) {
      setBusy(false);
      onVerified();
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    setBusy(false);
    if (verifyError) {
      setCode("");
      setError("That code didn't work. Codes change every 30 seconds; enter the current one.");
      return;
    }
    onVerified();
  };

  return (
    <div className="mfa-gate">
      <form className="mfa-card" onSubmit={submit}>
        <BrandMark className="mfa-mark" />
        <span className="mfa-badge" aria-hidden="true">
          <UiIcon name="shield" className="h-5 w-5" />
        </span>
        <h1>Two-step verification</h1>
        <p>Open your authenticator app and enter the 6-digit code for SydIN.</p>
        <label htmlFor="mfa-code-0" className="sr-only">
          Authenticator code
        </label>
        <CodeInput
          idPrefix="mfa-code"
          value={code}
          onChange={(value) => {
            setCode(value);
            if (error) setError("");
          }}
          disabled={busy}
          invalid={Boolean(error)}
          autoFocus
        />
        {error && (
          <p role="alert" className="mfa-error">
            {error}
          </p>
        )}
        <button type="submit" className="login-submit" disabled={code.length !== 6 || busy} aria-busy={busy}>
          {busy ? "Checking…" : "Continue"}
        </button>
        <button
          type="button"
          className="mfa-signout"
          onClick={async () => {
            await supabase.auth.signOut().catch(() => undefined);
            window.location.href = "/login";
          }}
        >
          Sign out
        </button>
        <p className="mfa-help">
          Lost your phone? Contact SydIN support on WhatsApp at +961 76 075 247.
        </p>
      </form>
    </div>
  );
}
