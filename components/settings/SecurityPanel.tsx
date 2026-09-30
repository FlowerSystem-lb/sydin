"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, DialogShell, useToast } from "@/components/ui";
import UiIcon from "@/components/UiIcon";
import { supabase } from "@/app/lib/supabase";

/* Settings > My profile > security and notifications (30 Sep 2026).
 *
 *  - Two-step verification: an authenticator-app code at every sign-in. Once
 *    on, the database only serves this account's data to a session that
 *    entered the code (sql/phase-35), so a stolen password alone is useless.
 *  - Sign out of all devices: ends every session everywhere (lost phone, a
 *    worker who left). Sessions already open expire within the hour.
 *  (Email notifications moved to their own section: NotificationsPanel.)
 * All confirmations are page dialogs, never window.confirm. */

type Factor = { id: string; created_at?: string };

export default function SecurityPanel() {
  const { showToast } = useToast();
  const [factor, setFactor] = useState<Factor | null | undefined>(undefined);
  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [turningOff, setTurningOff] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  const loadFactor = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    const verified = data?.totp?.find((entry) => entry.status === "verified");
    setFactor(verified ? { id: verified.id, created_at: verified.created_at } : null);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one read on mount; state set after await
    void loadFactor();
  }, [loadFactor]);

  const startEnroll = async () => {
    setBusy(true);
    const { data: factors } = await supabase.auth.mfa.listFactors();
    for (const entry of factors?.all ?? []) {
      if (entry.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: entry.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `SydIN ${new Date().toISOString().slice(0, 10)}`,
    });
    setBusy(false);
    if (error || !data) {
      showToast({ tone: "danger", message: "Couldn't start the setup. Please try again." });
      return;
    }
    setCode("");
    setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const finishEnroll = async () => {
    if (!enrolling || code.length !== 6) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolling.id, code });
    setBusy(false);
    if (error) {
      setCode("");
      showToast({ tone: "danger", message: "That code didn't work. Enter the current one from the app." });
      return;
    }
    setEnrolling(null);
    setCode("");
    await loadFactor();
    showToast({ tone: "success", message: "Two-step verification is on. SydIN will ask for the code when you sign in." });
  };

  const turnOff = async () => {
    if (!factor || code.length !== 6) return;
    setBusy(true);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (verifyError) {
      setBusy(false);
      setCode("");
      showToast({ tone: "danger", message: "That code didn't work. Enter the current one from the app." });
      return;
    }
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    setBusy(false);
    if (error) {
      showToast({ tone: "danger", message: "Couldn't turn it off. Please try again." });
      return;
    }
    setTurningOff(false);
    setCode("");
    await loadFactor();
    showToast({ tone: "success", message: "Two-step verification is off." });
  };

  const signOutEverywhere = async () => {
    setBusy(true);
    await supabase.auth.signOut({ scope: "global" }).catch(() => undefined);
    window.location.href = "/login";
  };

  return (
    <>
      <div className="st-row">
        <div className="st-row-label" title="A code from an app on your phone at every sign-in.">
          <span>Two-step verification</span>
        </div>
        <div className="st-row-control">
          {factor === undefined ? (
            <span className="st-hint">Checking…</span>
          ) : enrolling ? (
            <div className="st-twostep">
              <ol className="st-twostep-steps">
                <li>Install Google Authenticator or Microsoft Authenticator on your phone.</li>
                <li>In the app, tap + and scan this code.</li>
                <li>Type the 6-digit code the app shows.</li>
              </ol>
              <div className="st-twostep-qr">
                {/* eslint-disable-next-line @next/next/no-img-element -- Supabase returns the QR as an SVG data URL */}
                <img src={enrolling.qr} alt="QR code for your authenticator app" />
              </div>
              <p className="st-hint">
                Can&apos;t scan? Enter this key in the app: <span className="st-mono">{enrolling.secret}</span>
              </p>
              <div className="st-inline">
                <input
                  className="st-input st-code-input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="6-digit code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  aria-label="Code from the app"
                />
                <Button size="sm" loading={busy} loadingLabel="Checking…" disabled={code.length !== 6} onClick={() => void finishEnroll()}>
                  Turn on
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setEnrolling(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : factor ? (
            <div className="st-inline">
              <span className="st-pill st-pill-green">On</span>
              <span className="st-hint">SydIN asks for your app code at every sign-in.</span>
              <Button variant="secondary" size="sm" onClick={() => { setCode(""); setTurningOff(true); }}>
                Turn off
              </Button>
            </div>
          ) : (
            <div className="st-inline">
              <span className="st-pill st-pill-grey">Off</span>
              <span className="st-hint">Protect your account with a code from your phone.</span>
              <Button size="sm" loading={busy} loadingLabel="Starting…" onClick={() => void startEnroll()}>
                Turn on
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="st-row">
        <div className="st-row-label" title="Ends every session on every phone and computer.">
          <span>Signed-in devices</span>
        </div>
        <div className="st-row-control">
          <div className="st-inline">
            <Button variant="secondary" size="sm" onClick={() => setSigningOutAll(true)}>
              <UiIcon name="logout" className="h-4 w-4" />
              Sign out of all devices
            </Button>
          </div>
        </div>
      </div>

      <DialogShell
        open={turningOff}
        tone="danger"
        eyebrow="Two-step verification"
        title="Turn off two-step verification?"
        description="Enter the current code from your authenticator app to confirm. After this, a password alone signs in."
        onClose={() => setTurningOff(false)}
        closeDisabled={busy}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTurningOff(false)} disabled={busy}>
              Keep it on
            </Button>
            <Button variant="danger" onClick={() => void turnOff()} loading={busy} loadingLabel="Turning off…" disabled={code.length !== 6}>
              Turn off
            </Button>
          </>
        }
      >
        <input
          className="st-input st-code-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="6-digit code"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          aria-label="Code from the app"
          autoFocus
        />
      </DialogShell>

      <DialogShell
        open={signingOutAll}
        eyebrow="Signed-in devices"
        title="Sign out of all devices?"
        description="Every phone and computer signed in to this account is signed out, including this one. Use it if a device is lost or someone should no longer have access."
        onClose={() => setSigningOutAll(false)}
        closeDisabled={busy}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSigningOutAll(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void signOutEverywhere()} loading={busy} loadingLabel="Signing out…">
              Sign out everywhere
            </Button>
          </>
        }
      />
    </>
  );
}
